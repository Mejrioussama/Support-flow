package com.supportflow.entity.enums;

/**
 * Statut du ticket dans le workflow
 */
public enum TicketStatus {
    NEW("Nouveau"),
    OPEN("Ouvert"), // Legacy compatibility
    ASSIGNED("Assigne"),
    IN_PROGRESS("En cours"),
    PENDING("En attente"),
    ESCALATED_MANUAL("Escalade (manuel)"),
    ESCALATED_SLA("Escalade (SLA)"),
    RESOLVED("Resolu"),
    CLOSED("Ferme"),
    CANCELLED("Annule");

    private final String label;

    TicketStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
