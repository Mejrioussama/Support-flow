package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.enums.EscalationEvaluationTrigger;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.TicketHistoryAction;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Periodic automation backed by the unified escalation engine.
 *
 * <p>Each ticket is processed in its own PESSIMISTIC_WRITE-locked, REQUIRES_NEW transaction
 * (see {@link #processTicketInIsolatedTransaction}) rather than one big transaction for the
 * whole scheduled cycle. Two reasons: (1) in a multi-instance deployment, two pods running this
 * same {@code @Scheduled} loop concurrently could otherwise both read the same unlocked ticket,
 * both pass the escalation guards, and both fire notification side effects before either save
 * commits, producing duplicate escalation emails/websocket events; the per-ticket lock serializes
 * that instead. (2) with everything in one shared transaction, a single flush conflict on one
 * ticket could taint the whole cycle's transaction and silently discard unrelated tickets'
 * already-processed changes (SLA pauses, alerts, escalations) for that tick. Isolating each
 * ticket in its own transaction means one failure can only roll back that one ticket.
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

    // Self-injected proxy: required so that calls to processTicketInIsolatedTransaction() go
    // through Spring's transactional proxy (a plain `this.` self-invocation would silently skip
    // the @Transactional interception and run in whatever transaction the caller has, if any).
    @Autowired
    @Lazy
    private TicketAutomationService self;

    @Value("${supportflow.automation.interval-ms:15000}")
    private long automationIntervalMs;

    @Value("${supportflow.automation.sla-critical-hours:24}")
    private long slaCriticalHours;

    @Value("${supportflow.automation.sla-critical-repeat-hours:6}")
    private long slaCriticalRepeatHours;

    @Value("${supportflow.automation.pending-blocked-hours:24}")
    private long pendingBlockedHours;

    @Scheduled(fixedDelayString = "${supportflow.automation.interval-ms:15000}")
    public void runAutomationCycle() {
        LocalDateTime now = LocalDateTime.now();
        autoManageSlaPause(now);
        applySimpleSlaMonitoring(now);
        applySlaBreachEscalation(now);
        applyEscalatedSlaCriticalReminder(now);
        applyBlockedPendingReminder(now);
        applyAntiBlocking(now);
    }

    /**
     * Runs {@code action} against a fresh, PESSIMISTIC_WRITE-locked copy of the ticket in its
     * own transaction. The lock means a concurrently-running pod processing the same ticket
     * blocks until this transaction commits, then re-reads already-committed state - so the
     * caller's guard conditions (re-checked inside {@code action} against the locked entity,
     * not the possibly-stale one from the outer unlocked list query) turn the loser into a safe
     * no-op instead of a duplicate action.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processTicketInIsolatedTransaction(Long ticketId, Consumer<Ticket> action) {
        Ticket ticket = ticketRepository.findByIdForUpdate(ticketId).orElse(null);
        if (ticket == null) {
            return;
        }
        action.accept(ticket);
    }

    private void runIsolatedForEach(List<Long> ticketIds, String stepName, Consumer<Ticket> action) {
        for (Long ticketId : ticketIds) {
            try {
                self.processTicketInIsolatedTransaction(ticketId, action);
            } catch (Exception exception) {
                log.error("Echec automation '{}' pour le ticket {}: {}", stepName, ticketId, exception.getMessage(), exception);
            }
        }
    }

    private void autoManageSlaPause(LocalDateTime now) {
        List<Long> ticketIds = ticketRepository.findByStatusAndSlaPaused(TicketStatus.PENDING, false)
            .stream().map(Ticket::getId).toList();
        runIsolatedForEach(ticketIds, "auto-pause-sla", ticket -> applySlaPauseToTicket(ticket, now));
    }

    private void applySlaPauseToTicket(Ticket ticket, LocalDateTime now) {
        if (ticket.getStatus() != TicketStatus.PENDING || Boolean.TRUE.equals(ticket.getSlaPaused()) || ticket.getSlaDeadline() == null) {
            return;
        }

        ticket.pauseSla();
        ticket.setSlaPhase("PAUSED");
        ticketRepository.save(ticket);

        TicketHistory history = new TicketHistory();
        history.setTicket(ticket);
        history.setAction(TicketHistoryAction.SLA_AUTO_PAUSED);
        history.setDescription("SLA auto-pause: ticket en attente client (PENDING)");
        history.setPerformedBy("System");
        history.setCreatedAt(now);
        historyRepository.save(history);
    }

    private void applySimpleSlaMonitoring(LocalDateTime now) {
        List<Long> ticketIds = ticketRepository.findActiveTicketsForSlaWarning(now)
            .stream().map(Ticket::getId).toList();
        runIsolatedForEach(ticketIds, "sla-monitoring", ticket -> applySlaMonitoringToTicket(ticket, now));
    }

    private void applySlaMonitoringToTicket(Ticket ticket, LocalDateTime now) {
        if (ticket.getCreatedAt() == null || ticket.getSlaDeadline() == null || Boolean.TRUE.equals(ticket.getSlaPaused())) {
            return;
        }

        String oldPhase = ticket.getSlaPhase() != null ? ticket.getSlaPhase() : "ON_TRACK";
        ticket.setSlaBreached(slaComputationService.isBreached(ticket, now));
        String newPhase = slaComputationService.computePhase(ticket, now);
        if (oldPhase.equals(newPhase)) {
            return;
        }

        ticket.setSlaPhase(newPhase);

        if ("AT_RISK".equals(newPhase) && !historyRepository.existsByTicketIdAndAction(ticket.getId(), TicketHistoryAction.SLA_AT_RISK_ALERT)) {
            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction(TicketHistoryAction.SLA_AT_RISK_ALERT);
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

    private void applySlaBreachEscalation(LocalDateTime now) {
        List<Long> ticketIds = ticketRepository.findTicketsWithBreachedSla(now)
            .stream().map(Ticket::getId).toList();
        runIsolatedForEach(ticketIds, "sla-breach-escalation", ticket -> applySlaBreachToTicket(ticket));
    }

    private void applySlaBreachToTicket(Ticket ticket) {
        if (ticket.getStatus() == TicketStatus.RESOLVED
            || ticket.getStatus() == TicketStatus.CLOSED
            || ticket.getStatus() == TicketStatus.CANCELLED) {
            if (!Boolean.TRUE.equals(ticket.getSlaBreached())) {
                ticket.setSlaBreached(true);
                ticketRepository.save(ticket);
                notificationService.notifySlaBreached(ticket);
            }
            return;
        }

        escalationService.evaluateEscalation(ticket.getId(), EscalationEvaluationTrigger.SLA_BREACHED);
    }

    private void applyAntiBlocking(LocalDateTime now) {
        escalationService.handleStuckAssignedTickets(now);
        escalationService.handleStaleEscalations(now);
    }

    private void applyEscalatedSlaCriticalReminder(LocalDateTime now) {
        LocalDateTime threshold = now.minusHours(slaCriticalHours);
        LocalDateTime antiSpamSince = now.minusHours(slaCriticalRepeatHours);
        List<Long> ticketIds = ticketRepository.findSlaEscalatedOlderThan(threshold)
            .stream().map(Ticket::getId).toList();
        runIsolatedForEach(ticketIds, "sla-critical-reminder",
            ticket -> applyCriticalReminderToTicket(ticket, now, antiSpamSince));
    }

    private void applyCriticalReminderToTicket(Ticket ticket, LocalDateTime now, LocalDateTime antiSpamSince) {
        boolean alreadyNotifiedRecently = historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(
            ticket.getId(),
            TicketHistoryAction.SLA_CRITICAL_EVENT,
            antiSpamSince);

        if (alreadyNotifiedRecently) {
            return;
        }

        TicketHistory history = new TicketHistory();
        history.setTicket(ticket);
        history.setAction(TicketHistoryAction.SLA_CRITICAL_EVENT);
        history.setDescription("Ticket toujours en escalade active (L2/L3) depuis plus de " + slaCriticalHours + "h");
        history.setPerformedBy("System");
        history.setCreatedAt(now);
        historyRepository.save(history);

        notificationService.notifyLongRunningEscalation(ticket);
    }

    private void applyBlockedPendingReminder(LocalDateTime now) {
        LocalDateTime threshold = now.minusHours(pendingBlockedHours);
        List<Long> ticketIds = ticketRepository.findPendingTicketsOlderThan(threshold)
            .stream().map(Ticket::getId).toList();
        runIsolatedForEach(ticketIds, "blocked-pending-reminder",
            ticket -> applyBlockedReminderToTicket(ticket, now));
    }

    private void applyBlockedReminderToTicket(Ticket ticket, LocalDateTime now) {
        boolean alreadyNotifiedRecently = historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(
            ticket.getId(),
            TicketHistoryAction.TICKET_BLOCKED_ALERT,
            now.minusHours(6));

        if (alreadyNotifiedRecently) {
            return;
        }

        TicketHistory history = new TicketHistory();
        history.setTicket(ticket);
        history.setAction(TicketHistoryAction.TICKET_BLOCKED_ALERT);
        history.setDescription("Ticket bloque en attente depuis plus de " + pendingBlockedHours + "h");
        history.setPerformedBy("System");
        history.setCreatedAt(now);
        historyRepository.save(history);

        notificationService.notifyTicketBlocked(ticket);
    }
}
