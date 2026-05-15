package com.supportflow.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Entité Notification utilisateur
 */
@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notification_user", columnList = "user_id"),
    @Index(name = "idx_notification_read", columnList = "is_read"),
    @Index(name = "idx_notification_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Notification extends BaseEntity {
    
    @Column(name = "title", nullable = false, length = 200)
    private String title;
    
    @Column(name = "message", columnDefinition = "TEXT")
    private String message;
    
    @Column(name = "type", length = 30)
    private String type;
    
    @Column(name = "icon", length = 50)
    private String icon;
    
    @Column(name = "link", length = 500)
    private String link;

    /** SLA percentage consumed at time of notification (0-100+) */
    @Column(name = "sla_percentage")
    private Integer slaPercentage;

    /** Whether this notification requires a manager action */
    @Column(name = "action_required")
    @Builder.Default
    private Boolean actionRequired = false;

    /** JSON-serialized list of suggested actions for manager */
    @Column(name = "suggested_actions", length = 1000)
    private String suggestedActions;

    /** The best recommended agent name for SLA breach reassignment */
    @Column(name = "recommended_agent", length = 200)
    private String recommendedAgent;

    /** Recommended agent id for reassignment */
    @Column(name = "recommended_agent_id")
    private Long recommendedAgentId;
    
    @Column(name = "is_read")
    @Builder.Default
    private Boolean isRead = false;
    
    @Column(name = "read_at")
    private LocalDateTime readAt;
    
    @Column(name = "ticket_reference", length = 20)
    private String ticketReference;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;
    
    // Méthode pour marquer comme lu
    public void markAsRead() {
        this.isRead = true;
        this.readAt = LocalDateTime.now();
    }
    
    // Factory methods
    public static Notification ticketCreated(User user, Ticket ticket) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("Ã°ÂÂÂ Nouveau ticket créé")
            .message("Le ticket " + ticket.getReference() + " a été créé: " + ticket.getTitle())
            .type("TICKET_CREATED")
            .icon("pi-plus-circle")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    
    public static Notification ticketAssigned(User user, Ticket ticket) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("Ã°ÂÂÂ Ticket assigné")
            .message("Le ticket " + ticket.getReference() + " vous a été assigné")
            .type("TICKET_ASSIGNED")
            .icon("pi-user")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    
    public static Notification ticketStatusChanged(User user, Ticket ticket, String newStatus) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("Ã°ÂÂÂ Statut mis à jour")
            .message("Le ticket " + ticket.getReference() + " est maintenant: " + newStatus)
            .type("STATUS_CHANGED")
            .icon("pi-sync")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    
    public static Notification ticketResolved(User user, Ticket ticket) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("âÂÂ Ticket résolu")
            .message("Le ticket " + ticket.getReference() + " a été résolu")
            .type("TICKET_RESOLVED")
            .icon("pi-check-circle")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    
    public static Notification slaWarning(User user, Ticket ticket) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("âÂÂ ïÂ¸Â Alerte SLA")
            .message("Le ticket " + ticket.getReference() + " approche de sa deadline SLA")
            .type("SLA_WARNING")
            .icon("pi-exclamation-triangle")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    
    public static Notification slaBreached(User user, Ticket ticket) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("Ã°ÂÂÂ¨ SLA dépassé")
            .message("Le SLA du ticket " + ticket.getReference() + " a été dépassé!")
            .type("SLA_BREACHED")
            .icon("pi-times-circle")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    
    public static Notification newComment(User user, Ticket ticket, String commenterName) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("Ã°ÂÂÂ¬ Nouveau commentaire")
            .message(commenterName + " a commenté le ticket " + ticket.getReference())
            .type("NEW_COMMENT")
            .icon("pi-comment")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
    public static Notification customerResponseReceived(User user, Ticket ticket, String customerName) {
        return Notification.builder()
            .user(user)
            .ticket(ticket)
            .title("Reponse client recue")
            .message(customerName + " a repondu sur le ticket " + ticket.getReference() + ". Le traitement reprend.")
            .type("CUSTOMER_RESPONSE_RECEIVED")
            .icon("reply")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
    }
}
