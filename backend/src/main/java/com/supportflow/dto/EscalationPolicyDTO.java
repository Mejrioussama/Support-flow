package com.supportflow.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EscalationPolicyDTO {
    private Long id;
    private Long clientId;
    private String clientName;
    private String policyName;
    private Integer level1Threshold;
    private Integer level2Threshold;
    private Integer level3DelayMinutes;
    private Integer stuckAssignedMinutes;
    private Integer maxEscalations;
    private Integer cooldownMinutes;
    private Boolean autoReassignEnabled;
    private Boolean notifyClientOnEscalation;
    private Boolean isActive;
}
