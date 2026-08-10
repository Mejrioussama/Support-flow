package com.supportflow.repository;

import com.supportflow.entity.WorkflowSyncJob;
import com.supportflow.entity.enums.WorkflowSyncStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WorkflowSyncJobRepository extends JpaRepository<WorkflowSyncJob, Long> {

    Optional<WorkflowSyncJob> findByIdempotencyKey(String idempotencyKey);

    long countByStatus(WorkflowSyncStatus status);

    @Query(value = """
        SELECT * FROM workflow_sync_jobs
        WHERE status = 'PENDING' AND next_attempt_at <= CURRENT_TIMESTAMP
        ORDER BY next_attempt_at, id
        LIMIT 20
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<WorkflowSyncJob> lockDueBatch();

    @Query("select j from WorkflowSyncJob j where j.ticket.id = :ticketId order by j.createdAt desc")
    List<WorkflowSyncJob> findRecentForTicket(@Param("ticketId") Long ticketId);
}
