package com.supportflow.dto;

import com.supportflow.entity.enums.Role;
import lombok.*;

/**
 * DTO résumé pour les utilisateurs (utilisé dans les relations)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSummaryDTO {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String fullName;
    private Role role;
    private String avatarUrl;
    private String primarySkillCode;
    private String primarySkillLabel;
}
