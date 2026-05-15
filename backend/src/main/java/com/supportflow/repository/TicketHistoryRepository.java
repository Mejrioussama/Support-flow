package com.supportflow.repository;

import com.supportflow.entity.TicketHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository pour l'entité TicketHistory
 */
@Repository
public interface TicketHistoryRepository extends JpaRepository<TicketHistory, Long> {
    
    List<TicketHistory> findByTicketIdOrderByCreatedAtDesc(Long ticketId);
    
    Page<TicketHistory> findByTicketId(Long ticketId, Pageable pageable);
    
    List<TicketHistory> findByUserId(Long userId);
    
    @Query("SELECT h FROM TicketHistory h WHERE h.ticket.id = :ticketId AND h.action = :action ORDER BY h.createdAt DESC")
    List<TicketHistory> findByTicketIdAndAction(@Param("ticketId") Long ticketId, @Param("action") String action);
    
    @Query("SELECT h FROM TicketHistory h WHERE h.createdAt >= :startDate ORDER BY h.createdAt DESC")
    List<TicketHistory> findRecentHistory(@Param("startDate") LocalDateTime startDate);
    
    @Query("SELECT h.action, COUNT(h) FROM TicketHistory h WHERE h.ticket.id = :ticketId GROUP BY h.action")
    List<Object[]> countActionsByTicketId(@Param("ticketId") Long ticketId);
    
    @Query("SELECT COUNT(h) FROM TicketHistory h WHERE h.ticket.id = :ticketId")
    long countByTicketId(@Param("ticketId") Long ticketId);

    boolean existsByTicketIdAndAction(Long ticketId, String action);

    boolean existsByTicketIdAndActionAndCreatedAtAfter(Long ticketId, String action, LocalDateTime createdAt);
}
