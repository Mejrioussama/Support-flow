package com.supportflow.entity.enums;

/**
 * Raisons d'escalade pour le suivi détaillé
 */
public enum EscalationReason {
    SLA_BREACH,
    STUCK_ASSIGNED,
    MANUAL,
    NO_AGENT_AVAILABLE,
    MANAGER_OVERRIDE,
    COOLDOWN_SKIP,
    FATIGUE_BLOCKED,
    HOLD_ACTIVE
}
