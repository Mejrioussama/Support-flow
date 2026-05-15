package com.supportflow.controller;

import com.supportflow.dto.SatisfactionSurveyDTO;
import com.supportflow.service.SatisfactionService;
import com.supportflow.service.UserIdentityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/satisfaction")
@RequiredArgsConstructor
@Tag(name = "Satisfaction", description = "Sondages de satisfaction post-résolution")
public class SatisfactionController {

    private final SatisfactionService satisfactionService;
    private final UserIdentityService userIdentityService;

    @GetMapping("/ticket/{ticketId}")
    @Operation(summary = "Obtenir le sondage d'un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<SatisfactionSurveyDTO> getSurvey(@PathVariable Long ticketId) {
        SatisfactionSurveyDTO dto = satisfactionService.getSurveyByTicket(ticketId);
        if (dto == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/ticket/{ticketId}/send")
    @Operation(summary = "Envoyer un sondage de satisfaction pour un ticket résolu")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Void> sendSurvey(@PathVariable Long ticketId) {
        satisfactionService.sendSurvey(ticketId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/ticket/{ticketId}/respond")
    @Operation(summary = "Soumettre une réponse de satisfaction")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<SatisfactionSurveyDTO> respond(
            @PathVariable Long ticketId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        Integer rating = Integer.valueOf(body.get("rating").toString());
        String comment = body.get("comment") != null ? body.get("comment").toString() : null;
        Long userId = userIdentityService.resolveUserIdFromJwt(jwt);
        return ResponseEntity.ok(satisfactionService.submitResponse(ticketId, rating, comment, userId));
    }

    @GetMapping("/stats")
    @Operation(summary = "Statistiques de satisfaction globales")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(satisfactionService.getStats());
    }

    @GetMapping("/low-rated-escalated")
    @Operation(summary = "Tickets escaladés avec satisfaction basse")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<SatisfactionSurveyDTO>> getLowRatedEscalated() {
        return ResponseEntity.ok(satisfactionService.getLowRatedEscalated());
    }
}
