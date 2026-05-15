package com.supportflow.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentSkillUpdateDTO {
    @Size(max = 50)
    private String primaryCategoryCode;

    @Size(max = 50)
    private String secondaryCategoryCode;
}
