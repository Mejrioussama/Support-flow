package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Execute les synchronisations Camunda hors du thread HTTP
 * pour eviter de bloquer les reponses API.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CamundaAsyncService {

    @Autowired(required = false)
    private CamundaService camundaService;

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository historyRepository;
    private final NotificationService notificationService;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void startTicketProcessAsync(Long ticketId) {
        if (camundaService == null) {
            return;
        }

        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null) {
            log.warn("Impossible de demarrer Camunda async: ticket {} introuvable", ticketId);
            return;
        }

        try {
            String processInstanceId = camundaService.startTicketProcess(ticket);
            ticket.setProcessInstanceId(processInstanceId);
            ticketRepository.save(ticket);
            log.info("Workflow Camunda demarre en async pour {}", ticket.getReference());
        } catch (Exception e) {
            log.warn("Echec demarrage Camunda async pour {}: {}", ticket.getReference(), e.getMessage());
            recordCamundaSyncIssue(ticket, "CREATE_ASYNC", e.getMessage());
        }
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTicketCreatedAsync(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null) {
            log.warn("Impossible d'envoyer les notifications async: ticket {} introuvable", ticketId);
            return;
        }

        try {
            notificationService.notifyTicketCreated(ticket);
        } catch (Exception e) {
            log.warn("Echec notification async de creation pour {}: {}", ticket.getReference(), e.getMessage());
        }
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeAssignmentTaskAsync(Long ticketId, String phase) {
        if (camundaService == null) {
            return;
        }

        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null) {
            log.warn("Impossible de completer la tache Camunda async: ticket {} introuvable", ticketId);
            return;
        }

        try {
            int maxAttempts = 10;
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                ticket = ticketRepository.findById(ticketId).orElse(null);
                if (ticket == null) {
                    log.warn("Ticket {} introuvable pendant la sync Camunda async", ticketId);
                    return;
                }

                if (ticket.getProcessInstanceId() != null && ticket.getAssignedAgent() != null) {
                    camundaService.completeAssignmentTask(ticket);
                    log.info("Sync assignation Camunda async lancee pour {} (attempt {})", ticket.getReference(), attempt);
                    return;
                }

                Thread.sleep(400L);
            }

            recordCamundaSyncIssue(ticket, phase, "Workflow Camunda indisponible ou non initialise apres retries");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Sync assignation Camunda async interrompue pour {}", ticket.getReference());
            recordCamundaSyncIssue(ticket, phase, "Sync Camunda interrompue");
        } catch (Exception e) {
            log.warn("Echec sync assignation Camunda async pour {}: {}", ticket.getReference(), e.getMessage());
            recordCamundaSyncIssue(ticket, phase, e.getMessage());
        }
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeValidationTaskAsync(Ticket ticket, boolean validated) {
        if (camundaService == null) {
            return;
        }

        try {
            boolean completed = false;
            int maxAttempts = 10;
            int attempt = 0;

            while (!completed && attempt < maxAttempts) {
                attempt++;
                completed = camundaService.completeValidationTask(ticket, validated);
                if (!completed) {
                    Thread.sleep(400L);
                }
            }

            if (completed) {
                log.info("Sync Camunda async terminee pour ticket {} (attempt {})", ticket.getReference(), attempt);
            } else {
                log.warn("Sync Camunda async incomplete pour {} apres {} tentatives", ticket.getReference(), maxAttempts);
                recordCamundaSyncIssue(ticket, "CLOSE_ASYNC", "Tache client_validation introuvable apres retries");
            }
        } catch (Exception e) {
            log.warn("Echec sync Camunda async (CLOSE) pour {}: {}", ticket.getReference(), e.getMessage());
            recordCamundaSyncIssue(ticket, "CLOSE_ASYNC", e.getMessage());
        }
    }

    private void recordCamundaSyncIssue(Ticket ticket, String phase, String error) {
        try {
            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction("CAMUNDA_SYNC_WARNING");
            history.setFieldName("workflow");
            history.setDescription("Camunda indisponible pendant " + phase + ". Synchronisation workflow a verifier.");
            history.setNewValue(error != null ? error.substring(0, Math.min(error.length(), 450)) : "N/A");
            history.setPerformedBy("System");
            history.setCreatedAt(LocalDateTime.now());
            historyRepository.save(history);
        } catch (Exception ignored) {
            log.debug("Impossible d'enregistrer CAMUNDA_SYNC_WARNING async pour {}", ticket.getReference());
        }
    }
}

