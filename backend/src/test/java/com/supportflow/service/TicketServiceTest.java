package com.supportflow.service;

import com.supportflow.dto.TicketCreateDTO;
import com.supportflow.dto.TicketResolveRequestDTO;
import com.supportflow.dto.TicketResponseDTO;
import com.supportflow.dto.TicketUpdateDTO;
import com.supportflow.entity.*;
import com.supportflow.entity.enums.*;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Core ticket-lifecycle coverage for TicketService, complementing TicketArchiveServiceTest
 * (which covers only the archive/close path). Written against @InjectMocks with every
 * collaborator mocked, matching the style used in EscalationServiceTest/TicketAutomationServiceTest.
 *
 * <p>Two TicketService quirks that shape how these tests are written (see runAfterCommit()):
 * with no real Spring transaction active, TransactionSynchronizationManager.isSynchronizationActive()
 * is false, so enqueueWorkflowSync()'s "after commit" callback actually runs synchronously and
 * inline - it re-fetches the ticket via ticketRepository.findById(ticket.getId()) before calling
 * workflowSyncService.enqueue(...). That re-fetch must be stubbed for those assertions to work.
 * Also, camundaEnabled is a @Value-injected field that Mockito's plain @InjectMocks never
 * populates (defaults to false), which silently short-circuits enqueueWorkflowSync() entirely if
 * not forced to true via ReflectionTestUtils - this is the same root cause behind the pre-existing
 * TicketArchiveServiceTest.testCloseTicketSuccess failure (tracked/fixed separately).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TicketServiceTest {

    @Mock private TicketRepository ticketRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private UserRepository userRepository;
    @Mock private TicketHistoryRepository historyRepository;
    @Mock private EntityMapper mapper;
    @Mock private NotificationService notificationService;
    @Mock private CamundaAsyncService camundaAsyncService;
    @Mock private KeycloakAdminService keycloakAdminService;
    @Mock private ReportService reportService;
    @Mock private SlaComputationService slaComputationService;
    @Mock private WorkflowSynchronization workflowSyncService;
    @Mock private CamundaService camundaService;
    @Mock private EscalationService escalationService;
    @Mock private SupportCategoryService supportCategoryService;
    @Mock private TicketReferenceSequenceRepository ticketReferenceSequenceRepository;

    @InjectMocks
    private TicketService ticketService;

    private Client testClient;
    private User testAgent;
    private User testManager;
    private Ticket testTicket;

    @BeforeEach
    void setUp() {
        // camundaEnabled is @Value-injected in the real app; plain Mockito @InjectMocks never
        // resolves @Value, so it defaults to false and enqueueWorkflowSync() would silently no-op.
        ReflectionTestUtils.setField(ticketService, "camundaEnabled", true);

        // TicketService declares camundaService/escalationService/supportCategoryService/
        // ticketReferenceSequenceRepository as plain @Autowired *fields* (not constructor
        // params, since they're optional or added after the constructor was written). Mockito's
        // @InjectMocks only performs constructor injection when a satisfying constructor exists
        // - it does not also field-inject the remaining @Mock fields - so these four are null
        // unless wired explicitly here.
        ReflectionTestUtils.setField(ticketService, "camundaService", camundaService);
        ReflectionTestUtils.setField(ticketService, "escalationService", escalationService);
        ReflectionTestUtils.setField(ticketService, "supportCategoryService", supportCategoryService);
        ReflectionTestUtils.setField(ticketService, "ticketReferenceSequenceRepository", ticketReferenceSequenceRepository);

        testClient = new Client();
        testClient.setId(1L);
        testClient.setCompanyName("Acme Corp");

        testAgent = new User();
        testAgent.setId(10L);
        testAgent.setUsername("agent1");
        testAgent.setFirstName("Alice");
        testAgent.setLastName("Agent");
        testAgent.setRole(Role.SUPPORT_AGENT);

        testManager = new User();
        testManager.setId(20L);
        testManager.setUsername("manager1");
        testManager.setFirstName("Marc");
        testManager.setLastName("Manager");
        testManager.setRole(Role.SUPPORT_MANAGER);

        testTicket = new Ticket();
        testTicket.setId(1L);
        testTicket.setReference("SF-0001");
        testTicket.setTitle("Cannot login");
        testTicket.setStatus(TicketStatus.NEW);
        testTicket.setClient(testClient);
        testTicket.setCreatedAt(LocalDateTime.now().minusHours(2));

        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

        when(mapper.toTicketResponseDTO(any(Ticket.class))).thenAnswer(inv -> {
            Ticket t = inv.getArgument(0);
            return TicketResponseDTO.builder()
                .id(t.getId())
                .reference(t.getReference())
                .status(t.getStatus())
                .waitingOn(t.getWaitingOn())
                .satisfactionRating(t.getSatisfactionRating())
                .build();
        });
    }

    // ─────────────────────────────────────────
    // createTicket
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("createTicket")
    class CreateTicketTests {

        @Test
        @DisplayName("Generates the next reference under the locked sequence and records CREATED history")
        void createsTicketWithGeneratedReferenceAndHistory() {
            TicketCreateDTO dto = TicketCreateDTO.builder()
                .title("Cannot access dashboard")
                .description("Getting a 500 error")
                .type(TicketType.INCIDENT)
                .severity(Severity.HIGH)
                .impact(Impact.HIGH)
                .clientId(1L)
                .build();

            Ticket mappedTicket = new Ticket();
            when(mapper.toTicket(any(TicketCreateDTO.class))).thenReturn(mappedTicket);
            when(clientRepository.findById(1L)).thenReturn(Optional.of(testClient));
            when(userRepository.findById(9L)).thenReturn(Optional.of(testAgent));

            TicketReferenceSequence sequence = new TicketReferenceSequence();
            sequence.setId(1L);
            sequence.setLastValue(4);
            when(ticketReferenceSequenceRepository.lockForUpdate()).thenReturn(Optional.of(sequence));
            when(slaComputationService.resolveSlaMinutes(Severity.HIGH, testClient)).thenReturn(480);

            // enqueueWorkflowSync()'s inline "after commit" re-fetch (see class javadoc).
            when(ticketRepository.findById(2L)).thenAnswer(inv -> {
                mappedTicket.setId(2L);
                return Optional.of(mappedTicket);
            });
            doAnswer(inv -> {
                mappedTicket.setId(2L);
                return mappedTicket;
            }).when(ticketRepository).save(mappedTicket);

            TicketResponseDTO result = ticketService.createTicket(dto, 9L);

            assertNotNull(result);
            assertEquals("SF-0005", mappedTicket.getReference());
            assertEquals(testClient, mappedTicket.getClient());
            assertEquals(TicketStatus.NEW, mappedTicket.getStatus());

            // Reference counter is incremented and persisted, not just read.
            verify(ticketReferenceSequenceRepository).save(argThat(s -> s.getLastValue() == 5));

            verify(supportCategoryService).normalizeTicketCategory(mappedTicket);
            verify(historyRepository).save(argThat(h ->
                h.getAction() == TicketHistoryAction.CREATED && h.getTicket() == mappedTicket));
            verify(workflowSyncService).enqueue(eq(mappedTicket), eq(WorkflowSyncAction.START), isNull(), eq("CREATE"));
        }

        @Test
        @DisplayName("Rejects ticket creation with no client id")
        void rejectsMissingClientId() {
            TicketCreateDTO dto = TicketCreateDTO.builder()
                .title("No client")
                .type(TicketType.QUESTION)
                .severity(Severity.LOW)
                .impact(Impact.LOW)
                .build();

            assertThrows(ResourceNotFoundException.class, () -> ticketService.createTicket(dto, 9L));
            verifyNoInteractions(historyRepository);
        }
    }

    // ─────────────────────────────────────────
    // updateTicket
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("updateTicket")
    class UpdateTicketTests {

        @Test
        @DisplayName("Applies only the provided fields and recalculates the score")
        void appliesPartialUpdate() {
            TicketUpdateDTO dto = TicketUpdateDTO.builder()
                .title("Updated title")
                .severity(Severity.CRITICAL)
                .impact(Impact.HIGH)
                .build();

            TicketResponseDTO result = ticketService.updateTicket(1L, dto, 20L);

            assertNotNull(result);
            assertEquals("Updated title", testTicket.getTitle());
            assertEquals(Severity.CRITICAL, testTicket.getSeverity());
            assertEquals(Impact.HIGH, testTicket.getImpact());
            verify(supportCategoryService).normalizeTicketCategory(testTicket);
            verify(ticketRepository).save(testTicket);
        }

        @Test
        @DisplayName("Delegates a status change in the payload to the status-change path")
        void delegatesStatusChange() {
            TicketUpdateDTO dto = TicketUpdateDTO.builder()
                .status(TicketStatus.IN_PROGRESS)
                .build();

            ticketService.updateTicket(1L, dto, 20L);

            assertEquals(TicketStatus.IN_PROGRESS, testTicket.getStatus());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.STATUS_CHANGE));
            verify(notificationService).notifyStatusChanged(testTicket, TicketStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Delegates an assignedAgentId in the payload to the assignment path")
        void delegatesAssignment() {
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));
            TicketUpdateDTO dto = TicketUpdateDTO.builder()
                .assignedAgentId(10L)
                .build();

            ticketService.updateTicket(1L, dto, 20L);

            assertEquals(testAgent, testTicket.getAssignedAgent());
            verify(notificationService).notifyTicketAssigned(testTicket, testAgent);
        }

        @Test
        @DisplayName("404s when the ticket does not exist")
        void throwsWhenTicketMissing() {
            when(ticketRepository.findById(99L)).thenReturn(Optional.empty());
            TicketUpdateDTO dto = TicketUpdateDTO.builder().title("x").build();

            assertThrows(ResourceNotFoundException.class, () -> ticketService.updateTicket(99L, dto, 20L));
        }
    }

    // ─────────────────────────────────────────
    // assignTicket
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("assignTicket")
    class AssignTicketTests {

        @Test
        @DisplayName("Assigns an eligible agent, transitions NEW to ASSIGNED, and records history + notification")
        void assignsEligibleAgent() {
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));

            TicketResponseDTO result = ticketService.assignTicket(1L, 10L, 20L);

            assertNotNull(result);
            assertEquals(testAgent, testTicket.getAssignedAgent());
            assertEquals(TicketStatus.ASSIGNED, testTicket.getStatus());
            assertNotNull(testTicket.getAssignedAt());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.ASSIGNMENT));
            verify(notificationService).notifyTicketAssigned(testTicket, testAgent);
            verify(workflowSyncService).enqueue(eq(testTicket), eq(WorkflowSyncAction.ASSIGN), isNull(), anyString());
        }

        @Test
        @DisplayName("Rejects assigning a user who is neither agent nor manager")
        void rejectsNonAgentAssignee() {
            User client = new User();
            client.setId(30L);
            client.setRole(Role.CLIENT);
            when(userRepository.findById(30L)).thenReturn(Optional.of(client));

            assertThrows(BusinessException.class, () -> ticketService.assignTicket(1L, 30L, 20L));
            verify(historyRepository, never()).save(any());
        }

        @Test
        @DisplayName("Rejects assigning an already-finalized ticket")
        void rejectsFinalizedTicket() {
            testTicket.setStatus(TicketStatus.CLOSED);
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));

            assertThrows(BusinessException.class, () -> ticketService.assignTicket(1L, 10L, 20L));
        }
    }

    // ─────────────────────────────────────────
    // takeCharge
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("takeCharge")
    class TakeChargeTests {

        @Test
        @DisplayName("Moves an unassigned ticket to IN_PROGRESS and assigns the taking agent")
        void takesChargeOfUnassignedTicket() {
            testTicket.setStatus(TicketStatus.OPEN);
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));

            TicketResponseDTO result = ticketService.takeCharge(1L, 10L);

            assertNotNull(result);
            assertEquals(TicketStatus.IN_PROGRESS, testTicket.getStatus());
            assertEquals(testAgent, testTicket.getAssignedAgent());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.STATUS_CHANGE));
            verify(notificationService).notifyStatusChanged(testTicket, TicketStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Resumes a paused SLA when taking charge of a PENDING ticket")
        void resumesSlaWhenTakingChargeOfPendingTicket() {
            testTicket.setStatus(TicketStatus.PENDING);
            testTicket.setSlaPaused(true);
            testTicket.setAssignedAgent(testAgent);
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));

            ticketService.takeCharge(1L, 10L);

            verify(slaComputationService).resumeSla(eq(testTicket), any(LocalDateTime.class));
            assertNull(testTicket.getWaitingOn());
        }

        @Test
        @DisplayName("Rejects a different agent taking charge of an already-assigned ticket")
        void rejectsStealingAssignedTicket() {
            testTicket.setStatus(TicketStatus.ASSIGNED);
            testTicket.setAssignedAgent(testAgent);
            User otherAgent = new User();
            otherAgent.setId(11L);
            otherAgent.setRole(Role.SUPPORT_AGENT);
            when(userRepository.findById(11L)).thenReturn(Optional.of(otherAgent));

            assertThrows(BusinessException.class, () -> ticketService.takeCharge(1L, 11L));
        }

        @Test
        @DisplayName("Rejects taking charge of a closed ticket")
        void rejectsClosedTicket() {
            testTicket.setStatus(TicketStatus.CLOSED);
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));

            assertThrows(BusinessException.class, () -> ticketService.takeCharge(1L, 10L));
        }
    }

    // ─────────────────────────────────────────
    // escalateManually
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("escalateManually")
    class EscalateManuallyTests {

        @Test
        @DisplayName("Reassigns to the new agent, sets ESCALATED_MANUAL, and records history + notification")
        void escalatesToNewAgent() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);
            testTicket.setAssignedAgent(testAgent);
            User newAgent = new User();
            newAgent.setId(11L);
            newAgent.setUsername("agent2");
            newAgent.setRole(Role.SUPPORT_AGENT);
            when(userRepository.findById(11L)).thenReturn(Optional.of(newAgent));
            when(userRepository.findById(20L)).thenReturn(Optional.of(testManager));

            TicketResponseDTO result = ticketService.escalateManually(1L, 11L, "Needs specialist", 20L);

            assertNotNull(result);
            assertEquals(newAgent, testTicket.getAssignedAgent());
            assertEquals(TicketStatus.ESCALATED_MANUAL, testTicket.getStatus());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.ESCALADE_MANUELLE));
            verify(notificationService).notifyTicketEscalated(testTicket, newAgent, "Needs specialist");
        }

        @Test
        @DisplayName("Rejects escalating an already-finalized ticket")
        void rejectsFinalizedTicket() {
            testTicket.setStatus(TicketStatus.RESOLVED);
            User newAgent = new User();
            newAgent.setId(11L);
            newAgent.setRole(Role.SUPPORT_AGENT);
            when(userRepository.findById(11L)).thenReturn(Optional.of(newAgent));

            assertThrows(BusinessException.class, () -> ticketService.escalateManually(1L, 11L, "reason", 20L));
        }

        @Test
        @DisplayName("Rejects escalating to a non-agent target user")
        void rejectsNonAgentTarget() {
            User client = new User();
            client.setId(31L);
            client.setRole(Role.CLIENT);
            when(userRepository.findById(31L)).thenReturn(Optional.of(client));

            assertThrows(BusinessException.class, () -> ticketService.escalateManually(1L, 31L, "reason", 20L));
        }
    }

    // ─────────────────────────────────────────
    // requestManagerReview
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("requestManagerReview")
    class RequestManagerReviewTests {

        @Test
        @DisplayName("Records a history entry and notifies when a reason is given, then delegates to EscalationService")
        void recordsReasonAndDelegates() {
            when(userRepository.findById(20L)).thenReturn(Optional.of(testManager));
            when(escalationService.evaluateEscalation(1L, EscalationEvaluationTrigger.MANUAL_MANAGER_REVIEW))
                .thenReturn(TicketResponseDTO.builder().id(1L).build());

            TicketResponseDTO result = ticketService.requestManagerReview(1L, "Client is very unhappy", 20L);

            assertNotNull(result);
            assertEquals("Client is very unhappy", testTicket.getManagerReviewReason());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.MANAGER_REVIEW_REQUESTED));
            verify(notificationService).notifyManagerReviewRequested(testTicket, "Client is very unhappy", testManager);
            verify(escalationService).evaluateEscalation(1L, EscalationEvaluationTrigger.MANUAL_MANAGER_REVIEW);
        }

        @Test
        @DisplayName("Skips the history entry when no reason is given but still delegates")
        void skipsHistoryWithoutReason() {
            when(escalationService.evaluateEscalation(1L, EscalationEvaluationTrigger.MANUAL_MANAGER_REVIEW))
                .thenReturn(TicketResponseDTO.builder().id(1L).build());

            ticketService.requestManagerReview(1L);

            verify(historyRepository, never()).save(any());
            verify(escalationService).evaluateEscalation(1L, EscalationEvaluationTrigger.MANUAL_MANAGER_REVIEW);
        }
    }

    // ─────────────────────────────────────────
    // pauseSla / resumeSla / extendSla / waitForCustomer
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("pauseSla / resumeSla / extendSla")
    class SlaLifecycleTests {

        @Test
        @DisplayName("pauseSla pauses the ticket and records SLA_PAUSED_MANUAL history")
        void pausesSla() {
            TicketResponseDTO result = ticketService.pauseSla(1L, "Waiting on vendor", 20L);

            assertNotNull(result);
            assertEquals("PAUSED", testTicket.getSlaPhase());
            assertEquals("Waiting on vendor", testTicket.getSlaPauseReason());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.SLA_PAUSED_MANUAL));
        }

        @Test
        @DisplayName("resumeSla delegates to SlaComputationService and records SLA_RESUMED history")
        void resumesSla() {
            when(slaComputationService.resumeSla(eq(testTicket), any(LocalDateTime.class))).thenReturn(42L);

            TicketResponseDTO result = ticketService.resumeSla(1L, 20L);

            assertNotNull(result);
            assertNull(testTicket.getSlaPauseReason());
            verify(slaComputationService).resumeSla(eq(testTicket), any(LocalDateTime.class));
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.SLA_RESUMED));
        }

        @Test
        @DisplayName("extendSla delegates to SlaComputationService and records SLA_EXTENDED history")
        void extendsSla() {
            TicketResponseDTO result = ticketService.extendSla(1L, 60, "Manager approved", 20L);

            assertNotNull(result);
            verify(slaComputationService).extendSla(eq(testTicket), eq(60), eq("Manager approved"), any(LocalDateTime.class));
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.SLA_EXTENDED));
        }
    }

    @Nested
    @DisplayName("waitForCustomer")
    class WaitForCustomerTests {

        @Test
        @DisplayName("Moves the ticket to PENDING, pauses SLA, and records the matching WAITING_ON_* action")
        void movesToPendingAndPausesSla() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);

            TicketResponseDTO result = ticketService.waitForCustomer(1L, WaitingOn.CLIENT, "Need more logs", 20L);

            assertNotNull(result);
            assertEquals(TicketStatus.PENDING, testTicket.getStatus());
            assertEquals(WaitingOn.CLIENT, testTicket.getWaitingOn());
            assertEquals("Need more logs", testTicket.getPendingReason());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.WAITING_ON_CLIENT));
            verify(notificationService).broadcastTicketStatusChange(testTicket, "IN_PROGRESS", "PENDING");
        }

        @Test
        @DisplayName("Maps each WaitingOn value to its matching TicketHistoryAction")
        void mapsThirdPartyWaitingOn() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);

            ticketService.waitForCustomer(1L, WaitingOn.THIRD_PARTY, "Vendor ticket open", 20L);

            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.WAITING_ON_THIRD_PARTY));
        }

        @Test
        @DisplayName("Rejects putting an already-finalized ticket on hold")
        void rejectsFinalizedTicket() {
            testTicket.setStatus(TicketStatus.CLOSED);

            assertThrows(BusinessException.class,
                () -> ticketService.waitForCustomer(1L, WaitingOn.CLIENT, "reason", 20L));
        }
    }

    // ─────────────────────────────────────────
    // resolveTicket / rejectResolution
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("resolveTicket")
    class ResolveTicketTests {

        private TicketResolveRequestDTO buildResolveRequest() {
            return TicketResolveRequestDTO.builder()
                .resolutionSummary("Restarted the auth service")
                .resolutionDetails(TicketResolveRequestDTO.TicketResolutionDetailsPayload.builder()
                    .diagnostic("Auth service was stuck in a crash loop")
                    .rootCause("Bad deploy of the OAuth config")
                    .actionsTaken("Rolled back the config and restarted the service")
                    .nextRecommendation("Add a health check before rollout")
                    .build())
                .build();
        }

        @Test
        @DisplayName("Only the assigned agent can resolve; records RESOLUTION_CAPTURED and enqueues RESOLVE sync")
        void assignedAgentCanResolve() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);
            testTicket.setAssignedAgent(testAgent);
            when(userRepository.findById(10L)).thenReturn(Optional.of(testAgent));

            TicketResponseDTO result = ticketService.resolveTicket(1L, buildResolveRequest(), 10L);

            assertNotNull(result);
            assertEquals(TicketStatus.RESOLVED, testTicket.getStatus());
            assertEquals("Restarted the auth service", testTicket.getResolutionSummary());
            assertNotNull(testTicket.getResolvedAt());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.STATUS_CHANGE));
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.RESOLUTION_CAPTURED));
            verify(notificationService).notifyTicketResolved(testTicket);
            verify(workflowSyncService).enqueue(eq(testTicket), eq(WorkflowSyncAction.RESOLVE), isNull(), anyString());
        }

        @Test
        @DisplayName("Rejects resolution attempted by an agent other than the assignee")
        void rejectsNonAssignedAgent() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);
            testTicket.setAssignedAgent(testAgent);
            User otherAgent = new User();
            otherAgent.setId(11L);
            when(userRepository.findById(11L)).thenReturn(Optional.of(otherAgent));

            assertThrows(BusinessException.class,
                () -> ticketService.resolveTicket(1L, buildResolveRequest(), 11L));
            verify(historyRepository, never()).save(any());
        }

        @Test
        @DisplayName("Rejects resolution when the acting user cannot be resolved")
        void rejectsUnknownAgent() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThrows(BusinessException.class,
                () -> ticketService.resolveTicket(1L, buildResolveRequest(), 99L));
        }
    }

    @Nested
    @DisplayName("rejectResolution")
    class RejectResolutionTests {

        @Test
        @DisplayName("Reopens a RESOLVED ticket to IN_PROGRESS and records RESOLUTION_REJECTED history")
        void reopensResolvedTicket() {
            testTicket.setStatus(TicketStatus.RESOLVED);
            when(userRepository.findById(20L)).thenReturn(Optional.of(testManager));

            TicketResponseDTO result = ticketService.rejectResolution(1L, "Not actually fixed", 20L);

            assertNotNull(result);
            assertEquals(TicketStatus.IN_PROGRESS, testTicket.getStatus());
            assertEquals("Not actually fixed", testTicket.getResolutionRejectedReason());
            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.RESOLUTION_REJECTED));
            verify(notificationService).notifyResolutionRejected(testTicket, testManager, "Not actually fixed");
            verify(workflowSyncService).enqueue(eq(testTicket), eq(WorkflowSyncAction.VALIDATE), eq("false"), anyString());
        }

        @Test
        @DisplayName("Rejects rejecting a resolution on a ticket that isn't RESOLVED")
        void rejectsNonResolvedTicket() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);

            assertThrows(BusinessException.class,
                () -> ticketService.rejectResolution(1L, "comment", 20L));
        }
    }

    // ─────────────────────────────────────────
    // changeStatus
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("changeStatus")
    class ChangeStatusTests {

        @Test
        @DisplayName("Sets resolvedAt and notifies when transitioning to RESOLVED")
        void transitionsToResolved() {
            testTicket.setStatus(TicketStatus.IN_PROGRESS);

            TicketResponseDTO result = ticketService.changeStatus(1L, TicketStatus.RESOLVED, 20L);

            assertNotNull(result);
            assertEquals(TicketStatus.RESOLVED, testTicket.getStatus());
            assertNotNull(testTicket.getResolvedAt());
            verify(notificationService).notifyTicketResolved(testTicket);
            verify(notificationService).broadcastTicketStatusChange(testTicket, "IN_PROGRESS", "RESOLVED");
        }

        @Test
        @DisplayName("Sets closedAt when transitioning to CLOSED")
        void transitionsToClosed() {
            testTicket.setStatus(TicketStatus.RESOLVED);

            ticketService.changeStatus(1L, TicketStatus.CLOSED, 20L);

            assertEquals(TicketStatus.CLOSED, testTicket.getStatus());
            assertNotNull(testTicket.getClosedAt());
        }

        @Test
        @DisplayName("Clears waitingOn/pendingReason when moving away from PENDING")
        void clearsWaitingOnWhenLeavingPending() {
            testTicket.setStatus(TicketStatus.PENDING);
            testTicket.setWaitingOn(WaitingOn.CLIENT);
            testTicket.setPendingReason("waiting on client");

            ticketService.changeStatus(1L, TicketStatus.IN_PROGRESS, 20L);

            assertNull(testTicket.getWaitingOn());
            assertNull(testTicket.getPendingReason());
        }

        @Test
        @DisplayName("Records a STATUS_REASON history entry only when a reason is supplied")
        void recordsStatusReasonWhenProvided() {
            testTicket.setStatus(TicketStatus.NEW);
            when(userRepository.findById(20L)).thenReturn(Optional.of(testManager));

            ticketService.changeStatus(1L, TicketStatus.ASSIGNED, 20L, "Manual override");

            verify(historyRepository).save(argThat(h -> h.getAction() == TicketHistoryAction.STATUS_REASON
                && "Motif changement statut: Manual override".equals(h.getDescription())));
        }

        @Test
        @DisplayName("Does not record a STATUS_REASON entry when no reason is supplied")
        void skipsStatusReasonWhenAbsent() {
            testTicket.setStatus(TicketStatus.NEW);

            ticketService.changeStatus(1L, TicketStatus.ASSIGNED, 20L);

            verify(historyRepository, never()).save(argThat(h -> h.getAction() == TicketHistoryAction.STATUS_REASON));
        }
    }
}
