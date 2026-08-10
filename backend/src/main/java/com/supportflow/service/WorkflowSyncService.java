package com.supportflow.service;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.WorkflowSyncJob;
import com.supportflow.entity.enums.TicketHistoryAction;
import com.supportflow.entity.enums.WorkflowSyncAction;
import com.supportflow.entity.enums.WorkflowSyncStatus;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.WorkflowSyncJobRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Gauge;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowSyncService implements WorkflowSynchronization {

    private final WorkflowSyncJobRepository jobRepository;
    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository historyRepository;
    private final CamundaService camundaService;
    private final ReportService reportService;
    private final MeterRegistry meterRegistry;

    @Value("${supportflow.workflow.sync.max-attempts:8}")
    private int defaultMaxAttempts;

    @Value("${supportflow.workflow.sync.initial-backoff-seconds:5}")
    private long initialBackoffSeconds;

    @Value("${supportflow.workflow.sync.max-backoff-seconds:900}")
    private long maxBackoffSeconds;

    @Value("${supportflow.workflow.camunda-enabled:true}")
    private boolean enabled;

    @PostConstruct
    void registerQueueMetrics() {
        Gauge.builder("supportflow.workflow.sync.jobs", jobRepository,
                repository -> repository.countByStatus(WorkflowSyncStatus.PENDING))
            .tag("status", "pending").register(meterRegistry);
        Gauge.builder("supportflow.workflow.sync.jobs", jobRepository,
                repository -> repository.countByStatus(WorkflowSyncStatus.FAILED))
            .tag("status", "failed").register(meterRegistry);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Override
    public WorkflowSyncJob enqueue(Ticket ticket, WorkflowSyncAction action, String payload, String eventKey) {
        String idempotencyKey = ticket.getId() + ":" + action + ":" + eventKey;
        return jobRepository.findByIdempotencyKey(idempotencyKey).orElseGet(() -> {
            WorkflowSyncJob job = WorkflowSyncJob.builder()
                .ticket(ticket)
                .action(action)
                .status(WorkflowSyncStatus.PENDING)
                .payload(payload)
                .idempotencyKey(idempotencyKey)
                .attemptCount(0)
                .maxAttempts(defaultMaxAttempts)
                .nextAttemptAt(LocalDateTime.now())
                .build();
            log.info("Workflow sync queued ticket={} action={} key={}", ticket.getReference(), action, idempotencyKey);
            return jobRepository.save(job);
        });
    }

    @Scheduled(fixedDelayString = "${supportflow.workflow.sync.poll-interval-ms:2000}")
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void processDueJobs() {
        if (!enabled) {
            return;
        }
        List<WorkflowSyncJob> jobs = jobRepository.lockDueBatch();
        for (WorkflowSyncJob job : jobs) {
            processLockedJob(job);
        }
    }

    @Scheduled(fixedDelayString = "${supportflow.workflow.sync.reconcile-interval-ms:60000}")
    @Transactional
    public void reconcileTicketWorkflows() {
        if (!enabled) {
            return;
        }

        ticketRepository.findTicketsMissingProcessInstance(PageRequest.of(0, 100))
            .forEach(ticket -> enqueue(ticket, WorkflowSyncAction.START, null, "RECONCILE"));
        ticketRepository.findClosedTicketsWithProcessInstance(PageRequest.of(0, 100))
            .forEach(ticket -> enqueue(ticket, WorkflowSyncAction.ARCHIVE, null,
                "RECONCILE:" + ticket.getProcessInstanceId()));
    }

    private void processLockedJob(WorkflowSyncJob job) {
        Ticket ticket = ticketRepository.findById(job.getTicket().getId()).orElse(null);
        if (ticket == null) {
            failPermanently(job, "Ticket no longer exists");
            return;
        }

        job.setStatus(WorkflowSyncStatus.PROCESSING);
        job.setAttemptCount(job.getAttemptCount() + 1);
        try {
            execute(job, ticket);
            job.setStatus(WorkflowSyncStatus.SUCCEEDED);
            job.setCompletedAt(LocalDateTime.now());
            job.setLastError(null);
            meterRegistry.counter("supportflow.workflow.sync.completed", "action", job.getAction().name()).increment();
            log.info("Workflow sync completed ticket={} action={} attempt={}",
                ticket.getReference(), job.getAction(), job.getAttemptCount());
        } catch (Exception exception) {
            scheduleRetry(job, ticket, exception);
        }
    }

    private void execute(WorkflowSyncJob job, Ticket ticket) {
        switch (job.getAction()) {
            case START -> {
                if (ticket.getProcessInstanceId() == null || ticket.getProcessInstanceId().isBlank()) {
                    ticket.setProcessInstanceId(camundaService.startTicketProcess(ticket));
                    ticketRepository.save(ticket);
                }
            }
            case ASSIGN -> requireProcess(ticket,
                () -> requireCompletion(camundaService.completeAssignmentTaskStrict(ticket), "assignment"));
            case RESOLVE -> requireProcess(ticket,
                () -> requireCompletion(camundaService.completeResolutionTaskStrict(ticket), "resolution"));
            case VALIDATE -> requireProcess(ticket,
                () -> completeValidation(ticket, Boolean.parseBoolean(job.getPayload())));
            case CLOSE -> requireProcess(ticket, () -> completeValidation(ticket, true));
            case ARCHIVE -> {
                if (ticket.getAlfrescoFolderId() == null || ticket.getAlfrescoFolderId().isBlank()) {
                    reportService.archiveToAlfresco(ticket);
                }
                Object completed = camundaService.reconcileClosedTicketProcess(ticket).get("completed");
                if (!Boolean.TRUE.equals(completed)) {
                    throw new IllegalStateException("Closed Camunda process is still active");
                }
            }
        }
    }

    private void requireProcess(Ticket ticket, Runnable action) {
        if (ticket.getProcessInstanceId() == null || ticket.getProcessInstanceId().isBlank()) {
            throw new IllegalStateException("Camunda process is not initialized yet");
        }
        action.run();
    }

    private void completeValidation(Ticket ticket, boolean validated) {
        requireCompletion(camundaService.completeValidationTaskStrict(ticket, validated), "validation");
    }

    private void requireCompletion(boolean completed, String task) {
        if (!completed) {
            throw new IllegalStateException("Camunda " + task + " task is not available yet");
        }
    }

    private void scheduleRetry(WorkflowSyncJob job, Ticket ticket, Exception exception) {
        String error = truncate(exception.getMessage() != null ? exception.getMessage() : exception.getClass().getSimpleName(), 1000);
        job.setLastError(error);
        meterRegistry.counter("supportflow.workflow.sync.failed_attempts", "action", job.getAction().name()).increment();

        if (job.getAttemptCount() >= job.getMaxAttempts()) {
            failPermanently(job, error);
            recordExhaustedFailure(ticket, job, error);
            return;
        }

        long multiplier = 1L << Math.min(job.getAttemptCount() - 1, 20);
        long delaySeconds = Math.min(maxBackoffSeconds, initialBackoffSeconds * multiplier);
        job.setStatus(WorkflowSyncStatus.PENDING);
        job.setNextAttemptAt(LocalDateTime.now().plusSeconds(delaySeconds));
        log.warn("Workflow sync retry scheduled ticket={} action={} attempt={} delay={}s error={}",
            ticket.getReference(), job.getAction(), job.getAttemptCount(), delaySeconds, error);
    }

    private void failPermanently(WorkflowSyncJob job, String error) {
        job.setStatus(WorkflowSyncStatus.FAILED);
        job.setLastError(truncate(error, 1000));
        job.setCompletedAt(LocalDateTime.now());
    }

    private void recordExhaustedFailure(Ticket ticket, WorkflowSyncJob job, String error) {
        TicketHistory history = new TicketHistory();
        history.setTicket(ticket);
        history.setAction(TicketHistoryAction.CAMUNDA_SYNC_FAILED);
        history.setFieldName("workflow");
        history.setDescription("Workflow synchronization exhausted retries for " + job.getAction());
        history.setNewValue(truncate(error, 500));
        history.setPerformedBy("System");
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);
    }

    private String truncate(String value, int maxLength) {
        return value != null && value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
