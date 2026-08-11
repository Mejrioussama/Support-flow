package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.enums.TicketHistoryAction;
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
            history.setAction(TicketHistoryAction.CAMUNDA_SYNC_WARNING);
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

