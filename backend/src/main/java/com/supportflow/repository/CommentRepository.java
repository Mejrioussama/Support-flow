package com.supportflow.repository;

import com.supportflow.entity.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository pour l'entité Comment
 */
@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
    
    List<Comment> findByTicketIdOrderByCreatedAtDesc(Long ticketId);
    
    Page<Comment> findByTicketId(Long ticketId, Pageable pageable);
    
    List<Comment> findByAuthorId(Long authorId);
    
    @Query("SELECT c FROM Comment c WHERE c.ticket.id = :ticketId AND c.isInternal = false ORDER BY c.createdAt DESC")
    List<Comment> findPublicCommentsByTicketId(@Param("ticketId") Long ticketId);
    
    @Query("SELECT c FROM Comment c WHERE c.ticket.id = :ticketId AND c.isSolution = true")
    List<Comment> findSolutionCommentsByTicketId(@Param("ticketId") Long ticketId);
    
    @Query("SELECT COUNT(c) FROM Comment c WHERE c.ticket.id = :ticketId")
    long countByTicketId(@Param("ticketId") Long ticketId);
    
    @Query("SELECT COUNT(c) FROM Comment c WHERE c.author.id = :authorId")
    long countByAuthorId(@Param("authorId") Long authorId);
}
