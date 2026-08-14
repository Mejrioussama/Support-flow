package com.supportflow.controller;

import com.supportflow.dto.AgentRecommendationDTO;
import com.supportflow.dto.TicketAssignmentPreviewRequestDTO;
import com.supportflow.entity.*;
import com.supportflow.repository.*;
import com.supportflow.security.AuthorizationHelper;
import com.supportflow.service.AICopilotService;
import com.supportflow.service.TicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Proxy REST vers le microservice Python AI Agent.
 * Enrichit les requêtes avec les données de la BDD avant de les envoyer au LLM.
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "AI Assistant", description = "Assistant IA pour agents et managers (Python + Ollama)")
public class AIAssistantController {

    @Value("${AI_AGENT_URL:http://localhost:8000}")
    private String aiAgentUrl;

    @Value("${supportflow.ai.assignment-timeout-seconds:15}")
    private int assignmentTimeoutSeconds;

    private final TicketRepository ticketRepository;
    private final KnowledgeArticleRepository kbRepository;
    private final EscalationEventRepository escalationEventRepository;
    private final AuthorizationHelper authHelper;
    private final TicketService ticketService;
    private final AICopilotService aiCopilotService;
    private final ObjectMapper objectMapper;

    private RestTemplate restTemplate;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /**
     * Matches the "what needs my attention right now?" family of questions, which is answered
     * straight from the database rather than by the LLM. Deliberately narrow: a question that
     * does not clearly ask for the urgent/at-risk worklist falls through to the model, so a
     * miss here costs latency, never a wrong answer.
     */
    private static final java.util.regex.Pattern ATTENTION_QUESTION = java.util.regex.Pattern.compile(
        "(?i)(ticket|dossier)s?.{0,40}(urgent|attention|critique|prioritaire|en retard|sla)"
        + "|(urgent|attention|critique|prioritaire|en retard|sla).{0,40}(ticket|dossier)s?");

    @PostConstruct
    public void init() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(300));
        this.restTemplate = new RestTemplate(factory);
        log.info("AIAssistantController initialized, AI Agent URL: {}", aiAgentUrl);
    }

    // ─── Status ──────────────────────────────────────────────────────────────

    @GetMapping("/status")
    @Operation(summary = "Statut de l'AI Agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> getStatus() {
        try {
            ResponseEntity<Map> resp = restTemplate.getForEntity(aiAgentUrl + "/health", Map.class);
            return ResponseEntity.ok(resp.getBody());
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                "status", "down",
                "ollama_available", false,
                "error", e.getMessage()
            ));
        }
    }

    // ─── Analyze Ticket ──────────────────────────────────────────────────────

    @GetMapping("/analyze/{ticketId}")
    @Operation(summary = "Analyser un ticket (classification IA)")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> analyzeTicket(@PathVariable Long ticketId, @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canStaffAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Ticket ticket = findTicket(ticketId);
        Map<String, Object> body = buildTicketPayload(ticket);
        return forwardPost("/analyze", body);
    }

    // ─── Suggest Response ────────────────────────────────────────────────────

    @GetMapping("/suggest-response/{ticketId}")
    @Operation(summary = "Suggérer une réponse pour le client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> suggestResponse(@PathVariable Long ticketId, @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canStaffAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Ticket ticket = findTicket(ticketId);

        // Chercher des articles KB similaires
        List<Map<String, String>> kbArticles = new ArrayList<>();
        try {
            var articles = kbRepository.searchArticles(
                ticket.getTitle(),
                org.springframework.data.domain.PageRequest.of(0, 3)
            ).getContent();
            for (var a : articles) {
                kbArticles.add(Map.of(
                    "title", a.getTitle(),
                    "summary", a.getSummary() != null ? a.getSummary() : "",
                    "content", a.getContent() != null ? a.getContent().substring(0, Math.min(300, a.getContent().length())) : ""
                ));
            }
        } catch (Exception e) {
            log.debug("Pas d'articles KB: {}", e.getMessage());
        }

        Map<String, Object> body = Map.of(
            "ticket", buildTicketPayload(ticket),
            "kb_articles", kbArticles
        );
        return forwardPost("/suggest-response", body);
    }

    @GetMapping("/copilot/{ticketId}")
    @Operation(summary = "Copilot IA contextualise pour un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> copilot(@PathVariable Long ticketId, @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canStaffAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Ticket ticket = findTicket(ticketId);

        // Cache lookup happens only after the access check above, so a cache hit can never
        // hand a briefing to someone who is not allowed to see the ticket. The key carries
        // updatedAt, so editing the ticket naturally misses the cache and regenerates. The
        // background precompute triggered from TicketService (see AICopilotService) usually
        // already warmed this entry by the time an agent gets here.
        Map<String, Object> cached = aiCopilotService.getCached(ticket);
        if (cached != null) {
            log.debug("Copilot cache hit for ticket {}", ticketId);
            return ResponseEntity.ok(cached);
        }

        Map<String, Object> result = aiCopilotService.generateAndCache(ticket);
        return result != null
            ? ResponseEntity.ok(result)
            : ResponseEntity.status(502).body(Map.of("error", "AI Agent indisponible", "path", "/copilot"));
    }

    // ─── Diagnose ────────────────────────────────────────────────────────────

    @GetMapping("/diagnose/{ticketId}")
    @Operation(summary = "Diagnostic technique automatique")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> diagnoseTicket(@PathVariable Long ticketId, @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canStaffAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Ticket ticket = findTicket(ticketId);
        return forwardPost("/diagnose", buildTicketPayload(ticket));
    }

    // ─── Escalation Summary (Manager) ────────────────────────────────────────

    @GetMapping("/escalation-summary/{ticketId}")
    @Operation(summary = "Résumé d'escalade pour le manager")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map> summarizeEscalation(@PathVariable Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        List<EscalationEvent> events = escalationEventRepository.findByTicketIdOrderByCreatedAtDesc(ticketId);

        List<Map<String, Object>> eventList = events.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("from_level", e.getFromLevel());
            m.put("to_level", e.getToLevel());
            m.put("reason", e.getReason() != null ? e.getReason().name() : "UNKNOWN");
            m.put("triggered_by", e.getTriggeredBy() != null ? e.getTriggeredBy().name() : "SYSTEM");
            m.put("from_agent", e.getFromAgent() != null ? e.getFromAgent().getFirstName() + " " + e.getFromAgent().getLastName() : "");
            m.put("to_agent", e.getToAgent() != null ? e.getToAgent().getFirstName() + " " + e.getToAgent().getLastName() : "");
            m.put("was_blocked", e.getWasBlocked() != null && e.getWasBlocked());
            m.put("timestamp", e.getCreatedAt() != null ? e.getCreatedAt().format(FMT) : "");
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> body = Map.of(
            "ticket", buildTicketPayload(ticket),
            "events", eventList
        );
        return forwardPost("/escalation-summary", body);
    }

    @GetMapping("/assignment-recommendation/{ticketId}")
    @Operation(summary = "Recommandation hybride d'assignation pour validation manager")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map<String, Object>> assignmentRecommendation(@PathVariable Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        List<AgentRecommendationDTO> candidates = ticketService.getRecommendedAgents(ticketId).stream()
            .limit(5)
            .toList();

        if (candidates.isEmpty()) {
            return ResponseEntity.ok(buildAssignmentFallback(ticket.getId(), ticket.getReference(), candidates,
                "Aucun agent disponible pour une recommandation automatique."));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ticket", buildTicketPayload(ticket));
        body.put("candidates", candidates.stream().map(this::buildAssignmentCandidatePayload).toList());

        ResponseEntity<Map> aiResponse = forwardPost("/assignment-recommendation", body, Duration.ofSeconds(assignmentTimeoutSeconds));
        if (aiResponse.getStatusCode().is2xxSuccessful() && aiResponse.getBody() != null) {
            Map<String, Object> response = new LinkedHashMap<>(aiResponse.getBody());
            response.put("candidates", candidates);
            response.putIfAbsent("ticket_id", ticket.getId());
            response.putIfAbsent("ticket_reference", ticket.getReference());
            response.putIfAbsent("manager_validation_required", true);
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.ok(buildAssignmentFallback(ticket.getId(), ticket.getReference(), candidates,
            "Agent IA indisponible, fallback sur le scoring compétences + charge."));
    }

    @PostMapping("/assignment-recommendation-preview")
    @Operation(summary = "Prévisualiser une recommandation hybride d'assignation pour un brouillon")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map<String, Object>> assignmentRecommendationPreview(
            @RequestBody TicketAssignmentPreviewRequestDTO request) {
        List<AgentRecommendationDTO> candidates = ticketService.getRecommendedAgentsForDraft(
            request.getCategory(), request.getType(), request.getTitle(), request.getDescription())
            .stream()
            .limit(5)
            .toList();

        Long draftId = request.getTicketId() != null ? request.getTicketId() : 0L;
        String draftReference = request.getReference() != null && !request.getReference().isBlank()
            ? request.getReference()
            : "BROUILLON";

        if (candidates.isEmpty()) {
            return ResponseEntity.ok(buildAssignmentFallback(draftId, draftReference, candidates,
                "Aucun agent disponible pour une recommandation automatique."));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ticket", buildTicketPreviewPayload(request));
        body.put("candidates", candidates.stream().map(this::buildAssignmentCandidatePayload).toList());

        ResponseEntity<Map> aiResponse = forwardPost("/assignment-recommendation", body, Duration.ofSeconds(assignmentTimeoutSeconds));
        if (aiResponse.getStatusCode().is2xxSuccessful() && aiResponse.getBody() != null) {
            Map<String, Object> response = new LinkedHashMap<>(aiResponse.getBody());
            response.put("candidates", candidates);
            response.putIfAbsent("ticket_id", draftId);
            response.putIfAbsent("ticket_reference", draftReference);
            response.putIfAbsent("manager_validation_required", true);
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.ok(buildAssignmentFallback(draftId, draftReference, candidates,
            "Agent IA indisponible, fallback sur le scoring compétences + charge."));
    }

    // ─── Trends (Manager) ────────────────────────────────────────────────────

    @GetMapping("/trends")
    @Operation(summary = "Analyse de tendances IA")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map> analyzeTrends(@RequestParam(defaultValue = "30") int days) {
        var since = java.time.LocalDateTime.now().minusDays(days);
        List<Ticket> recent = ticketRepository.findAll().stream()
            .filter(t -> t.getCreatedAt() != null && t.getCreatedAt().isAfter(since))
            .toList();

        long total = recent.size();
        long breached = recent.stream().filter(t -> Boolean.TRUE.equals(t.getSlaBreached())).count();
        long escalated = recent.stream().filter(t -> t.getEscalationLevel() != null && t.getEscalationLevel() > 0).count();
        long resolved = recent.stream()
            .filter(t -> "RESOLVED".equals(t.getStatus().name()) || "CLOSED".equals(t.getStatus().name())).count();

        Map<String, Long> bySev = recent.stream()
            .collect(Collectors.groupingBy(t -> t.getSeverity().name(), Collectors.counting()));
        Map<String, Long> byCat = recent.stream()
            .filter(t -> t.getCategory() != null)
            .collect(Collectors.groupingBy(Ticket::getCategory, Collectors.counting()));

        double avgRes = recent.stream()
            .filter(t -> t.getResolutionTimeMinutes() != null && t.getResolutionTimeMinutes() > 0)
            .mapToLong(Ticket::getResolutionTimeMinutes)
            .average().orElse(0);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("period_days", days);
        body.put("total_tickets", total);
        body.put("resolved", resolved);
        body.put("sla_breached", breached);
        body.put("escalated", escalated);
        body.put("by_severity", bySev);
        body.put("by_category", byCat);
        body.put("avg_resolution_minutes", avgRes);
        body.put("satisfaction_avg", 0);
        body.put("escalation_by_reason", Map.of());

        return forwardPost("/trends", body);
    }

    // ─── Chat ────────────────────────────────────────────────────────────────

    @PostMapping("/chat")
    @Operation(summary = "Chat libre avec l'IA")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> chat(@RequestBody Map<String, Object> requestBody,
                                    @AuthenticationPrincipal Jwt jwt) {
        String message = requestBody.get("message").toString();
        Long ticketId = requestBody.containsKey("ticketId") && requestBody.get("ticketId") != null
            ? Long.valueOf(requestBody.get("ticketId").toString()) : null;

        // "Which tickets need attention?" is a database question, not a language question.
        // Answering it from SQL is instant and always accurate, where the LLM took ~30s on
        // CPU-only inference and could invent ticket references. Anything not matching a
        // known factual pattern still falls through to the model below.
        if (ticketId == null && ATTENTION_QUESTION.matcher(message).find()) {
            return ResponseEntity.ok(answerTicketsNeedingAttention(jwt, message));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);

        if (ticketId != null) {
            try {
                Ticket ticket = findTicket(ticketId);
                body.put("ticket", buildTicketPayload(ticket));
            } catch (Exception e) {
                log.debug("Ticket {} non trouvé pour contexte chat", ticketId);
            }
        }

        List<Map<String, String>> history = new ArrayList<>();
        if (requestBody.containsKey("history") && requestBody.get("history") instanceof List) {
            history = (List<Map<String, String>>) requestBody.get("history");
        }
        body.put("history", history);

        return forwardPost("/chat", body);
    }

    /**
     * Builds the urgent-worklist answer from live ticket data. Agents only ever see their own
     * assigned tickets here; managers and admins see the whole backlog, matching the scoping
     * the rest of the application already applies.
     */
    private Map<String, Object> answerTicketsNeedingAttention(Jwt jwt, String question) {
        Long scopeAgentId = authHelper.isManagerOrAdmin(jwt) ? null : authHelper.getUserId(jwt);
        List<Ticket> tickets = ticketRepository.findTicketsNeedingAttention(
            scopeAgentId, org.springframework.data.domain.PageRequest.of(0, 10));

        String answer;
        if (tickets.isEmpty()) {
            answer = scopeAgentId == null
                ? "Aucun ticket ne demande une attention immediate : aucun SLA depasse et aucun ticket critique ouvert."
                : "Aucun de vos tickets ne demande une attention immediate.";
        } else {
            StringBuilder sb = new StringBuilder();
            sb.append(tickets.size() == 1 ? "1 ticket demande votre attention :\n"
                                          : tickets.size() + " tickets demandent votre attention :\n");
            for (Ticket t : tickets) {
                sb.append("\n- ").append(t.getReference()).append(" — ").append(t.getTitle())
                  .append("\n  Priorite ").append(t.getPriority())
                  .append(" · Statut ").append(t.getStatus())
                  .append(Boolean.TRUE.equals(t.getSlaBreached()) ? " · SLA DEPASSE" : "")
                  .append(t.getSlaDeadline() != null ? " · Echeance " + t.getSlaDeadline().format(FMT) : "")
                  .append("\n");
            }
            answer = sb.toString();
        }

        // Same response shape the Python agent uses for its own static-knowledge shortcut
        // (model "supportflow-facts"), so the frontend renders both identically.
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("question", question);
        response.put("answer", answer);
        response.put("ticket_context", null);
        response.put("model", "supportflow-data");
        response.put("duration_s", 0.0);
        response.put("responded_at", java.time.LocalDateTime.now().toString());
        return response;
    }

    /**
     * Server-Sent Events variant of {@link #chat}. Generation dominates chat latency on
     * CPU-only inference while prompt evaluation is under a second, so streaming puts the
     * first words on screen in ~0.25s instead of leaving the user on a spinner for the whole
     * answer. Authorization, per-user scoping and the instant database path are identical to
     * the buffered endpoint - only the transport differs.
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Chat IA en streaming (SSE)")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<StreamingResponseBody> chatStream(@RequestBody Map<String, Object> requestBody,
                                                            @AuthenticationPrincipal Jwt jwt) {
        String message = requestBody.get("message").toString();
        Long ticketId = requestBody.containsKey("ticketId") && requestBody.get("ticketId") != null
            ? Long.valueOf(requestBody.get("ticketId").toString()) : null;

        // Factual questions are answered from SQL here too: already instant, so they are
        // emitted as a single frame rather than routed through the model.
        if (ticketId == null && ATTENTION_QUESTION.matcher(message).find()) {
            Map<String, Object> answer = answerTicketsNeedingAttention(jwt, message);
            StreamingResponseBody body = out -> {
                writeSse(out, "token", Map.of("content", answer.get("answer")));
                writeSse(out, "done", answer);
                out.flush();
            };
            return ResponseEntity.ok().contentType(MediaType.TEXT_EVENT_STREAM).body(body);
        }

        Map<String, Object> upstreamBody = new LinkedHashMap<>();
        upstreamBody.put("message", message);
        if (ticketId != null) {
            try {
                upstreamBody.put("ticket", buildTicketPayload(findTicket(ticketId)));
            } catch (Exception e) {
                log.debug("Ticket {} non trouve pour contexte chat stream", ticketId);
            }
        }
        upstreamBody.put("history", requestBody.get("history") instanceof List
            ? requestBody.get("history") : new ArrayList<>());

        StreamingResponseBody body = out -> relayStream("/chat/stream", upstreamBody, out);
        return ResponseEntity.ok().contentType(MediaType.TEXT_EVENT_STREAM).body(body);
    }

    /** Copies the AI agent's SSE stream through to the caller as it arrives. */
    private void relayStream(String path, Object requestBody, java.io.OutputStream out) {
        try {
            // Pinned to HTTP/1.1: the JDK client defaults to HTTP/2 and attempts an h2c
            // upgrade, which uvicorn does not serve - the handshake ends up dropping the
            // request body and the agent rejects the call as having no payload.
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(aiAgentUrl + path))
                .timeout(Duration.ofSeconds(300))
                .header("Content-Type", "application/json")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                .build();

            var response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofInputStream());
            try (var in = response.body()) {
                byte[] buffer = new byte[512];
                int read;
                // Flush on every chunk: buffering here would defeat the whole point by
                // delivering the stream as one blob at the end.
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    out.flush();
                }
            }
        } catch (Exception e) {
            log.error("AI Agent stream failed [{}]: {}", path, e.getMessage());
            try {
                writeSse(out, "error", Map.of("detail", "AI Agent indisponible"));
                out.flush();
            } catch (Exception ignored) {
                log.debug("Client deconnecte avant l'envoi de l'erreur de streaming");
            }
        }
    }

    /** Writes one SSE frame; the trailing blank line is what terminates it for the browser. */
    private void writeSse(java.io.OutputStream out, String event, Object data) throws java.io.IOException {
        String frame = "event: " + event + "\ndata: " + objectMapper.writeValueAsString(data) + "\n\n";
        out.write(frame.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    // ─── Generate KB Article ─────────────────────────────────────────────────

    @GetMapping("/generate-kb/{ticketId}")
    @Operation(summary = "Générer un article KB depuis un ticket résolu")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Map> generateKbArticle(@PathVariable Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        return forwardPost("/generate-kb-article", buildTicketPayload(ticket));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Ticket findTicket(Long id) {
        return ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket non trouvé: " + id));
    }

    private Map<String, Object> buildTicketPayload(Ticket t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("reference", t.getReference() != null ? t.getReference() : "");
        m.put("title", t.getTitle());
        m.put("description", t.getDescription() != null ? t.getDescription() : "");
        m.put("type", t.getType() != null ? t.getType().name() : "");
        m.put("status", t.getStatus() != null ? t.getStatus().name() : "");
        m.put("severity", t.getSeverity() != null ? t.getSeverity().name() : "");
        m.put("impact", t.getImpact() != null ? t.getImpact().name() : "");
        m.put("category", t.getCategory() != null ? t.getCategory() : "");
        m.put("normalized_category", t.getNormalizedCategory() != null ? t.getNormalizedCategory().getCode() : "");
        m.put("escalation_level", t.getEscalationLevel() != null ? t.getEscalationLevel() : 0);
        m.put("escalation_count", t.getEscalationCount() != null ? t.getEscalationCount() : 0);
        m.put("sla_breached", Boolean.TRUE.equals(t.getSlaBreached()));
        m.put("assigned_agent", t.getAssignedAgent() != null
            ? t.getAssignedAgent().getFirstName() + " " + t.getAssignedAgent().getLastName() : "");
        m.put("created_at", t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : "");
        m.put("resolution_summary", t.getResolutionSummary() != null ? t.getResolutionSummary() : "");

        // Commentaires récents
        List<String> comments = new ArrayList<>();
        if (t.getComments() != null) {
            for (var c : t.getComments().stream().limit(10).toList()) {
                String name = c.getAuthor() != null ? c.getAuthor().getFirstName() : "?";
                comments.add(String.format("[%s] %s: %s",
                    c.getCreatedAt() != null ? c.getCreatedAt().format(FMT) : "?",
                    name, c.getContent()));
            }
        }
        m.put("comments", comments);
        return m;
    }

    private Map<String, Object> buildTicketPreviewPayload(TicketAssignmentPreviewRequestDTO request) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", request.getTicketId() != null ? request.getTicketId() : 0);
        m.put("reference", request.getReference() != null && !request.getReference().isBlank() ? request.getReference() : "BROUILLON");
        m.put("title", request.getTitle() != null ? request.getTitle() : "");
        m.put("description", request.getDescription() != null ? request.getDescription() : "");
        m.put("type", request.getType() != null ? request.getType() : "");
        m.put("status", request.getTicketId() != null ? "DRAFT_UPDATE" : "DRAFT_CREATE");
        m.put("severity", request.getSeverity() != null ? request.getSeverity() : "");
        m.put("impact", request.getImpact() != null ? request.getImpact() : "");
        m.put("category", request.getCategory() != null ? request.getCategory() : "");
        m.put("escalation_level", 0);
        m.put("escalation_count", 0);
        m.put("sla_breached", false);
        m.put("assigned_agent", "");
        m.put("created_at", "");
        m.put("resolution_summary", "");
        m.put("comments", List.of());
        return m;
    }

    private Map<String, Object> buildAssignmentCandidatePayload(AgentRecommendationDTO candidate) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", candidate.getId());
        m.put("username", candidate.getUsername() != null ? candidate.getUsername() : "");
        m.put("full_name", candidate.getFullName() != null ? candidate.getFullName() : "");
        m.put("active_tickets", candidate.getActiveTickets());
        m.put("sla_compliance_rate", candidate.getSlaComplianceRate());
        m.put("expertise_score", candidate.getExpertiseScore());
        m.put("recommendation_score", candidate.getRecommendationScore());
        m.put("normalized_category", candidate.getNormalizedCategory() != null ? candidate.getNormalizedCategory() : "");
        m.put("skill_match_type", candidate.getSkillMatchType() != null ? candidate.getSkillMatchType().name() : "");
        m.put("primary_skill_match", Boolean.TRUE.equals(candidate.getPrimarySkillMatch()));
        m.put("secondary_skill_match", Boolean.TRUE.equals(candidate.getSecondarySkillMatch()));
        m.put("primary_skill_code", candidate.getPrimarySkillCode() != null ? candidate.getPrimarySkillCode() : "");
        m.put("secondary_skill_code", candidate.getSecondarySkillCode() != null ? candidate.getSecondarySkillCode() : "");
        m.put("recommendation_reason", candidate.getRecommendationReason() != null ? candidate.getRecommendationReason() : "");
        return m;
    }

    private Map<String, Object> buildAssignmentFallback(Long ticketId, String ticketReference, List<AgentRecommendationDTO> candidates, String reason) {
        Map<String, Object> response = new LinkedHashMap<>();
        AgentRecommendationDTO topCandidate = candidates.isEmpty() ? null : candidates.get(0);

        response.put("ticket_id", ticketId);
        response.put("ticket_reference", ticketReference);
        response.put("recommended_agent_id", topCandidate != null ? topCandidate.getId() : null);
        response.put("recommended_agent_name", topCandidate != null ? topCandidate.getFullName() : "Aucun agent");
        response.put("confidence", topCandidate != null ? "MOYENNE" : "FAIBLE");
        response.put("skill_match", topCandidate != null ? topCandidate.getRecommendationReason() : reason);
        response.put("rationale", topCandidate != null
            ? "Recommandation calculée à partir du match compétence, de la charge active et du respect SLA."
            : reason);
        response.put("manager_validation_note", "Le manager doit valider ou remplacer cette proposition avant l'assignation finale.");
        response.put("fallback_used", true);
        response.put("manager_validation_required", true);
        response.put("model", "rules-fallback");
        response.put("duration_s", 0.0);
        response.put("generated_at", java.time.LocalDateTime.now().toString());
        response.put("candidates", candidates);
        return response;
    }

    private ResponseEntity<Map> forwardPost(String path, Object body) {
        return forwardPost(path, body, Duration.ofSeconds(300));
    }

    private ResponseEntity<Map> forwardPost(String path, Object body, Duration readTimeout) {
        try {
            var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(5));
            factory.setReadTimeout(readTimeout);
            RestTemplate requestTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> resp = requestTemplate.postForEntity(aiAgentUrl + path, entity, Map.class);
            return ResponseEntity.ok(resp.getBody());
        } catch (Exception e) {
            log.error("AI Agent call failed [{}]: {}", path, e.getMessage());
            return ResponseEntity.status(502).body(Map.of(
                "error", "AI Agent indisponible",
                "detail", e.getMessage(),
                "path", path
            ));
        }
    }
}
