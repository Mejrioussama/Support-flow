package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.WorkflowSyncJob;
import com.supportflow.entity.enums.WorkflowSyncAction;
import com.supportflow.entity.enums.WorkflowSyncStatus;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.WorkflowSyncJobRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowSyncServiceTest {

    @Mock private WorkflowSyncJobRepository jobRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private TicketHistoryRepository historyRepository;
    @Mock private CamundaService camundaService;
    @Mock private ReportService reportService;

    private WorkflowSyncService service;

    @BeforeEach
    void setUp() {
        service = new WorkflowSyncService(jobRepository, ticketRepository, historyRepository,
            camundaService, reportService, new SimpleMeterRegistry());
        ReflectionTestUtils.setField(service, "defaultMaxAttempts", 3);
        ReflectionTestUtils.setField(service, "initialBackoffSeconds", 1L);
        ReflectionTestUtils.setField(service, "maxBackoffSeconds", 30L);
        ReflectionTestUtils.setField(service, "enabled", true);
    }

    @Test
    void enqueueUsesStableIdempotencyKey() {
        Ticket ticket = ticket(7L);
        WorkflowSyncJob existing = WorkflowSyncJob.builder().idempotencyKey("7:START:CREATE").build();
        when(jobRepository.findByIdempotencyKey("7:START:CREATE"))
            .thenReturn(Optional.empty(), Optional.of(existing));
        when(jobRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        WorkflowSyncJob first = service.enqueue(ticket, WorkflowSyncAction.START, null, "CREATE");
        WorkflowSyncJob duplicate = service.enqueue(ticket, WorkflowSyncAction.START, null, "CREATE");

        assertEquals("7:START:CREATE", first.getIdempotencyKey());
        assertSame(existing, duplicate);
        verify(jobRepository).save(any(WorkflowSyncJob.class));
    }

    @Test
    void startsMissingProcessExactlyOnceForLockedJob() {
        Ticket ticket = ticket(8L);
        WorkflowSyncJob job = pendingJob(ticket, WorkflowSyncAction.START, 3);
        when(jobRepository.lockDueBatch()).thenReturn(List.of(job));
        when(ticketRepository.findById(8L)).thenReturn(Optional.of(ticket));
        when(camundaService.startTicketProcess(ticket)).thenReturn("process-8");

        service.processDueJobs();

        assertEquals(WorkflowSyncStatus.SUCCEEDED, job.getStatus());
        assertEquals("process-8", ticket.getProcessInstanceId());
        assertNotNull(job.getCompletedAt());
        verify(ticketRepository).save(ticket);
    }

    @Test
    void exhaustedRetryIsPersistedInTicketHistory() {
        Ticket ticket = ticket(9L);
        WorkflowSyncJob job = pendingJob(ticket, WorkflowSyncAction.START, 1);
        when(jobRepository.lockDueBatch()).thenReturn(List.of(job));
        when(ticketRepository.findById(9L)).thenReturn(Optional.of(ticket));
        when(camundaService.startTicketProcess(ticket)).thenThrow(new IllegalStateException("camunda down"));

        service.processDueJobs();

        assertEquals(WorkflowSyncStatus.FAILED, job.getStatus());
        assertEquals(1, job.getAttemptCount());
        verify(historyRepository).save(any(TicketHistory.class));
    }

    @Test
    void archiveRetriesAlfrescoAndRequiresCamundaCompletion() {
        Ticket ticket = ticket(10L);
        ticket.setProcessInstanceId("process-10");
        WorkflowSyncJob job = pendingJob(ticket, WorkflowSyncAction.ARCHIVE, 3);
        when(jobRepository.lockDueBatch()).thenReturn(List.of(job));
        when(ticketRepository.findById(10L)).thenReturn(Optional.of(ticket));
        when(camundaService.reconcileClosedTicketProcess(ticket)).thenReturn(Map.of("completed", true));

        service.processDueJobs();

        verify(reportService).archiveToAlfresco(ticket);
        assertEquals(WorkflowSyncStatus.SUCCEEDED, job.getStatus());
    }

    @Test
    void disabledWorkerDoesNotLockQueue() {
        ReflectionTestUtils.setField(service, "enabled", false);

        service.processDueJobs();

        verify(jobRepository, never()).lockDueBatch();
    }

    private Ticket ticket(Long id) {
        Ticket ticket = new Ticket();
        ticket.setId(id);
        ticket.setReference("SF-" + id);
        return ticket;
    }

    private WorkflowSyncJob pendingJob(Ticket ticket, WorkflowSyncAction action, int maxAttempts) {
        return WorkflowSyncJob.builder()
            .ticket(ticket)
            .action(action)
            .status(WorkflowSyncStatus.PENDING)
            .idempotencyKey(ticket.getId() + ":" + action + ":test")
            .attemptCount(0)
            .maxAttempts(maxAttempts)
            .nextAttemptAt(LocalDateTime.now())
            .build();
    }
}
