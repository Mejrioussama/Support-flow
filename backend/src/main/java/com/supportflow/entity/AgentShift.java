package com.supportflow.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.DayOfWeek;
import java.time.LocalTime;

/**
 * Planning de travail d'un agent.
 * Définit les créneaux horaires par jour de la semaine.
 */
@Entity
@Table(name = "agent_shifts", indexes = {
    @Index(name = "idx_shift_agent", columnList = "agent_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class AgentShift extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false)
    private User agent;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 10)
    private DayOfWeek dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    /** Agent d'astreinte (peut recevoir des tickets hors shift) */
    @Column(name = "is_on_call")
    @Builder.Default
    private Boolean isOnCall = false;
}
