package com.supportflow.entity.enums;

/**
 * Impact client du ticket
 */
public enum Impact {
    CRITICAL(4, "Critique - Service totalement indisponible"),
    HIGH(3, "Fort - Fonctionnalité majeure impactée"),
    MEDIUM(2, "Moyen - Fonctionnalité secondaire impactée"),
    LOW(1, "Faible - Impact mineur");
    
    private final int weight;
    private final String description;
    
    Impact(int weight, String description) {
        this.weight = weight;
        this.description = description;
    }
    
    public int getWeight() {
        return weight;
    }
    
    public String getDescription() {
        return description;
    }
}
