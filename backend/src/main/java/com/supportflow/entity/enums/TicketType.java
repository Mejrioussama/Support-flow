package com.supportflow.entity.enums;

/**
 * Type de ticket
 */
public enum TicketType {
    INCIDENT("Incident"),
    BUG("Bug"),
    FEATURE_REQUEST("Demande d'évolution"),
    QUESTION("Question"),
    TASK("Tâche");
    
    private final String label;
    
    TicketType(String label) {
        this.label = label;
    }
    
    public String getLabel() {
        return label;
    }
}
