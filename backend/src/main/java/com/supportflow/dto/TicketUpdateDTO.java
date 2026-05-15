package com.supportflow.dto;

import com.supportflow.entity.enums.*;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.Set;

/**
 * DTO pour les requêtes de mise à jour de ticket
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketUpdateDTO {
    
    @Size(min = 5, max = 200, message = "Le titre doit faire entre 5 et 200 caractères")
    private String title;
    
    private String description;
    
    private TicketType type;
    
    private TicketStatus status;
    
    private Severity severity;
    
    private Impact impact;
    
    private Long assignedAgentId;
    
    private String category;
    
    private Set<String> tags;
    
    private String resolutionSummary;

    private TicketResolutionDetailsDTO resolutionDetails;

    private WaitingOn waitingOn;

    private String pendingReason;

    private String slaPauseReason;

    private String managerReviewReason;

    private String resolutionRejectedReason;
    
    private Integer satisfactionRating;
    
    private String satisfactionComment;
}
