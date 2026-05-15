package com.supportflow.camunda.delegate;

import com.supportflow.entity.Ticket;
import com.supportflow.repository.TicketRepository;
import com.supportflow.service.TicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

/**
 * Delegate Camunda pour les notifications SLA
 */
@Component("slaNotificationDelegate")
@RequiredArgsConstructor
@Slf4j
public class SlaNotificationDelegate implements JavaDelegate {
    
    private final TicketRepository ticketRepository;
    private final TicketService ticketService;
    
    @Override
    public void execute(DelegateExecution execution) throws Exception {
        Long ticketId = (Long) execution.getVariable("ticketId");
        String ticketReference = (String) execution.getVariable("ticketReference");
        
        log.info("Notification SLA déclenchée pour le ticket: {}", ticketReference);
        
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        
        if (ticket != null) {
            ticketService.escalateSLA(ticketId);
            log.info("Escalade SLA automatique exécutée pour {}", ticketReference);
        } else {
            log.warn("Ticket non trouvé: {}", ticketId);
        }
    }
}
