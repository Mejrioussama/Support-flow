package com.supportflow.entity.enums;

public enum WaitingOn {
    CLIENT("Client"),
    AGENT("Agent"),
    MANAGER("Manager"),
    THIRD_PARTY("Tiers");

    private final String label;

    WaitingOn(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
