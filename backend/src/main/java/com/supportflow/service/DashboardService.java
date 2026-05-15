package com.supportflow.service;

import com.supportflow.dto.stats.AgentPerformanceDTO;
import com.supportflow.dto.stats.DailyTicketCount;
import com.supportflow.dto.stats.DashboardStatsDTO;
import com.supportflow.entity.Client;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.ClientRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service pour les statistiques du dashboard
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class DashboardService {
    
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final com.supportflow.repository.EscalationEventRepository escalationEventRepository;
    private final com.supportflow.repository.SatisfactionSurveyRepository satisfactionSurveyRepository;
    
    /**
     * Récupère les statistiques complètes du dashboard
     */
    public DashboardStatsDTO getDashboardStats() {
        log.debug("Calcul des statistiques du dashboard");
        
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        
        // Compteurs par statut
        long openTickets = ticketRepository.countByStatus(TicketStatus.OPEN) + ticketRepository.countByStatus(TicketStatus.NEW);
        long assignedTickets = ticketRepository.countByStatus(TicketStatus.ASSIGNED);
        long inProgressTickets = ticketRepository.countByStatus(TicketStatus.IN_PROGRESS);
        long pendingTickets = ticketRepository.countByStatus(TicketStatus.PENDING);
        long resolvedTickets = ticketRepository.countByStatus(TicketStatus.RESOLVED);
        long closedTickets = ticketRepository.countByStatus(TicketStatus.CLOSED);
        long escalatedManualTickets = ticketRepository.countByStatus(TicketStatus.ESCALATED_MANUAL);
        long escalatedSlaTickets = ticketRepository.countEscalatedAttentionTickets();
        
        long totalTickets = ticketRepository.count();
        long slaBreachedTickets = ticketRepository.countSlaBreachedTickets();
        long slaAtRiskTickets = ticketRepository.countSlaAtRiskTickets();
        long slaOnTrackTickets = ticketRepository.countSlaOnTrackTickets(LocalDateTime.now());
        
        // Calcul du taux de conformité SLA
        long completedTickets = resolvedTickets + closedTickets;
        double slaComplianceRate = completedTickets > 0 
            ? ((completedTickets - slaBreachedTickets) * 100.0 / completedTickets) 
            : 100.0;
        
        // Moyennes
        Double avgResolutionTime = ticketRepository.getAverageResolutionTime();
        Double avgSatisfaction = ticketRepository.getAverageSatisfactionRating();
        
        // Tickets créés/résolus aujourd'hui
        long ticketsCreatedToday = ticketRepository.countTicketsCreatedSince(todayStart);
        long ticketsResolvedToday = ticketRepository.countTicketsResolvedSince(todayStart);
        
        // Distribution par statut
        Map<String, Long> ticketsByStatus = new HashMap<>();
        ticketRepository.countTicketsByStatus().forEach(row -> {
            ticketsByStatus.put(((TicketStatus) row[0]).name(), (Long) row[1]);
        });
        
        // Distribution par priorité
        Map<String, Long> ticketsByPriority = new HashMap<>();
        ticketRepository.countTicketsByPriority().forEach(row -> {
            ticketsByPriority.put(((Priority) row[0]).name(), (Long) row[1]);
        });
        
        // Distribution par type
        Map<String, Long> ticketsByType = new HashMap<>();
        ticketRepository.countTicketsByType().forEach(row -> {
            ticketsByType.put(row[0].toString(), (Long) row[1]);
        });
        
        // Tendance journalière (30 derniers jours)
        List<DailyTicketCount> dailyTrend = ticketRepository.countTicketsByDay(thirtyDaysAgo)
            .stream()
            .map(row -> DailyTicketCount.builder()
                .date(((java.sql.Date) row[0]).toLocalDate())
                .createdCount((Long) row[1])
                .build())
            .collect(Collectors.toList());
        
        // Top agents
        List<AgentPerformanceDTO> topAgents = getTopAgentsPerformance();
        
        return DashboardStatsDTO.builder()
            .totalTickets(totalTickets)
            .openTickets(openTickets + assignedTickets)
            .inProgressTickets(inProgressTickets + pendingTickets)
            .resolvedTickets(resolvedTickets)
            .closedTickets(closedTickets)
            .escalatedManualTickets(escalatedManualTickets)
            .escalatedSlaTickets(escalatedSlaTickets)
            .slaBreachedTickets(slaBreachedTickets)
            .slaAtRiskTickets(slaAtRiskTickets)
            .slaOnTrackTickets(slaOnTrackTickets)
            .slaComplianceRate(Math.round(slaComplianceRate * 100.0) / 100.0)
            .averageResolutionTime(avgResolutionTime)
            .formattedAverageResolutionTime(formatMinutes(avgResolutionTime))
            .averageSatisfactionRating(avgSatisfaction != null ? Math.round(avgSatisfaction * 10.0) / 10.0 : null)
            .ticketsCreatedToday(ticketsCreatedToday)
            .ticketsResolvedToday(ticketsResolvedToday)
            .ticketsByStatus(ticketsByStatus)
            .ticketsByPriority(ticketsByPriority)
            .ticketsByType(ticketsByType)
            .dailyTrend(dailyTrend)
            .topAgents(topAgents)
            .build();
    }
    
    /**
     * Récupère les statistiques du dashboard pour un client (basé sur email)
     */
    public DashboardStatsDTO getClientDashboardStats(String email) {
        log.debug("Calcul des statistiques du dashboard pour le client avec email: {}", email);
        
        Optional<Client> clientOpt = clientRepository.findByEmail(email);
        if (clientOpt.isEmpty()) {
            // Retourner des stats vides si le client n'est pas trouvé
            return DashboardStatsDTO.builder()
                .totalTickets(0L)
                .openTickets(0L)
                .inProgressTickets(0L)
                .resolvedTickets(0L)
                .closedTickets(0L)
                .escalatedManualTickets(0L)
                .escalatedSlaTickets(0L)
                .slaBreachedTickets(0L)
                .slaAtRiskTickets(0L)
                .slaOnTrackTickets(0L)
                .slaComplianceRate(100.0)
                .ticketsByStatus(new HashMap<>())
                .ticketsByPriority(new HashMap<>())
                .ticketsByType(new HashMap<>())
                .build();
        }
        
        Long clientId = clientOpt.get().getId();
        
        // Compteurs par statut pour ce client
        long openTickets = ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.OPEN)
            + ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.NEW);
        long assignedTickets = ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.ASSIGNED);
        long inProgressTickets = ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.IN_PROGRESS);
        long pendingTickets = ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.PENDING);
        long resolvedTickets = ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.RESOLVED);
        long closedTickets = ticketRepository.countByClientIdAndStatus(clientId, TicketStatus.CLOSED);
        
        long totalTickets = openTickets + assignedTickets + inProgressTickets + pendingTickets + resolvedTickets + closedTickets;
        
        // Distribution par statut
        Map<String, Long> ticketsByStatus = new HashMap<>();
        ticketsByStatus.put("NEW", openTickets);
        ticketsByStatus.put("ASSIGNED", assignedTickets);
        ticketsByStatus.put("IN_PROGRESS", inProgressTickets);
        ticketsByStatus.put("PENDING", pendingTickets);
        ticketsByStatus.put("RESOLVED", resolvedTickets);
        ticketsByStatus.put("CLOSED", closedTickets);
        
        // Distribution par priorité
        Map<String, Long> ticketsByPriority = new HashMap<>();
        ticketsByPriority.put("LOW", ticketRepository.countByClientIdAndPriority(clientId, Priority.LOW));
        ticketsByPriority.put("MEDIUM", ticketRepository.countByClientIdAndPriority(clientId, Priority.MEDIUM));
        ticketsByPriority.put("HIGH", ticketRepository.countByClientIdAndPriority(clientId, Priority.HIGH));
        ticketsByPriority.put("CRITICAL", ticketRepository.countByClientIdAndPriority(clientId, Priority.CRITICAL));
        
        return DashboardStatsDTO.builder()
            .totalTickets(totalTickets)
            .openTickets(openTickets + assignedTickets)
            .inProgressTickets(inProgressTickets + pendingTickets)
            .resolvedTickets(resolvedTickets)
            .closedTickets(closedTickets)
            .escalatedManualTickets(0L)
            .escalatedSlaTickets(0L)
            .slaBreachedTickets(0L)
            .slaAtRiskTickets(0L)
            .slaOnTrackTickets(0L)
            .slaComplianceRate(100.0)
            .ticketsByStatus(ticketsByStatus)
            .ticketsByPriority(ticketsByPriority)
            .ticketsByType(new HashMap<>())
            .build();
    }
    
    /**
     * Récupère les performances des meilleurs agents
     */
    public List<AgentPerformanceDTO> getTopAgentsPerformance() {
        return ticketRepository.getAgentPerformanceStats()
            .stream()
            .map(row -> {
                Long agentId = (Long) row[0];
                Double avgTime = (Double) row[1];
                Long totalTickets = (Long) row[2];
                Double avgSatisfaction = (Double) row[3];
                
                return AgentPerformanceDTO.builder()
                    .agentId(agentId)
                    .totalTickets(totalTickets)
                    .averageResolutionTime(avgTime)
                    .formattedAverageResolutionTime(formatMinutes(avgTime))
                    .averageSatisfactionRating(avgSatisfaction)
                    .build();
            })
            .sorted((a, b) -> Long.compare(b.getTotalTickets(), a.getTotalTickets()))
            .limit(10)
            .collect(Collectors.toList());
    }
    
    /**
     * Récupère les statistiques pour un agent spécifique
     */
    public AgentPerformanceDTO getAgentStats(Long agentId) {
        // Implementation détaillée pour un agent
        return ticketRepository.getAgentPerformanceStats()
            .stream()
            .filter(row -> agentId.equals(row[0]))
            .map(row -> AgentPerformanceDTO.builder()
                .agentId((Long) row[0])
                .averageResolutionTime((Double) row[1])
                .totalTickets((Long) row[2])
                .averageSatisfactionRating((Double) row[3])
                .build())
            .findFirst()
            .orElse(null);
    }
    
    /**
     * Récupère les statistiques pour un client
     */
    public Map<String, Object> getClientStats(Long clientId) {
        Map<String, Object> stats = new HashMap<>();
        
        // Implémenter les statistiques spécifiques au client
        stats.put("totalTickets", ticketRepository.findByClientId(clientId, null).getTotalElements());
        
        return stats;
    }
    
    // Utilitaire pour formater les minutes
    private String formatMinutes(Double minutes) {
        if (minutes == null) return "N/A";
        long totalMinutes = minutes.longValue();
        long hours = totalMinutes / 60;
        long mins = totalMinutes % 60;
        return String.format("%dh%02dmin", hours, mins);
    }

    /**
     * Statistiques d'escalade pour le dashboard
     */
    public com.supportflow.dto.stats.EscalationStatsDTO getEscalationStats(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        // Count by level
        java.util.Map<Integer, Long> countByLevel = new java.util.HashMap<>();
        try {
            List<Object[]> levelCounts = escalationEventRepository.countByLevelSince(since);
            for (Object[] row : levelCounts) {
                countByLevel.put((Integer) row[0], (Long) row[1]);
            }
        } catch (Exception e) {
            log.warn("Erreur calcul escalation stats: {}", e.getMessage());
        }

        // Avg time by level
        java.util.Map<Integer, Double> avgByLevel = new java.util.HashMap<>();
        for (int level = 1; level <= 3; level++) {
            try {
                Double avg = escalationEventRepository.avgTimeAtLevel(level);
                if (avg != null) avgByLevel.put(level, avg);
            } catch (Exception e) {
                log.debug("Pas de données avg pour level {}", level);
            }
        }

        long total = countByLevel.values().stream().mapToLong(Long::longValue).sum();
        long blocked = 0;
        try {
            blocked = escalationEventRepository.findByReasonAndCreatedAtAfter(
                com.supportflow.entity.enums.EscalationReason.FATIGUE_BLOCKED, since).size()
                + escalationEventRepository.findByReasonAndCreatedAtAfter(
                com.supportflow.entity.enums.EscalationReason.COOLDOWN_SKIP, since).size();
        } catch (Exception e) {
            log.debug("Pas de données blocked escalations");
        }

        Double avgSatEsc = null;
        Double avgSatNon = null;
        try {
            avgSatEsc = satisfactionSurveyRepository.averageRatingForEscalated();
            avgSatNon = satisfactionSurveyRepository.averageRating();
        } catch (Exception e) {
            log.debug("Pas de données satisfaction");
        }

        return com.supportflow.dto.stats.EscalationStatsDTO.builder()
            .countByLevel(countByLevel)
            .avgMinutesByLevel(avgByLevel)
            .totalEscalations(total)
            .blockedEscalations(blocked)
            .avgSatisfactionEscalated(avgSatEsc)
            .avgSatisfactionNonEscalated(avgSatNon)
            .build();
    }
}
