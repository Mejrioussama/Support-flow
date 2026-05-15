package com.supportflow.controller;

import com.supportflow.dto.ProcessStatusDTO;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.TicketRepository;
import com.supportflow.service.CamundaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST pour la gestion et le monitoring des processus Camunda
 */
@RestController
@RequestMapping("/camunda")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Camunda", description = "API de monitoring des processus Camunda")
public class CamundaController {
    
    private final CamundaService camundaService;
    private final TicketRepository ticketRepository;

    @PostMapping("/start")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'SUPPORT_AGENT', 'ADMIN')")
    @Operation(summary = "Démarrer explicitement un processus ticket",
               description = "Démarre une instance Camunda pour un ticket existant via ticketId ou ticketReference")
    public ResponseEntity<Map<String, Object>> startProcess(@RequestBody Map<String, Object> body) {
        Long ticketId = null;
        if (body.get("ticketId") != null) {
            ticketId = Long.valueOf(body.get("ticketId").toString());
        }

        String ticketReference = body.get("ticketReference") != null
                ? body.get("ticketReference").toString()
                : null;

        Ticket ticket = null;
        if (ticketId != null) {
            ticket = ticketRepository.findById(ticketId).orElse(null);
        } else if (ticketReference != null && !ticketReference.isBlank()) {
            ticket = ticketRepository.findByReference(ticketReference).orElse(null);
        }

        if (ticket == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Ticket not found"));
        }

        if (ticket.getProcessInstanceId() != null && !ticket.getProcessInstanceId().isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "message", "Process already started",
                    "ticketId", ticket.getId(),
                    "ticketReference", ticket.getReference(),
                    "processInstanceId", ticket.getProcessInstanceId()
            ));
        }

        String processInstanceId = camundaService.startTicketProcess(ticket);
        ticket.setProcessInstanceId(processInstanceId);
        ticketRepository.save(ticket);

        return ResponseEntity.ok(Map.of(
                "message", "Process started",
                "ticketId", ticket.getId(),
                "ticketReference", ticket.getReference(),
                "processInstanceId", processInstanceId
        ));
    }
    
    /**
     * Récupère le statut d'un processus par ID
     */
    @GetMapping("/status/{processInstanceId}")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'SUPPORT_AGENT', 'ADMIN')")
    @Operation(summary = "Obtenir le statut d'un processus", 
               description = "Récupère l'état actuel d'un processus Camunda avec ses variables et activité courante")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statut du processus récupéré avec succès"),
        @ApiResponse(responseCode = "401", description = "Non authentifié"),
        @ApiResponse(responseCode = "403", description = "Accès refusé")
    })
    public ResponseEntity<ProcessStatusDTO> getProcessStatus(
            @Parameter(description = "ID de l'instance de processus", required = true)
            @PathVariable String processInstanceId) {
        log.info("Récupération du statut du processus: {}", processInstanceId);
        ProcessStatusDTO status = camundaService.getProcessStatus(processInstanceId);
        
        if ("NOT_FOUND".equals(status.getProcessStatus())) {
            return ResponseEntity.notFound().build();
        }
        
        if ("ERROR".equals(status.getProcessStatus())) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(status);
        }
        
        return ResponseEntity.ok(status);
    }
    
    /**
     * Récupère le statut d'un processus par référence de ticket
     */
    @GetMapping("/status/ticket/{ticketReference}")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'SUPPORT_AGENT', 'ADMIN')")
    @Operation(summary = "Obtenir le statut du processus d'un ticket", 
               description = "Récupère l'état du processus Camunda par la référence du ticket")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statut du processus récupéré"),
        @ApiResponse(responseCode = "404", description = "Processus non trouvé"),
        @ApiResponse(responseCode = "401", description = "Non authentifié"),
        @ApiResponse(responseCode = "403", description = "Accès refusé")
    })
    public ResponseEntity<ProcessStatusDTO> getProcessStatusByTicket(
            @Parameter(description = "Référence du ticket (ex: TK-001)", required = true)
            @PathVariable String ticketReference) {
        log.info("Récupération du statut du processus pour le ticket: {}", ticketReference);
        ProcessStatusDTO status = camundaService.getProcessStatusByTicketReference(ticketReference);
        
        if ("NOT_FOUND".equals(status.getProcessStatus())) {
            // Fallback: when Camunda runtime/history does not return an instance anymore,
            // infer completion from persisted ticket state to avoid false 404 in monitoring.
            Ticket ticket = ticketRepository.findByReference(ticketReference).orElse(null);
            if (ticket != null && ticket.getStatus() == TicketStatus.CLOSED) {
                ProcessStatusDTO completed = ProcessStatusDTO.builder()
                    .processInstanceId(ticket.getProcessInstanceId())
                    .ticketReference(ticketReference)
                    .ticketId(ticket.getId() != null ? String.valueOf(ticket.getId()) : null)
                    .currentActivity("COMPLETED")
                    .processStatus("COMPLETED")
                    .complete(true)
                    .build();
                return ResponseEntity.ok(completed);
            }

            return ResponseEntity.notFound().build();
        }
        
        if ("ERROR".equals(status.getProcessStatus())) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(status);
        }
        
        return ResponseEntity.ok(status);
    }
    
    /**
     * Vérifie la santé du moteur Camunda
     */
    @GetMapping("/health")
    @Operation(summary = "Vérifier la santé du moteur Camunda", 
               description = "Vérifie que le moteur Camunda est opérationnel")
    @ApiResponse(responseCode = "200", description = "Camunda est en bonne santé")
    public ResponseEntity<String> checkHealth() {
        try {
            // Simple check - if we can get here, Camunda is working
            return ResponseEntity.ok("Camunda engine is healthy");
        } catch (Exception e) {
            log.error("Camunda health check failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Camunda engine is not available: " + e.getMessage());
        }
    }

    @PostMapping("/reconcile/closed")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    @Operation(summary = "Réconcilier les tickets fermés actifs Camunda",
               description = "Force la progression des workflows Camunda encore actifs pour des tickets déjà CLOSED")
    public ResponseEntity<Map<String, Object>> reconcileClosedTickets(
            @RequestParam(defaultValue = "50") int limit) {
        int boundedLimit = Math.max(1, Math.min(limit, 500));

        var page = ticketRepository.findByStatus(
            TicketStatus.CLOSED,
            PageRequest.of(0, boundedLimit, Sort.by(Sort.Direction.DESC, "id"))
        );

        List<Map<String, Object>> details = new ArrayList<>();
        int completed = 0;
        int stillActive = 0;
        int noActive = 0;

        for (Ticket ticket : page.getContent()) {
            Map<String, Object> item = camundaService.reconcileClosedTicketProcess(ticket);
            details.add(item);

            String status = (String) item.get("status");
            if ("COMPLETED".equals(status)) {
                completed++;
            } else if ("NO_ACTIVE_INSTANCE".equals(status)) {
                noActive++;
            } else {
                stillActive++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("scanned", page.getContent().size());
        response.put("completed", completed);
        response.put("noActiveInstance", noActive);
        response.put("stillActive", stillActive);
        response.put("details", details);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cleanup/closed-active")
    @PreAuthorize("hasAnyRole('SUPPORT_MANAGER', 'ADMIN')")
    @Operation(summary = "Nettoyer instances actives sur tickets fermés",
               description = "Supprime les instances runtime Camunda restantes pour des tickets déjà CLOSED")
    public ResponseEntity<Map<String, Object>> cleanupClosedActiveInstances(
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(camundaService.cleanupClosedActiveInstances(limit));
    }
}
