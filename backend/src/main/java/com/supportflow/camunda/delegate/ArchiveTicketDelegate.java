package com.supportflow.camunda.delegate;

import com.supportflow.service.TicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

/**
 * Delegate Camunda pour l'archivage strict des tickets dans Alfresco.
 */
@Component("archiveTicketDelegate")
@RequiredArgsConstructor
@Slf4j
public class ArchiveTicketDelegate implements JavaDelegate {

    private final TicketService ticketService;

    @Override
    public void execute(DelegateExecution execution) throws Exception {
        Long ticketId = (Long) execution.getVariable("ticketId");
        String ticketReference = (String) execution.getVariable("ticketReference");

        log.info("Archivage workflow du ticket: {}", ticketReference);
        ticketService.archiveTicketFromWorkflow(ticketId);
        log.info("Ticket {} archive via workflow Camunda", ticketReference);
    }
}
