package com.supportflow.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Entité Historique des modifications du ticket
 */
@Entity
@Table(name = "ticket_history", indexes = {
    @Index(name = "idx_history_ticket", columnList = "ticket_id"),
    @Index(name = "idx_history_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class TicketHistory extends BaseEntity {
    
    @Column(name = "action", nullable = false, length = 50)
    private String action;
    
    @Column(name = "field_name", length = 50)
    private String fieldName;
    
    @Column(name = "old_value", length = 500)
    private String oldValue;
    
    @Column(name = "new_value", length = 500)
    private String newValue;
    
    @Column(name = "description", length = 500)
    private String description;
    
    @Column(name = "performed_by", length = 100)
    private String performedBy;

    // Audit trail avancé
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "change_type", length = 20)
    private String changeType;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
    
    // Factory methods
    public static TicketHistory createStatusChange(Ticket ticket, User user, String oldStatus, String newStatus) {
        return TicketHistory.builder()
            .ticket(ticket)
            .user(user)
            .action("STATUS_CHANGE")
            .fieldName("status")
            .oldValue(oldStatus)
            .newValue(newStatus)
            .description("Changement de statut: " + oldStatus + " → " + newStatus)
            .performedBy(user != null ? user.getFullName() : "System")
            .build();
    }
    
    public static TicketHistory createAssignment(Ticket ticket, User performedBy, User assignedTo) {
        return createAssignment(ticket, performedBy, assignedTo, null);
    }

    public static TicketHistory createAssignment(Ticket ticket, User performedBy, User assignedTo, String source) {
        boolean aiValidated = "AI_RECOMMENDATION".equalsIgnoreCase(source);
        return TicketHistory.builder()
            .ticket(ticket)
            .user(performedBy)
            .action(aiValidated ? "ASSIGNMENT_AI_VALIDATED" : "ASSIGNMENT")
            .fieldName("assignedAgent")
            .newValue(assignedTo != null ? assignedTo.getFullName() : null)
            .description(aiValidated
                ? "Assignation validée par manager depuis recommandation IA: " + (assignedTo != null ? assignedTo.getFullName() : "Non assigné")
                : "Ticket assigné à: " + (assignedTo != null ? assignedTo.getFullName() : "Non assigné"))
            .performedBy(performedBy != null ? performedBy.getFullName() : "System")
            .build();
    }

    public static TicketHistory createComment(Ticket ticket, User user) {
        return TicketHistory.builder()
            .ticket(ticket)
            .user(user)
            .action("COMMENT_ADDED")
            .description("Nouveau commentaire ajouté")
            .performedBy(user != null ? user.getFullName() : "System")
            .build();
    }
    
    public static TicketHistory createAttachment(Ticket ticket, User user, String fileName) {
        return TicketHistory.builder()
            .ticket(ticket)
            .user(user)
            .action("ATTACHMENT_ADDED")
            .fieldName("attachment")
            .newValue(fileName)
            .description("Pièce jointe ajoutée: " + fileName)
            .performedBy(user != null ? user.getFullName() : "System")
            .build();
    }
    
    public static TicketHistory createCreation(Ticket ticket, User user) {
        return TicketHistory.builder()
            .ticket(ticket)
            .user(user)
            .action("CREATED")
            .description("Ticket créé")
            .performedBy(user != null ? user.getFullName() : "System")
            .build();
    }
}
