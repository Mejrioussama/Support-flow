package com.supportflow.dto.auth;

import com.supportflow.entity.enums.Role;
import lombok.*;

/**
 * DTO pour les réponses d'authentification JWT
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JwtResponse {
    
    private String accessToken;
    
    private String refreshToken;
    
    private String tokenType = "Bearer";
    
    private Long expiresIn;
    
    private Long userId;
    
    private String username;
    
    private String email;
    
    private String fullName;
    
    private Role role;
}
