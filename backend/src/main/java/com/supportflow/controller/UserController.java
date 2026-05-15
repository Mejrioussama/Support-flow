package com.supportflow.controller;

import com.supportflow.dto.AgentSkillDTO;
import com.supportflow.dto.AgentSkillUpdateDTO;
import com.supportflow.dto.KeycloakMigrationResultDTO;
import com.supportflow.dto.UserDTO;
import com.supportflow.dto.UserSummaryDTO;
import com.supportflow.dto.auth.RegisterRequest;
import com.supportflow.entity.enums.Role;
import com.supportflow.service.AgentSkillService;
import com.supportflow.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST pour la gestion des utilisateurs
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Utilisateurs", description = "API de gestion des utilisateurs")
public class UserController {
    
    private final UserService userService;
    private final AgentSkillService agentSkillService;
    
    @PostMapping
    @Operation(summary = "Créer un nouvel utilisateur")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody RegisterRequest request) {
        UserDTO user = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Récupérer un utilisateur par ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }
    
    @GetMapping("/username/{username}")
    @Operation(summary = "Récupérer un utilisateur par nom d'utilisateur")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> getUserByUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.getUserByUsername(username));
    }
    
    @GetMapping
    @Operation(summary = "Lister tous les utilisateurs actifs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Page<UserDTO>> getAllUsers(
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(userService.getUsers(pageable, role, isActive, search));
    }
    
    @GetMapping("/role/{role}")
    @Operation(summary = "Lister les utilisateurs par rôle")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<UserDTO>> getUsersByRole(@PathVariable Role role) {
        return ResponseEntity.ok(userService.getUsersByRole(role));
    }
    
    @GetMapping("/agents/available")
    @Operation(summary = "Lister les agents support disponibles")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<UserSummaryDTO>> getAvailableAgents() {
        return ResponseEntity.ok(userService.getAvailableSupportAgents());
    }

    @GetMapping("/agents")
    @Operation(summary = "Lister tous les agents support actifs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<UserDTO>> getAgents() {
        return ResponseEntity.ok(userService.getUsersByRole(Role.SUPPORT_AGENT));
    }

    @GetMapping("/me")
    @Operation(summary = "Récupérer le profil utilisateur courant")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        Long userId = userService.resolveUserIdFromJwt(jwt);
        return ResponseEntity.ok(userService.getUserById(userId));
    }

    @GetMapping("/{id}/skills")
    @Operation(summary = "Lire les competences d'un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<AgentSkillDTO>> getAgentSkills(@PathVariable Long id) {
        return ResponseEntity.ok(agentSkillService.getAgentSkills(id));
    }

    @PutMapping("/{id}/skills")
    @Operation(summary = "Mettre a jour les competences d'un agent")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> updateAgentSkills(
            @PathVariable Long id,
            @Valid @RequestBody AgentSkillUpdateDTO dto) {
        return ResponseEntity.ok(agentSkillService.updateAgentSkills(id, dto));
    }

    @PatchMapping("/me")
    @Operation(summary = "Mettre à jour le profil utilisateur courant")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> updateCurrentUser(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, String> body) {
        Long userId = userService.resolveUserIdFromJwt(jwt);
        UserDTO current = userService.getUserById(userId);

        if (body.get("firstName") != null) current.setFirstName(body.get("firstName"));
        if (body.get("lastName") != null) current.setLastName(body.get("lastName"));
        if (body.get("phone") != null) current.setPhone(body.get("phone"));
        if (body.get("avatarUrl") != null) current.setAvatarUrl(body.get("avatarUrl"));

        return ResponseEntity.ok(userService.updateUser(userId, current));
    }
    
    @GetMapping("/search")
    @Operation(summary = "Rechercher des utilisateurs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Page<UserDTO>> searchUsers(
            @RequestParam String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(userService.searchUsers(q, pageable));
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un utilisateur")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UserDTO dto) {
        return ResponseEntity.ok(userService.updateUser(id, dto));
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Désactiver un utilisateur")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateUser(@PathVariable Long id) {
        userService.deactivateUser(id);
    }

    @PatchMapping("/{id}/activate")
    @Operation(summary = "Activer un utilisateur")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> activateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.activateUser(id));
    }

    @PatchMapping("/{id}/deactivate")
    @Operation(summary = "Désactiver un utilisateur")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<UserDTO> deactivateUserPatch(@PathVariable Long id) {
        userService.deactivateUser(id);
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PatchMapping("/{id}/password")
    @Operation(summary = "Mettre à jour le mot de passe d'un utilisateur")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Void> changePassword(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        boolean temporary = Boolean.parseBoolean(body.getOrDefault("temporary", "false"));
        userService.updatePassword(id, body.get("newPassword"), temporary);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/password-reset-email")
    @Operation(summary = "Envoyer un reset de mot de passe par mail")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Map<String, String>> sendPasswordResetEmail(@PathVariable Long id) {
        UserDTO user = userService.getUserById(id);
        userService.sendPasswordResetEmail(id);
        return ResponseEntity.ok(Map.of(
            "message", "Email de reset envoye avec succes",
            "email", user.getEmail()
        ));
    }

    @PostMapping("/migrate-keycloak")
    @Operation(summary = "Migrer les comptes existants vers Keycloak")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<KeycloakMigrationResultDTO>> migrateExistingUsersToKeycloak() {
        return ResponseEntity.ok(userService.migrateExistingUsersToKeycloak());
    }
    
    @GetMapping("/check/username/{username}")
    @Operation(summary = "Vérifier si un nom d'utilisateur existe")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Boolean> checkUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.existsByUsername(username));
    }
    
    @GetMapping("/check/email/{email}")
    @Operation(summary = "Vérifier si un email existe")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Boolean> checkEmail(@PathVariable String email) {
        return ResponseEntity.ok(userService.existsByEmail(email));
    }
}
