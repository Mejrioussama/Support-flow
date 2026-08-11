package com.supportflow.config;

import com.supportflow.entity.enums.WorkflowSyncStatus;
import com.supportflow.repository.WorkflowSyncJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("workflowSync")
@RequiredArgsConstructor
public class WorkflowSyncHealthIndicator implements HealthIndicator {
    private final WorkflowSyncJobRepository repository;

    @Override
    public Health health() {
        long pending = repository.countByStatus(WorkflowSyncStatus.PENDING);
        long failed = repository.countByStatus(WorkflowSyncStatus.FAILED);
        return Health.up()
            .withDetail("pending", pending)
            .withDetail("failed", failed)
            .withDetail("state", failed > 0 ? "DEGRADED" : "READY")
            .build();
    }
}
