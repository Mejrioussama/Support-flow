package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.enums.EscalationEvaluationTrigger;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Periodic automation backed by the unified escalation engine.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketAutomationService {

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository historyRepository;
    private final NotificationService notificationService;
    private final EscalationService escalationService;
    private final SlaComputationService slaComputationService;

    @Value("${supportflow.automation.interval-ms:15000}")
    private long automationIntervalMs;

    @Value("${supportflow.automation.sla-critical-hours:24}")
    private long slaCriticalHours;

    @Value("${supportflow.automation.sla-critical-repeat-hours:6}")
    private long slaCriticalRepeatHours;

    @Value("${supportflow.automation.pending-blocked-hours:24}")
    private long pendingBlockedHours;

    @Scheduled(fixedDelayString = "${supportflow.automation.interval-ms:15000}")
    @Transactional
    public void runAutomationCycle() {
        LocalDateTime now = LocalDateTime.now();
        autoManageSlaPause(now);
        applySimpleSlaMonitoring(now);
        applySlaBreachEscalation(now);
        applyEscalatedSlaCriticalReminder(now);
        applyBlockedPendingReminder(now);
        applyAntiBlocking(now);
    }

    private void autoManageSlaPause(LocalDateTime now) {
        List<Ticket> pendingNotPaused = ticketRepository.findByStatusAndSlaPaused(TicketStatus.PENDING, false);
        for (Ticket ticket : pendingNotPaused) {
            if (ticket.getSlaDeadline() == null) {
                continue;
            }
            ticket.pauseSla();
            ticket.setSlaPhase("PAUSED");
            ticketRepository.save(ticket);

            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction("SLA_AUTO_PAUSED");
            history.setDescription("SLA auto-pause: ticket en attente client (PENDING)");
            history.setPerformedBy("System");
            history.setCreatedAt(now);
            historyRepository.save(history);
        }
    }

    private void applySimpleSlaMonitoring(LocalDateTime now) {
        List<Ticket> activeTickets = ticketRepository.findActiveTicketsForSlaWarning(now);
        for (Ticket ticket : activeTickets) {
            if (ticket.getCreatedAt() == null || ticket.getSlaDeadline() == null || Boolean.TRUE.equals(ticket.getSlaPaused())) {
                continue;
            }

            String oldPhase = ticket.getSlaPhase() != null ? ticket.getSlaPhase() : "ON_TRACK";
            ticket.setSlaBreached(slaComputationService.isBreached(ticket, now));
            String newPhase = slaComputationService.computePhase(ticket, now);
            if (oldPhase.equals(newPhase)) {
                continue;
            }

            ticket.setSlaPhase(newPhase);

            if ("AT_RISK".equals(newPhase) && !historyRepository.existsByTicketIdAndAction(ticket.getId(), "SLA_AT_RISK_ALERT")) {
                TicketHistory history = new TicketHistory();
                history.setTicket(ticket);
                history.setAction("SLA_AT_RISK_ALERT");
                history.setDescription("Ticket proche du depassement SLA. Alerte agent + manager.");
                history.setPerformedBy("System");
                history.setCreatedAt(now);
                historyRepository.save(history);

                ticket.setSlaWarningSent(true);
                if (ticket.getPriority() == Priority.LOW || ticket.getPriority() == Priority.MEDIUM) {
                    ticket.setPriority(Priority.HIGH);
                }
                notificationService.notifySlaAtRisk(ticket);
                escalationService.evaluateEscalation(ticket.getId(), EscalationEvaluationTrigger.SLA_AT_RISK);
            }

            ticketRepository.save(ticket);
        }
    }

    private void applySlaBreachEscalation(LocalDateTime now) {
        List<Ticket> breachedTickets = ticketRepository.findTicketsWithBreachedSla(now);
        for (Ticket ticket : breachedTickets) {
            if (ticket.getStatus() == TicketStatus.RESOLVED
                || ticket.getStatus() == TicketStatus.CLOSED
                || ticket.getStatus() == TicketStatus.CANCELLED) {
                ticket.setSlaBreached(true);
                ticketRepository.save(ticket);
                notificationService.notifySlaBreached(ticket);
                continue;
            }

            try {
                escalationService.evaluateEscalation(ticket.getId(), EscalationEvaluationTrigger.SLA_BREACHED);
            } catch (Exception exception) {
                log.error("Erreur d'escalade unifiee pour {}: {}", ticket.getReference(), exception.getMessage());
            }
        }
    }

    private void applyAntiBlocking(LocalDateTime now) {
        escalationService.handleStuckAssignedTickets(now);
        escalationService.handleStaleEscalations(now);
    }

    private void applyEscalatedSlaCriticalReminder(LocalDateTime now) {
        LocalDateTime threshold = now.minusHours(slaCriticalHours);
        LocalDateTime antiSpamSince = now.minusHours(slaCriticalRepeatHours);
        List<Ticket> staleEscalations = ticketRepository.findSlaEscalatedOlderThan(threshold);

        for (Ticket ticket : staleEscalations) {
            boolean alreadyNotifiedRecently = historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(
                ticket.getId(),
                "SLA_CRITICAL_EVENT",
                antiSpamSince);

            if (alreadyNotifiedRecently) {
                continue;
            }

            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction("SLA_CRITICAL_EVENT");
            history.setDescription("Ticket toujours en escalade active (L2/L3) depuis plus de " + slaCriticalHours + "h");
            history.setPerformedBy("System");
            history.setCreatedAt(now);
            historyRepository.save(history);

            notificationService.notifyLongRunningEscalation(ticket);
        }
    }

    private void applyBlockedPendingReminder(LocalDateTime now) {
        LocalDateTime threshold = now.minusHours(pendingBlockedHours);
        List<Ticket> blockedTickets = ticketRepository.findPendingTicketsOlderThan(threshold);

        for (Ticket ticket : blockedTickets) {
            boolean alreadyNotifiedRecently = historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(
                ticket.getId(),
                "TICKET_BLOCKED_ALERT",
                now.minusHours(6));

            if (alreadyNotifiedRecently) {
                continue;
            }

            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction("TICKET_BLOCKED_ALERT");
            history.setDescription("Ticket bloque en attente depuis plus de " + pendingBlockedHours + "h");
            history.setPerformedBy("System");
            history.setCreatedAt(now);
            historyRepository.save(history);

            notificationService.notifyTicketBlocked(ticket);
        }
    }
}
