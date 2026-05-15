package com.supportflow.controller;

import com.supportflow.dto.stats.AgentPerformanceDTO;
import com.supportflow.dto.stats.DailyTicketCount;
import com.supportflow.dto.stats.DashboardStatsDTO;
import com.supportflow.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.supportflow.security.AuthorizationHelper;

/**
 * Contrôleur REST pour le dashboard et les statistiques
 */
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Dashboard", description = "API des statistiques et KPIs")
public class DashboardController {
    
    private final DashboardService dashboardService;
    private final AuthorizationHelper authHelper;
    
    @GetMapping("/stats")
    @Operation(summary = "Récupérer les statistiques globales du dashboard")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<DashboardStatsDTO> getDashboardStats(@AuthenticationPrincipal Jwt jwt) {
        if (authHelper.isClient(jwt)) {
            String email = jwt.getClaimAsString("email");
            return ResponseEntity.ok(dashboardService.getClientDashboardStats(email));
        } else if (authHelper.isStaff(jwt)) {
            return ResponseEntity.ok(dashboardService.getDashboardStats());
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

        @GetMapping("/trend")
        @Operation(summary = "Récupérer la tendance journalière des tickets")
        @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
        public ResponseEntity<List<DailyTicketCount>> getTicketsTrend(
            @RequestParam(defaultValue = "30") int days,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.isClient(jwt) && !authHelper.isStaff(jwt)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        DashboardStatsDTO stats = authHelper.isClient(jwt)
            ? dashboardService.getClientDashboardStats(jwt.getClaimAsString("email"))
            : dashboardService.getDashboardStats();

        List<DailyTicketCount> trend = stats.getDailyTrend();
        if (trend == null) {
            return ResponseEntity.ok(List.of());
        }

        int safeDays = Math.max(1, days);
        int fromIndex = Math.max(0, trend.size() - safeDays);
        return ResponseEntity.ok(trend.subList(fromIndex, trend.size()));
        }

        @GetMapping("/top-agents")
        @Operation(summary = "Récupérer le top des agents")
        @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
        public ResponseEntity<List<AgentPerformanceDTO>> getTopAgents(
            @RequestParam(defaultValue = "5") int limit) {
        int safeLimit = Math.max(1, limit);
        List<AgentPerformanceDTO> top = dashboardService.getTopAgentsPerformance()
            .stream()
            .limit(safeLimit)
            .collect(Collectors.toList());
        return ResponseEntity.ok(top);
        }

        @GetMapping("/sla")
        @Operation(summary = "Récupérer les statistiques SLA")
        @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
        public ResponseEntity<Map<String, Long>> getSlaStats(@AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.isClient(jwt) && !authHelper.isStaff(jwt)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        DashboardStatsDTO stats = authHelper.isClient(jwt)
            ? dashboardService.getClientDashboardStats(jwt.getClaimAsString("email"))
            : dashboardService.getDashboardStats();

        Map<String, Long> sla = Map.of(
            "onTime", stats.getSlaOnTrackTickets(),
            "breached", stats.getSlaBreachedTickets(),
            "atRisk", stats.getSlaAtRiskTickets()
        );
        return ResponseEntity.ok(sla);
        }

        @GetMapping("/activity")
        @Operation(summary = "Récupérer une activité récente synthétique du dashboard")
        @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
        public ResponseEntity<List<Map<String, Object>>> getRecentActivity(@AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.isClient(jwt) && !authHelper.isStaff(jwt)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        DashboardStatsDTO stats = authHelper.isClient(jwt)
            ? dashboardService.getClientDashboardStats(jwt.getClaimAsString("email"))
            : dashboardService.getDashboardStats();

        List<Map<String, Object>> activity = List.of(
            Map.of("type", "TICKETS_CREATED_TODAY", "value", stats.getTicketsCreatedToday()),
            Map.of("type", "TICKETS_RESOLVED_TODAY", "value", stats.getTicketsResolvedToday()),
            Map.of("type", "SLA_AT_RISK", "value", stats.getSlaAtRiskTickets()),
            Map.of("type", "SLA_BREACHED", "value", stats.getSlaBreachedTickets())
        );

        return ResponseEntity.ok(activity);
        }
    
    
    @GetMapping("/agents/performance")
    @Operation(summary = "Récupérer les performances des agents")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<AgentPerformanceDTO>> getAgentsPerformance() {
        return ResponseEntity.ok(dashboardService.getTopAgentsPerformance());
    }
    
    @GetMapping("/agents/{agentId}/stats")
    @Operation(summary = "Récupérer les statistiques d'un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<AgentPerformanceDTO> getAgentStats(
            @PathVariable Long agentId,
            @AuthenticationPrincipal Jwt jwt) {
        // Agent ne peut voir que ses propres stats
        if (authHelper.isAgent(jwt) && !agentId.equals(authHelper.getUserId(jwt))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(dashboardService.getAgentStats(agentId));
    }
    
    @GetMapping("/clients/{clientId}/stats")
    @Operation(summary = "Récupérer les statistiques d'un client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map<String, Object>> getClientStats(@PathVariable Long clientId) {
        return ResponseEntity.ok(dashboardService.getClientStats(clientId));
    }

    @GetMapping("/escalation-stats")
    @Operation(summary = "Statistiques d'escalade")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<com.supportflow.dto.stats.EscalationStatsDTO> getEscalationStats(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(dashboardService.getEscalationStats(days));
    }
}
