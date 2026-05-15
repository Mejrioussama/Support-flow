package com.supportflow.controller;

import com.supportflow.dto.NotificationDTO;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.UserIdentityService;
import com.supportflow.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST pour la gestion des notifications
 */
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Notifications", description = "API de gestion des notifications")
public class NotificationController {
    
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final UserIdentityService userIdentityService;
    
    @GetMapping
    @Operation(summary = "Récupérer les notifications de l'utilisateur connecté")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<NotificationDTO>> getMyNotifications(
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(size = 20) Pageable pageable) {
        
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(notificationService.getUserNotifications(userId, pageable));
    }
    
    @GetMapping("/unread")
    @Operation(summary = "Récupérer les notifications non lues")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<NotificationDTO>> getUnreadNotifications(
            @AuthenticationPrincipal Jwt jwt) {
        
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(notificationService.getUnreadNotifications(userId));
    }
    
    @GetMapping("/unread/count")
    @Operation(summary = "Compter les notifications non lues")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Long>> countUnreadNotifications(
            @AuthenticationPrincipal Jwt jwt) {
        
        Long userId = getUserIdFromJwt(jwt);
        long count = notificationService.countUnreadNotifications(userId);
        return ResponseEntity.ok(Map.of("count", count));
    }
    
    @PostMapping("/{id}/read")
    @Operation(summary = "Marquer une notification comme lue")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        Long userId = getUserIdFromJwt(jwt);
        notificationService.markAsReadForUser(id, userId);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/read-all")
    @Operation(summary = "Marquer toutes les notifications comme lues")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Integer>> markAllAsRead(
            @AuthenticationPrincipal Jwt jwt) {
        
        Long userId = getUserIdFromJwt(jwt);
        int count = notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(Map.of("markedAsRead", count));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer une notification")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> deleteNotification(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        Long userId = getUserIdFromJwt(jwt);
        boolean deleted = notificationService.deleteForUser(id, userId);
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    @DeleteMapping("/read")
    @Operation(summary = "Supprimer toutes les notifications lues")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Integer>> deleteReadNotifications(
            @AuthenticationPrincipal Jwt jwt) {
        Long userId = getUserIdFromJwt(jwt);
        int count = notificationService.deleteReadForUser(userId);
        return ResponseEntity.ok(Map.of("deleted", count));
    }
    
    /**
     * Résout l'ID utilisateur MySQL depuis le JWT Keycloak
     */
    private Long getUserIdFromJwt(Jwt jwt) {
        return userIdentityService.resolveUserIdFromJwt(jwt);
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

