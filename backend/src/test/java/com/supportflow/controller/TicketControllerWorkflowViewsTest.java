package com.supportflow.controller;

import com.supportflow.dto.AgentWorkbenchDTO;
import com.supportflow.dto.ClientDTO;
import com.supportflow.dto.TicketResponseDTO;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.UserRepository;
import com.supportflow.security.AuthorizationHelper;
import com.supportflow.service.CamundaService;
import com.supportflow.service.ClientService;
import com.supportflow.service.EscalationService;
import com.supportflow.service.TicketService;
import com.supportflow.service.UserIdentityService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketControllerWorkflowViewsTest {

    @Mock private TicketService ticketService;
    @Mock private CamundaService camundaService;
    @Mock private ClientService clientService;
    @Mock private UserRepository userRepository;
    @Mock private UserIdentityService userIdentityService;
    @Mock private EscalationService escalationService;
    @Mock private AuthorizationHelper authHelper;

    @InjectMocks
    private TicketController controller;

    @Test
    @DisplayName("Client my-tickets delegates to client filtered service")
    void getMyTickets_clientDelegatesToClientQuery() {
        Jwt clientJwt = buildJwt(List.of("CLIENT"), "client1@supportflow.com");
        ClientDTO client = new ClientDTO();
        client.setId(44L);
        when(clientService.getClientByEmail("client1@supportflow.com")).thenReturn(client);

        var pageable = PageRequest.of(0, 20);
        var page = new PageImpl<TicketResponseDTO>(List.of(new TicketResponseDTO()), pageable, 1);
        when(ticketService.getTicketsByClient(44L, TicketStatus.PENDING, Priority.HIGH, null, true, false, "AT_RISK", "vpn", pageable))
            .thenReturn(page);

        var response = controller.getMyTickets(clientJwt, TicketStatus.PENDING, Priority.HIGH, null, true, false, "AT_RISK", "vpn", pageable);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(page, response.getBody());
        verify(ticketService).getTicketsByClient(44L, TicketStatus.PENDING, Priority.HIGH, null, true, false, "AT_RISK", "vpn", pageable);
        verify(ticketService, never()).getTicketsByAgent(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Agent workbench returns forbidden when user id cannot be resolved")
    void getAgentWorkbench_forbiddenWithoutAgentId() {
        Jwt agentJwt = buildJwt(List.of("SUPPORT_AGENT"), "agent1@supportflow.com");
        when(userIdentityService.resolveUserIdFromJwt(agentJwt)).thenReturn(null);

        var response = controller.getAgentWorkbench(agentJwt, 8);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    @DisplayName("Agent workbench delegates to service with resolved agent id")
    void getAgentWorkbench_delegatesToService() {
        Jwt agentJwt = buildJwt(List.of("SUPPORT_AGENT"), "agent1@supportflow.com");
        when(userIdentityService.resolveUserIdFromJwt(agentJwt)).thenReturn(12L);

        AgentWorkbenchDTO dto = new AgentWorkbenchDTO();
        dto.setAvailableToTake(List.of());
        dto.setAssignedOpen(List.of());
        dto.setWaitingCustomer(List.of());
        dto.setCustomerReplied(List.of());
        dto.setResolutionRejected(List.of());
        when(ticketService.getAgentWorkbench(12L, 6)).thenReturn(dto);

        var response = controller.getAgentWorkbench(agentJwt, 6);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(dto, response.getBody());
        verify(ticketService).getAgentWorkbench(12L, 6);
    }

    @Test
    @DisplayName("Client resolution-rejected filter still uses same dedicated endpoint")
    void getMyTickets_clientRejectedFilter() {
        Jwt clientJwt = buildJwt(List.of("CLIENT"), "client2@supportflow.com");
        User user = new User();
        user.setId(51L);
        com.supportflow.entity.Client client = new com.supportflow.entity.Client();
        client.setId(19L);
        user.setClient(client);
        when(userIdentityService.resolveUserIdFromJwt(clientJwt)).thenReturn(51L);
        when(userRepository.findById(51L)).thenReturn(Optional.of(user));

        var pageable = PageRequest.of(0, 10);
        var page = new PageImpl<TicketResponseDTO>(List.of(), pageable, 0);
        when(ticketService.getTicketsByClient(19L, null, null, null, null, true, null, null, pageable)).thenReturn(page);

        var response = controller.getMyTickets(clientJwt, null, null, null, null, true, null, null, pageable);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(ticketService).getTicketsByClient(19L, null, null, null, null, true, null, null, pageable);
    }

    private Jwt buildJwt(List<String> roles, String email) {
        return Jwt.withTokenValue("token")
            .header("alg", "none")
            .claim("sub", "user")
            .claim("email", email)
            .claim("realm_access", Map.of("roles", roles))
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    }
}
