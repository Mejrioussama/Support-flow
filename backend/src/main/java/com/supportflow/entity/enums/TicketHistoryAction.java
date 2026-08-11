package com.supportflow.entity.enums;

/**
 * Every event type ever recorded on {@code TicketHistory.action}. Previously a free-form
 * String, matched by exact-literal comparison in cooldown/anti-spam checks scattered across
 * TicketService, EscalationService, and TicketAutomationService - a typo in any one of those
 * literals would silently break the corresponding cooldown/idempotency guard with no compiler
 * or DB error. Enum constant names must match the historical String values exactly (this maps
 * via {@code @Enumerated(EnumType.STRING)}, so existing rows in a live DB stay readable).
 */
public enum TicketHistoryAction {
    CREATED,
    STATUS_CHANGE,
    STATUS_REASON,
    ASSIGNMENT,
    ASSIGNMENT_AI_VALIDATED,
    ASSIGNED_STUCK_ALERT,
    COMMENT_ADDED,
    ATTACHMENT_ADDED,
    CUSTOMER_RESPONSE_RECEIVED,

    ESCALADE_MANUELLE,
    MANAGER_REVIEW_REQUESTED,
    ESCALATION_HOLD,
    ESCALATION_HOLD_RELEASED,
    ESCALATION_L1,
    ESCALATION_L2,
    ESCALATION_L3,
    ESCALATION_L3_FAILED,

    SLA_AUTO_PAUSED,
    SLA_PAUSED_MANUAL,
    SLA_RESUMED,
    SLA_EXTENDED,
    SLA_DUE_DATE_UPDATED,
    SLA_AT_RISK_ALERT,
    SLA_CRITICAL_EVENT,
    TICKET_BLOCKED_ALERT,

    WAITING_ON_CLIENT,
    WAITING_ON_AGENT,
    WAITING_ON_MANAGER,
    WAITING_ON_THIRD_PARTY,

    RESOLUTION_CAPTURED,
    RESOLUTION_REJECTED,
    FERMETURE,
    ARCHIVAGE,
    ARCHIVE_SYNC_WARNING,

    CAMUNDA_SYNC_WARNING,
    CAMUNDA_SYNC_FAILED
}
