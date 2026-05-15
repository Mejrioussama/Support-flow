package com.supportflow.dto;

import com.supportflow.entity.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO complet pour les utilisateurs
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {
    
    private Long id;
    
    @NotBlank(message = "Le nom d'utilisateur est obligatoire")
    @Size(min = 3, max = 50)
    private String username;
    
    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    private String email;
    
    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 50)
    private String firstName;
    
    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 50)
    private String lastName;
    
    private String phone;
    
    private String avatarUrl;
    
    @NotNull(message = "Le rôle est obligatoire")
    private Role role;

    private String keycloakId;
    
    private Long clientId;
    private String clientName;
    
    private Boolean isActive;
    
    private LocalDateTime lastLogin;
    
    private LocalDateTime createdAt;
    
    // Stats
    private int assignedTicketsCount;

    private String primarySkillCode;
    private String primarySkillLabel;
    private String secondarySkillCode;
    private String secondarySkillLabel;
    private List<AgentSkillDTO> skills;
}
