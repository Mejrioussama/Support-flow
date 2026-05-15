package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.TicketRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.task.Task;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Rehydrate Camunda instances for tickets inserted outside the normal API flow
 * (for example SQL demo seeds used in local testing).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CamundaBootstrapService {

    private static final List<TicketStatus> ACTIVE_WORKFLOW_STATUSES = List.of(
        TicketStatus.NEW,
        TicketStatus.OPEN,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.PENDING,
        TicketStatus.ESCALATED_MANUAL,
        TicketStatus.ESCALATED_SLA
    );

    private final TicketRepository ticketRepository;
    private final CamundaService camundaService;
    private final TaskService taskService;
    private final PlatformTransactionManager transactionManager;

    @EventListener(ApplicationReadyEvent.class)
    public void bootstrapMissingCamundaProcesses() {
        List<Long> ticketIds = ticketRepository.findByStatusIn(ACTIVE_WORKFLOW_STATUSES).stream()
            .map(Ticket::getId)
            .toList();

        if (ticketIds.isEmpty()) {
            log.info("Camunda bootstrap: aucun ticket actif a resynchroniser");
            return;
        }

        TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
        int started = 0;
        int advanced = 0;

        for (Long ticketId : ticketIds) {
            try {
                BootstrapResult syncResult = transactionTemplate.execute(status -> synchronizeTicket(ticketId));
                if (syncResult == null) {
                    continue;
                }

                if (syncResult.started()) {
                    started++;
                }

                if (syncResult.shouldAdvance()
                    && Boolean.TRUE.equals(transactionTemplate.execute(status -> advanceQualifiedTicket(ticketId)))) {
                    advanced++;
                }
            } catch (Exception e) {
                log.warn("Camunda bootstrap: impossible de resynchroniser le ticket {}: {}", ticketId, e.getMessage());
            }
        }

        if (started == 0 && advanced == 0) {
            log.info("Camunda bootstrap: aucun workflow a corriger");
            return;
        }

        log.info("Camunda bootstrap termine: {} processus demarres, {} workflows avances vers resolve_ticket", started, advanced);
    }

    private boolean shouldAdvanceToResolveTask(TicketStatus status) {
        return status == TicketStatus.ASSIGNED
            || status == TicketStatus.IN_PROGRESS
            || status == TicketStatus.PENDING
            || status == TicketStatus.ESCALATED_MANUAL
            || status == TicketStatus.ESCALATED_SLA;
    }

    private BootstrapResult synchronizeTicket(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null) {
            return null;
        }

        boolean started = false;
        if (ticket.getProcessInstanceId() == null || ticket.getProcessInstanceId().isBlank()) {
            String processInstanceId = camundaService.startTicketProcess(ticket);
            ticket.setProcessInstanceId(processInstanceId);
            ticketRepository.save(ticket);
            started = true;
        }

        boolean shouldAdvance = ticket.getAssignedAgent() != null && shouldAdvanceToResolveTask(ticket.getStatus());
        return new BootstrapResult(ticket.getReference(), started, shouldAdvance);
    }

    private boolean advanceQualifiedTicket(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null || ticket.getProcessInstanceId() == null || ticket.getProcessInstanceId().isBlank()) {
            return false;
        }

        if (ticket.getAssignedAgent() == null) {
            return false;
        }

        Task task = taskService.createTaskQuery()
            .processInstanceId(ticket.getProcessInstanceId())
            .taskDefinitionKey("qualify_ticket")
            .orderByTaskCreateTime()
            .desc()
            .listPage(0, 1)
            .stream()
            .findFirst()
            .orElse(null);

        if (task == null) {
            return false;
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("assignedAgentId", String.valueOf(ticket.getAssignedAgent().getId()));
        variables.put("assignedAgentName", ticket.getAssignedAgent().getFullName());

        taskService.complete(task.getId(), variables);
        log.info("Camunda bootstrap: workflow avance vers resolve_ticket pour {}", ticket.getReference());
        return true;
    }

    private record BootstrapResult(String ticketReference, boolean started, boolean shouldAdvance) {}
}
