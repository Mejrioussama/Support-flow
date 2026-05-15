package com.supportflow.controller;

import com.supportflow.dto.AgentAvailabilityDTO;
import com.supportflow.entity.AgentShift;
import com.supportflow.entity.enums.AgentStatus;
import com.supportflow.service.AgentWorkloadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import com.supportflow.security.AuthorizationHelper;

@RestController
@RequestMapping("/agents")
@RequiredArgsConstructor
@Tag(name = "Agent Workload", description = "Gestion de la charge et disponibilité des agents")
public class AgentWorkloadController {

    private final AgentWorkloadService workloadService;
    private final AuthorizationHelper authHelper;

    @GetMapping("/availability")
    @Operation(summary = "Liste la disponibilité de tous les agents")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<AgentAvailabilityDTO>> getAllStatuses() {
        return ResponseEntity.ok(workloadService.getAllAgentStatuses());
    }

    @GetMapping("/{agentId}/availability")
    @Operation(summary = "Disponibilité d'un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<AgentAvailabilityDTO> getAgentStatus(
            @PathVariable Long agentId,
            @AuthenticationPrincipal Jwt jwt) {
        // Agent ne peut voir que sa propre disponibilité
        if (authHelper.isAgent(jwt) && !agentId.equals(authHelper.getUserId(jwt))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(workloadService.getAgentStatus(agentId));
    }

    @PutMapping("/{agentId}/availability")
    @Operation(summary = "Mettre à jour la disponibilité d'un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<AgentAvailabilityDTO> updateAvailability(
            @PathVariable Long agentId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        // Agent ne peut modifier que sa propre disponibilité
        if (authHelper.isAgent(jwt) && !agentId.equals(authHelper.getUserId(jwt))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        AgentStatus status = AgentStatus.valueOf(body.get("status"));
        String reason = body.get("reason");
        return ResponseEntity.ok(workloadService.updateAvailability(agentId, status, reason));
    }

    @PutMapping("/{agentId}/max-tickets")
    @Operation(summary = "Définir le nombre max de tickets simultanés")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<AgentAvailabilityDTO> setMaxTickets(
            @PathVariable Long agentId,
            @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(workloadService.setMaxConcurrentTickets(agentId, body.get("maxTickets")));
    }

    // Shift management
    @GetMapping("/{agentId}/shifts")
    @Operation(summary = "Planning des shifts d'un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> getShifts(@PathVariable Long agentId) {
        return ResponseEntity.ok(workloadService.getAgentShifts(agentId).stream()
            .map(this::shiftToMap).collect(java.util.stream.Collectors.toList()));
    }

    @PostMapping("/{agentId}/shifts")
    @Operation(summary = "Ajouter un créneau de travail")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map<String, Object>> createShift(
            @PathVariable Long agentId,
            @RequestBody Map<String, String> body) {
        DayOfWeek day = DayOfWeek.valueOf(body.get("dayOfWeek"));
        LocalTime start = LocalTime.parse(body.get("startTime"));
        LocalTime end = LocalTime.parse(body.get("endTime"));
        boolean onCall = Boolean.parseBoolean(body.getOrDefault("isOnCall", "false"));
        return ResponseEntity.ok(shiftToMap(workloadService.createShift(agentId, day, start, end, onCall)));
    }

    private Map<String, Object> shiftToMap(AgentShift shift) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", shift.getId());
        m.put("agentId", shift.getAgent().getId());
        m.put("agentName", shift.getAgent().getFirstName() + " " + shift.getAgent().getLastName());
        m.put("dayOfWeek", shift.getDayOfWeek().name());
        m.put("startTime", shift.getStartTime().toString());
        m.put("endTime", shift.getEndTime().toString());
        m.put("isOnCall", shift.getIsOnCall());
        return m;
    }

    @DeleteMapping("/shifts/{shiftId}")
    @Operation(summary = "Supprimer un créneau de travail")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Void> deleteShift(@PathVariable Long shiftId) {
        workloadService.deleteShift(shiftId);
        return ResponseEntity.noContent().build();
    }
}
