package com.supportflow.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/** Single source of truth for translating trusted Keycloak role claims. */
@Component
public class KeycloakRoleExtractor {

    private static final Set<String> TRUSTED_ROLE_CLIENTS = Set.of(
        "supportflow-frontend", "supportflow-backend"
    );

    public Set<String> extractRoles(Jwt jwt) {
        Set<String> roles = new LinkedHashSet<>();
        if (jwt == null) return roles;

        addRoles(roles, jwt.getClaim("roles"));
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) addRoles(roles, realmAccess.get("roles"));

        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess != null) {
            for (String clientId : TRUSTED_ROLE_CLIENTS) {
                Object clientAccess = resourceAccess.get(clientId);
                if (clientAccess instanceof Map<?, ?> accessMap) {
                    addRoles(roles, accessMap.get("roles"));
                }
            }
        }
        return roles;
    }

    public Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
        return extractRoles(jwt).stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
            .map(GrantedAuthority.class::cast)
            .toList();
    }

    private void addRoles(Set<String> target, Object value) {
        if (value instanceof String singleValue) {
            for (String role : singleValue.split(",")) addNormalized(target, role);
        } else if (value instanceof Collection<?> values) {
            values.stream().filter(String.class::isInstance).map(String.class::cast)
                .forEach(role -> addNormalized(target, role));
        }
    }

    private void addNormalized(Set<String> target, String role) {
        if (role == null || role.isBlank()) return;
        String normalized = role.trim().toUpperCase();
        target.add(normalized.startsWith("ROLE_") ? normalized.substring(5) : normalized);
    }
}
