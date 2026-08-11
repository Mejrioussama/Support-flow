package com.supportflow.config;

import com.supportflow.security.KeycloakRoleExtractor;
import org.junit.jupiter.api.Test;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecurityConfigRoleConversionTest {

    private final Converter<Jwt, AbstractAuthenticationToken> converter =
        new SecurityConfig(new KeycloakRoleExtractor()).jwtAuthenticationConverter();

    @Test
    void acceptsRolesOnlyFromTrustedSupportFlowClients() {
        Jwt jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject("user")
            .claim("resource_access", Map.of(
                "supportflow-frontend", Map.of("roles", List.of("SUPPORT_AGENT")),
                "unrelated-client", Map.of("roles", List.of("ADMIN"))))
            .build();

        Set<String> authorities = converter.convert(jwt).getAuthorities().stream()
            .map(authority -> authority.getAuthority())
            .collect(Collectors.toSet());

        assertTrue(authorities.contains("ROLE_SUPPORT_AGENT"));
        assertFalse(authorities.contains("ROLE_ADMIN"));
    }

    @Test
    void acceptsBackendClientRoles() {
        Jwt jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject("service")
            .claim("resource_access", Map.of(
                "supportflow-backend", Map.of("roles", List.of("SUPPORT_MANAGER"))))
            .build();

        Set<String> authorities = converter.convert(jwt).getAuthorities().stream()
            .map(authority -> authority.getAuthority())
            .collect(Collectors.toSet());

        assertTrue(authorities.contains("ROLE_SUPPORT_MANAGER"));
    }
}
