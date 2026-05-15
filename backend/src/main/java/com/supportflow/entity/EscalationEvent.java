package com.supportflow.entity;

import com.supportflow.entity.enums.EscalationReason;
import com.supportflow.entity.enums.EscalationTrigger;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Événement d'escalade — traçabilité complète de chaque escalade.
 * Séparé de TicketHistory pour requêtes optimisées et timeline dédiée.
 */
@Entity
@Table(name = "escalation_events", indexes = {
    @Index(name = "idx_esc_event_ticket", columnList = "ticket_id"),
    @Index(name = "idx_esc_event_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class EscalationEvent extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @Column(name = "from_level", nullable = false)
    private Integer fromLevel;

    @Column(name = "to_level", nullable = false)
    private Integer toLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 30)
    private EscalationReason reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "triggered_by", nullable = false, length = 10)
    private EscalationTrigger triggeredBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_agent_id")
    private User fromAgent;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_agent_id")
    private User toAgent;

    @Column(name = "description", length = 500)
    private String description;

    /** % SLA consommé au moment de l'escalade */
    @Column(name = "sla_percent_at_escalation")
    private Double slaPercentAtEscalation;

    /** Si l'escalade a été bloquée par cooldown ou fatigue */
    @Column(name = "was_blocked")
    @Builder.Default
    private Boolean wasBlocked = false;
}
