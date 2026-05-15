package com.supportflow.repository;

import com.supportflow.entity.EscalationEvent;
import com.supportflow.entity.enums.EscalationReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EscalationEventRepository extends JpaRepository<EscalationEvent, Long> {

    List<EscalationEvent> findByTicketIdOrderByCreatedAtDesc(Long ticketId);

    long countByTicketId(Long ticketId);

    @Query("SELECT COUNT(e) FROM EscalationEvent e WHERE e.ticket.id = :ticketId AND e.wasBlocked = false")
    long countEffectiveEscalations(@Param("ticketId") Long ticketId);

    @Query("SELECT e.toLevel, COUNT(e) FROM EscalationEvent e WHERE e.createdAt >= :since AND e.wasBlocked = false GROUP BY e.toLevel")
    List<Object[]> countByLevelSince(@Param("since") LocalDateTime since);

    @Query("SELECT AVG(TIMESTAMPDIFF(MINUTE, e.createdAt, " +
           "(SELECT MIN(e2.createdAt) FROM EscalationEvent e2 WHERE e2.ticket.id = e.ticket.id AND e2.fromLevel = e.toLevel AND e2.createdAt > e.createdAt))) " +
           "FROM EscalationEvent e WHERE e.toLevel = :level AND e.wasBlocked = false")
    Double avgTimeAtLevel(@Param("level") int level);

    List<EscalationEvent> findByReasonAndCreatedAtAfter(EscalationReason reason, LocalDateTime since);
}
