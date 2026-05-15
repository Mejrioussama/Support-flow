package com.supportflow.dto.stats;

import lombok.*;

/**
 * DTO pour les performances d'un agent
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentPerformanceDTO {
    private Long agentId;
    private String agentName;
    private String avatarUrl;
    private long totalTickets;
    private long resolvedTickets;
    private long openTickets;
    private Double averageResolutionTime;
    private String formattedAverageResolutionTime;
    private Double averageSatisfactionRating;
    private double slaComplianceRate;
}
