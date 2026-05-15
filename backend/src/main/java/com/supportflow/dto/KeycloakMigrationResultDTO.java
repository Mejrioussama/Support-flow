package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Resultat d'une migration d'utilisateur vers Keycloak.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KeycloakMigrationResultDTO {

    private Long userId;
    private String username;
    private String email;
    private String role;
    private String action;
    private String keycloakId;
    private String password;
}
