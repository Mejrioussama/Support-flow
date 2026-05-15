package com.supportflow.entity;

import com.supportflow.entity.enums.AgentStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Disponibilité temps réel d'un agent.
 * Mis à jour par l'agent ou automatiquement par le système.
 */
@Entity
@Table(name = "agent_availability", indexes = {
    @Index(name = "idx_avail_agent", columnList = "agent_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class AgentAvailability extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false, unique = true)
    private User agent;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 15)
    @Builder.Default
    private AgentStatus status = AgentStatus.AVAILABLE;

    @Column(name = "status_since")
    private LocalDateTime statusSince;

    @Column(name = "status_reason", length = 200)
    private String statusReason;

    /** Nombre max de tickets simultanés (null = illimité) */
    @Column(name = "max_concurrent_tickets")
    private Integer maxConcurrentTickets;
}
