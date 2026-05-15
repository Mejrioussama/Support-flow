package com.supportflow.controller;

import com.supportflow.dto.ClientDTO;
import com.supportflow.dto.ClientSummaryDTO;
import com.supportflow.entity.User;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.ClientService;
import com.supportflow.service.KeycloakAdminService;
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

/**
 * Contrôleur REST pour la gestion des clients
 */
@RestController
@RequestMapping("/clients")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Clients", description = "API de gestion des clients")
public class ClientController {
    
    private final ClientService clientService;
    private final UserRepository userRepository;
    private final KeycloakAdminService keycloakAdminService;
    
    @PostMapping
    @Operation(summary = "Créer un nouveau client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<ClientDTO> createClient(@Valid @RequestBody ClientDTO dto) {
        ClientDTO client = clientService.createClient(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(client);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Récupérer un client par ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<ClientDTO> getClientById(@PathVariable Long id) {
        return ResponseEntity.ok(clientService.getClientById(id));
    }
    
    @GetMapping("/code/{code}")
    @Operation(summary = "Récupérer un client par code")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<ClientDTO> getClientByCode(@PathVariable String code) {
        return ResponseEntity.ok(clientService.getClientByCode(code));
    }
    
    @GetMapping
    @Operation(summary = "Lister tous les clients actifs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT')")
    public ResponseEntity<Page<ClientDTO>> getAllClients(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(clientService.getAllActiveClients(pageable));
    }
    
    @GetMapping("/summary")
    @Operation(summary = "Lister tous les clients (résumé)")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<ClientSummaryDTO>> getAllClientsSummary() {
        return ResponseEntity.ok(clientService.getAllClientsSummary());
    }
    
    @GetMapping("/search")
    @Operation(summary = "Rechercher des clients")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<Page<ClientDTO>> searchClients(
            @RequestParam String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(clientService.searchClients(q, pageable));
    }
    
    @GetMapping("/industries")
    @Operation(summary = "Lister toutes les industries")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<List<String>> getAllIndustries() {
        return ResponseEntity.ok(clientService.getAllIndustries());
    }
    
    @GetMapping("/me")
    @Operation(summary = "Récupérer mon profil client (pour utilisateurs avec rôle CLIENT)")
    @PreAuthorize("hasRole('CLIENT')")
    public ResponseEntity<ClientDTO> getMyClientProfile(@AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        String keycloakId = jwt.getSubject();
        String preferredUsername = jwt.getClaimAsString("preferred_username");

        log.info("Recherche du profil client pour email={}, keycloakId={}", email, keycloakId);

        ClientDTO client = clientService.getClientByEmail(email);
        if (client != null) {
            return ResponseEntity.ok(client);
        }

        User user = null;
        if (keycloakId != null) {
            user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        }
        if (user == null && email != null) {
            user = userRepository.findByEmail(email).orElse(null);
        }
        if (user == null && preferredUsername != null) {
            user = userRepository.findByUsername(preferredUsername).orElse(null);
        }

        if (user == null && keycloakId != null) {
            var keycloakUser = keycloakAdminService.getKeycloakUserById(keycloakId);
            if (keycloakUser != null) {
                String keycloakEmail = (String) keycloakUser.get("email");
                String keycloakUsername = (String) keycloakUser.get("username");

                if (keycloakEmail != null) {
                    user = userRepository.findByEmail(keycloakEmail).orElse(null);
                }
                if (user == null && keycloakUsername != null) {
                    user = userRepository.findByUsername(keycloakUsername).orElse(null);
                }
                if (user != null && user.getKeycloakId() == null) {
                    user.setKeycloakId(keycloakId);
                    user = userRepository.save(user);
                }
                if (user == null && keycloakEmail != null) {
                    client = clientService.getClientByEmail(keycloakEmail);
                }
            }
        }

        if (client == null && user != null && user.getClient() != null) {
            client = clientService.getClientById(user.getClient().getId());
        }

        if (client == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(client);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<ClientDTO> updateClient(
            @PathVariable Long id,
            @Valid @RequestBody ClientDTO dto) {
        return ResponseEntity.ok(clientService.updateClient(id, dto));
    }

    @PatchMapping("/{id}/activate")
    @Operation(summary = "Activer un client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<ClientDTO> activateClient(@PathVariable Long id) {
        return ResponseEntity.ok(clientService.activateClient(id));
    }

    @PatchMapping("/{id}/deactivate")
    @Operation(summary = "Désactiver un client")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPPORT_MANAGER')")
    public ResponseEntity<ClientDTO> deactivateClientPatch(@PathVariable Long id) {
        clientService.deactivateClient(id);
        return ResponseEntity.ok(clientService.getClientById(id));
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Désactiver un client")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateClient(@PathVariable Long id) {
        clientService.deactivateClient(id);
    }
}
