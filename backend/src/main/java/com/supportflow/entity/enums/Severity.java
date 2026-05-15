package com.supportflow.entity.enums;

/**
 * Niveau de gravité du ticket
 */
public enum Severity {
    SUPER_CRITICAL(5, "Super Critique"),
    CRITICAL(4, "Critique"),
    HIGH(3, "Élevée"),
    MEDIUM(2, "Moyenne"),
    LOW(1, "Faible");
    
    private final int weight;
    private final String label;
    
    Severity(int weight, String label) {
        this.weight = weight;
        this.label = label;
    }
    
    public int getWeight() {
        return weight;
    }
    
    public String getLabel() {
        return label;
    }
}
