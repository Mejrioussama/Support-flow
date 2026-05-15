package com.supportflow.controller;

import com.supportflow.dto.UserDTO;
import com.supportflow.dto.auth.JwtResponse;
import com.supportflow.dto.auth.LoginRequest;
import com.supportflow.dto.auth.RegisterRequest;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.repository.UserRepository;
import com.supportflow.security.JwtTokenProvider;
import com.supportflow.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * Contrôleur REST pour l'authentification
 * Actif uniquement en mode développement (profile dev)
 * En production, l'authentification est gérée par Keycloak
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentification", description = "API d'authentification JWT")
@Profile("dev")
public class AuthController {
    
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final UserService userService;
    private final UserRepository userRepository;
    
    @PostMapping("/login")
    @Operation(summary = "Authentifier un utilisateur")
    public ResponseEntity<JwtResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("Tentative de connexion: {}", request.getUsername());
        
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.getUsername(),
                request.getPassword()
            )
        );
        
        SecurityContextHolder.getContext().setAuthentication(authentication);
        
        String accessToken = tokenProvider.generateAccessToken(authentication);
        String refreshToken = tokenProvider.generateRefreshToken(request.getUsername());
        
        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));
        
        // Mettre à jour la date de dernière connexion
        userService.updateLastLogin(user.getId());
        
        log.info("Connexion réussie: {}", request.getUsername());
        
        return ResponseEntity.ok(JwtResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .tokenType("Bearer")
            .expiresIn(tokenProvider.getExpirationDuration())
            .userId(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .role(user.getRole())
            .build());
    }
    
    @PostMapping("/register")
    @Operation(summary = "Enregistrer un nouvel utilisateur")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody RegisterRequest request) {
        log.info("Demande d'inscription: {}", request.getUsername());
        
        // Par défaut, les nouveaux utilisateurs sont des clients
        if (request.getRole() == null) {
            request.setRole(Role.CLIENT);
        }
        
        UserDTO user = userService.createUser(request);
        
        log.info("Inscription réussie: {}", request.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
    
    @PostMapping("/refresh")
    @Operation(summary = "Rafraîchir le token d'accès")
    public ResponseEntity<JwtResponse> refreshToken(
            @RequestHeader("Authorization") String refreshToken) {
        
        if (refreshToken != null && refreshToken.startsWith("Bearer ")) {
            refreshToken = refreshToken.substring(7);
        }
        
        if (tokenProvider.validateToken(refreshToken)) {
            String username = tokenProvider.getUsernameFromToken(refreshToken);
            
            User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));
            
            String roles = "ROLE_" + user.getRole().name();
            String newAccessToken = tokenProvider.generateAccessToken(username, roles);
            String newRefreshToken = tokenProvider.generateRefreshToken(username);
            
            return ResponseEntity.ok(JwtResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(tokenProvider.getExpirationDuration())
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build());
        }
        
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    
    @PostMapping("/logout")
    @Operation(summary = "Déconnecter un utilisateur")
    public ResponseEntity<Void> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/me")
    @Operation(summary = "Récupérer l'utilisateur connecté")
    public ResponseEntity<UserDTO> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        String username = authentication.getName();
        return ResponseEntity.ok(userService.getUserByUsername(username));
    }
}
