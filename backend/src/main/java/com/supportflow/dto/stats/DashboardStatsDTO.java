package com.supportflow.dto.stats;

import lombok.*;

import java.util.List;
import java.util.Map;

/**
 * DTO pour les statistiques du dashboard
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardStatsDTO {
    
    // Compteurs principaux
    private long totalTickets;
    private long openTickets;
    private long inProgressTickets;
    private long resolvedTickets;
    private long closedTickets;
    private long escalatedManualTickets;
    private long escalatedSlaTickets;
    
    // SLA
    private long slaBreachedTickets;
    private long slaAtRiskTickets;
    private long slaOnTrackTickets;
    private double slaComplianceRate;
    
    // Performance
    private Double averageResolutionTime;
    private String formattedAverageResolutionTime;
    private Double averageSatisfactionRating;
    
    // Tickets créés/résolus aujourd'hui
    private long ticketsCreatedToday;
    private long ticketsResolvedToday;
    
    // Distribution par statut
    private Map<String, Long> ticketsByStatus;
    
    // Distribution par priorité
    private Map<String, Long> ticketsByPriority;
    
    // Distribution par type
    private Map<String, Long> ticketsByType;
    
    // Tendance (derniers 30 jours)
    private List<DailyTicketCount> dailyTrend;
    
    // Top agents
    private List<AgentPerformanceDTO> topAgents;
}
