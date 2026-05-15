package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.EscalationEvaluationTrigger;
import com.supportflow.repository.TicketRepository;
import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Camunda SLA timers now forward into the unified escalation engine.
 */
@Service
public class SlaTimerService {

    private static final Logger logger = LoggerFactory.getLogger(SlaTimerService.class);

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private EscalationService escalationService;

    public void onSlaCheckpoint(DelegateExecution execution) {
        try {
            Long ticketId = (Long) execution.getVariable("ticketId");
            logger.info("SLA checkpoint interne ignore pour le ticket {}", ticketId);
        } catch (Exception exception) {
            logger.error("Error in onSlaCheckpoint", exception);
            throw new RuntimeException("SLA checkpoint timer failed", exception);
        }
    }

    public void onSlaAtRisk(DelegateExecution execution) {
        try {
            Long ticketId = (Long) execution.getVariable("ticketId");
            Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));

            notificationService.notifySlaAtRisk(ticket);
            escalationService.evaluateEscalation(ticketId, EscalationEvaluationTrigger.SLA_AT_RISK);
            logger.info("Sent at-risk SLA alert for ticket {}", ticketId);
        } catch (Exception exception) {
            logger.error("Error in onSlaAtRisk", exception);
            throw new RuntimeException("SLA at-risk timer failed", exception);
        }
    }

    public void onSlaBreached100Percent(DelegateExecution execution) {
        try {
            Long ticketId = (Long) execution.getVariable("ticketId");
            logger.error("SLA breached (100%): escalating ticket {}", ticketId);
            escalationService.evaluateEscalation(ticketId, EscalationEvaluationTrigger.SLA_BREACHED);
            logger.info("Ticket {} escalated successfully from Camunda timer", ticketId);
        } catch (Exception exception) {
            logger.error("Error in onSlaBreached100Percent", exception);
            throw new RuntimeException("SLA timer 100% escalation failed", exception);
        }
    }
}
