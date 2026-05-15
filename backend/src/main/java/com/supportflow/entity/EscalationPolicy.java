package com.supportflow.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Politique d'escalade configurable par client.
 * Permet de personnaliser les seuils d'escalade selon le contrat/SLA du client.
 * Si aucune policy n'existe pour un client, les valeurs par défaut s'appliquent.
 */
@Entity
@Table(name = "escalation_policies", indexes = {
    @Index(name = "idx_esc_policy_client", columnList = "client_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class EscalationPolicy extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", unique = true)
    private Client client;

    @Column(name = "policy_name", length = 100)
    private String policyName;

    /** % SLA consommé pour déclencher L1 (reassignation auto). Default 90 */
    @Column(name = "level1_threshold")
    @Builder.Default
    private Integer level1Threshold = 90;

    /** % SLA consommé pour déclencher L2 (alerte manager). Default 100 */
    @Column(name = "level2_threshold")
    @Builder.Default
    private Integer level2Threshold = 100;

    /** Minutes après L2 sans action pour passer en L3 (manager takeover). Default 30 */
    @Column(name = "level3_delay_minutes")
    @Builder.Default
    private Integer level3DelayMinutes = 30;

    /** Minutes avant reassignation de tickets ASSIGNED sans prise en charge. Default 15 */
    @Column(name = "stuck_assigned_minutes")
    @Builder.Default
    private Integer stuckAssignedMinutes = 15;

    /** Nombre maximum d'escalades par ticket avant blocage. Default 10 */
    @Column(name = "max_escalations")
    @Builder.Default
    private Integer maxEscalations = 10;

    /** Délai minimum en minutes entre deux escalades (anti-boucle). Default 5 */
    @Column(name = "cooldown_minutes")
    @Builder.Default
    private Integer cooldownMinutes = 5;

    /** Activer/désactiver la reassignation automatique pour ce client */
    @Column(name = "auto_reassign_enabled")
    @Builder.Default
    private Boolean autoReassignEnabled = true;

    /** Activer/désactiver les notifications d'escalade au client final */
    @Column(name = "notify_client_on_escalation")
    @Builder.Default
    private Boolean notifyClientOnEscalation = true;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
}
