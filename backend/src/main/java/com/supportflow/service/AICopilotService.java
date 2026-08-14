package com.supportflow.service;

import com.supportflow.config.CacheConfig;
import com.supportflow.entity.Ticket;
import com.supportflow.repository.KnowledgeArticleRepository;
import com.supportflow.repository.TicketRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Produces AI copilot briefings for tickets and writes them to the shared cache
 * (see {@link CacheConfig#AI_COPILOT_CACHE}). Used both synchronously by
 * AIAssistantController on a cache miss, and asynchronously right after ticket
 * creation/update so the briefing is usually already warm by the time an agent
 * opens the ticket — turning a ~30s wait on CPU-only inference into an instant
 * cache hit for the common case.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AICopilotService {

    @Value("${AI_AGENT_URL:http://localhost:8000}")
    private String aiAgentUrl;

    private final KnowledgeArticleRepository kbRepository;
    private final TicketRepository ticketRepository;
    private final CacheManager cacheManager;

    private RestTemplate restTemplate;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @PostConstruct
    void init() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(300));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * The cache key is derived from the fields that actually go into the AI prompt, not from
     * updatedAt. A raw updatedAt-based key looked simpler but broke precompute in practice: the
     * Camunda workflow sync re-saves the ticket a few seconds after creation (to store the
     * process instance id), bumping updatedAt and version without touching anything the AI
     * sees. That metadata-only save silently invalidated the precomputed entry before an agent
     * ever got to use it. Keying on the payload content itself means only a change that could
     * actually change the AI's answer invalidates the cache.
     */
    private String cacheKey(Map<String, Object> payload) {
        return payload.get("id") + "|" + payload.get("title") + "|" + payload.get("description") + "|"
            + payload.get("type") + "|" + payload.get("status") + "|" + payload.get("severity") + "|"
            + payload.get("impact") + "|" + payload.get("category") + "|" + payload.get("escalation_level") + "|"
            + payload.get("escalation_count") + "|" + payload.get("sla_breached") + "|"
            + payload.get("assigned_agent") + "|" + payload.get("resolution_summary") + "|"
            + payload.get("comments");
    }

    /** Returns the cached briefing for this ticket's current content, or null on a miss. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getCached(Ticket ticket) {
        Cache cache = cacheManager.getCache(CacheConfig.AI_COPILOT_CACHE);
        return cache != null ? cache.get(cacheKey(buildTicketPayload(ticket)), Map.class) : null;
    }

    /** Calls the AI agent and caches a fresh briefing for this ticket. Never throws. */
    public Map<String, Object> generateAndCache(Ticket ticket) {
        try {
            Map<String, Object> ticketPayload = buildTicketPayload(ticket);
            Map<String, Object> body = Map.of(
                "ticket", ticketPayload,
                "kb_articles", findRelevantKbArticles(ticket)
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Map> resp = restTemplate.postForEntity(
                aiAgentUrl + "/copilot", new HttpEntity<>(body, headers), Map.class);

            @SuppressWarnings("unchecked")
            Map<String, Object> result = resp.getBody();
            if (result != null) {
                Cache cache = cacheManager.getCache(CacheConfig.AI_COPILOT_CACHE);
                if (cache != null) {
                    cache.put(cacheKey(ticketPayload), result);
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Generation copilot echouee pour ticket {}: {}", ticket.getReference(), e.getMessage());
            return null;
        }
    }

    /**
     * Fire-and-forget precompute, triggered right after a ticket is created or edited so the
     * briefing is usually already warm by the time an agent opens the ticket. Reloads the
     * ticket by id in its own transaction rather than receiving the entity directly, because
     * the caller's persistence context is gone by the time this runs on a separate thread
     * (mirrors the pattern in CamundaAsyncService).
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void precomputeAsync(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null || getCached(ticket) != null) {
            return;
        }
        log.debug("Precomputing copilot briefing for ticket {}", ticket.getReference());
        generateAndCache(ticket);
    }

    private List<Map<String, String>> findRelevantKbArticles(Ticket ticket) {
        List<Map<String, String>> kbArticles = new ArrayList<>();
        try {
            var articles = kbRepository.searchArticles(
                ticket.getTitle(), org.springframework.data.domain.PageRequest.of(0, 4)
            ).getContent();
            for (var a : articles) {
                kbArticles.add(Map.of(
                    "title", a.getTitle(),
                    "summary", a.getSummary() != null ? a.getSummary() : "",
                    "content", a.getContent() != null ? a.getContent().substring(0, Math.min(350, a.getContent().length())) : ""
                ));
            }
        } catch (Exception e) {
            log.debug("Pas d'articles KB pour copilot: {}", e.getMessage());
        }
        return kbArticles;
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

        List<String> comments = new ArrayList<>();
        if (t.getComments() != null) {
            for (var c : t.getComments().stream().limit(10).toList()) {
                String name = c.getAuthor() != null ? c.getAuthor().getFirstName() : "?";
                comments.add(String.format("[%s] %s: %s",
                    c.getCreatedAt() != null ? c.getCreatedAt().format(FMT) : "?", name, c.getContent()));
            }
        }
        m.put("comments", comments);
        return m;
    }
}
