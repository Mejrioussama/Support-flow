package com.supportflow.controller;

import com.supportflow.dto.*;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.entity.enums.WaitingOn;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.ClientService;
import com.supportflow.service.CamundaService;
import com.supportflow.service.AlfrescoCmisService;
import com.supportflow.service.TicketService;
import com.supportflow.service.UserIdentityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.io.ByteArrayResource;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.supportflow.security.AuthorizationHelper;

/**
 * Contrôleur REST pour la gestion des tickets
 */
@RestController
@RequestMapping("/tickets")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Tickets", description = "API de gestion des tickets")
public class TicketController {
    
    private final TicketService ticketService;
    private final CamundaService camundaService;
    private final ClientService clientService;
    private final UserRepository userRepository;
    private final UserIdentityService userIdentityService;
    private final com.supportflow.service.EscalationService escalationService;
    private final AuthorizationHelper authHelper;
    
    @PostMapping
    @Operation(summary = "Créer un nouveau ticket", description = "Crée un nouveau ticket avec calcul automatique du score et SLA")
    @ApiResponse(responseCode = "201", description = "Ticket créé avec succès")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<TicketResponseDTO> createTicket(
            @Valid @RequestBody TicketCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        
        String userEmail = jwt.getClaimAsString("email");
        String userName = jwt.getClaimAsString("name");
        String preferredUsername = jwt.getClaimAsString("preferred_username");
        log.info("Création ticket par: {}", userEmail);
        
        // Si CLIENT et pas de clientId fourni, auto-détecter ou créer par email
        if (isClientRole(jwt) && dto.getClientId() == null) {
            Long resolvedClientId = resolveClientId(jwt);
            ClientDTO clientDTO = resolvedClientId != null ? clientService.getClientById(resolvedClientId) : clientService.getClientByEmail(userEmail);
            if (clientDTO == null) {
                // Créer automatiquement le profil client
                log.info("Création automatique du profil client pour: {}", userEmail);
                ClientDTO newClient = new ClientDTO();
                newClient.setEmail(userEmail);
                newClient.setCompanyName(userName != null ? userName : preferredUsername);
                newClient.setCode("CLT-" + (preferredUsername != null ? preferredUsername.toUpperCase() : "AUTO"));
                newClient.setIsActive(true);
                clientDTO = clientService.createClient(newClient);
                log.info("Profil client créé: {} pour email: {}", clientDTO.getId(), userEmail);
            }
            dto.setClientId(clientDTO.getId());
            log.info("Client assigné: {} pour email: {}", clientDTO.getId(), userEmail);
        }
        
        Long userId = getUserIdFromJwt(jwt);
        TicketResponseDTO ticket = ticketService.createTicket(dto, userId);
        
        log.info("Ticket créé: {}", ticket.getReference());
        return ResponseEntity.status(HttpStatus.CREATED).body(ticket);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Récupérer un ticket par ID")
    @ApiResponse(responseCode = "200", description = "Ticket trouvé")
    @ApiResponse(responseCode = "404", description = "Ticket non trouvé")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TicketResponseDTO> getTicketById(
            @Parameter(description = "ID du ticket") @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        
        if (!authHelper.canAccessTicket(jwt, id)) {
            log.warn("Accès refusé au ticket {} pour l'utilisateur {}", id, jwt.getClaimAsString("email"));
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        return ResponseEntity.ok(ticketService.getTicketById(id));
    }
    
    @GetMapping("/reference/{reference}")
    @Operation(summary = "Récupérer un ticket par référence")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TicketResponseDTO> getTicketByReference(
            @Parameter(description = "Référence du ticket (ex: SF-0001)") @PathVariable String reference,
            @AuthenticationPrincipal Jwt jwt) {
        
        TicketResponseDTO ticket = ticketService.getTicketByReference(reference);
        
        if (!authHelper.canAccessTicket(jwt, ticket.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        return ResponseEntity.ok(ticket);
    }
    
    @GetMapping
    @Operation(summary = "Lister tous les tickets avec pagination (filtré par rôle)")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<TicketResponseDTO>> getAllTickets(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) TicketStatus status,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) WaitingOn waitingOn,
            @RequestParam(required = false) String actionBucket,
            @RequestParam(required = false) Boolean hasCustomerReply,
            @RequestParam(required = false) Boolean resolutionRejected,
            @RequestParam(required = false) Boolean unassigned,
            @RequestParam(required = false) String slaState,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        
        // If CLIENT role, only return their tickets
        if (isClientRole(jwt)) {
            Long clientId = resolveClientId(jwt);
            if (clientId == null) {
                return ResponseEntity.ok(Page.empty(pageable));
            }
            log.info("Client {} requesting their tickets", clientId);
            return ResponseEntity.ok(ticketService.getTicketsByClient(clientId, status, pageable));
        }
        
        // AGENT: only see assigned tickets
        if (isAgentRole(jwt)) {
            Long agentId = getUserIdFromJwt(jwt);
            log.info("Agent {} requesting their assigned tickets", agentId);
            return ResponseEntity.ok(ticketService.getTicketsByAgent(agentId, status, pageable));
        }
        
        // ADMIN, MANAGER can see all tickets
        if (isManagerOrAdminRole(jwt)) {
            return ResponseEntity.ok(ticketService.getManagerTickets(
                status, priority, waitingOn, actionBucket, hasCustomerReply,
                resolutionRejected, unassigned, slaState, pageable
            ));
        }

        // Fail-closed: rôle inconnu → 403
        log.warn("Accès refusé à la liste tickets - rôle non reconnu: {}", jwt.getClaimAsString("email"));
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    
    @GetMapping("/my-tickets")
    @Operation(summary = "Lister mes tickets selon le profil connecte")
    @PreAuthorize("hasAnyRole('CLIENT', 'SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<Page<TicketResponseDTO>> getMyTickets(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) TicketStatus status,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) WaitingOn waitingOn,
            @RequestParam(required = false) Boolean hasCustomerReply,
            @RequestParam(required = false) Boolean resolutionRejected,
            @RequestParam(required = false) String slaState,
            @RequestParam(required = false, name = "search") String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        if (isClientRole(jwt)) {
            Long clientId = resolveClientId(jwt);
            if (clientId == null) {
                return ResponseEntity.ok(Page.empty(pageable));
            }
            return ResponseEntity.ok(ticketService.getTicketsByClient(
                clientId, status, priority, waitingOn, hasCustomerReply,
                resolutionRejected, slaState, search, pageable
            ));
        }

        Long userId = getUserIdFromJwt(jwt);
        if (userId == null) {
            return ResponseEntity.ok(Page.empty(pageable));
        }

        return ResponseEntity.ok(ticketService.getTicketsByAgent(
            userId, status, priority, waitingOn, hasCustomerReply,
            resolutionRejected, slaState, search, pageable
        ));
    }

    @GetMapping("/agent-workbench")
    @Operation(summary = "Vue de travail agent orientee production")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<AgentWorkbenchDTO> getAgentWorkbench(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "8") int limit) {
        Long agentId = getUserIdFromJwt(jwt);
        if (agentId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(ticketService.getAgentWorkbench(agentId, limit));
    }
    
    @GetMapping("/status/{status}")
    @Operation(summary = "Lister les tickets par statut")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<TicketResponseDTO>> getTicketsByStatus(
            @PathVariable TicketStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ticketService.getTicketsByStatus(status, pageable));
    }
    
    @GetMapping("/client/{clientId}")
    @Operation(summary = "Lister les tickets d'un client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Page<TicketResponseDTO>> getTicketsByClient(
            @PathVariable Long clientId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ticketService.getTicketsByClient(clientId, pageable));
    }
    
    @GetMapping("/agent/{agentId}")
    @Operation(summary = "Lister les tickets assignés à un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<TicketResponseDTO>> getTicketsByAgent(
            @PathVariable Long agentId,
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        // Agent ne peut voir que ses propres tickets
        if (authHelper.isAgent(jwt) && !agentId.equals(authHelper.getUserId(jwt))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(ticketService.getTicketsByAgent(agentId, pageable));
    }
    
    @GetMapping("/unassigned")
    @Operation(summary = "Lister les tickets non assignés")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<TicketResponseDTO>> getUnassignedTickets() {
        return ResponseEntity.ok(ticketService.getUnassignedTickets());
    }
    
    @GetMapping("/search")
    @Operation(summary = "Rechercher des tickets")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<TicketResponseDTO>> searchTickets(
            @RequestParam String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ticketService.searchTickets(q, pageable));
    }

    @GetMapping("/archived/search")
    @Operation(summary = "Rechercher les tickets archives")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<TicketResponseDTO>> searchArchivedTickets(
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Long collaboratorId,
            @RequestParam(required = false) com.supportflow.entity.enums.Severity severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @PageableDefault(size = 20, sort = "closedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ticketService.searchArchivedTickets(
            clientId, collaboratorId, severity, fromDate, toDate, pageable
        ));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Historique d'un ticket")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<TicketHistoryDTO>> getTicketHistory(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        if (isClientRole(jwt)) {
            if (!isClientTicketAccessible(id, jwt)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }
        return ResponseEntity.ok(ticketService.getTicketHistory(id, pageable));
    }

    @GetMapping("/{id}/escalation-history")
    @Operation(summary = "Historique des escalades d'un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<EscalationEventDTO>> getEscalationHistory(@PathVariable Long id) {
        return ResponseEntity.ok(escalationService.getEscalationHistory(id));
    }

    @PostMapping("/{id}/escalation-hold")
    @Operation(summary = "Mettre l'escalade en hold temporaire")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<TicketResponseDTO> holdEscalation(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        int holdMinutes = body.get("minutes") != null
            ? Integer.parseInt(body.get("minutes").toString()) : 60;
        String reason = body.get("reason") != null ? body.get("reason").toString() : "Investigation en cours";
        return ResponseEntity.ok(escalationService.holdEscalation(id, holdMinutes, reason));
    }

    @PostMapping("/{id}/escalation-hold-release")
    @Operation(summary = "Libérer le hold d'escalade")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<TicketResponseDTO> releaseEscalationHold(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(escalationService.releaseEscalationHold(id));
    }

    @GetMapping("/{id}/workflow-status")
    @Operation(summary = "Statut workflow Camunda d'un ticket")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ProcessStatusDTO> getTicketWorkflowStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        if (isClientRole(jwt) && !isClientTicketAccessible(id, jwt)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        TicketResponseDTO ticket = ticketService.getTicketById(id);
        if (ticket == null || ticket.getReference() == null || ticket.getReference().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        ProcessStatusDTO status = camundaService.getProcessStatusByTicketReference(ticket.getReference());
        return ResponseEntity.ok(status);
    }

    @GetMapping("/{id}/workflow-trace")
    @Operation(summary = "Trace workflow Camunda d'un ticket")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WorkflowTraceDTO> getTicketWorkflowTrace(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        if (isClientRole(jwt) && !isClientTicketAccessible(id, jwt)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        TicketResponseDTO ticket = ticketService.getTicketById(id);
        if (ticket == null || ticket.getReference() == null || ticket.getReference().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        WorkflowTraceDTO trace = camundaService.getWorkflowTraceByTicketReference(ticket.getReference());
        return ResponseEntity.ok(trace);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<TicketResponseDTO> updateTicket(
            @PathVariable Long id,
            @Valid @RequestBody TicketUpdateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canStaffAccessTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.updateTicket(id, dto, userId));
    }
    
    @PostMapping("/{id}/assign/{agentId}")
    @Operation(summary = "Assigner un ticket à un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<TicketResponseDTO> assignTicket(
            @PathVariable Long id,
            @PathVariable Long agentId,
            @RequestBody(required = false) TicketAssignmentRequestDTO request,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canAssignTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        Long userId = getUserIdFromJwt(jwt);
        String source = request != null ? request.getSource() : null;
        return ResponseEntity.ok(ticketService.assignTicket(id, agentId, userId, source));
    }

    @GetMapping("/{id}/recommended-agents")
    @Operation(summary = "Obtenir une shortlist intelligente d'agents pour assignation")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<AgentRecommendationDTO>> getRecommendedAgents(@PathVariable Long id) {
        return ResponseEntity.ok(ticketService.getRecommendedAgents(id));
    }

    @GetMapping("/{id}/assignment-candidates")
    @Operation(summary = "Obtenir tous les candidats d'assignation avec leur etat")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<AgentRecommendationDTO>> getAssignmentCandidates(@PathVariable Long id) {
        return ResponseEntity.ok(ticketService.getAssignmentCandidates(id));
    }

    @GetMapping("/{id}/alfresco-documents")
    @Operation(summary = "Lister les documents GED reels d'un ticket")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TicketArchiveDocumentDTO>> getAlfrescoDocuments(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canAccessTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(ticketService.getAlfrescoDocuments(id));
    }

    @GetMapping("/{id}/alfresco-documents/content")
    @Operation(summary = "Lire le contenu binaire d'un document Alfresco lie au ticket")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ByteArrayResource> getAlfrescoDocumentContent(
            @PathVariable Long id,
            @RequestParam String objectId,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canAccessTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        AlfrescoCmisService.DocumentContentResult content = ticketService.getAlfrescoDocumentContent(id, objectId);
        String fileName = content.fileName() != null ? content.fileName() : "document";
        String mimeType = content.mimeType() != null && !content.mimeType().isBlank()
            ? content.mimeType()
            : MediaType.APPLICATION_OCTET_STREAM_VALUE;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.inline().filename(fileName).build());
        headers.setContentType(MediaType.parseMediaType(mimeType));

        return ResponseEntity.ok()
            .headers(headers)
            .contentLength(content.content().length)
            .body(new ByteArrayResource(content.content()));
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un ticket")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTicket(@PathVariable Long id) {
        ticketService.deleteTicket(id);
    }
    
    @PostMapping("/{id}/take-charge")
    @Operation(summary = "Agent prend en charge un ticket", description = "L'agent prend en charge le ticket et le passe en IN_PROGRESS")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> takeCharge(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canTakeChargeTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        Long agentId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.takeCharge(id, agentId));
    }
    
    @PostMapping("/{id}/escalate")
    @Operation(summary = "Escalader un ticket manuellement", description = "L'agent escalade le ticket vers un autre agent/senior")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> escalateManually(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canEscalateTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        Long newAgentId = Long.valueOf(body.get("newAgentId").toString());
        String motif = body.get("motif") != null ? body.get("motif").toString() : "Non spécifié";
        Long performedBy = getUserIdFromJwt(jwt);
        
        return ResponseEntity.ok(ticketService.escalateManually(id, newAgentId, motif, performedBy));
    }
    
    @PostMapping("/{id}/escalate-sla")
    @Operation(summary = "Escalader un ticket automatiquement (SLA)", description = "Escalade automatique déclenchée par Camunda")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> escalateSLA(@PathVariable Long id) {
        return ResponseEntity.ok(ticketService.escalateSLA(id));
    }

    @PostMapping("/{id}/manager-review")
    @Operation(summary = "Demander une revue manager", description = "Declenche la revue manager via le moteur d'escalade unifie")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> requestManagerReview(
            @PathVariable Long id,
            @Valid @RequestBody TicketReasonRequestDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canRequestManagerReview(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.requestManagerReview(id, dto.getReason(), userId));
    }

    @PostMapping("/{id}/sla-due-date")
    @Operation(summary = "Mettre à jour la date SLA", description = "Met à jour la date/heure SLA et synchronise le timer Camunda")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> updateSlaDueDate(
            @PathVariable Long id,
            @Valid @RequestBody TicketSlaDueDateUpdateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canRequestManagerReview(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.updateSlaDueDate(id, dto.getDueDate(), userId));
    }

    @PostMapping("/{id}/sla-pause")
    @Operation(summary = "Pause SLA", description = "Met en pause le chrono SLA (ex: attente reponse client)")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> pauseSla(
            @PathVariable Long id,
            @Valid @RequestBody TicketReasonRequestDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canManageSla(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.pauseSla(id, dto.getReason(), userId));
    }

    @PostMapping("/{id}/sla-resume")
    @Operation(summary = "Resume SLA", description = "Reprend le chrono SLA apres une pause")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> resumeSla(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canManageSla(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.resumeSla(id, userId));
    }

    @PostMapping("/{id}/wait-for-customer")
    @Operation(summary = "Mettre un ticket en attente client", description = "Passe le ticket en PENDING et met le SLA en pause avec un motif")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> waitForCustomer(
            @PathVariable Long id,
            @Valid @RequestBody TicketPendingRequestDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canManageSla(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.waitForCustomer(id, dto.getWaitingOn(), dto.getPendingReason(), userId));
    }

    @PostMapping("/{id}/sla-extend")
    @Operation(summary = "Prolonger SLA", description = "Le manager prolonge le SLA avec justification")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> extendSla(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canRequestManagerReview(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        int minutes = body.get("minutes") != null ? Integer.parseInt(body.get("minutes").toString()) : 0;
        String reason = body.get("reason") != null ? body.get("reason").toString() : "Extension par manager";
        if (minutes <= 0 || minutes > 10080) {
            return ResponseEntity.badRequest().build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.extendSla(id, minutes, reason, userId));
    }
    
    @PostMapping("/{id}/resolve")
    @Operation(summary = "Résoudre un ticket", description = "L'agent marque le ticket comme résolu avec un résumé")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> resolveTicket(
            @PathVariable Long id,
            @Valid @RequestBody TicketResolveRequestDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canResolveTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long agentId = getUserIdFromJwt(jwt);
        
        return ResponseEntity.ok(ticketService.resolveTicket(id, dto, agentId));
    }
    
    @PostMapping("/{id}/close")
    @Operation(summary = "Fermer un ticket", description = "Le client valide et ferme le ticket avec une note de satisfaction")
    @PreAuthorize("hasAnyRole('CLIENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> closeTicket(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canCloseTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        // Vérifier que le CLIENT a accès à ce ticket
        if (isClientRole(jwt)) {
            if (!isClientTicketAccessible(id, jwt)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }
        
        Integer satisfactionRating = body.get("satisfactionRating") != null 
            ? Integer.valueOf(body.get("satisfactionRating").toString()) 
            : null;
        String satisfactionComment = body.get("satisfactionComment") != null 
            ? body.get("satisfactionComment").toString() 
            : null;
        
        return ResponseEntity.ok(ticketService.closeTicket(id, satisfactionRating, satisfactionComment));
    }

    @PostMapping("/{id}/archive")
    @Operation(summary = "Archiver un ticket", description = "Archive manuellement un ticket deja ferme")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> archiveTicket(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canArchiveTicket(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.archiveTicket(id, userId));
    }

    @PostMapping("/{id}/reject-resolution")
    @Operation(summary = "Rejeter une résolution", description = "Le client rejette la résolution et le ticket repasse en IN_PROGRESS")
    @PreAuthorize("hasAnyRole('CLIENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> rejectResolution(
            @PathVariable Long id,
            @Valid @RequestBody TicketReasonRequestDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canRejectResolution(jwt, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (isClientRole(jwt)) {
            if (!isClientTicketAccessible(id, jwt)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(ticketService.rejectResolution(id, dto.getReason(), userId));
    }
    
    @PatchMapping("/{id}/status")
    @Operation(summary = "Changer le statut d'un ticket")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
    public ResponseEntity<TicketResponseDTO> changeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        
        TicketStatus newStatus = TicketStatus.valueOf(body.get("status"));
        String reason = body.get("reason");
        Long userId = getUserIdFromJwt(jwt);
        
        return ResponseEntity.ok(ticketService.changeStatus(id, newStatus, userId, reason));
    }
    
    private Long resolveClientId(Jwt jwt) {
        if (jwt == null) {
            return null;
        }

        String email = jwt.getClaimAsString("email");
        if (email != null) {
            ClientDTO client = clientService.getClientByEmail(email);
            if (client != null) {
                return client.getId();
            }
        }

        Long userId = getUserIdFromJwt(jwt);
        if (userId == null) {
            return null;
        }

        return userRepository.findById(userId)
            .map(User::getClient)
            .map(com.supportflow.entity.Client::getId)
            .orElse(null);
    }

    private boolean isClientTicketAccessible(Long ticketId, Jwt jwt) {
        Long clientId = resolveClientId(jwt);
        if (clientId == null) {
            return false;
        }

        TicketResponseDTO ticket = ticketService.getTicketById(ticketId);
        return ticket.getClient() != null && clientId.equals(ticket.getClient().getId());
    }
    /**
     * Récupère l'ID utilisateur depuis le JWT (basé sur l'email)
     * Auto-crée l'utilisateur s'il n'existe pas dans la base
     */
    private Long getUserIdFromJwt(Jwt jwt) {
        return userIdentityService.resolveUserIdFromJwt(jwt);
    }
    
    /**
     * Détermine le rôle de l'utilisateur depuis le JWT
     */
    private Role getRoleFromJwt(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null) {
                if (roles.contains("ADMIN")) return Role.ADMIN;
                if (roles.contains("SUPPORT_MANAGER")) return Role.SUPPORT_MANAGER;
                if (roles.contains("SUPPORT_AGENT")) return Role.SUPPORT_AGENT;
            }
        }
        return Role.CLIENT; // default pour les utilisateurs inconnus
    }
    
    /**
     * Vérifie si l'utilisateur a le rôle CLIENT
     */
    private boolean isClientRole(Jwt jwt) {
        if (jwt == null) return false;
        
        // Check realm_access roles
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null) {
                // If has CLIENT but not ADMIN, SUPPORT_MANAGER, or SUPPORT_AGENT
                boolean isClient = roles.contains("CLIENT");
                boolean isStaff = roles.contains("ADMIN") || 
                                  roles.contains("SUPPORT_MANAGER") || 
                                  roles.contains("SUPPORT_AGENT");
                return isClient && !isStaff;
            }
        }
        return false;
    }
    
    /**
     * Vérifie si l'utilisateur a le rôle SUPPORT_AGENT (et pas ADMIN/MANAGER)
     */
    private boolean isAgentRole(Jwt jwt) {
        return authHelper.isAgent(jwt);
    }

    private boolean isManagerOrAdminRole(Jwt jwt) {
        return authHelper.isManagerOrAdmin(jwt);
    }
}






