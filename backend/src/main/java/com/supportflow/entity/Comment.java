package com.supportflow.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Entité Commentaire sur un ticket
 */
@Entity
@Table(name = "comments", indexes = {
    @Index(name = "idx_comment_ticket", columnList = "ticket_id"),
    @Index(name = "idx_comment_author", columnList = "author_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Comment extends BaseEntity {
    
    @NotBlank(message = "Le contenu du commentaire est obligatoire")
    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;
    
    @Column(name = "is_internal")
    @Builder.Default
    private Boolean isInternal = false;
    
    @Column(name = "is_solution")
    @Builder.Default
    private Boolean isSolution = false;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Comment parent;
}
