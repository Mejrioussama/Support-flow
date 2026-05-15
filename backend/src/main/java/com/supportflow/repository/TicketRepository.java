package com.supportflow.repository;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.entity.enums.TicketType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository pour l'entité Ticket
 */
@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {
    
    Optional<Ticket> findByReference(String reference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Ticket t WHERE t.id = :id")
    Optional<Ticket> findByIdForUpdate(@Param("id") Long id);
    
    boolean existsByReference(String reference);
    
    // Recherche par statut
    List<Ticket> findByStatus(TicketStatus status);
    
    Page<Ticket> findByStatus(TicketStatus status, Pageable pageable);
    
    List<Ticket> findByStatusIn(List<TicketStatus> statuses);
    
    // Recherche par priorité
    List<Ticket> findByPriority(Priority priority);
    
    Page<Ticket> findByPriority(Priority priority, Pageable pageable);
    
    // Recherche par type
    List<Ticket> findByType(TicketType type);
    
    // Recherche par client
    Page<Ticket> findByClientId(Long clientId, Pageable pageable);

    Page<Ticket> findByClientIdAndStatus(Long clientId, TicketStatus status, Pageable pageable);
    
    List<Ticket> findByClientIdAndStatusNot(Long clientId, TicketStatus status);
    
    // Recherche par agent assigné
    Page<Ticket> findByAssignedAgentId(Long agentId, Pageable pageable);

    Page<Ticket> findByAssignedAgentIdAndStatus(Long agentId, TicketStatus status, Pageable pageable);
    
    List<Ticket> findByAssignedAgentIdAndStatusIn(Long agentId, List<TicketStatus> statuses);
    
    // Tickets non assignés
    @Query("SELECT t FROM Ticket t WHERE t.assignedAgent IS NULL AND t.status IN ('NEW', 'OPEN')")
    List<Ticket> findUnassignedTickets();
    
    // SLA Management
    @Query("SELECT t FROM Ticket t WHERE t.slaDeadline < :now AND t.slaBreached = false " +
           "AND t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')")
    List<Ticket> findTicketsWithBreachedSla(@Param("now") LocalDateTime now);
    
    @Query("SELECT t FROM Ticket t WHERE t.slaDeadline BETWEEN :now AND :warningTime " +
           "AND t.slaWarningSent = false " +
           "AND t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')")
    List<Ticket> findTicketsApproachingSla(@Param("now") LocalDateTime now, 
                                           @Param("warningTime") LocalDateTime warningTime);
    
    // Recherche textuelle
    @Query("SELECT t FROM Ticket t WHERE " +
           "LOWER(t.reference) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.description) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Ticket> searchTickets(@Param("search") String search, Pageable pageable);
    
    // Statistiques
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status = :status")
    long countByStatus(@Param("status") TicketStatus status);

    @Query("SELECT t FROM Ticket t WHERE t.status = 'ASSIGNED' " +
           "AND t.assignedAt IS NOT NULL AND t.assignedAt < :cutoff")
    List<Ticket> findStuckAssignedTickets(@Param("cutoff") LocalDateTime cutoff);

    @Query("SELECT t FROM Ticket t WHERE t.slaDeadline IS NOT NULL " +
           "AND t.slaDeadline > :now " +
           "AND t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')")
    List<Ticket> findActiveTicketsForSlaWarning(@Param("now") LocalDateTime now);

    @Query("SELECT t FROM Ticket t WHERE t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED') " +
           "AND (COALESCE(t.escalationLevel, 0) >= 2 OR t.status = 'ESCALATED_SLA') " +
           "AND COALESCE(t.escalatedAt, t.lastEscalationAt, t.updatedAt) <= :threshold")
    List<Ticket> findSlaEscalatedOlderThan(@Param("threshold") LocalDateTime threshold);

    @Query("SELECT t FROM Ticket t WHERE t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED') " +
           "AND (COALESCE(t.escalationLevel, 0) >= 2 OR t.status = 'ESCALATED_SLA') " +
           "AND (t.lastEscalationAt IS NOT NULL AND t.lastEscalationAt <= :cutoff) " +
           "AND COALESCE(t.escalationLevel, 0) < 3")
    List<Ticket> findSlaEscalatedWithoutRecentAction(@Param("cutoff") LocalDateTime cutoff);
    
    // SLA Pause/Resume support
    @Query("SELECT t FROM Ticket t WHERE t.status = :status AND (t.slaPaused = :paused OR t.slaPaused IS NULL AND :paused = false)")
    List<Ticket> findByStatusAndSlaPaused(@Param("status") TicketStatus status, @Param("paused") boolean paused);

    @Query("SELECT t FROM Ticket t WHERE t.status = 'PENDING' AND t.updatedAt <= :threshold")
    List<Ticket> findPendingTicketsOlderThan(@Param("threshold") LocalDateTime threshold);
    
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.priority = :priority")
    long countByPriority(@Param("priority") Priority priority);

    long countByAssignedAgentIdAndStatusIn(Long agentId, List<TicketStatus> statuses);

    long countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(Long agentId, List<TicketStatus> statuses);

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.assignedAgent.id = :agentId " +
           "AND LOWER(t.category) = LOWER(:category) " +
           "AND t.status NOT IN ('CLOSED', 'CANCELLED')")
    long countByAssignedAgentAndCategory(@Param("agentId") Long agentId, @Param("category") String category);

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.assignedAgent.id = :agentId " +
           "AND t.normalizedCategory.code = :categoryCode " +
           "AND t.status NOT IN ('CLOSED', 'CANCELLED')")
    long countByAssignedAgentAndNormalizedCategory(@Param("agentId") Long agentId, @Param("categoryCode") String categoryCode);
    
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.createdAt >= :startDate")
    long countTicketsCreatedSince(@Param("startDate") LocalDateTime startDate);
    
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.resolvedAt >= :startDate")
    long countTicketsResolvedSince(@Param("startDate") LocalDateTime startDate);
    
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.slaBreached = true")
    long countSlaBreachedTickets();

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED') " +
           "AND (t.slaPhase = 'AT_RISK' OR COALESCE(t.escalationLevel, 0) >= 1 OR t.status = 'ESCALATED_SLA')")
    long countSlaAtRiskTickets();

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED') " +
           "AND (COALESCE(t.escalationLevel, 0) >= 2 OR t.status = 'ESCALATED_SLA')")
    long countEscalatedAttentionTickets();

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED') " +
           "AND t.slaDeadline IS NOT NULL AND t.slaDeadline > :now " +
           "AND (t.slaWarningSent = false OR t.slaWarningSent IS NULL)")
    long countSlaOnTrackTickets(@Param("now") LocalDateTime now);
    
    // Moyennes
    @Query("SELECT AVG(t.resolutionTimeMinutes) FROM Ticket t WHERE t.resolutionTimeMinutes IS NOT NULL")
    Double getAverageResolutionTime();
    
    @Query("SELECT AVG(t.satisfactionRating) FROM Ticket t WHERE t.satisfactionRating IS NOT NULL")
    Double getAverageSatisfactionRating();
    
    // Dashboard queries
    @Query("SELECT t.status, COUNT(t) FROM Ticket t GROUP BY t.status")
    List<Object[]> countTicketsByStatus();
    
    @Query("SELECT t.priority, COUNT(t) FROM Ticket t GROUP BY t.priority")
    List<Object[]> countTicketsByPriority();
    
    @Query("SELECT t.type, COUNT(t) FROM Ticket t GROUP BY t.type")
    List<Object[]> countTicketsByType();
    
    @Query("SELECT FUNCTION('DATE', t.createdAt), COUNT(t) FROM Ticket t " +
           "WHERE t.createdAt >= :startDate " +
           "GROUP BY FUNCTION('DATE', t.createdAt) " +
           "ORDER BY FUNCTION('DATE', t.createdAt)")
    List<Object[]> countTicketsByDay(@Param("startDate") LocalDateTime startDate);
    
    @Query("SELECT t.assignedAgent.id, t.assignedAgent.firstName, t.assignedAgent.lastName, COUNT(t) " +
           "FROM Ticket t WHERE t.assignedAgent IS NOT NULL " +
           "GROUP BY t.assignedAgent.id, t.assignedAgent.firstName, t.assignedAgent.lastName")
    List<Object[]> countTicketsByAgent();
    
    // Génération de référence
    @Query("SELECT MAX(CAST(SUBSTRING(t.reference, 4) AS integer)) FROM Ticket t " +
           "WHERE t.reference LIKE 'SF-%'")
    Integer findMaxReferenceNumber();
    
    // Tickets récents
    @Query("SELECT t FROM Ticket t ORDER BY t.createdAt DESC")
    Page<Ticket> findRecentTickets(Pageable pageable);
    
    // Tickets par catégorie
    @Query("SELECT t.category, COUNT(t) FROM Ticket t WHERE t.category IS NOT NULL GROUP BY t.category")
    List<Object[]> countTicketsByCategory();
    
    // Performance agent
    @Query("SELECT t.assignedAgent.id, AVG(t.resolutionTimeMinutes), COUNT(t), AVG(t.satisfactionRating) " +
           "FROM Ticket t " +
           "WHERE t.assignedAgent IS NOT NULL AND t.resolvedAt IS NOT NULL " +
           "GROUP BY t.assignedAgent.id")
    List<Object[]> getAgentPerformanceStats();
    
    // Client-specific stats
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.client.id = :clientId AND t.status = :status")
    long countByClientIdAndStatus(@Param("clientId") Long clientId, @Param("status") TicketStatus status);
    
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.client.id = :clientId AND t.priority = :priority")
    long countByClientIdAndPriority(@Param("clientId") Long clientId, @Param("priority") Priority priority);
}
