package com.supportflow.security;

import com.supportflow.entity.Ticket;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.ClientService;
import com.supportflow.service.UserIdentityService;
import com.supportflow.dto.ClientDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Utilitaire centralisé pour les vérifications d'autorisation.
 * Garantit un comportement fail-closed sur tous les endpoints.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuthorizationHelper {

    private final UserIdentityService userIdentityService;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final ClientService clientService;

    // ─── Role Detection ──────────────────────────────────────────────────────

    public boolean isAdmin(Jwt jwt) {
        return hasRole(jwt, "ADMIN");
    }

    public boolean isManager(Jwt jwt) {
        return hasRole(jwt, "SUPPORT_MANAGER");
    }

    public boolean isManagerOrAdmin(Jwt jwt) {
        return isAdmin(jwt) || isManager(jwt);
    }

    public boolean isAgent(Jwt jwt) {
        if (jwt == null) return false;
        List<String> roles = extractRoles(jwt);
        boolean agent = roles.contains("SUPPORT_AGENT");
        boolean managerOrAdmin = roles.contains("ADMIN") || roles.contains("SUPPORT_MANAGER");
        return agent && !managerOrAdmin;
    }

    public boolean isClient(Jwt jwt) {
        if (jwt == null) return false;
        List<String> roles = extractRoles(jwt);
        boolean client = roles.contains("CLIENT");
        boolean staff = roles.contains("ADMIN") || roles.contains("SUPPORT_MANAGER") || roles.contains("SUPPORT_AGENT");
        return client && !staff;
    }

    public boolean isStaff(Jwt jwt) {
        if (jwt == null) return false;
        List<String> roles = extractRoles(jwt);
        return roles.contains("ADMIN") || roles.contains("SUPPORT_MANAGER") || roles.contains("SUPPORT_AGENT");
    }

    // ─── User Identity ───────────────────────────────────────────────────────

    public Long getUserId(Jwt jwt) {
        return userIdentityService.resolveUserIdFromJwt(jwt);
    }

    // ─── Ticket Ownership ────────────────────────────────────────────────────

    /**
     * Vérifie si un agent est bien assigné au ticket.
     */
    public boolean isAgentAssignedToTicket(Long userId, Long ticketId) {
        return ticketRepository.findById(ticketId)
                .map(t -> t.getAssignedAgent() != null && t.getAssignedAgent().getId().equals(userId))
                .orElse(false);
    }

    /**
     * Vérifie si un client a accès au ticket (via son entreprise).
     */
    public boolean isClientTicketOwner(Jwt jwt, Long ticketId) {
        Long clientId = resolveClientId(jwt);
        if (clientId == null) return false;
        return ticketRepository.findById(ticketId)
                .map(t -> t.getClient() != null && t.getClient().getId().equals(clientId))
                .orElse(false);
    }

    /**
     * Vérifie l'accès à un ticket selon le rôle :
     * - ADMIN/MANAGER → toujours OK
     * - AGENT → seulement si assigné
     * - CLIENT → seulement si ticket de son entreprise
     */
    public boolean canAccessTicket(Jwt jwt, Long ticketId) {
        if (isManagerOrAdmin(jwt)) return true;
        if (isAgent(jwt)) {
            Long userId = getUserId(jwt);
            return isAgentAssignedToTicket(userId, ticketId);
        }
        if (isClient(jwt)) {
            return isClientTicketOwner(jwt, ticketId);
        }
        return false;
    }

    /**
     * Vérifie l'accès staff à un ticket (exclut CLIENT) :
     * - ADMIN/MANAGER → toujours OK
     * - AGENT → seulement si assigné
     */
    public boolean canStaffAccessTicket(Jwt jwt, Long ticketId) {
        if (isManagerOrAdmin(jwt)) return true;
        if (isAgent(jwt)) {
            Long userId = getUserId(jwt);
            return isAgentAssignedToTicket(userId, ticketId);
        }
        return false;
    }

    public boolean canAssignTicket(Jwt jwt, Long ticketId) {
        if (!isManagerOrAdmin(jwt)) return false;
        return ticketRepository.findById(ticketId)
            .map(ticket -> !isFinalized(ticket))
            .orElse(false);
    }

    public boolean canTakeChargeTicket(Jwt jwt, Long ticketId) {
        if (!isStaff(jwt)) return false;

        Long userId = getUserId(jwt);
        if (userId == null) return false;

        return ticketRepository.findById(ticketId)
            .map(ticket -> {
                if (isFinalized(ticket) || ticket.getStatus() == TicketStatus.IN_PROGRESS) {
                    return false;
                }

                if (ticket.getAssignedAgent() == null) {
                    return true;
                }

                return ticket.getAssignedAgent().getId().equals(userId);
            })
            .orElse(false);
    }

    public boolean canResolveTicket(Jwt jwt, Long ticketId) {
        if (!isStaff(jwt)) return false;

        Long userId = getUserId(jwt);
        if (userId == null) return false;

        return ticketRepository.findById(ticketId)
            .map(ticket -> ticket.getAssignedAgent() != null
                && ticket.getAssignedAgent().getId().equals(userId)
                && isResolvableStatus(ticket.getStatus()))
            .orElse(false);
    }

    public boolean canEscalateTicket(Jwt jwt, Long ticketId) {
        if (!isStaff(jwt)) return false;

        return ticketRepository.findById(ticketId)
            .map(ticket -> {
                if (isFinalized(ticket)) {
                    return false;
                }

                if (isManagerOrAdmin(jwt)) {
                    return true;
                }

                Long userId = getUserId(jwt);
                return userId != null
                    && ticket.getAssignedAgent() != null
                    && ticket.getAssignedAgent().getId().equals(userId);
            })
            .orElse(false);
    }

    public boolean canManageSla(Jwt jwt, Long ticketId) {
        if (!isStaff(jwt)) return false;

        return ticketRepository.findById(ticketId)
            .map(ticket -> {
                if (isFinalized(ticket)) {
                    return false;
                }

                if (isManagerOrAdmin(jwt)) {
                    return true;
                }

                Long userId = getUserId(jwt);
                return userId != null
                    && ticket.getAssignedAgent() != null
                    && ticket.getAssignedAgent().getId().equals(userId);
            })
            .orElse(false);
    }

    public boolean canRequestManagerReview(Jwt jwt, Long ticketId) {
        if (!isManagerOrAdmin(jwt)) return false;
        return ticketRepository.findById(ticketId)
            .map(ticket -> !isFinalized(ticket))
            .orElse(false);
    }

    public boolean canCloseTicket(Jwt jwt, Long ticketId) {
        return ticketRepository.findById(ticketId)
            .map(ticket -> {
                if (ticket.getStatus() != TicketStatus.RESOLVED) {
                    return false;
                }

                if (isManagerOrAdmin(jwt)) {
                    return true;
                }

                return isClient(jwt) && isClientTicketOwner(jwt, ticketId);
            })
            .orElse(false);
    }

    public boolean canRejectResolution(Jwt jwt, Long ticketId) {
        return ticketRepository.findById(ticketId)
            .map(ticket -> {
                if (ticket.getStatus() != TicketStatus.RESOLVED) {
                    return false;
                }

                if (isManagerOrAdmin(jwt)) {
                    return true;
                }

                return isClient(jwt) && isClientTicketOwner(jwt, ticketId);
            })
            .orElse(false);
    }

    public boolean canArchiveTicket(Jwt jwt, Long ticketId) {
        if (!isManagerOrAdmin(jwt)) return false;
        return ticketRepository.findById(ticketId)
            .map(ticket -> ticket.getStatus() == TicketStatus.CLOSED
                && (ticket.getAlfrescoFolderId() == null || ticket.getAlfrescoFolderId().isBlank()))
            .orElse(false);
    }

    // ─── Client Resolution ───────────────────────────────────────────────────

    public Long resolveClientId(Jwt jwt) {
        if (jwt == null) return null;
        String email = jwt.getClaimAsString("email");
        if (email != null) {
            ClientDTO client = clientService.getClientByEmail(email);
            if (client != null) return client.getId();
        }
        Long userId = getUserId(jwt);
        if (userId == null) return null;
        return userRepository.findById(userId)
                .map(User::getClient)
                .map(c -> c.getId())
                .orElse(null);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<String> extractRoles(Jwt jwt) {
        Set<String> roles = new LinkedHashSet<>();

        List<String> flatRoles = jwt.getClaimAsStringList("roles");
        if (flatRoles != null) {
            flatRoles.stream()
                .map(this::normalizeRole)
                .forEach(roles::add);
        }

        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            List<String> realmRoles = (List<String>) realmAccess.get("roles");
            if (realmRoles != null) {
                realmRoles.stream()
                    .map(this::normalizeRole)
                    .forEach(roles::add);
            }
        }

        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess != null) {
            for (Object value : resourceAccess.values()) {
                if (!(value instanceof Map<?, ?> accessMap)) {
                    continue;
                }

                Object nestedRoles = accessMap.get("roles");
                if (nestedRoles instanceof List<?> roleList) {
                    roleList.stream()
                        .filter(String.class::isInstance)
                        .map(String.class::cast)
                        .map(this::normalizeRole)
                        .forEach(roles::add);
                }
            }
        }

        return List.copyOf(roles);
    }

    private boolean hasRole(Jwt jwt, String role) {
        if (jwt == null) return false;
        return extractRoles(jwt).contains(normalizeRole(role));
    }

    private boolean isFinalized(Ticket ticket) {
        return ticket.getStatus() == TicketStatus.RESOLVED
            || ticket.getStatus() == TicketStatus.CLOSED
            || ticket.getStatus() == TicketStatus.CANCELLED;
    }

    private boolean isResolvableStatus(TicketStatus status) {
        return status == TicketStatus.ASSIGNED
            || status == TicketStatus.IN_PROGRESS
            || status == TicketStatus.PENDING
            || status == TicketStatus.ESCALATED_MANUAL
            || status == TicketStatus.ESCALATED_SLA;
    }

    private String normalizeRole(String role) {
        if (role == null) {
            return "";
        }
        return role.startsWith("ROLE_") ? role.substring(5).toUpperCase() : role.toUpperCase();
    }
}
