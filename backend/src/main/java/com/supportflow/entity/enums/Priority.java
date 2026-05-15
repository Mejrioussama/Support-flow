package com.supportflow.entity.enums;

/**
 * Priorité calculée du ticket
 */
public enum Priority {
    SUPER_CRITICAL(5, "Super Critique", "#8B0000"),
    CRITICAL(4, "Critique", "#FF0000"),
    HIGH(3, "Haute", "#FF6600"),
    MEDIUM(2, "Moyenne", "#FFCC00"),
    LOW(1, "Basse", "#00CC00");
    
    private final int level;
    private final String label;
    private final String color;
    
    Priority(int level, String label, String color) {
        this.level = level;
        this.label = label;
        this.color = color;
    }
    
    public int getLevel() {
        return level;
    }
    
    public String getLabel() {
        return label;
    }
    
    public String getColor() {
        return color;
    }
    
    /**
     * Calcule la priorité basée sur le score
     */
    public static Priority fromScore(int score) {
        if (score >= 23) return SUPER_CRITICAL;
        if (score >= 10) return CRITICAL;
        if (score >= 7) return HIGH;
        if (score >= 4) return MEDIUM;
        return LOW;
    }
}
