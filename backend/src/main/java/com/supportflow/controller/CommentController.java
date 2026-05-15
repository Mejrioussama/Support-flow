package com.supportflow.controller;

import com.supportflow.dto.CommentDTO;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.UserIdentityService;
import com.supportflow.service.CommentService;
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

import com.supportflow.security.AuthorizationHelper;

/**
 * Contrôleur REST pour la gestion des commentaires
 */
@RestController
@RequestMapping("/tickets/{ticketId}/comments")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Commentaires", description = "API de gestion des commentaires")
public class CommentController {
    
    private final CommentService commentService;
    private final UserRepository userRepository;
    private final UserIdentityService userIdentityService;
    private final AuthorizationHelper authHelper;
    
    @PostMapping
    @Operation(summary = "Ajouter un commentaire à un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<CommentDTO> addComment(
            @PathVariable Long ticketId,
            @Valid @RequestBody CommentDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        
        if (!authHelper.canAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        CommentDTO comment = commentService.addComment(ticketId, dto, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(comment);
    }
    
    @GetMapping
    @Operation(summary = "Lister les commentaires d'un ticket (staff uniquement, inclut notes internes)")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<List<CommentDTO>> getTicketComments(
            @PathVariable Long ticketId,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canStaffAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(commentService.getTicketComments(ticketId));
    }
    
    @GetMapping("/public")
    @Operation(summary = "Lister les commentaires publics d'un ticket")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<List<CommentDTO>> getPublicComments(
            @PathVariable Long ticketId,
            @AuthenticationPrincipal Jwt jwt) {
        if (!authHelper.canAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(commentService.getPublicTicketComments(ticketId));
    }
    
    @GetMapping("/paginated")
    @Operation(summary = "Lister les commentaires avec pagination")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<CommentDTO>> getCommentsPaginated(
            @PathVariable Long ticketId,
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(size = 20) Pageable pageable) {
        if (!authHelper.canStaffAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(commentService.getTicketCommentsPaginated(ticketId, pageable));
    }
    
    @PutMapping("/{commentId}")
    @Operation(summary = "Modifier un commentaire")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'CLIENT')")
    public ResponseEntity<CommentDTO> updateComment(
            @PathVariable Long ticketId,
            @PathVariable Long commentId,
            @Valid @RequestBody CommentDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        
        if (!authHelper.canAccessTicket(jwt, ticketId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Long userId = getUserIdFromJwt(jwt);
        return ResponseEntity.ok(commentService.updateComment(commentId, dto, userId));
    }
    
    @DeleteMapping("/{commentId}")
    @Operation(summary = "Supprimer un commentaire")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @PathVariable Long ticketId,
            @PathVariable Long commentId,
            @AuthenticationPrincipal Jwt jwt) {
        
        Long userId = getUserIdFromJwt(jwt);
        commentService.deleteComment(commentId, userId);
    }
    
    /**
     * Résout l'ID utilisateur MySQL depuis le JWT Keycloak
     */
    private Long getUserIdFromJwt(Jwt jwt) {
        return userIdentityService.resolveUserIdFromJwt(jwt);
    }
    
    private Role getRoleFromJwt(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
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

