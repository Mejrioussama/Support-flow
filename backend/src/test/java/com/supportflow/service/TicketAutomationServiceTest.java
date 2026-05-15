package com.supportflow.service;

import com.supportflow.entity.*;
import com.supportflow.entity.enums.*;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketAutomationServiceTest {

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketHistoryRepository historyRepository;
    @Mock private TicketService ticketService;
    @Mock private NotificationService notificationService;
    @Mock private EscalationService escalationService;
    @Mock private SlaComputationService slaComputationService;

    @InjectMocks
    private TicketAutomationService automationService;

    private Ticket testTicket;
    private Client testClient;
    private User testAgent;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(automationService, "automationIntervalMs", 15000L);
        ReflectionTestUtils.setField(automationService, "slaCriticalHours", 24L);
        ReflectionTestUtils.setField(automationService, "slaCriticalRepeatHours", 6L);
        ReflectionTestUtils.setField(automationService, "pendingBlockedHours", 24L);

        testClient = new Client();
        testClient.setId(1L);
        testClient.setCompanyName("Test Corp");

        testAgent = new User();
        testAgent.setId(10L);
        testAgent.setUsername("agent1");
        testAgent.setFirstName("Alice");
        testAgent.setLastName("Agent");

        testTicket = new Ticket();
        testTicket.setId(100L);
        testTicket.setReference("SF-AUTO-001");
        testTicket.setTitle("Test automation ticket");
        testTicket.setClient(testClient);
        testTicket.setAssignedAgent(testAgent);
        testTicket.setStatus(TicketStatus.IN_PROGRESS);
        testTicket.setPriority(Priority.MEDIUM);
        testTicket.setSeverity(Severity.MEDIUM);
        testTicket.setEscalationLevel(0);
        testTicket.setEscalationCount(0);
        testTicket.setSlaPaused(false);
        testTicket.setSlaWarningSent(false);

        lenient().when(slaComputationService.isBreached(any(Ticket.class), any(LocalDateTime.class))).thenReturn(false);
        lenient().when(slaComputationService.computePhase(any(Ticket.class), any(LocalDateTime.class))).thenReturn("ON_TRACK");
    }

    // ─────────────────────────────────────────
    // AUTO SLA PAUSE
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Auto SLA Pause for PENDING tickets")
    class AutoPauseTests {

        @Test
        @DisplayName("Should auto-pause SLA when ticket is PENDING and not already paused")
        void autoPause_pendingTicket() {
            testTicket.setStatus(TicketStatus.PENDING);
            testTicket.setSlaPaused(false);
            testTicket.setSlaDeadline(LocalDateTime.now().plusHours(2));
            testTicket.setSlaPhase("ON_TRACK");

            when(ticketRepository.findByStatusAndSlaPaused(TicketStatus.PENDING, false))
                .thenReturn(List.of(testTicket));

            automationService.runAutomationCycle();

            verify(ticketRepository).save(argThat(ticket -> {
                assertTrue(ticket.getSlaPaused());
                assertEquals("PAUSED", ticket.getSlaPhase());
                return true;
            }));
            verify(historyRepository).save(argThat(h ->
                "SLA_AUTO_PAUSED".equals(h.getAction())));
        }

        @Test
        @DisplayName("Should skip tickets without SLA deadline")
        void autoPause_noDeadline_skips() {
            testTicket.setStatus(TicketStatus.PENDING);
            testTicket.setSlaPaused(false);
            testTicket.setSlaDeadline(null);

            when(ticketRepository.findByStatusAndSlaPaused(TicketStatus.PENDING, false))
                .thenReturn(List.of(testTicket));

            automationService.runAutomationCycle();

            // Should not save the ticket (no deadline, skip)
            verify(ticketRepository, never()).save(argThat(ticket ->
                "PAUSED".equals(ticket.getSlaPhase())));
        }
    }

    // ─────────────────────────────────────────
    // SIMPLE SLA MONITORING
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Simple SLA Monitoring")
    class PhaseMonitoringTests {

        @Test
        @DisplayName("Should transition to AT_RISK at 75% SLA and send notification")
        void phase_onTrackToAtRisk() {
            // Set up ticket beyond the at-risk threshold
            LocalDateTime created = LocalDateTime.now().minusMinutes(160);
            testTicket.setCreatedAt(created);
            testTicket.setSlaHours(200); // 200 minutes total
            testTicket.setSlaDeadline(created.plusMinutes(200));
            testTicket.setSlaPhase("ON_TRACK");
            testTicket.setSlaWarningSent(false);
            testTicket.setSlaPaused(false);

            when(ticketRepository.findActiveTicketsForSlaWarning(any())).thenReturn(List.of(testTicket));
            when(historyRepository.existsByTicketIdAndAction(100L, "SLA_AT_RISK_ALERT")).thenReturn(false);
            when(slaComputationService.computePhase(eq(testTicket), any(LocalDateTime.class))).thenReturn("AT_RISK");

            automationService.runAutomationCycle();

            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals("AT_RISK", ticket.getSlaPhase());
                assertTrue(ticket.getSlaWarningSent());
                return true;
            }));
            verify(notificationService).notifySlaAtRisk(testTicket);
            verify(historyRepository).save(argThat(h ->
                "SLA_AT_RISK_ALERT".equals(h.getAction())));
        }

        @Test
        @DisplayName("Should upgrade priority when ticket becomes AT_RISK")
        void phase_atRisk_upgradesPriority() {
            // Set up ticket beyond the at-risk threshold
            LocalDateTime created = LocalDateTime.now().minusMinutes(160);
            testTicket.setCreatedAt(created);
            testTicket.setSlaHours(200);
            testTicket.setSlaDeadline(created.plusMinutes(200));
            testTicket.setSlaPhase("ON_TRACK");
            testTicket.setSlaPaused(false);
            testTicket.setPriority(Priority.LOW);

            when(ticketRepository.findActiveTicketsForSlaWarning(any())).thenReturn(List.of(testTicket));
            when(historyRepository.existsByTicketIdAndAction(100L, "SLA_AT_RISK_ALERT")).thenReturn(false);
            when(slaComputationService.computePhase(eq(testTicket), any(LocalDateTime.class))).thenReturn("AT_RISK");

            automationService.runAutomationCycle();

            verify(ticketRepository).save(argThat(ticket -> {
                assertEquals("AT_RISK", ticket.getSlaPhase());
                assertEquals(Priority.HIGH, ticket.getPriority());
                return true;
            }));
            verify(notificationService).notifySlaAtRisk(testTicket);
        }

        @Test
        @DisplayName("Should NOT re-send AT_RISK alert if already sent")
        void phase_atRiskAlreadySent_skips() {
            LocalDateTime created = LocalDateTime.now().minusMinutes(160);
            testTicket.setCreatedAt(created);
            testTicket.setSlaHours(200);
            testTicket.setSlaDeadline(created.plusMinutes(200));
            testTicket.setSlaPhase("ON_TRACK");
            testTicket.setSlaPaused(false);

            when(ticketRepository.findActiveTicketsForSlaWarning(any())).thenReturn(List.of(testTicket));
            when(historyRepository.existsByTicketIdAndAction(100L, "SLA_AT_RISK_ALERT")).thenReturn(true);
            when(slaComputationService.computePhase(eq(testTicket), any(LocalDateTime.class))).thenReturn("AT_RISK");

            automationService.runAutomationCycle();

            verify(notificationService, never()).notifySlaAtRisk(any());
        }

        @Test
        @DisplayName("Should skip paused tickets in SLA monitoring")
        void phase_pausedTicket_skips() {
            testTicket.setSlaPaused(true);
            testTicket.setSlaPhase("PAUSED");
            testTicket.setCreatedAt(LocalDateTime.now().minusHours(5));
            testTicket.setSlaDeadline(LocalDateTime.now().minusHours(1));
            testTicket.setSlaHours(240);

            when(ticketRepository.findActiveTicketsForSlaWarning(any())).thenReturn(List.of(testTicket));

            automationService.runAutomationCycle();

            // Phase should not change for paused tickets
            verify(notificationService, never()).notifySlaAtRisk(any());
        }
    }

    // ─────────────────────────────────────────
    // SLA BREACH ESCALATION
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("SLA Breach Escalation Chain")
    class BreachEscalationTests {

        @Test
        @DisplayName("Should trigger L1 for breached ticket at level 0")
        void breach_level0_triggersL1() {
            testTicket.setEscalationLevel(0);
            when(ticketRepository.findTicketsWithBreachedSla(any())).thenReturn(List.of(testTicket));

            automationService.runAutomationCycle();

            verify(escalationService).evaluateEscalation(100L, EscalationEvaluationTrigger.SLA_BREACHED);
        }

        @Test
        @DisplayName("Should trigger L2 for breached ticket already at level 1")
        void breach_level1_triggersL2() {
            testTicket.setEscalationLevel(1);
            when(ticketRepository.findTicketsWithBreachedSla(any())).thenReturn(List.of(testTicket));

            automationService.runAutomationCycle();

            verify(escalationService).evaluateEscalation(100L, EscalationEvaluationTrigger.SLA_BREACHED);
        }

        @Test
        @DisplayName("Should mark breached but not escalate resolved/closed/cancelled tickets")
        void breach_terminalTickets_noEscalation() {
            testTicket.setStatus(TicketStatus.RESOLVED);
            when(ticketRepository.findTicketsWithBreachedSla(any())).thenReturn(List.of(testTicket));

            automationService.runAutomationCycle();

            verify(ticketRepository).save(argThat(t -> t.getSlaBreached()));
            verify(notificationService).notifySlaBreached(testTicket);
            verify(escalationService, never()).escalateLevel1(any());
            verify(escalationService, never()).escalateLevel2(any());
        }

        @Test
        @DisplayName("Should log and continue when unified escalation throws")
        void breach_exceptionFallback() {
            testTicket.setEscalationLevel(0);
            when(ticketRepository.findTicketsWithBreachedSla(any())).thenReturn(List.of(testTicket));
            doThrow(new RuntimeException("DB error"))
                .when(escalationService).evaluateEscalation(100L, EscalationEvaluationTrigger.SLA_BREACHED);

            automationService.runAutomationCycle();

            verify(escalationService).evaluateEscalation(100L, EscalationEvaluationTrigger.SLA_BREACHED);
            verifyNoInteractions(ticketService);
        }
    }

    // ─────────────────────────────────────────
    // ANTI-BLOCKING & STALE ESCALATIONS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Anti-Blocking and Stale Escalation Handlers")
    class AntiBlockingTests {

        @Test
        @DisplayName("Should delegate stuck tickets to EscalationService")
        void antiBlocking_delegatesToEscalationService() {
            automationService.runAutomationCycle();

            verify(escalationService).handleStuckAssignedTickets(any(LocalDateTime.class));
            verify(escalationService).handleStaleEscalations(any(LocalDateTime.class));
        }
    }

    // ─────────────────────────────────────────
    // LONG-RUNNING ESCALATION REMINDERS
    // ─────────────────────────────────────────

    @Nested
    @DisplayName("Escalated SLA Long-Running Reminders")
    class CriticalReminderTests {

        @Test
        @DisplayName("Should send reminder for tickets escalated > 24h")
        void criticalReminder_sendsNotification() {
            testTicket.setStatus(TicketStatus.ESCALATED_SLA);
            testTicket.setEscalatedAt(LocalDateTime.now().minusHours(30));

            when(ticketRepository.findSlaEscalatedOlderThan(any())).thenReturn(List.of(testTicket));
            when(historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(eq(100L), eq("SLA_CRITICAL_EVENT"), any()))
                .thenReturn(false);

            automationService.runAutomationCycle();

            verify(notificationService).notifyLongRunningEscalation(testTicket);
            verify(historyRepository).save(argThat(h ->
                "SLA_CRITICAL_EVENT".equals(h.getAction())));
        }

        @Test
        @DisplayName("Should NOT send duplicate reminder within anti-spam window")
        void criticalReminder_antiSpam() {
            testTicket.setStatus(TicketStatus.ESCALATED_SLA);

            when(ticketRepository.findSlaEscalatedOlderThan(any())).thenReturn(List.of(testTicket));
            when(historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(eq(100L), eq("SLA_CRITICAL_EVENT"), any()))
                .thenReturn(true); // Already notified recently

            automationService.runAutomationCycle();

            verify(notificationService, never()).notifyLongRunningEscalation(any());
        }
    }
}
