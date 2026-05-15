package com.supportflow.service;

import com.supportflow.dto.CommentDTO;
import com.supportflow.entity.Comment;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.CommentRepository;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Service de gestion des commentaires
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CommentService {
    
    private final CommentRepository commentRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final TicketHistoryRepository historyRepository;
    private final EntityMapper mapper;
    private final NotificationService notificationService;
    private final CamundaService camundaService;
    private final SlaComputationService slaComputationService;
    
    /**
     * Ajoute un commentaire à un ticket
     */
    public CommentDTO addComment(Long ticketId, CommentDTO dto, Long userId) {
        log.info("Ajout d'un commentaire au ticket: {}", ticketId);
        
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvé: " + ticketId));
        
        User author = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé: " + userId));
        
        Comment comment = Comment.builder()
            .content(dto.getContent())
            .isInternal(dto.getIsInternal() != null ? dto.getIsInternal() : false)
            .isSolution(dto.getIsSolution() != null ? dto.getIsSolution() : false)
            .ticket(ticket)
            .author(author)
            .build();
        
        // Parent comment si réponse
        if (dto.getParentId() != null) {
            Comment parent = commentRepository.findById(dto.getParentId())
                .orElseThrow(() -> new ResourceNotFoundException("Commentaire parent non trouvé"));
            comment.setParent(parent);
        }
        
        comment = commentRepository.save(comment);
        
        // Historique
        TicketHistory history = TicketHistory.createComment(ticket, author);
        historyRepository.save(history);
        
        // Notification
        notificationService.notifyNewComment(ticket, author);
        
        // Broadcast temps réel via WebSocket
        notificationService.broadcastNewComment(ticketId, ticket.getReference(), 
            author.getFullName(), dto.getContent());
        
        // Si c'est marqué comme solution, mettre à jour le ticket
        if (Boolean.TRUE.equals(dto.getIsSolution())) {
            ticket.setResolutionSummary(dto.getContent());
            ticketRepository.save(ticket);
        }

        if (author.isClient() && !Boolean.TRUE.equals(comment.getIsInternal())
            && ticket.getStatus() == TicketStatus.PENDING && Boolean.TRUE.equals(ticket.getSlaPaused())) {
            TicketStatus previousStatus = ticket.getStatus();
            slaComputationService.resumeSla(ticket, LocalDateTime.now());
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticket.setLastCustomerResponseAt(LocalDateTime.now());
            ticket.setWaitingOn(null);
            ticket.setPendingReason(null);
            ticket.setSlaPauseReason(null);
            ticket.setSlaPhase(slaComputationService.computePhase(ticket));
            ticket = ticketRepository.save(ticket);

            TicketHistory resumeHistory = new TicketHistory();
            resumeHistory.setTicket(ticket);
            resumeHistory.setAction("CUSTOMER_RESPONSE_RECEIVED");
            resumeHistory.setOldValue(previousStatus.name());
            resumeHistory.setNewValue(TicketStatus.IN_PROGRESS.name());
            resumeHistory.setDescription("Le client a repondu. Le ticket repasse en traitement et le SLA reprend.");
            resumeHistory.setPerformedBy(author.getFullName());
            resumeHistory.setCreatedAt(LocalDateTime.now());
            historyRepository.save(resumeHistory);

            notificationService.notifyCustomerResponseReceived(ticket, author);
            notificationService.notifyStatusChanged(ticket, TicketStatus.IN_PROGRESS);
            notificationService.broadcastTicketStatusChange(ticket, previousStatus.name(), TicketStatus.IN_PROGRESS.name());
            Map<String, Object> event = new HashMap<>();
            event.put("authorName", author.getFullName());
            event.put("message", "Le client a repondu. Le ticket repasse en traitement.");
            notificationService.broadcastTicketEvent(ticket, "CUSTOMER_RESPONSE_RECEIVED", event);

            if (camundaService != null && ticket.getProcessInstanceId() != null) {
                try {
                    camundaService.rescheduleSlaTimer(ticket, ticket.getSlaDeadline());
                } catch (Exception e) {
                    log.warn("Impossible de relancer le timer SLA apres reponse client: {}", e.getMessage());
                }
            }
        }
        
        log.info("Commentaire ajouté: {}", comment.getId());
        return mapper.toCommentDTO(comment);
    }
    
    /**
     * Met à jour un commentaire
     */
    public CommentDTO updateComment(Long commentId, CommentDTO dto, Long userId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new ResourceNotFoundException("Commentaire non trouvé: " + commentId));
        
        // Vérifier que l'utilisateur est l'auteur
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new SecurityException("Vous ne pouvez modifier que vos propres commentaires");
        }
        
        if (dto.getContent() != null) comment.setContent(dto.getContent());
        if (dto.getIsInternal() != null) comment.setIsInternal(dto.getIsInternal());
        if (dto.getIsSolution() != null) comment.setIsSolution(dto.getIsSolution());
        
        comment = commentRepository.save(comment);
        return mapper.toCommentDTO(comment);
    }
    
    /**
     * Supprime un commentaire
     */
    public void deleteComment(Long commentId, Long userId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new ResourceNotFoundException("Commentaire non trouvé: " + commentId));
        
        // Vérifier que l'utilisateur est l'auteur ou admin
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé"));
        
        if (!comment.getAuthor().getId().equals(userId) && !user.isAdmin() && !user.isSupportManager()) {
            throw new SecurityException("Vous ne pouvez supprimer que vos propres commentaires");
        }
        
        commentRepository.delete(comment);
        log.info("Commentaire supprimé: {}", commentId);
    }
    
    /**
     * Récupère les commentaires d'un ticket
     */
    @Transactional(readOnly = true)
    public List<CommentDTO> getTicketComments(Long ticketId) {
        return mapper.toCommentDTOList(
            commentRepository.findByTicketIdOrderByCreatedAtDesc(ticketId));
    }
    
    /**
     * Récupère les commentaires publics d'un ticket
     */
    @Transactional(readOnly = true)
    public List<CommentDTO> getPublicTicketComments(Long ticketId) {
        return mapper.toCommentDTOList(
            commentRepository.findPublicCommentsByTicketId(ticketId));
    }
    
    /**
     * Récupère les commentaires avec pagination
     */
    @Transactional(readOnly = true)
    public Page<CommentDTO> getTicketCommentsPaginated(Long ticketId, Pageable pageable) {
        return commentRepository.findByTicketId(ticketId, pageable)
            .map(mapper::toCommentDTO);
    }
    
    /**
     * Compte les commentaires d'un ticket
     */
    @Transactional(readOnly = true)
    public long countTicketComments(Long ticketId) {
        return commentRepository.countByTicketId(ticketId);
    }
}
