package com.supportflow.dto.stats;

import lombok.*;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EscalationStatsDTO {
    /** Total escalades par niveau {1: 15, 2: 8, 3: 2} */
    private Map<Integer, Long> countByLevel;

    /** Temps moyen passé à chaque niveau (en minutes) */
    private Map<Integer, Double> avgMinutesByLevel;

    /** Taux de résolution après escalade (%) */
    private Double resolutionRateAfterEscalation;

    /** Nombre total d'escalades dans la période */
    private Long totalEscalations;

    /** Nombre d'escalades bloquées par cooldown/fatigue */
    private Long blockedEscalations;

    /** Satisfaction moyenne sur tickets escaladés */
    private Double avgSatisfactionEscalated;

    /** Satisfaction moyenne sur tickets non-escaladés */
    private Double avgSatisfactionNonEscalated;
}
