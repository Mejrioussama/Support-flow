package com.supportflow.dto.auth;

import com.supportflow.entity.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * DTO pour les requêtes d'inscription
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterRequest {
    
    @NotBlank(message = "Le nom d'utilisateur est obligatoire")
    @Size(min = 3, max = 50, message = "Le nom d'utilisateur doit faire entre 3 et 50 caractères")
    private String username;
    
    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    private String email;
    
    @NotBlank(message = "Le mot de passe est obligatoire")
    @Size(min = 6, max = 100, message = "Le mot de passe doit faire entre 6 et 100 caractères")
    private String password;
    
    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 50)
    private String firstName;
    
    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 50)
    private String lastName;
    
    private String phone;
    
    private Role role;
    
    private Long clientId;

    private String primarySkillCode;

    private String secondarySkillCode;
}
