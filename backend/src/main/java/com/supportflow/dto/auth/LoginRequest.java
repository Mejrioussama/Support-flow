package com.supportflow.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

/**
 * DTO pour les requêtes de connexion
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {
    
    @NotBlank(message = "Le nom d'utilisateur est obligatoire")
    private String username;
    
    @NotBlank(message = "Le mot de passe est obligatoire")
    private String password;
}
