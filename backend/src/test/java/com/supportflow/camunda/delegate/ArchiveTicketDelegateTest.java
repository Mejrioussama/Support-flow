package com.supportflow.camunda.delegate;

import com.supportflow.entity.Ticket;
import com.supportflow.service.TicketService;
import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ArchiveTicketDelegateTest {

    @Mock
    private TicketService ticketService;

    @Mock
    private DelegateExecution execution;

    @InjectMocks
    private ArchiveTicketDelegate archiveTicketDelegate;

    @Test
    void testExecute_Success() throws Exception {
        Long ticketId = 1L;
        String ticketReference = "SF-0001";

        when(execution.getVariable("ticketId")).thenReturn(ticketId);
        when(execution.getVariable("ticketReference")).thenReturn(ticketReference);
        doNothing().when(ticketService).archiveTicketFromWorkflow(ticketId);

        archiveTicketDelegate.execute(execution);

        verify(ticketService, times(1)).archiveTicketFromWorkflow(ticketId);
    }

    @Test
    void testExecute_ArchiveFailure() throws Exception {
        Long ticketId = 1L;
        String ticketReference = "SF-0001";

        when(execution.getVariable("ticketId")).thenReturn(ticketId);
        when(execution.getVariable("ticketReference")).thenReturn(ticketReference);
        doThrow(new RuntimeException("Alfresco connection failed"))
            .when(ticketService).archiveTicketFromWorkflow(ticketId);

        assertThrows(RuntimeException.class, () -> archiveTicketDelegate.execute(execution));

        verify(ticketService, times(1)).archiveTicketFromWorkflow(ticketId);
    }

    @Test
    void testExecute_NullTicketId() throws Exception {
        when(execution.getVariable("ticketId")).thenReturn(null);
        when(execution.getVariable("ticketReference")).thenReturn("SF-0002");

        archiveTicketDelegate.execute(execution);

        verify(ticketService, times(1)).archiveTicketFromWorkflow(null);
    }
}
