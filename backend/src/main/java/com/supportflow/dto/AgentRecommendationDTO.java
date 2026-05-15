package com.supportflow.dto;

import com.supportflow.entity.enums.SkillMatchType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentRecommendationDTO {
    private Long id;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String fullName;
    private long activeTickets;
    private double slaComplianceRate;
    private double expertiseScore;
    private double recommendationScore;
    private String recommendationReason;
    private String normalizedCategory;
    private SkillMatchType skillMatchType;
    private Boolean primarySkillMatch;
    private Boolean secondarySkillMatch;
    private String primarySkillCode;
    private String secondarySkillCode;
    private Boolean assignmentEligible;
    private String assignmentStatus;
    private String assignmentStatusLabel;
}
