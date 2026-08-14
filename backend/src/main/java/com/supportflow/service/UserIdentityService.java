package com.supportflow.service;

import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserIdentityService {

    private final UserRepository userRepository;
    private final KeycloakAdminService keycloakAdminService;

    public Long resolveUserIdFromJwt(Jwt jwt) {
        User user = resolveUserFromJwt(jwt);
        return user != null ? user.getId() : null;
    }

    public User resolveUserFromJwt(Jwt jwt) {
        if (jwt == null) {
            return null;
        }

        String keycloakId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        String preferredUsername = jwt.getClaimAsString("preferred_username");

        if (keycloakId == null && email == null && preferredUsername == null) {
            return null;
        }

        if (keycloakId != null) {
            var byKeycloakId = userRepository.findByKeycloakId(keycloakId);
            if (byKeycloakId.isPresent()) {
                return byKeycloakId.get();
            }
        }

        // Auto-linking an unlinked local User record by email/username match is only safe when
        // the identity claim is verified: Keycloak's self-registration flow (registrationAllowed)
        // lets a caller pick any email/username with no ownership check, since duplicateEmailsAllowed
        // only prevents collisions within Keycloak's own store, not against SupportFlow's local
        // "users" table. Without this gate, an attacker could self-register with an existing
        // staff member's email and silently inherit that member's local account/role on first
        // login. Accounts provisioned through KeycloakAdminService (the legitimate admin path)
        // are always created with emailVerified=true, so this does not affect normal staff
        // provisioning - only unverified, self-registered identities are excluded from linking.
        boolean jwtEmailVerified = Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));

        if (email != null && jwtEmailVerified) {
            var byEmail = userRepository.findByEmail(email);
            if (byEmail.isPresent()) {
                return attachKeycloakIdIfMissing(byEmail.get(), keycloakId);
            }
        }

        if (preferredUsername != null && jwtEmailVerified) {
            var byUsername = userRepository.findByUsername(preferredUsername);
            if (byUsername.isPresent()) {
                return attachKeycloakIdIfMissing(byUsername.get(), keycloakId);
            }
        }

        Map<String, Object> keycloakUser = keycloakId != null
            ? keycloakAdminService.getKeycloakUserById(keycloakId)
            : null;

        String keycloakEmail = getString(keycloakUser, "email");
        String keycloakUsername = getString(keycloakUser, "username");
        String keycloakFirstName = getString(keycloakUser, "firstName");
        String keycloakLastName = getString(keycloakUser, "lastName");
        boolean keycloakEmailVerified = keycloakUser != null && Boolean.TRUE.equals(keycloakUser.get("emailVerified"));

        if (keycloakEmail != null && keycloakEmailVerified) {
            var byEmail = userRepository.findByEmail(keycloakEmail);
            if (byEmail.isPresent()) {
                return attachKeycloakIdIfMissing(byEmail.get(), keycloakId);
            }
        }

        if (keycloakUsername != null && keycloakEmailVerified) {
            var byUsername = userRepository.findByUsername(keycloakUsername);
            if (byUsername.isPresent()) {
                return attachKeycloakIdIfMissing(byUsername.get(), keycloakId);
            }
        }

        log.info("Auto-creation utilisateur pour keycloakId={}, email={}, username={}",
            keycloakId, email, preferredUsername);

        User newUser = new User();
        String resolvedEmail = firstNonBlank(email, keycloakEmail, keycloakId != null ? keycloakId + "@supportflow.local" : null);
        String resolvedUsername = firstNonBlank(preferredUsername, keycloakUsername, email, keycloakId);
        String resolvedFirstName = firstNonBlank(jwt.getClaimAsString("given_name"), keycloakFirstName, resolvedUsername, "User");
        String resolvedLastName = firstNonBlank(jwt.getClaimAsString("family_name"), keycloakLastName, "SupportFlow");

        newUser.setEmail(resolvedEmail);
        newUser.setUsername(resolvedUsername);
        newUser.setFirstName(resolvedFirstName);
        newUser.setLastName(resolvedLastName);
        newUser.setKeycloakId(keycloakId);
        newUser.setIsActive(true);
        newUser.setRole(getRoleFromJwt(jwt));
        return userRepository.save(newUser);
    }

    private User attachKeycloakIdIfMissing(User user, String keycloakId) {
        if (user.getKeycloakId() == null && keycloakId != null) {
            user.setKeycloakId(keycloakId);
            try {
                return userRepository.save(user);
            } catch (ObjectOptimisticLockingFailureException e) {
                // Another concurrent request (e.g. parallel page-load calls) already attached the
                // keycloakId to this row first, bumping its version. That request's write already
                // satisfies our goal here, so reload the current row instead of failing the request.
                return userRepository.findById(user.getId()).orElse(user);
            }
        }
        return user;
    }

    private String getString(Map<String, Object> source, String key) {
        if (source == null) {
            return null;
        }
        Object value = source.get(key);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Role getRoleFromJwt(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null) {
                if (roles.contains("ADMIN")) return Role.ADMIN;
                if (roles.contains("SUPPORT_MANAGER")) return Role.SUPPORT_MANAGER;
                if (roles.contains("SUPPORT_AGENT")) return Role.SUPPORT_AGENT;
                if (roles.contains("CLIENT")) return Role.CLIENT;
            }
        }
        return Role.CLIENT;
    }
}
