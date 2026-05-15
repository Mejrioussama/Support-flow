package com.supportflow.service;

import com.supportflow.dto.TicketResponseDTO;
import com.supportflow.entity.*;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.exception.ArchiveIntegrationException;
import com.supportflow.exception.BusinessException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TicketArchiveServiceTest {

    @Mock private TicketRepository ticketRepository;
    @Mock private AttachmentRepository attachmentRepository;
    @Mock private TicketHistoryRepository historyRepository;
    @Mock private UserRepository userRepository;
    @Mock private CamundaService camundaService;
    @Mock private CamundaAsyncService camundaAsyncService;
    @Mock private KeycloakAdminService keycloakAdminService;
    @Mock private ReportService reportService;
    @Mock private NotificationService notificationService;
    @Mock private EntityMapper mapper;

    @InjectMocks private TicketService ticketService;

    private Ticket testTicket;
    private Client testClient;
    private User testAgent;
    private User testUser;

    @BeforeEach
    void setUp() {
        testClient = new Client();
        testClient.setId(1L);
        testClient.setCompanyName("Test Client");

        testAgent = new User();
        testAgent.setId(2L);
        testAgent.setUsername("agent1");
        testAgent.setFirstName("Agent");
        testAgent.setLastName("One");

        testUser = new User();
        testUser.setId(3L);
        testUser.setUsername("manager");
        testUser.setFirstName("Manager");
        testUser.setLastName("User");

        testTicket = new Ticket();
        testTicket.setId(1L);
        testTicket.setReference("SF-0001");
        testTicket.setTitle("Test Ticket");
        testTicket.setStatus(TicketStatus.RESOLVED);
        testTicket.setResolutionSummary("Issue resolved");
        testTicket.setClient(testClient);
        testTicket.setAssignedAgent(testAgent);
        testTicket.setCreatedAt(LocalDateTime.now().minusDays(1));

        when(mapper.toTicketResponseDTO(any(Ticket.class))).thenAnswer(invocation -> {
            Ticket ticket = invocation.getArgument(0);
            return TicketResponseDTO.builder()
                .id(ticket.getId())
                .reference(ticket.getReference())
                .status(ticket.getStatus())
                .satisfactionRating(ticket.getSatisfactionRating())
                .build();
        });
    }

    /**
     * Test 1: Manual archiving success on CLOSED ticket
     */
    @Test
    void testArchiveTicketManualSuccess() {
        testTicket.setStatus(TicketStatus.CLOSED);
        when(ticketRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);
        when(userRepository.findById(3L)).thenReturn(Optional.of(testUser));

        // Don't throw exception from reportService
        doNothing().when(reportService).archiveToAlfresco(testTicket);

        var result = ticketService.archiveTicket(1L, 3L);

        assertNotNull(result);
        assertEquals(TicketStatus.CLOSED, result.getStatus());
        verify(reportService, times(1)).archiveToAlfresco(testTicket);
        verify(ticketRepository, times(1)).saveAndFlush(testTicket);
        verify(historyRepository, times(1)).save(any(TicketHistory.class));
    }

    /**
     * Test 2: Archive fails if ticket not CLOSED
     */
    @Test
    void testArchiveTicketNotClosed() {
        testTicket.setStatus(TicketStatus.RESOLVED);
        when(ticketRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testTicket));

        assertThrows(BusinessException.class, () -> ticketService.archiveTicket(1L, null));
        verify(reportService, never()).archiveToAlfresco(any());
    }

    /**
     * Test 3: Archive logs sync issue when Alfresco is down
     */
    @Test
    void testArchiveTicketAlfresco502() {
        testTicket.setStatus(TicketStatus.CLOSED);
        when(ticketRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);
        doThrow(new ArchiveIntegrationException("Aucun repository CMIS Alfresco disponible"))
            .when(reportService).archiveToAlfresco(testTicket);

        var result = ticketService.archiveTicket(1L, null);

        assertNotNull(result);
        assertEquals(TicketStatus.CLOSED, result.getStatus());
        verify(ticketRepository, times(1)).saveAndFlush(testTicket);
        verify(historyRepository, atLeastOnce()).save(any(TicketHistory.class));
    }

    /**
     * Test 4: Idempotent archiving - second archive call is no-op if alfrescoFolderId already set
     */
    @Test
    void testArchiveTicketIdempotent() {
        testTicket.setStatus(TicketStatus.CLOSED);
        testTicket.setAlfrescoFolderId("existing-folder-id");
        when(ticketRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);

        var result = ticketService.archiveTicket(1L, null);

        assertNotNull(result);
        // reportService should NOT be called because archive already exists
        verify(reportService, never()).archiveToAlfresco(any());
    }

    /**
     * Test 5: Close ticket with archive - success path
     */
    @Test
    void testCloseTicketSuccess() {
        testTicket.setStatus(TicketStatus.RESOLVED);
        testTicket.setProcessInstanceId("camunda-process-123");

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);
        doNothing().when(reportService).archiveToAlfresco(testTicket);
        doNothing().when(camundaAsyncService).completeValidationTaskAsync(testTicket, true);
        doNothing().when(notificationService).notifyStatusChanged(testTicket, TicketStatus.CLOSED);
        doNothing().when(notificationService).broadcastTicketStatusChange(any(), any(), any());

        var result = ticketService.closeTicket(1L, 5, "Great resolution!");

        assertNotNull(result);
        assertEquals(TicketStatus.CLOSED, result.getStatus());
        assertEquals(5, result.getSatisfactionRating());
        verify(reportService, times(1)).archiveToAlfresco(testTicket);
        verify(ticketRepository, atLeast(2)).saveAndFlush(testTicket);
    }

    /**
     * Test 6: Close ticket tolerates archive failure and records sync issue
     */
    @Test
    void testCloseTicketArchiveFailure() {
        testTicket.setStatus(TicketStatus.RESOLVED);

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);
        doThrow(new ArchiveIntegrationException("Configuration Alfresco incomplete pour l'archivage GED"))
            .when(reportService).archiveToAlfresco(testTicket);

        var result = ticketService.closeTicket(1L, 5, "Great resolution!");

        assertNotNull(result);
        assertEquals(TicketStatus.CLOSED, result.getStatus());
        verify(historyRepository, atLeastOnce()).save(any(TicketHistory.class));
    }

    /**
     * Test 7: Close ticket tolerates Camunda sync failure
     */
    @Test
    void testCloseTicketCamundaFailure() {
        testTicket.setStatus(TicketStatus.RESOLVED);
        testTicket.setProcessInstanceId("camunda-process-123");

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);
        doNothing().when(reportService).archiveToAlfresco(testTicket);
        doThrow(new IllegalStateException("Camunda: impossible de compléter la tâche de validation client pour SF-0001"))
            .when(camundaAsyncService).completeValidationTaskAsync(testTicket, true);

        var result = ticketService.closeTicket(1L, 5, "Great resolution!");

        assertNotNull(result);
        assertEquals(TicketStatus.CLOSED, result.getStatus());
        verify(reportService, times(1)).archiveToAlfresco(testTicket);
    }

    /**
     * Test 8: Close ticket with invalid satisfaction rating
     */
    @Test
    void testCloseTicketInvalidRating() {
        testTicket.setStatus(TicketStatus.RESOLVED);

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        assertThrows(BusinessException.class, 
            () -> ticketService.closeTicket(1L, 6, "Invalid rating!"));
        verify(reportService, never()).archiveToAlfresco(any());
    }

    /**
     * Test 9: Close ticket without resolution summary
     */
    @Test
    void testCloseTicketNoResolutionSummary() {
        testTicket.setStatus(TicketStatus.RESOLVED);
        testTicket.setResolutionSummary(null);

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        assertThrows(BusinessException.class, 
            () -> ticketService.closeTicket(1L, 5, "No summary!"));
        verify(reportService, never()).archiveToAlfresco(any());
    }

    /**
     * Test 10: Archive from workflow (archiveTicketFromWorkflow) enforces CLOSED status
     */
    @Test
    void testArchiveFromWorkflowForcesClosedStatus() {
        testTicket.setStatus(TicketStatus.RESOLVED);
        testTicket.setClosedAt(null);

        when(ticketRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.saveAndFlush(testTicket)).thenReturn(testTicket);
        doNothing().when(reportService).archiveToAlfresco(testTicket);

        ticketService.archiveTicketFromWorkflow(1L);

        // Status should have been changed to CLOSED
        assertEquals(TicketStatus.CLOSED, testTicket.getStatus());
        assertNotNull(testTicket.getClosedAt());
        verify(reportService, times(1)).archiveToAlfresco(testTicket);
        verify(ticketRepository, atLeast(2)).saveAndFlush(testTicket);
    }
}
