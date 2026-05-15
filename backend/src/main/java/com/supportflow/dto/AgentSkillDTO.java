package com.supportflow.dto;

import com.supportflow.entity.enums.AgentSkillType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentSkillDTO {
    private Long id;
    private Long agentId;
    private String categoryCode;
    private String categoryLabel;
    private AgentSkillType skillType;
}
