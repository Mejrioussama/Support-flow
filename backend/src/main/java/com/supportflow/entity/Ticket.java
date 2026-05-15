package com.supportflow.entity;

import com.supportflow.entity.enums.*;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Entité Ticket - CÃÂur du système SupportFlow
 */
@Entity
@Table(name = "tickets", indexes = {
    @Index(name = "idx_ticket_reference", columnList = "reference"),
    @Index(name = "idx_ticket_status", columnList = "status"),
    @Index(name = "idx_ticket_priority", columnList = "priority"),
    @Index(name = "idx_ticket_created", columnList = "created_at"),
    @Index(name = "idx_ticket_sla_deadline", columnList = "sla_deadline")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Ticket extends BaseEntity {
    
    @Column(name = "reference", unique = true, nullable = false, length = 20)
    private String reference;
    
    @NotBlank(message = "Le titre est obligatoire")
    @Size(min = 5, max = 200)
    @Column(name = "title", nullable = false, length = 200)
    private String title;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private TicketType type;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TicketStatus status = TicketStatus.NEW;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 20)
    private Severity severity;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "impact", nullable = false, length = 20)
    private Impact impact;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 20)
    private Priority priority;
    
    // Score calculé automatiquement
    @Column(name = "score")
    private Integer score;
    
    // SLA Management
    @Column(name = "sla_hours")
    private Integer slaHours;
    
    @Column(name = "sla_deadline")
    private LocalDateTime slaDeadline;
    
    @Column(name = "sla_breached")
    @Builder.Default
    private Boolean slaBreached = false;
    
    @Column(name = "sla_warning_sent")
    @Builder.Default
    private Boolean slaWarningSent = false;
    
    @Column(name = "sla_phase", length = 30)
    @Builder.Default
    private String slaPhase = "ON_TRACK";
    
    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;
    
    // Escalation chain tracking
    @Column(name = "escalation_level")
    @Builder.Default
    private Integer escalationLevel = 0;
    
    @Column(name = "escalation_count")
    @Builder.Default
    private Integer escalationCount = 0;
    
    @Column(name = "last_escalation_at")
    private LocalDateTime lastEscalationAt;
    
    @Column(name = "escalation_blocked")
    @Builder.Default
    private Boolean escalationBlocked = false;
    
    @Column(name = "sla_adjusted_minutes")
    @Builder.Default
    private Integer slaAdjustedMinutes = 0;

    // Previous agent tracking (for escalation audit trail)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_agent_id")
    private User previousAgent;

    // Escalation hold/suspense mechanism
    @Column(name = "escalation_hold_until")
    private LocalDateTime escalationHoldUntil;

    @Column(name = "escalation_hold_reason", length = 500)
    private String escalationHoldReason;
    
    // SLA Pause/Resume (Clock Stop)
    @Column(name = "sla_paused")
    @Builder.Default
    private Boolean slaPaused = false;
    
    @Column(name = "sla_paused_at")
    private LocalDateTime slaPausedAt;

    @Column(name = "sla_pause_reason", length = 500)
    private String slaPauseReason;
    
    @Column(name = "sla_total_paused_minutes")
    @Builder.Default
    private Long slaTotalPausedMinutes = 0L;
    
    // SLA Extension
    @Column(name = "sla_extended_minutes")
    @Builder.Default
    private Integer slaExtendedMinutes = 0;
    
    @Column(name = "sla_extension_reason", length = 500)
    private String slaExtensionReason;
    
    // Business Hours flag
    @Column(name = "sla_business_hours_only")
    @Builder.Default
    private Boolean slaBusinessHoursOnly = true;
    
    // Workflow Camunda
    @Column(name = "process_instance_id")
    private String processInstanceId;
    
    @Column(name = "current_task_id")
    private String currentTaskId;
    
    // Timestamps
    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;
    
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
    
    @Column(name = "closed_at")
    private LocalDateTime closedAt;
    
    // Satisfaction client
    @Column(name = "satisfaction_rating")
    private Integer satisfactionRating;
    
    @Column(name = "satisfaction_comment", length = 500)
    private String satisfactionComment;
    
    // Temps de résolution en minutes
    @Column(name = "resolution_time_minutes")
    private Long resolutionTimeMinutes;
    
    // Catégorie et tags
    @Column(name = "category", length = 50)
    private String category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "normalized_category_id")
    private SupportCategory normalizedCategory;
    
    @ElementCollection
    @CollectionTable(name = "ticket_tags", joinColumns = @JoinColumn(name = "ticket_id"))
    @Column(name = "tag", length = 30)
    @Builder.Default
    private Set<String> tags = new HashSet<>();
    
    // Solution / Résolution
    @Column(name = "resolution_summary", columnDefinition = "TEXT")
    private String resolutionSummary;

    @Column(name = "resolution_diagnostic", columnDefinition = "TEXT")
    private String resolutionDiagnostic;

    @Column(name = "resolution_root_cause", columnDefinition = "TEXT")
    private String resolutionRootCause;

    @Column(name = "resolution_actions_taken", columnDefinition = "TEXT")
    private String resolutionActionsTaken;

    @Column(name = "resolution_next_recommendation", columnDefinition = "TEXT")
    private String resolutionNextRecommendation;

    @Enumerated(EnumType.STRING)
    @Column(name = "waiting_on", length = 20)
    private WaitingOn waitingOn;

    @Column(name = "pending_reason", length = 500)
    private String pendingReason;

    @Column(name = "manager_review_reason", length = 500)
    private String managerReviewReason;

    @Column(name = "resolution_rejected_reason", length = 500)
    private String resolutionRejectedReason;

    @Column(name = "last_customer_response_at")
    private LocalDateTime lastCustomerResponseAt;
    
    // Alfresco Document ID
    @Column(name = "alfresco_folder_id")
    private String alfrescoFolderId;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdByUser;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_agent_id")
    private User assignedAgent;
    
    @OneToMany(mappedBy = "ticket", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    @Builder.Default
    private List<Comment> comments = new ArrayList<>();
    
    @OneToMany(mappedBy = "ticket", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<Attachment> attachments = new HashSet<>();
    
    @OneToMany(mappedBy = "ticket", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    @Builder.Default
    private List<TicketHistory> history = new ArrayList<>();
    
    @OneToMany(mappedBy = "ticket", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Notification> notifications = new ArrayList<>();
    
    // Méthodes métier
    
    /**
     * Calcule le score du ticket basé sur gravité, impact et SLA
     * Formula: Score = (Gravité à 3) + (Impact à 2) + (SLA Factor)
     */
    public int calculateScore() {
        int gravityScore = severity != null ? severity.getWeight() * 3 : 0;
        int impactScore = impact != null ? impact.getWeight() * 2 : 0;
        int slaFactor = calculateSlaFactor();
        
        this.score = gravityScore + impactScore + slaFactor;
        this.priority = Priority.fromScore(this.score);
        
        return this.score;
    }
    
    private int calculateSlaFactor() {
        if (slaDeadline == null) return 0;
        
        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(slaDeadline)) {
            return 4; // SLA dépassé
        }
        
        long totalMinutes = java.time.Duration.between(getCreatedAt(), slaDeadline).toMinutes();
        long remainingMinutes = java.time.Duration.between(now, slaDeadline).toMinutes();
        double percentageRemaining = (double) remainingMinutes / totalMinutes;
        
        if (percentageRemaining < 0.25) return 3;
        if (percentageRemaining < 0.50) return 2;
        if (percentageRemaining < 0.75) return 1;
        return 0;
    }
    
    /**
     * Définit le SLA et calcule la deadline (en minutes)
     */
    public void setSlaAndDeadline(int minutes) {
        this.slaHours = minutes;
        this.slaTotalPausedMinutes = 0L;
        this.slaExtendedMinutes = 0;
        this.slaPaused = false;
        // SUPER_CRITICAL runs 24/7, others use business hours
        this.slaBusinessHoursOnly = (severity != Severity.SUPER_CRITICAL);
        this.slaDeadline = getCreatedAt() != null 
            ? getCreatedAt().plusMinutes(minutes) 
            : LocalDateTime.now().plusMinutes(minutes);
    }
    
    /**
     * Pause le chrono SLA (ex: attente réponse client)
     */
    public void pauseSla() {
        if (Boolean.TRUE.equals(slaPaused)) return;
        this.slaPaused = true;
        this.slaPausedAt = LocalDateTime.now();
    }
    
    /**
     * Reprend le chrono SLA et recalcule la deadline
     */
    public void resumeSla() {
        if (!Boolean.TRUE.equals(slaPaused) || slaPausedAt == null) return;
        long pausedMinutes = java.time.Duration.between(slaPausedAt, LocalDateTime.now()).toMinutes();
        this.slaTotalPausedMinutes = (slaTotalPausedMinutes != null ? slaTotalPausedMinutes : 0L) + pausedMinutes;
        // Push deadline forward by the paused duration
        if (slaDeadline != null) {
            this.slaDeadline = slaDeadline.plusMinutes(pausedMinutes);
        }
        this.slaPaused = false;
        this.slaPausedAt = null;
    }
    
    /**
     * Prolonge le SLA de X minutes (par le manager)
     */
    public void extendSla(int additionalMinutes, String reason) {
        this.slaExtendedMinutes = (slaExtendedMinutes != null ? slaExtendedMinutes : 0) + additionalMinutes;
        this.slaExtensionReason = reason;
        if (slaDeadline != null) {
            this.slaDeadline = slaDeadline.plusMinutes(additionalMinutes);
        }
        // Reset breach flags if deadline is now in the future
        if (slaDeadline != null && slaDeadline.isAfter(LocalDateTime.now())) {
            this.slaBreached = false;
            this.slaPhase = "ON_TRACK";
        }
    }
    
    /**
     * Calcule le temps effectif consommé (excluant les pauses)
     */
    public long getEffectiveElapsedMinutes() {
        if (getCreatedAt() == null) return 0;
        long totalElapsed = java.time.Duration.between(getCreatedAt(), LocalDateTime.now()).toMinutes();
        long paused = slaTotalPausedMinutes != null ? slaTotalPausedMinutes : 0L;
        // If currently paused, add current pause duration
        if (Boolean.TRUE.equals(slaPaused) && slaPausedAt != null) {
            paused += java.time.Duration.between(slaPausedAt, LocalDateTime.now()).toMinutes();
        }
        return Math.max(0, totalElapsed - paused);
    }
    
    /**
     * Calcule le pourcentage SLA consommé (tenant compte des pauses)
     */
    public double getSlaConsumedPercent() {
        if (slaHours == null || slaHours <= 0) return 0;
        int totalSlaMinutes = slaHours + (slaExtendedMinutes != null ? slaExtendedMinutes : 0);
        long effectiveElapsed = getEffectiveElapsedMinutes();
        return Math.min(100.0, (effectiveElapsed * 100.0) / totalSlaMinutes);
    }
    
    /**
     * Détermine la phase SLA actuelle dans un modèle simple et lisible:
     * ON_TRACK -> ticket encore dans une zone normale
     * AT_RISK -> ticket proche du dépassement, action rapide requise
     * BREACHED -> délai dépassé, escalade automatique
     */
    public String computeSlaPhase() {
        if (Boolean.TRUE.equals(slaPaused)) return "PAUSED";
        if (isSlaBreached()) return "BREACHED";
        double percent = getSlaConsumedPercent();
        if (percent >= 75) return "AT_RISK";
        return "ON_TRACK";
    }
    
    /**
     * Vérifie si le SLA est dépassé
     */
    public boolean isSlaBreached() {
        if (slaDeadline == null) return false;
        if (resolvedAt != null) {
            return resolvedAt.isAfter(slaDeadline);
        }
        return LocalDateTime.now().isAfter(slaDeadline);
    }
    
    /**
     * Calcule le temps de résolution
     */
    public void calculateResolutionTime() {
        if (getCreatedAt() != null && resolvedAt != null) {
            this.resolutionTimeMinutes = java.time.Duration.between(getCreatedAt(), resolvedAt).toMinutes();
        }
    }
    
    /**
     * Formate le temps de résolution en heures et minutes
     */
    public String getFormattedResolutionTime() {
        if (resolutionTimeMinutes == null) return "N/A";
        long hours = resolutionTimeMinutes / 60;
        long minutes = resolutionTimeMinutes % 60;
        return String.format("%dh%02dmin", hours, minutes);
    }
    
    // Méthodes de gestion des collections
    
    public void addComment(Comment comment) {
        comments.add(comment);
        comment.setTicket(this);
    }
    
    public void removeComment(Comment comment) {
        comments.remove(comment);
        comment.setTicket(null);
    }
    
    public void addAttachment(Attachment attachment) {
        attachments.add(attachment);
        attachment.setTicket(this);
    }
    
    public void removeAttachment(Attachment attachment) {
        attachments.remove(attachment);
        attachment.setTicket(null);
    }
    
    public void addHistoryEntry(TicketHistory entry) {
        history.add(entry);
        entry.setTicket(this);
    }
}
