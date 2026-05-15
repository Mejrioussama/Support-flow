package com.supportflow.service;

import com.supportflow.entity.*;
import com.supportflow.entity.enums.*;
import com.supportflow.exception.BusinessException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.dto.TicketResponseDTO;
import com.supportflow.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EscalationServiceTest {

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketHistoryRepository historyRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private EntityMapper mapper;
    @Mock private EscalationPolicyRepository policyRepository;
    @Mock private EscalationEventRepository eventRepository;
    @Mock private AgentAvailabilityRepository availabilityRepository;
    @Mock private AgentShiftRepository shiftRepository;
    @Mock private SupportCategoryService supportCategoryService;

    @InjectMocks
    private EscalationService escalationService;

    private Ticket testTicket;
    private Client testClient;
    private User agent1;
    private User agent2;
    private User manager1;
    private TicketResponseDTO mockResponse;
    private SupportCategory networkCategory;

    @BeforeEach
    void setUp() {
        // Set default @Value fields via reflection
        ReflectionTestUtils.setField(escalationService, "defaultLevel1Threshold", 90);
        ReflectionTestUtils.setField(escalationService, "defaultStuckAssignedMinutes", 15);
        ReflectionTestUtils.setField(escalationService, "defaultLevel3DelayMinutes", 30);
        ReflectionTestUtils.setField(escalationService, "defaultCooldownMinutes", 5);
        ReflectionTestUtils.setField(escalationService, "defaultMaxEscalations", 10);

        testClient = new Client();
        testClient.setId(1L);
        testClient.setCompanyName("Acme Corp");

        agent1 = new User();
        agent1.setId(10L);
        agent1.setUsername("agent1");
        agent1.setFirstName("Alice");
        agent1.setLastName("Agent");
        agent1.setRole(Role.SUPPORT_AGENT);
        agent1.setIsActive(true);

        agent2 = new User();
        agent2.setId(20L);
        agent2.setUsername("agent2");
        agent2.setFirstName("Bob");
        agent2.setLastName("Agent");
        agent2.setRole(Role.SUPPORT_AGENT);
        agent2.setIsActive(true);

        manager1 = new User();
        manager1.setId(30L);
        manager1.setUsername("manager1");
        manager1.setFirstName("Charlie");
        manager1.setLastName("Manager");
        manager1.setRole(Role.SUPPORT_MANAGER);
        manager1.setIsActive(true);

        networkCategory = SupportCategory.builder()
            .id(500L)
            .code("NETWORK")
            .label("Reseau")
            .description("Incidents reseau")
            .isActive(true)
            .sortOrder(40)
            .build();

        addSkill(agent2, networkCategory, AgentSkillType.PRIMARY);

        testTicket = new Ticket();
        testTicket.setId(100L);
        testTicket.setReference("SF-TEST-001");
        testTicket.setTitle("Test ticket");
        testTicket.setCategory("Network");
        testTicket.setNormalizedCategory(networkCategory);
        testTicket.setStatus(TicketStatus.IN_PROGRESS);
        testTicket.setClient(testClient);
        testTicket.setAssignedAgent(agent1);
        testTicket.setPriority(Priority.HIGH);
        testTicket.setSeverity(Severity.HIGH);
        testTicket.setEscalationLevel(0);
        testTicket.setEscalationCount(0);
        testTicket.setCreatedAt(LocalDateTime.now().minusHours(2));
        testTicket.setSlaDeadline(LocalDateTime.now().plusHours(2));
        testTicket.setSlaHours(480);

        mockResponse = TicketResponseDTO.builder()
            .id(100L)
            .reference("SF-TEST-001")
            .build();

        when(supportCategoryService.resolveNormalizedCategory(any(), any(), any(), any()))
            .thenReturn(networkCategory);
        doAnswer(invocation -> {
            Ticket ticket = invocation.getArgument(0);
            ticket.setNormalizedCategory(networkCategory);
            return null;
        }).when(supportCategoryService).normalizeTicketCategory(any(Ticket.class));
    }

    // ─────────────────────────────────────────
    // LEVEL 1 ESCALATION TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Level 1 - Auto-Reassignment")
    class Level1Tests {

        @Test
        @DisplayName("L1 should reassign ticket to best available agent")
        void escalateLevel1_reassignsTobestAgent() {
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findAssignableSupportUsers()).thenReturn(List.of(agent1, agent2));
            when(availabilityRepository.findByAgentId(20L))
                .thenReturn(Optional.of(createAvailability(agent2, AgentStatus.AVAILABLE)));
            when(availabilityRepository.findByAgentId(10L))
                .thenReturn(Optional.of(createAvailability(agent1, AgentStatus.AVAILABLE)));
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(20L), any())).thenReturn(List.of());
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(10L), any())).thenReturn(List.of());
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(20L), any())).thenReturn(1L);
            when(ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(eq(20L), any())).thenReturn(0L);
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(10L), any())).thenReturn(4L);
            when(ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(eq(10L), any())).thenReturn(2L);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            TicketResponseDTO result = escalationService.escalateLevel1(100L);

            assertNotNull(result);
            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(agent2, ticket.getAssignedAgent());
                assertEquals(1, ticket.getEscalationLevel());
                assertEquals(1, ticket.getEscalationCount());
                assertEquals(agent1, ticket.getPreviousAgent());
                return true;
            }));
            verify(notificationService).notifyEscalationReassignment(any(), eq(agent2), eq(agent1));
            verify(eventRepository).save(any(EscalationEvent.class));
        }

        @Test
        @DisplayName("L1 should fallback to L2 when no better agent available")
        void escalateLevel1_noAgent_fallbackToL2() {
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findAssignableSupportUsers()).thenReturn(List.of(agent1)); // Only current agent
            when(availabilityRepository.findByAgentId(10L))
                .thenReturn(Optional.of(createAvailability(agent1, AgentStatus.AVAILABLE)));
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(10L), any())).thenReturn(List.of());
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel1(100L);

            // Should escalate to L2 since no better agent
            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(TicketStatus.ESCALATED_SLA, ticket.getStatus());
                assertEquals(2, ticket.getEscalationLevel());
                return true;
            }));
            verify(notificationService).notifySLAEscalation(any());
        }

        @Test
        @DisplayName("L1 should skip terminal tickets (CLOSED/CANCELLED/RESOLVED)")
        void escalateLevel1_terminalTicket_noAction() {
            testTicket.setStatus(TicketStatus.CLOSED);
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(mapper.toTicketResponseDTO(testTicket)).thenReturn(mockResponse);

            TicketResponseDTO result = escalationService.escalateLevel1(100L);

            assertNotNull(result);
            verify(ticketRepository, never()).save(any());
        }

        @Test
        @DisplayName("L1 should skip if auto-reassign disabled by policy")
        void escalateLevel1_policyDisabled_skipToL2() {
            EscalationPolicy policy = new EscalationPolicy();
            policy.setAutoReassignEnabled(false);

            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(policy);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel1(100L);

            // Should jump directly to L2
            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(2, ticket.getEscalationLevel());
                return true;
            }));
        }
    }

    // ─────────────────────────────────────────
    // LEVEL 2 ESCALATION TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Level 2 - Manager Alert")
    class Level2Tests {

        @Test
        @DisplayName("L2 should set ESCALATED_SLA status and upgrade to CRITICAL")
        void escalateLevel2_setsStatusAndPriority() {
            testTicket.setPriority(Priority.HIGH);
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel2(100L);

            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(TicketStatus.ESCALATED_SLA, ticket.getStatus());
                assertEquals(Priority.CRITICAL, ticket.getPriority());
                assertEquals(2, ticket.getEscalationLevel());
                assertTrue(ticket.getSlaBreached());
                assertNotNull(ticket.getEscalatedAt());
                return true;
            }));
            verify(notificationService).notifySLAEscalation(any());
        }

        @Test
        @DisplayName("L2 should not downgrade SUPER_CRITICAL priority")
        void escalateLevel2_preservesSuperCritical() {
            testTicket.setPriority(Priority.SUPER_CRITICAL);
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel2(100L);

            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(Priority.SUPER_CRITICAL, ticket.getPriority());
                return true;
            }));
        }
    }

    // ─────────────────────────────────────────
    // LEVEL 3 ESCALATION TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Level 3 - Manager Takeover")
    class Level3Tests {

        @Test
        @DisplayName("L3 should transfer ticket to available manager")
        void escalateLevel3_transfersToManager() {
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER)).thenReturn(List.of(manager1));
            when(availabilityRepository.findByAgentId(30L))
                .thenReturn(Optional.of(createAvailability(manager1, AgentStatus.AVAILABLE)));
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(30L), any())).thenReturn(2L);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel3(100L);

            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(manager1, ticket.getAssignedAgent());
                assertEquals(agent1, ticket.getPreviousAgent());
                assertEquals(3, ticket.getEscalationLevel());
                return true;
            }));
            verify(notificationService).notifyEscalationToManager(any(), eq(manager1), eq(agent1));
        }

        @Test
        @DisplayName("L3 should cascade to admin if no manager available")
        void escalateLevel3_cascadesToAdmin() {
            User admin = new User();
            admin.setId(40L);
            admin.setUsername("admin1");
            admin.setFirstName("Dan");
            admin.setLastName("Admin");
            admin.setRole(Role.ADMIN);

            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER)).thenReturn(List.of());
            when(userRepository.findByRoleAndIsActiveTrue(Role.ADMIN)).thenReturn(List.of(admin));
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(40L), any())).thenReturn(0L);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel3(100L);

            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals(admin, ticket.getAssignedAgent());
                assertEquals(3, ticket.getEscalationLevel());
                return true;
            }));
        }

        @Test
        @DisplayName("L3 should record failure when no manager or admin available")
        void escalateLevel3_noManagerNoAdmin_recordsFailure() {
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER)).thenReturn(List.of());
            when(userRepository.findByRoleAndIsActiveTrue(Role.ADMIN)).thenReturn(List.of());
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel3(100L);

            verify(historyRepository).save(argThat(h ->
                h.getAction().equals("ESCALATION_L3_FAILED")));
            verify(eventRepository).save(argThat(e ->
                e.getReason() == EscalationReason.NO_AGENT_AVAILABLE));
        }
    }

    // ─────────────────────────────────────────
    // GUARD TESTS (Cooldown, Fatigue, Hold)
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Escalation Guards")
    class GuardTests {

        @Test
        @DisplayName("Cooldown should block escalation within cooldown period")
        void cooldown_blocksEscalation() {
            testTicket.setLastEscalationAt(LocalDateTime.now().minusMinutes(2)); // 2min ago < 5min cooldown
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel2(100L);

            // Ticket should NOT be saved with new escalation level
            verify(ticketRepository, never()).save(argThat(t ->
                t.getEscalationLevel() != null && t.getEscalationLevel() == 2));
            verify(eventRepository).save(argThat(e -> e.getWasBlocked()));
        }

        @Test
        @DisplayName("Fatigue should block escalation after max escalations reached")
        void fatigue_blocksAfterMax() {
            testTicket.setEscalationCount(10); // At max
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel2(100L);

            verify(ticketRepository).save(argThat(t ->
                Boolean.TRUE.equals(t.getEscalationBlocked())));
            verify(eventRepository).save(argThat(e ->
                e.getReason() == EscalationReason.FATIGUE_BLOCKED));
        }

        @Test
        @DisplayName("Escalation hold should block automatic escalation")
        void hold_blocksEscalation() {
            testTicket.setEscalationHoldUntil(LocalDateTime.now().plusMinutes(30));
            testTicket.setEscalationHoldReason("Investigation en cours");
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel1(100L);

            verify(ticketRepository, never()).save(argThat(t ->
                t.getEscalationLevel() != null && t.getEscalationLevel() >= 1));
            verify(eventRepository).save(argThat(e ->
                e.getReason() == EscalationReason.HOLD_ACTIVE && e.getWasBlocked()));
        }

        @Test
        @DisplayName("Expired hold should NOT block escalation")
        void expiredHold_doesNotBlock() {
            testTicket.setEscalationHoldUntil(LocalDateTime.now().minusMinutes(5)); // Expired
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findAssignableSupportUsers()).thenReturn(List.of(agent1, agent2));
            when(availabilityRepository.findByAgentId(20L))
                .thenReturn(Optional.of(createAvailability(agent2, AgentStatus.AVAILABLE)));
            when(availabilityRepository.findByAgentId(10L))
                .thenReturn(Optional.of(createAvailability(agent1, AgentStatus.AVAILABLE)));
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(20L), any())).thenReturn(List.of());
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(10L), any())).thenReturn(List.of());
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(20L), any())).thenReturn(0L);
            when(ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(eq(20L), any())).thenReturn(0L);
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(10L), any())).thenReturn(5L);
            when(ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(eq(10L), any())).thenReturn(2L);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.escalateLevel1(100L);

            // Should proceed with escalation
            verify(ticketRepository).save(argThat(t ->
                t.getEscalationLevel() != null && t.getEscalationLevel() >= 1));
        }
    }

    // ─────────────────────────────────────────
    // ESCALATION HOLD TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Escalation Hold/Suspense")
    class HoldTests {

        @Test
        @DisplayName("holdEscalation should set hold until and reason")
        void holdEscalation_setsHoldFields() {
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.holdEscalation(100L, 60, "Investigating root cause");

            verify(ticketRepository).save(argThat(ticket -> {
                assertNotNull(ticket.getEscalationHoldUntil());
                assertTrue(ticket.getEscalationHoldUntil().isAfter(LocalDateTime.now().plusMinutes(55)));
                assertEquals("Investigating root cause", ticket.getEscalationHoldReason());
                return true;
            }));
            verify(historyRepository).save(argThat(h -> h.getAction().equals("ESCALATION_HOLD")));
            verify(eventRepository).save(argThat(e -> e.getReason() == EscalationReason.HOLD_ACTIVE));
        }

        @Test
        @DisplayName("holdEscalation should reject invalid duration")
        void holdEscalation_invalidDuration_throws() {
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));

            assertThrows(BusinessException.class, () ->
                escalationService.holdEscalation(100L, 0, "Too short"));
            assertThrows(BusinessException.class, () ->
                escalationService.holdEscalation(100L, 1441, "Too long"));
        }

        @Test
        @DisplayName("releaseEscalationHold should clear hold fields")
        void releaseHold_clearsFields() {
            testTicket.setEscalationHoldUntil(LocalDateTime.now().plusMinutes(30));
            testTicket.setEscalationHoldReason("Investigation");
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.releaseEscalationHold(100L);

            verify(ticketRepository).save(argThat(ticket -> {
                assertNull(ticket.getEscalationHoldUntil());
                assertNull(ticket.getEscalationHoldReason());
                return true;
            }));
            verify(historyRepository).save(argThat(h -> h.getAction().equals("ESCALATION_HOLD_RELEASED")));
        }

        @Test
        @DisplayName("releaseEscalationHold should throw if no hold active")
        void releaseHold_noHold_throws() {
            testTicket.setEscalationHoldUntil(null);
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));

            assertThrows(BusinessException.class, () ->
                escalationService.releaseEscalationHold(100L));
        }
    }

    // ─────────────────────────────────────────
    // STUCK ASSIGNED TICKETS TESTS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Stuck Assigned Tickets (Anti-Blocking)")
    class AntiBlockingTests {

        @Test
        @DisplayName("Should reassign stuck ASSIGNED tickets")
        void handleStuck_reassignsTicket() {
            testTicket.setStatus(TicketStatus.ASSIGNED);
            testTicket.setAssignedAt(LocalDateTime.now().minusMinutes(20));

            when(ticketRepository.findStuckAssignedTickets(any())).thenReturn(List.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(userRepository.findAssignableSupportUsers()).thenReturn(List.of(agent1, agent2));
            when(availabilityRepository.findByAgentId(20L))
                .thenReturn(Optional.of(createAvailability(agent2, AgentStatus.AVAILABLE)));
            when(availabilityRepository.findByAgentId(10L))
                .thenReturn(Optional.of(createAvailability(agent1, AgentStatus.AVAILABLE)));
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(20L), any())).thenReturn(List.of());
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(10L), any())).thenReturn(List.of());
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(20L), any())).thenReturn(0L);
            when(ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(eq(20L), any())).thenReturn(0L);
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(10L), any())).thenReturn(4L);
            when(ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(eq(10L), any())).thenReturn(1L);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

            escalationService.handleStuckAssignedTickets(LocalDateTime.now());

            verify(ticketRepository, atLeastOnce()).save(argThat(ticket ->
                agent2.equals(ticket.getAssignedAgent())));
            verify(notificationService).notifyEscalationReassignment(any(), eq(agent2), eq(agent1));
        }

        @Test
        @DisplayName("Severity-aware: SUPER_CRITICAL should use shorter threshold")
        void handleStuck_superCritical_shorterThreshold() {
            testTicket.setStatus(TicketStatus.ASSIGNED);
            testTicket.setSeverity(Severity.SUPER_CRITICAL);
            // 5 minutes ago — should trigger for SUPER_CRITICAL (25% of 15 = ~4min)
            testTicket.setAssignedAt(LocalDateTime.now().minusMinutes(5));

            when(ticketRepository.findStuckAssignedTickets(any())).thenReturn(List.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            // No better agent → should escalate to L2
            when(userRepository.findAssignableSupportUsers()).thenReturn(List.of(agent1));
            when(availabilityRepository.findByAgentId(10L))
                .thenReturn(Optional.of(createAvailability(agent1, AgentStatus.AVAILABLE)));
            when(shiftRepository.findByAgentIdAndDayOfWeek(eq(10L), any())).thenReturn(List.of());
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.handleStuckAssignedTickets(LocalDateTime.now());

            // Either reassigned or escalated to L2
            verify(ticketRepository, atLeastOnce()).save(any(Ticket.class));
        }

        @Test
        @DisplayName("LOW severity should use standard threshold — no escalation if recent")
        void handleStuck_lowSeverity_standardThreshold() {
            testTicket.setStatus(TicketStatus.ASSIGNED);
            testTicket.setSeverity(Severity.LOW);
            // 10 minutes ago — should NOT trigger for LOW (threshold stays 15min)
            testTicket.setAssignedAt(LocalDateTime.now().minusMinutes(10));

            when(ticketRepository.findStuckAssignedTickets(any())).thenReturn(List.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);

            escalationService.handleStuckAssignedTickets(LocalDateTime.now());

            // Should NOT save — ticket not stuck long enough for LOW severity
            verify(notificationService, never()).notifyEscalationReassignment(any(), any(), any());
        }
    }

    // ─────────────────────────────────────────
    // STALE ESCALATIONS (L2→L3 AUTO)
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Stale Escalations (Auto L3)")
    class StaleEscalationTests {

        @Test
        @DisplayName("Should auto-escalate to L3 after delay")
        void handleStale_autoEscalatesL3() {
            testTicket.setEscalationLevel(2);
            testTicket.setStatus(TicketStatus.ESCALATED_SLA);
            testTicket.setLastEscalationAt(LocalDateTime.now().minusMinutes(35));

            when(ticketRepository.findSlaEscalatedWithoutRecentAction(any())).thenReturn(List.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);
            when(historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(eq(100L), eq("ESCALATION_L3"), any()))
                .thenReturn(false);
            when(ticketRepository.findById(100L)).thenReturn(Optional.of(testTicket));
            when(userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER)).thenReturn(List.of(manager1));
            when(availabilityRepository.findByAgentId(30L))
                .thenReturn(Optional.of(createAvailability(manager1, AgentStatus.AVAILABLE)));
            when(ticketRepository.countByAssignedAgentIdAndStatusIn(eq(30L), any())).thenReturn(0L);
            when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));
            when(mapper.toTicketResponseDTO(any())).thenReturn(mockResponse);

            escalationService.handleStaleEscalations(LocalDateTime.now());

            verify(ticketRepository, atLeastOnce()).save(argThat(t -> t.getEscalationLevel() == 3));
        }

        @Test
        @DisplayName("Should NOT re-escalate already L3 tickets")
        void handleStale_alreadyL3_skips() {
            testTicket.setEscalationLevel(3);
            testTicket.setStatus(TicketStatus.ESCALATED_SLA);
            testTicket.setLastEscalationAt(LocalDateTime.now().minusMinutes(60));

            when(ticketRepository.findSlaEscalatedWithoutRecentAction(any())).thenReturn(List.of(testTicket));
            when(policyRepository.findPolicyForClient(1L)).thenReturn(null);

            escalationService.handleStaleEscalations(LocalDateTime.now());

            verify(ticketRepository, never()).findById(any());
        }
    }

    // ─────────────────────────────────────────
    // ESCALATION HISTORY
    // ─────────────────────────────────────────

    @Test
    @DisplayName("getEscalationHistory should return events for ticket")
    void getEscalationHistory_returnsEvents() {
        EscalationEvent event = EscalationEvent.builder()
            .ticket(testTicket)
            .fromLevel(0)
            .toLevel(1)
            .reason(EscalationReason.SLA_BREACH)
            .triggeredBy(EscalationTrigger.SYSTEM)
            .fromAgent(agent1)
            .toAgent(agent2)
            .description("Test escalation")
            .slaPercentAtEscalation(92.5)
            .wasBlocked(false)
            .build();
        event.setCreatedAt(LocalDateTime.now());

        when(eventRepository.findByTicketIdOrderByCreatedAtDesc(100L)).thenReturn(List.of(event));

        var result = escalationService.getEscalationHistory(100L);

        assertEquals(1, result.size());
        assertEquals(0, result.get(0).getFromLevel());
        assertEquals(1, result.get(0).getToLevel());
        assertEquals(EscalationReason.SLA_BREACH, result.get(0).getReason());
    }

    // ─────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────

    private AgentAvailability createAvailability(User agent, AgentStatus status) {
        AgentAvailability avail = new AgentAvailability();
        avail.setAgent(agent);
        avail.setStatus(status);
        avail.setMaxConcurrentTickets(10);
        return avail;
    }

    private void addSkill(User user, SupportCategory category, AgentSkillType skillType) {
        AgentSkill skill = AgentSkill.builder()
            .agent(user)
            .category(category)
            .skillType(skillType)
            .build();
        user.getAgentSkills().add(skill);
    }
}
