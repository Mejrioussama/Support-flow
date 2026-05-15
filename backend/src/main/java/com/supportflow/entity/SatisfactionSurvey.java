package com.supportflow.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Sondage de satisfaction post-résolution.
 * Envoyé automatiquement au client quand le ticket est résolu.
 */
@Entity
@Table(name = "satisfaction_surveys", indexes = {
    @Index(name = "idx_survey_ticket", columnList = "ticket_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class SatisfactionSurvey extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false, unique = true)
    private Ticket ticket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "respondent_id")
    private User respondent;

    /** Note de 1 à 5 */
    @Column(name = "rating")
    private Integer rating;

    @Column(name = "comment", length = 1000)
    private String comment;

    /** Temps de réponse au sondage en minutes (null = pas encore répondu) */
    @Column(name = "response_time_minutes")
    private Long responseTimeMinutes;

    /** Le ticket était-il escaladé au moment de la résolution */
    @Column(name = "was_escalated")
    @Builder.Default
    private Boolean wasEscalated = false;

    /** Niveau d'escalade atteint (0-3) */
    @Column(name = "escalation_level_reached")
    @Builder.Default
    private Integer escalationLevelReached = 0;

    /** Le sondage a-t-il été envoyé */
    @Column(name = "survey_sent")
    @Builder.Default
    private Boolean surveySent = false;

    /** Le sondage a-t-il été complété */
    @Column(name = "survey_completed")
    @Builder.Default
    private Boolean surveyCompleted = false;
}
