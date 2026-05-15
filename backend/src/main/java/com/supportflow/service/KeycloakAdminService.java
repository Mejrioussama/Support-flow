package com.supportflow.service;

import com.supportflow.dto.auth.RegisterRequest;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.exception.BusinessException;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service pour interagir avec l'API Admin de Keycloak.
 * Synchronise les utilisateurs Keycloak vers la base de données MySQL.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KeycloakAdminService {

    public record ProvisionedKeycloakUser(String keycloakId, boolean created) {}

    private final UserRepository userRepository;

    @Value("${keycloak.admin.server-url:http://localhost:8180}")
    private String keycloakServerUrl;

    @Value("${keycloak.admin.realm:supportflow}")
    private String realm;

    @Value("${keycloak.admin.master-realm:master}")
    private String masterRealm;

    @Value("${keycloak.admin.client-id:admin-cli}")
    private String adminClientId;

    @Value("${keycloak.admin.username:admin}")
    private String adminUsername;

    @Value("${keycloak.admin.password:admin}")
    private String adminPassword;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Obtient un token admin depuis le master realm
     */
    private String getAdminToken() {
        String tokenUrl = keycloakServerUrl + "/realms/" + masterRealm + "/protocol/openid-connect/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", adminClientId);
        body.add("username", adminUsername);
        body.add("password", adminPassword);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    tokenUrl, HttpMethod.POST, request,
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getBody() != null) {
                return (String) response.getBody().get("access_token");
            }
        } catch (Exception e) {
            log.error("Erreur lors de l'obtention du token admin Keycloak: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Récupère tous les utilisateurs Keycloak ayant un rôle spécifique dans le realm
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getKeycloakUsersByRole(String roleName) {
        String token = getAdminToken();
        if (token == null) {
            log.warn("Impossible d'obtenir le token admin, retour liste vide");
            return Collections.emptyList();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            // Récupérer les utilisateurs ayant le rôle realm spécifié
            String roleUsersUrl = keycloakServerUrl + "/admin/realms/" + realm
                    + "/roles/" + roleName + "/users";

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    roleUsersUrl, HttpMethod.GET, entity,
                    new ParameterizedTypeReference<>() {}
            );

            return response.getBody() != null ? response.getBody() : Collections.emptyList();

        } catch (Exception e) {
            log.error("Erreur lors de la récupération des utilisateurs Keycloak avec rôle {}: {}",
                    roleName, e.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> getKeycloakUserById(String keycloakUserId) {
        String token = getAdminToken();
        if (token == null || keycloakUserId == null || keycloakUserId.isBlank()) {
            return null;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            String url = keycloakServerUrl + "/admin/realms/" + realm + "/users/" + keycloakUserId;
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url, HttpMethod.GET, entity, new ParameterizedTypeReference<>() {}
            );
            return response.getBody();
        } catch (Exception e) {
            log.warn("Impossible de recuperer l'utilisateur Keycloak {}: {}", keycloakUserId, e.getMessage());
            return null;
        }
    }

    public ProvisionedKeycloakUser provisionUser(RegisterRequest request) {
        String token = getAdminToken();
        if (token == null) {
            throw new BusinessException("Provisioning Keycloak indisponible pour le moment");
        }

        Map<String, Object> existingUser = findKeycloakUserByUsernameOrEmail(token, request.getUsername(), request.getEmail());
        Role requestedRole = request.getRole() != null ? request.getRole() : Role.CLIENT;

        if (existingUser != null) {
            String existingId = (String) existingUser.get("id");
            updateKeycloakUserProfile(token, existingId, request, true);
            assignRealmRole(token, existingId, requestedRole);
            updateKeycloakPassword(token, existingId, request.getPassword(), false);
            return new ProvisionedKeycloakUser(existingId, false);
        }

        String keycloakUserId = createKeycloakUser(token, request);
        assignRealmRole(token, keycloakUserId, requestedRole);
        updateKeycloakPassword(token, keycloakUserId, request.getPassword(), false);
        return new ProvisionedKeycloakUser(keycloakUserId, true);
    }

    public void deleteKeycloakUser(String keycloakUserId) {
        String token = getAdminToken();
        if (token == null || keycloakUserId == null || keycloakUserId.isBlank()) {
            return;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(token);
            restTemplate.exchange(
                keycloakServerUrl + "/admin/realms/" + realm + "/users/" + keycloakUserId,
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                Void.class
            );
        } catch (Exception e) {
            log.warn("Impossible de supprimer l'utilisateur Keycloak {}: {}", keycloakUserId, e.getMessage());
        }
    }

    public String ensureLinkedKeycloakUser(User user) {
        if (user == null) {
            return null;
        }
        if (user.getKeycloakId() != null && !user.getKeycloakId().isBlank()) {
            return user.getKeycloakId();
        }

        String token = getAdminToken();
        if (token == null) {
            return null;
        }

        Map<String, Object> existingUser = findKeycloakUserByUsernameOrEmail(token, user.getUsername(), user.getEmail());
        if (existingUser == null) {
            return null;
        }

        String keycloakId = (String) existingUser.get("id");
        user.setKeycloakId(keycloakId);
        userRepository.save(user);
        return keycloakId;
    }

    public void setUserEnabled(String keycloakUserId, boolean enabled) {
        String token = getAdminToken();
        if (token == null || keycloakUserId == null || keycloakUserId.isBlank()) {
            return;
        }

        try {
            String url = keycloakServerUrl + "/admin/realms/" + realm + "/users/" + keycloakUserId;
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(buildJsonHeaders(token)),
                new ParameterizedTypeReference<>() {}
            );

            Map<String, Object> body = response.getBody() != null ? new HashMap<>(response.getBody()) : new HashMap<>();
            body.put("enabled", enabled);

            restTemplate.exchange(
                url,
                HttpMethod.PUT,
                new HttpEntity<>(body, buildJsonHeaders(token)),
                Void.class
            );
        } catch (Exception e) {
            log.warn("Impossible de mettre a jour l'etat Keycloak {}: {}", keycloakUserId, e.getMessage());
        }
    }

    public void updateUserPassword(String keycloakUserId, String newPassword) {
        updateUserPassword(keycloakUserId, newPassword, false);
    }

    public void updateUserPassword(String keycloakUserId, String newPassword, boolean temporary) {
        if (newPassword == null || newPassword.isBlank()) {
            return;
        }
        String token = getAdminToken();
        if (token == null || keycloakUserId == null || keycloakUserId.isBlank()) {
            return;
        }

        try {
            updateKeycloakPassword(token, keycloakUserId, newPassword, temporary);
        } catch (Exception e) {
            log.warn("Impossible de mettre a jour le mot de passe Keycloak {}: {}", keycloakUserId, e.getMessage());
        }
    }

    /**
     * Synchronise les agents Keycloak vers la base de données MySQL.
     * Crée les utilisateurs manquants et met à jour les existants.
     * Retourne la liste des agents synchronisés depuis la DB.
     */
    public List<User> syncAndGetAgents() {
        List<Map<String, Object>> keycloakAgents = getKeycloakUsersByRole("SUPPORT_AGENT");

        if (keycloakAgents.isEmpty()) {
            log.warn("Aucun agent SUPPORT_AGENT trouvé dans Keycloak, retour agents DB existants");
            return userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_AGENT);
        }

        List<User> syncedAgents = new ArrayList<>();
        Set<String> keycloakIds = new HashSet<>();

        for (Map<String, Object> kcUser : keycloakAgents) {
            String keycloakId = (String) kcUser.get("id");
            String username = (String) kcUser.get("username");
            String email = (String) kcUser.get("email");
            String firstName = (String) kcUser.get("firstName");
            String lastName = (String) kcUser.get("lastName");
            Boolean enabled = (Boolean) kcUser.get("enabled");

            if (Boolean.FALSE.equals(enabled)) {
                continue; // Ignorer les utilisateurs désactivés dans Keycloak
            }

            keycloakIds.add(keycloakId);

            // Chercher par keycloakId d'abord, puis par email, puis par username
            Optional<User> existingUser = userRepository.findByKeycloakId(keycloakId);
            if (existingUser.isEmpty() && email != null) {
                existingUser = userRepository.findByEmail(email);
            }
            if (existingUser.isEmpty() && username != null) {
                existingUser = userRepository.findByUsername(username);
            }

            User user;
            if (existingUser.isPresent()) {
                user = existingUser.get();
                // Mettre à jour les infos depuis Keycloak
                if (keycloakId != null) user.setKeycloakId(keycloakId);
                if (firstName != null) user.setFirstName(firstName);
                if (lastName != null) user.setLastName(lastName);
                if (email != null && !userRepository.existsByEmail(email) || email.equals(user.getEmail())) {
                    user.setEmail(email);
                }
                user.setRole(Role.SUPPORT_AGENT);
                user.setIsActive(true);
                user = userRepository.save(user);
                log.debug("Agent mis à jour depuis Keycloak: {} ({})", username, keycloakId);
            } else {
                // Créer un nouvel utilisateur depuis Keycloak
                user = User.builder()
                        .keycloakId(keycloakId)
                        .username(username != null ? username : keycloakId)
                        .email(email != null ? email : username + "@supportflow.local")
                        .firstName(firstName != null ? firstName : username)
                        .lastName(lastName != null ? lastName : "")
                        .role(Role.SUPPORT_AGENT)
                        .isActive(true)
                        .build();
                user = userRepository.save(user);
                log.info("Nouvel agent créé depuis Keycloak: {} ({})", username, keycloakId);
            }

            syncedAgents.add(user);
        }

        // Désactiver les agents qui ne sont plus dans Keycloak (sauf ceux sans keycloakId)
        List<User> dbAgents = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_AGENT);
        for (User dbAgent : dbAgents) {
            if (dbAgent.getKeycloakId() != null && !keycloakIds.contains(dbAgent.getKeycloakId())) {
                // Cet agent n'est plus dans Keycloak, le désactiver
                dbAgent.setIsActive(false);
                userRepository.save(dbAgent);
                log.info("Agent désactivé (supprimé de Keycloak): {} ({})",
                        dbAgent.getUsername(), dbAgent.getKeycloakId());
            }
        }

        return syncedAgents;
    }

    /**
     * Synchronise tous les utilisateurs d'un rôle donné depuis Keycloak vers MySQL
     */
    public void syncUsersForRole(String roleName, Role dbRole) {
        List<Map<String, Object>> kcUsers = getKeycloakUsersByRole(roleName);

        for (Map<String, Object> kcUser : kcUsers) {
            String keycloakId = (String) kcUser.get("id");
            String username = (String) kcUser.get("username");
            String email = (String) kcUser.get("email");
            String firstName = (String) kcUser.get("firstName");
            String lastName = (String) kcUser.get("lastName");

            Optional<User> existing = userRepository.findByKeycloakId(keycloakId);
            if (existing.isEmpty() && email != null) {
                existing = userRepository.findByEmail(email);
            }

            if (existing.isEmpty()) {
                User user = User.builder()
                        .keycloakId(keycloakId)
                        .username(username != null ? username : keycloakId)
                        .email(email != null ? email : username + "@supportflow.local")
                        .firstName(firstName != null ? firstName : username)
                        .lastName(lastName != null ? lastName : "")
                        .role(dbRole)
                        .isActive(true)
                        .build();
                userRepository.save(user);
                log.info("Utilisateur synchronisé depuis Keycloak: {} (rôle: {})", username, dbRole);
            } else {
                User user = existing.get();
                if (user.getKeycloakId() == null) {
                    user.setKeycloakId(keycloakId);
                    userRepository.save(user);
                }
            }
        }
    }

    private HttpHeaders buildJsonHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Map<String, Object> findKeycloakUserByUsernameOrEmail(String token, String username, String email) {
        Map<String, Object> byUsername = findKeycloakUser(token, "username", username, true);
        if (byUsername != null) {
            return byUsername;
        }
        return findKeycloakUser(token, "email", email, false);
    }

    private Map<String, Object> findKeycloakUser(String token, String field, String value, boolean exactUsername) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                .fromHttpUrl(keycloakServerUrl + "/admin/realms/" + realm + "/users")
                .queryParam(field, value);

            if (exactUsername) {
                builder.queryParam("exact", true);
            }

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                new HttpEntity<>(buildJsonHeaders(token)),
                new ParameterizedTypeReference<>() {}
            );

            List<Map<String, Object>> users = response.getBody() != null ? response.getBody() : Collections.emptyList();
            return users.stream()
                .filter(user -> value.equalsIgnoreCase(Objects.toString(user.get(field), "")))
                .findFirst()
                .orElse(null);
        } catch (Exception e) {
            log.warn("Recherche Keycloak impossible pour {}={}: {}", field, value, e.getMessage());
            return null;
        }
    }

    private String createKeycloakUser(String token, RegisterRequest request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("username", request.getUsername());
        payload.put("email", request.getEmail());
        payload.put("firstName", request.getFirstName());
        payload.put("lastName", request.getLastName());
        payload.put("enabled", true);
        payload.put("emailVerified", true);

        try {
            ResponseEntity<Void> response = restTemplate.exchange(
                keycloakServerUrl + "/admin/realms/" + realm + "/users",
                HttpMethod.POST,
                new HttpEntity<>(payload, buildJsonHeaders(token)),
                Void.class
            );

            String keycloakUserId = extractUserIdFromLocation(response.getHeaders().getFirst(HttpHeaders.LOCATION));
            if (keycloakUserId == null) {
                Map<String, Object> created = findKeycloakUserByUsernameOrEmail(token, request.getUsername(), request.getEmail());
                keycloakUserId = created != null ? (String) created.get("id") : null;
            }

            if (keycloakUserId == null) {
                throw new BusinessException("Utilisateur cree dans Keycloak mais identifiant introuvable");
            }
            return keycloakUserId;
        } catch (Exception e) {
            throw new BusinessException("Impossible de creer le compte dans Keycloak: " + e.getMessage());
        }
    }

    private void updateKeycloakUserProfile(String token, String keycloakUserId, RegisterRequest request, boolean enabled) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", keycloakUserId);
        payload.put("username", request.getUsername());
        payload.put("email", request.getEmail());
        payload.put("firstName", request.getFirstName());
        payload.put("lastName", request.getLastName());
        payload.put("enabled", enabled);
        payload.put("emailVerified", true);

        restTemplate.exchange(
            keycloakServerUrl + "/admin/realms/" + realm + "/users/" + keycloakUserId,
            HttpMethod.PUT,
            new HttpEntity<>(payload, buildJsonHeaders(token)),
            Void.class
        );
    }

    private void updateKeycloakPassword(String token, String keycloakUserId, String password, boolean temporary) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "password");
        payload.put("value", password);
        payload.put("temporary", temporary);

        restTemplate.exchange(
            keycloakServerUrl + "/admin/realms/" + realm + "/users/" + keycloakUserId + "/reset-password",
            HttpMethod.PUT,
            new HttpEntity<>(payload, buildJsonHeaders(token)),
            Void.class
        );
    }

    private void assignRealmRole(String token, String keycloakUserId, Role role) {
        try {
            ResponseEntity<Map<String, Object>> roleResponse = restTemplate.exchange(
                keycloakServerUrl + "/admin/realms/" + realm + "/roles/" + role.name(),
                HttpMethod.GET,
                new HttpEntity<>(buildJsonHeaders(token)),
                new ParameterizedTypeReference<>() {}
            );

            Map<String, Object> roleRepresentation = roleResponse.getBody();
            if (roleRepresentation == null) {
                throw new BusinessException("Role Keycloak introuvable: " + role.name());
            }

            restTemplate.exchange(
                keycloakServerUrl + "/admin/realms/" + realm + "/users/" + keycloakUserId + "/role-mappings/realm",
                HttpMethod.POST,
                new HttpEntity<>(List.of(roleRepresentation), buildJsonHeaders(token)),
                Void.class
            );
        } catch (Exception e) {
            throw new BusinessException("Impossible d'assigner le role Keycloak " + role.name() + ": " + e.getMessage());
        }
    }

    private String extractUserIdFromLocation(String location) {
        if (location == null || location.isBlank()) {
            return null;
        }
        int lastSlash = location.lastIndexOf('/');
        return lastSlash >= 0 ? location.substring(lastSlash + 1) : location;
    }
}
