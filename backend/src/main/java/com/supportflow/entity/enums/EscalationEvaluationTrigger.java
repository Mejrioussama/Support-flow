package com.supportflow.entity.enums;

/**
 * Canonical triggers evaluated by the unified escalation engine.
 */
public enum EscalationEvaluationTrigger {
    SLA_AT_RISK,
    SLA_BREACHED,
    ASSIGNED_STUCK,
    MANUAL_MANAGER_REVIEW,
    MANUAL_FORCE_TAKEOVER
}
