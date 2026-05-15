package com.supportflow.repository;

import com.supportflow.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository pour l'entité Notification
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    Page<Notification> findByUserId(Long userId, Pageable pageable);
    
    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(Long userId);
    
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId ORDER BY n.createdAt DESC")
    Page<Notification> findUserNotifications(@Param("userId") Long userId, Pageable pageable);
    
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.user.id = :userId AND n.isRead = false")
    long countUnreadByUserId(@Param("userId") Long userId);
    
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = :readAt WHERE n.user.id = :userId AND n.isRead = false")
    int markAllAsReadByUserId(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);
    
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :beforeDate")
    int deleteOldNotifications(@Param("beforeDate") LocalDateTime beforeDate);
    
    List<Notification> findByTicketId(Long ticketId);
    
    @Query("SELECT n FROM Notification n WHERE n.type = :type AND n.user.id = :userId ORDER BY n.createdAt DESC")
    List<Notification> findByTypeAndUserId(@Param("type") String type, @Param("userId") Long userId);

    long deleteByIdAndUserId(Long id, Long userId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.user.id = :userId AND n.isRead = true")
    int deleteReadByUserId(@Param("userId") Long userId);
}
