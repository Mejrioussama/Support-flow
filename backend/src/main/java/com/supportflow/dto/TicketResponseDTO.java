package com.supportflow.dto;

import com.supportflow.entity.enums.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * DTO pour les réponses de ticket
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponseDTO {
    
    private Long id;
    private String reference;
    private String title;
    private String description;
    private TicketType type;
    private TicketStatus status;
    private Severity severity;
    private Impact impact;
    private Priority priority;
    private Integer score;
    
    // SLA
    private Integer slaHours;
    private LocalDateTime slaDeadline;
    private Boolean slaBreached;
    private Boolean slaWarningSent;
    private String slaState;
    private Boolean slaActionRequired;
    private String slaRemainingTime;
    private Boolean slaPaused;
    private LocalDateTime slaPausedAt;
    private Long slaTotalPausedMinutes;
    private Integer slaExtendedMinutes;
    private String slaExtensionReason;
    private Boolean slaBusinessHoursOnly;
    private Double slaConsumedPercent;
    private String slaPhase;
    private String slaCalendarLabel;
    private String slaOperationalStatus;
    
    // Escalation
    private Integer escalationLevel;
    private Integer escalationCount;
    private LocalDateTime lastEscalationAt;
    private Boolean escalationBlocked;
    private Integer slaAdjustedMinutes;
    private String previousAgentName;
    private LocalDateTime escalationHoldUntil;
    private String escalationHoldReason;
    
    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime assignedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;
    
    // Temps de résolution
    private Long resolutionTimeMinutes;
    private String formattedResolutionTime;
    
    // Satisfaction
    private Integer satisfactionRating;
    private String satisfactionComment;
    
    // Catégorie et tags
    private String category;
    private String normalizedCategory;
    private Boolean legacyEscalated;
    private Set<String> tags;
    
    // Relations
    private ClientSummaryDTO client;
    private UserSummaryDTO createdByUser;
    private UserSummaryDTO assignedAgent;
    
    // Compteurs
    private int commentsCount;
    private int attachmentsCount;
    
    // Workflow
    private String processInstanceId;
    private String currentTaskId;
    private Boolean archived;
    private String archiveReference;
    
    // Solution
    private String resolutionSummary;
    private TicketResolutionDetailsDTO resolutionDetails;
    private WaitingOn waitingOn;
    private String pendingReason;
    private String slaPauseReason;
    private String managerReviewReason;
    private String resolutionRejectedReason;
    private LocalDateTime lastCustomerResponseAt;
    private String nextExpectedAction;
}
