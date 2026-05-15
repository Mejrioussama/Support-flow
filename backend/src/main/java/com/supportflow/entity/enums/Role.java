package com.supportflow.entity.enums;

/**
 * Rôles utilisateur dans le système
 */
public enum Role {
    ADMIN("Administrateur"),
    SUPPORT_MANAGER("Responsable Support"),
    SUPPORT_AGENT("Agent Support"),
    CLIENT("Client");
    
    private final String label;
    
    Role(String label) {
        this.label = label;
    }
    
    public String getLabel() {
        return label;
    }
}
