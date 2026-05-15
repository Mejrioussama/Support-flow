package com.supportflow.repository;

import com.supportflow.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour l'entité Attachment
 */
@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    
    List<Attachment> findByTicketId(Long ticketId);
    
    Optional<Attachment> findByFileName(String fileName);
    
    Optional<Attachment> findByAlfrescoNodeId(String alfrescoNodeId);
    
    @Query("SELECT a FROM Attachment a WHERE a.ticket.id = :ticketId ORDER BY a.createdAt DESC")
    List<Attachment> findByTicketIdOrderByCreatedAtDesc(@Param("ticketId") Long ticketId);
    
    @Query("SELECT COUNT(a) FROM Attachment a WHERE a.ticket.id = :ticketId")
    long countByTicketId(@Param("ticketId") Long ticketId);
    
    @Query("SELECT SUM(a.fileSize) FROM Attachment a WHERE a.ticket.id = :ticketId")
    Long getTotalFileSizeByTicketId(@Param("ticketId") Long ticketId);
    
    @Query("SELECT a FROM Attachment a WHERE a.contentType LIKE :contentTypePrefix%")
    List<Attachment> findByContentTypeStartingWith(@Param("contentTypePrefix") String contentTypePrefix);
    
    void deleteByTicketId(Long ticketId);
}
