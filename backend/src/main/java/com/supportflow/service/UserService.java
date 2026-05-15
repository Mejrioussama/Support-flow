package com.supportflow.service;

import com.supportflow.dto.KeycloakMigrationResultDTO;
import com.supportflow.dto.UserDTO;
import com.supportflow.dto.UserSummaryDTO;
import com.supportflow.dto.auth.RegisterRequest;
import com.supportflow.entity.Client;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.ClientRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Service de gestion des utilisateurs
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityMapper mapper;
    private final KeycloakAdminService keycloakAdminService;
    private final UserIdentityService userIdentityService;
    private final AgentSkillService agentSkillService;
    private final PasswordResetMailService passwordResetMailService;

    private static final String PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    private static final SecureRandom PASSWORD_RANDOM = new SecureRandom();

    /**
     * Cree un nouvel utilisateur
     */
    public UserDTO createUser(RegisterRequest request) {
        log.info("Creation d'un nouvel utilisateur: {}", request.getUsername());

        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("Ce nom d'utilisateur existe deja");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Cet email existe deja");
        }

        KeycloakAdminService.ProvisionedKeycloakUser provisionedKeycloakUser =
            keycloakAdminService.provisionUser(request);

        try {
            User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .phone(request.getPhone())
                .role(request.getRole() != null ? request.getRole() : Role.CLIENT)
                .keycloakId(provisionedKeycloakUser.keycloakId())
                .isActive(true)
                .build();

            if (request.getClientId() != null) {
                Client client = clientRepository.findById(request.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client non trouve"));
                user.setClient(client);
            }

            user = userRepository.save(user);
            agentSkillService.updateAgentSkills(user.getId(), com.supportflow.dto.AgentSkillUpdateDTO.builder()
                .primaryCategoryCode(request.getPrimarySkillCode())
                .secondaryCategoryCode(request.getSecondarySkillCode())
                .build());
            log.info("Utilisateur cree: {}", user.getId());

            return getUserById(user.getId());
        } catch (RuntimeException e) {
            if (provisionedKeycloakUser.created()) {
                keycloakAdminService.deleteKeycloakUser(provisionedKeycloakUser.keycloakId());
            }
            throw e;
        }
    }

    /**
     * Met a jour un utilisateur
     */
    public UserDTO updateUser(Long id, UserDTO dto) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + id));

        if (dto.getEmail() != null && !dto.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(dto.getEmail())) {
                throw new BusinessException("Cet email existe deja");
            }
            user.setEmail(dto.getEmail());
        }

        if (dto.getFirstName() != null) user.setFirstName(dto.getFirstName());
        if (dto.getLastName() != null) user.setLastName(dto.getLastName());
        if (dto.getPhone() != null) user.setPhone(dto.getPhone());
        if (dto.getAvatarUrl() != null) user.setAvatarUrl(dto.getAvatarUrl());
        if (dto.getRole() != null) user.setRole(dto.getRole());
        if (dto.getIsActive() != null) user.setIsActive(dto.getIsActive());

        if (dto.getClientId() != null) {
            Client client = clientRepository.findById(dto.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException("Client non trouve"));
            user.setClient(client);
        }

        user = userRepository.save(user);
        agentSkillService.updateAgentSkills(user.getId(), com.supportflow.dto.AgentSkillUpdateDTO.builder()
            .primaryCategoryCode(dto.getPrimarySkillCode())
            .secondaryCategoryCode(dto.getSecondarySkillCode())
            .build());
        return getUserById(user.getId());
    }

    /**
     * Recupere un utilisateur par ID
     */
    @Transactional(readOnly = true)
    public UserDTO getUserById(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + id));
        return mapper.toUserDTO(user);
    }

    /**
     * Recupere un utilisateur par username
     */
    @Transactional(readOnly = true)
    public UserDTO getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + username));
        return mapper.toUserDTO(user);
    }

    /**
     * Liste tous les utilisateurs actifs
     */
    @Transactional(readOnly = true)
    public Page<UserDTO> getAllActiveUsers(Pageable pageable) {
        return userRepository.findByIsActiveTrue(pageable)
            .map(mapper::toUserDTO);
    }

    @Transactional(readOnly = true)
    public Page<UserDTO> getUsers(Pageable pageable, Role role, Boolean isActive, String search) {
        return userRepository.findUsersWithFilters(role, isActive, search, pageable)
            .map(mapper::toUserDTO);
    }

    /**
     * Liste les utilisateurs par role
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getUsersByRole(Role role) {
        return mapper.toUserDTOList(userRepository.findByRoleAndIsActiveTrue(role));
    }

    /**
     * Liste les agents support disponibles - synchronise depuis Keycloak
     */
    @Transactional
    public List<UserSummaryDTO> getAvailableSupportAgents() {
        try {
            List<User> syncedAgents = keycloakAdminService.syncAndGetAgents();
            if (!syncedAgents.isEmpty()) {
                log.info("Agents synchronises depuis Keycloak: {}", syncedAgents.size());
                return syncedAgents.stream().map(mapper::toUserSummaryDTO).toList();
            }
        } catch (Exception e) {
            log.warn("Erreur sync Keycloak, fallback sur la DB: {}", e.getMessage());
        }

        return userRepository.findAvailableSupportAgents()
            .stream()
            .map(mapper::toUserSummaryDTO)
            .toList();
    }

    /**
     * Recherche d'utilisateurs
     */
    @Transactional(readOnly = true)
    public Page<UserDTO> searchUsers(String query, Pageable pageable) {
        return userRepository.searchUsers(query, pageable)
            .map(mapper::toUserDTO);
    }

    /**
     * Desactive un utilisateur
     */
    public void deactivateUser(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + id));
        user.setIsActive(false);
        String keycloakUserId = keycloakAdminService.ensureLinkedKeycloakUser(user);
        userRepository.save(user);
        keycloakAdminService.setUserEnabled(keycloakUserId, false);
        log.info("Utilisateur desactive: {}", id);
    }

    /**
     * Active un utilisateur
     */
    public UserDTO activateUser(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + id));
        user.setIsActive(true);
        String keycloakUserId = keycloakAdminService.ensureLinkedKeycloakUser(user);
        user = userRepository.save(user);
        keycloakAdminService.setUserEnabled(keycloakUserId, true);
        log.info("Utilisateur active: {}", id);
        return mapper.toUserDTO(user);
    }

    /**
     * Met a jour le mot de passe d'un utilisateur
     */
    public void updatePassword(Long id, String newPassword) {
        updatePassword(id, newPassword, false);
    }

    public void updatePassword(Long id, String newPassword, boolean temporary) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new BusinessException("Le nouveau mot de passe est obligatoire");
        }
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + id));
        user.setPassword(passwordEncoder.encode(newPassword));
        String keycloakUserId = keycloakAdminService.ensureLinkedKeycloakUser(user);
        userRepository.save(user);
        keycloakAdminService.updateUserPassword(keycloakUserId, newPassword, temporary);
        log.info("Mot de passe mis a jour pour l'utilisateur: {} (temporary={})", id, temporary);
    }

    /**
     * Genere un mot de passe temporaire, le synchronise avec Keycloak et l'envoie par mail.
     */
    public void sendPasswordResetEmail(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouve: " + id));

        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new BusinessException("Aucun email disponible pour cet utilisateur");
        }

        String temporaryPassword = generateTemporaryPassword();
        user.setPassword(passwordEncoder.encode(temporaryPassword));
        String keycloakUserId = keycloakAdminService.ensureLinkedKeycloakUser(user);
        userRepository.save(user);
        keycloakAdminService.updateUserPassword(keycloakUserId, temporaryPassword, true);
        passwordResetMailService.sendTemporaryPassword(user, temporaryPassword);
        log.info("Reset par mail prepare pour l'utilisateur {} ({})", user.getUsername(), user.getEmail());
    }

    /**
     * Migre les comptes existants sans liaison Keycloak.
     */
    public List<KeycloakMigrationResultDTO> migrateExistingUsersToKeycloak() {
        List<KeycloakMigrationResultDTO> results = new ArrayList<>();
        List<User> users = userRepository.findByIsActiveTrue(org.springframework.data.domain.Pageable.unpaged()).getContent();

        for (User user : users) {
            if (user.getKeycloakId() != null && !user.getKeycloakId().isBlank()) {
                continue;
            }

            String defaultPassword = getDefaultPasswordForRole(user.getRole());
            RegisterRequest request = RegisterRequest.builder()
                .username(user.getUsername())
                .email(user.getEmail())
                .password(defaultPassword)
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .role(user.getRole())
                .clientId(user.getClient() != null ? user.getClient().getId() : null)
                .primarySkillCode(user.getPrimarySkill() != null && user.getPrimarySkill().getCategory() != null
                    ? user.getPrimarySkill().getCategory().getCode() : null)
                .secondarySkillCode(user.getSecondarySkill() != null && user.getSecondarySkill().getCategory() != null
                    ? user.getSecondarySkill().getCategory().getCode() : null)
                .build();

            KeycloakAdminService.ProvisionedKeycloakUser provisioned = keycloakAdminService.provisionUser(request);
            user.setKeycloakId(provisioned.keycloakId());
            userRepository.save(user);

            results.add(KeycloakMigrationResultDTO.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .action(provisioned.created() ? "CREATED_IN_KEYCLOAK" : "LINKED_EXISTING_KEYCLOAK")
                .keycloakId(provisioned.keycloakId())
                .password(defaultPassword)
                .build());
        }

        return results;
    }

    /**
     * Resout l'ID utilisateur local a partir du JWT
     */
    public Long resolveUserIdFromJwt(Jwt jwt) {
        return userIdentityService.resolveUserIdFromJwt(jwt);
    }

    /**
     * Met a jour la date de derniere connexion
     */
    public void updateLastLogin(Long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
        });
    }

    /**
     * Verifie si un username existe
     */
    @Transactional(readOnly = true)
    public boolean existsByUsername(String username) {
        return userRepository.existsByUsername(username);
    }

    /**
     * Verifie si un email existe
     */
    @Transactional(readOnly = true)
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    private String getDefaultPasswordForRole(Role role) {
        if (role == null) {
            return "client123";
        }
        return switch (role) {
            case ADMIN -> "admin123";
            case SUPPORT_MANAGER -> "manager123";
            case SUPPORT_AGENT -> "agent123";
            case CLIENT -> "client123";
        };
    }

    private String generateTemporaryPassword() {
        StringBuilder password = new StringBuilder("SF-");
        for (int i = 0; i < 11; i++) {
            int index = PASSWORD_RANDOM.nextInt(PASSWORD_ALPHABET.length());
            password.append(PASSWORD_ALPHABET.charAt(index));
        }
        password.append('7');
        return password.toString();
    }
}
