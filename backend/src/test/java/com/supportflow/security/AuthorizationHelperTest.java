package com.supportflow.security;

import com.supportflow.dto.ClientDTO;
import com.supportflow.entity.Client;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.User;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import com.supportflow.service.ClientService;
import com.supportflow.service.UserIdentityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthorizationHelperTest {

    @Mock private UserIdentityService userIdentityService;
    @Mock private UserRepository userRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private ClientService clientService;

    @InjectMocks
    private AuthorizationHelper authHelper;

    private Jwt adminJwt;
    private Jwt managerJwt;
    private Jwt agentJwt;
    private Jwt clientJwt;
    private Jwt nullRolesJwt;

    @BeforeEach
    void setUp() {
        adminJwt = buildJwt(List.of("ADMIN"));
        managerJwt = buildJwt(List.of("SUPPORT_MANAGER"));
        agentJwt = buildJwt(List.of("SUPPORT_AGENT"));
        clientJwt = buildJwt(List.of("CLIENT"));
        nullRolesJwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", "user")
            .claim("email", "test@test.com")
            .build();
    }

    // ─────────────────────────────────────────
    // ROLE DETECTION TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Role Detection")
    class RoleDetectionTests {

        @Test
        @DisplayName("isAdmin should return true only for ADMIN role")
        void isAdmin() {
            assertTrue(authHelper.isAdmin(adminJwt));
            assertFalse(authHelper.isAdmin(managerJwt));
            assertFalse(authHelper.isAdmin(agentJwt));
            assertFalse(authHelper.isAdmin(clientJwt));
            assertFalse(authHelper.isAdmin(null));
        }

        @Test
        @DisplayName("isManager should return true only for SUPPORT_MANAGER role")
        void isManager() {
            assertTrue(authHelper.isManager(managerJwt));
            assertFalse(authHelper.isManager(adminJwt));
            assertFalse(authHelper.isManager(agentJwt));
        }

        @Test
        @DisplayName("isManagerOrAdmin should return true for both")
        void isManagerOrAdmin() {
            assertTrue(authHelper.isManagerOrAdmin(adminJwt));
            assertTrue(authHelper.isManagerOrAdmin(managerJwt));
            assertFalse(authHelper.isManagerOrAdmin(agentJwt));
            assertFalse(authHelper.isManagerOrAdmin(clientJwt));
        }

        @Test
        @DisplayName("isAgent should return true only for pure SUPPORT_AGENT (not manager/admin)")
        void isAgent() {
            assertTrue(authHelper.isAgent(agentJwt));
            assertFalse(authHelper.isAgent(adminJwt));
            assertFalse(authHelper.isAgent(clientJwt));

            // Agent+Manager combo should NOT be pure agent
            Jwt agentManagerJwt = buildJwt(List.of("SUPPORT_AGENT", "SUPPORT_MANAGER"));
            assertFalse(authHelper.isAgent(agentManagerJwt));
        }

        @Test
        @DisplayName("isClient should return true only for pure CLIENT (not staff)")
        void isClient() {
            assertTrue(authHelper.isClient(clientJwt));
            assertFalse(authHelper.isClient(adminJwt));
            assertFalse(authHelper.isClient(agentJwt));

            // CLIENT+AGENT combo should NOT be pure client
            Jwt clientAgentJwt = buildJwt(List.of("CLIENT", "SUPPORT_AGENT"));
            assertFalse(authHelper.isClient(clientAgentJwt));
        }

        @Test
        @DisplayName("isStaff should return true for ADMIN, MANAGER, or AGENT")
        void isStaff() {
            assertTrue(authHelper.isStaff(adminJwt));
            assertTrue(authHelper.isStaff(managerJwt));
            assertTrue(authHelper.isStaff(agentJwt));
            assertFalse(authHelper.isStaff(clientJwt));
            assertFalse(authHelper.isStaff(null));
        }

        @Test
        @DisplayName("Null JWT should return false for all role checks")
        void nullJwt_allFalse() {
            assertFalse(authHelper.isAdmin(null));
            assertFalse(authHelper.isManager(null));
            assertFalse(authHelper.isAgent(null));
            assertFalse(authHelper.isClient(null));
            assertFalse(authHelper.isStaff(null));
        }

        @Test
        @DisplayName("JWT without realm_access should return false")
        void noRealmAccess_allFalse() {
            assertFalse(authHelper.isAdmin(nullRolesJwt));
            assertFalse(authHelper.isStaff(nullRolesJwt));
            assertFalse(authHelper.isClient(nullRolesJwt));
        }
    }

    // ─────────────────────────────────────────
    // TICKET ACCESS TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Ticket Access Checks")
    class TicketAccessTests {

        @Test
        @DisplayName("Admin/Manager should always access any ticket")
        void canAccessTicket_adminManager_always() {
            assertTrue(authHelper.canAccessTicket(adminJwt, 1L));
            assertTrue(authHelper.canAccessTicket(managerJwt, 1L));
            // No repository calls needed
            verify(ticketRepository, never()).findById(any());
        }

        @Test
        @DisplayName("Agent should only access assigned tickets")
        void canAccessTicket_agent_onlyAssigned() {
            User agent = new User();
            agent.setId(10L);

            Ticket ticket = new Ticket();
            ticket.setId(1L);
            ticket.setAssignedAgent(agent);

            when(userIdentityService.resolveUserIdFromJwt(agentJwt)).thenReturn(10L);
            when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));

            assertTrue(authHelper.canAccessTicket(agentJwt, 1L));
        }

        @Test
        @DisplayName("Agent should NOT access unassigned ticket")
        void canAccessTicket_agent_notAssigned() {
            User otherAgent = new User();
            otherAgent.setId(99L);

            Ticket ticket = new Ticket();
            ticket.setId(1L);
            ticket.setAssignedAgent(otherAgent);

            when(userIdentityService.resolveUserIdFromJwt(agentJwt)).thenReturn(10L);
            when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));

            assertFalse(authHelper.canAccessTicket(agentJwt, 1L));
        }

        @Test
        @DisplayName("Client should only access own company tickets")
        void canAccessTicket_client_ownCompany() {
            Client client = new Client();
            client.setId(5L);

            Ticket ticket = new Ticket();
            ticket.setId(1L);
            ticket.setClient(client);

            ClientDTO clientDTO = new ClientDTO();
            clientDTO.setId(5L);

            when(clientService.getClientByEmail("test@test.com")).thenReturn(clientDTO);
            when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));

            assertTrue(authHelper.canAccessTicket(clientJwt, 1L));
        }

        @Test
        @DisplayName("Client should NOT access other company tickets")
        void canAccessTicket_client_otherCompany() {
            Client otherClient = new Client();
            otherClient.setId(99L);

            Ticket ticket = new Ticket();
            ticket.setId(1L);
            ticket.setClient(otherClient);

            ClientDTO clientDTO = new ClientDTO();
            clientDTO.setId(5L);

            when(clientService.getClientByEmail("test@test.com")).thenReturn(clientDTO);
            when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));

            assertFalse(authHelper.canAccessTicket(clientJwt, 1L));
        }

        @Test
        @DisplayName("canStaffAccessTicket should deny CLIENT")
        void canStaffAccessTicket_denyClient() {
            assertFalse(authHelper.canStaffAccessTicket(clientJwt, 1L));
        }

        @Test
        @DisplayName("canAccessTicket should return false for unknown roles (fail-closed)")
        void canAccessTicket_unknownRole_fail_closed() {
            Jwt unknownJwt = buildJwt(List.of("UNKNOWN_ROLE"));
            assertFalse(authHelper.canAccessTicket(unknownJwt, 1L));
        }

        @Test
        @DisplayName("Non-existent ticket should deny access")
        void canAccessTicket_nonExistentTicket() {
            when(userIdentityService.resolveUserIdFromJwt(agentJwt)).thenReturn(10L);
            when(ticketRepository.findById(999L)).thenReturn(Optional.empty());

            assertFalse(authHelper.canAccessTicket(agentJwt, 999L));
        }
    }

    // ─────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────

    private Jwt buildJwt(List<String> roles) {
        return Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", "user-123")
            .claim("email", "test@test.com")
            .claim("realm_access", Map.of("roles", roles))
            .build();
    }
}
