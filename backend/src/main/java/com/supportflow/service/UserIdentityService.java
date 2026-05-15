package com.supportflow.service;

import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

        if (email != null) {
            var byEmail = userRepository.findByEmail(email);
            if (byEmail.isPresent()) {
                return attachKeycloakIdIfMissing(byEmail.get(), keycloakId);
            }
        }

        if (preferredUsername != null) {
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

        if (keycloakEmail != null) {
            var byEmail = userRepository.findByEmail(keycloakEmail);
            if (byEmail.isPresent()) {
                return attachKeycloakIdIfMissing(byEmail.get(), keycloakId);
            }
        }

        if (keycloakUsername != null) {
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
            return userRepository.save(user);
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
