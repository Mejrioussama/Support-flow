package com.supportflow.service;

import com.supportflow.entity.Client;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.Severity;
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

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SlaComputationService is pure, high-value business logic (deadline math, breach detection,
 * client-tier multipliers) that was previously entirely untested. Tests here use tickets with
 * slaBusinessHoursOnly=false throughout (the 24/7 path, matching how SUPER_CRITICAL tickets are
 * always initialized) so they exercise this class's own logic without also needing to mock
 * BusinessHoursService's business-hours calendar math - that's a separate concern.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SlaComputationServiceTest {

    @Mock
    private BusinessHoursService businessHoursService;

    @InjectMocks
    private SlaComputationService slaComputationService;

    @BeforeEach
    void setUp() {
        // @Value fields are never populated by plain Mockito @InjectMocks; wire the same
        // defaults the real application.yml ships so test expectations match production math.
        ReflectionTestUtils.setField(slaComputationService, "slaSuperCriticalMinutes", 2);
        ReflectionTestUtils.setField(slaComputationService, "slaCriticalHours", 4);
        ReflectionTestUtils.setField(slaComputationService, "slaHighHours", 8);
        ReflectionTestUtils.setField(slaComputationService, "slaMediumHours", 24);
        ReflectionTestUtils.setField(slaComputationService, "slaLowHours", 72);
        ReflectionTestUtils.setField(slaComputationService, "standardMultiplier", 1.0);
        ReflectionTestUtils.setField(slaComputationService, "businessMultiplier", 0.75);
        ReflectionTestUtils.setField(slaComputationService, "premiumMultiplier", 0.5);
        ReflectionTestUtils.setField(slaComputationService, "atRiskThreshold", 0.75);
    }

    private Ticket ticket24x7() {
        Ticket ticket = new Ticket();
        ticket.setSlaBusinessHoursOnly(false);
        return ticket;
    }

    @Nested
    @DisplayName("resolveSlaMinutes")
    class ResolveSlaMinutesTests {

        @Test
        @DisplayName("Uses the base severity minutes with no client multiplier applied")
        void noClientUsesStandardMultiplier() {
            int minutes = slaComputationService.resolveSlaMinutes(Severity.HIGH, null);
            assertEquals(8 * 60, minutes);
        }

        @Test
        @DisplayName("Applies the PREMIUM client multiplier to halve the SLA window")
        void premiumClientHalvesWindow() {
            Client client = new Client();
            client.setSlaLevel("PREMIUM");

            int minutes = slaComputationService.resolveSlaMinutes(Severity.HIGH, client);

            assertEquals(240, minutes);
        }

        @Test
        @DisplayName("Applies the BUSINESS client multiplier")
        void businessClientAppliesMultiplier() {
            Client client = new Client();
            client.setSlaLevel("BUSINESS");

            int minutes = slaComputationService.resolveSlaMinutes(Severity.MEDIUM, client);

            assertEquals((int) Math.ceil(24 * 60 * 0.75), minutes);
        }

        @Test
        @DisplayName("SUPER_CRITICAL uses the raw minute value, not an hour multiple")
        void superCriticalUsesMinutesDirectly() {
            int minutes = slaComputationService.resolveSlaMinutes(Severity.SUPER_CRITICAL, null);
            assertEquals(2, minutes);
        }
    }

    @Nested
    @DisplayName("isBreached")
    class IsBreachedTests {

        @Test
        @DisplayName("A ticket past its deadline and still open is breached")
        void pastDeadlineIsBreached() {
            Ticket ticket = ticket24x7();
            LocalDateTime now = LocalDateTime.now();
            ticket.setSlaDeadline(now.minusMinutes(5));

            assertTrue(slaComputationService.isBreached(ticket, now));
        }

        @Test
        @DisplayName("A ticket before its deadline is not breached")
        void beforeDeadlineIsNotBreached() {
            Ticket ticket = ticket24x7();
            LocalDateTime now = LocalDateTime.now();
            ticket.setSlaDeadline(now.plusMinutes(30));

            assertFalse(slaComputationService.isBreached(ticket, now));
        }

        @Test
        @DisplayName("A ticket resolved before its deadline is never breached, regardless of 'now'")
        void resolvedBeforeDeadlineIsNotBreached() {
            Ticket ticket = ticket24x7();
            LocalDateTime deadline = LocalDateTime.now().plusHours(2);
            ticket.setSlaDeadline(deadline);
            ticket.setResolvedAt(deadline.minusMinutes(10));

            // Even asking "is it breached right now" (long after resolution) must look at
            // resolvedAt vs. deadline, not the current instant.
            assertFalse(slaComputationService.isBreached(ticket, deadline.plusDays(1)));
        }

        @Test
        @DisplayName("A ticket resolved after its deadline is breached")
        void resolvedAfterDeadlineIsBreached() {
            Ticket ticket = ticket24x7();
            LocalDateTime deadline = LocalDateTime.now();
            ticket.setSlaDeadline(deadline);
            ticket.setResolvedAt(deadline.plusMinutes(15));

            assertTrue(slaComputationService.isBreached(ticket, deadline.plusDays(1)));
        }

        @Test
        @DisplayName("A ticket with no deadline is never breached")
        void noDeadlineIsNotBreached() {
            Ticket ticket = ticket24x7();
            assertFalse(slaComputationService.isBreached(ticket, LocalDateTime.now()));
        }
    }

    @Nested
    @DisplayName("computePhase")
    class ComputePhaseTests {

        @Test
        @DisplayName("A paused ticket is PAUSED regardless of deadline")
        void pausedTicketIsPaused() {
            Ticket ticket = ticket24x7();
            LocalDateTime now = LocalDateTime.now();
            ticket.setSlaPaused(true);
            ticket.setSlaDeadline(now.minusMinutes(5));

            assertEquals("PAUSED", slaComputationService.computePhase(ticket, now));
        }

        @Test
        @DisplayName("A ticket past its deadline is BREACHED")
        void breachedTicketIsBreached() {
            Ticket ticket = ticket24x7();
            LocalDateTime now = LocalDateTime.now();
            ticket.setCreatedAt(now.minusHours(1));
            ticket.setSlaDeadline(now.minusMinutes(1));
            ticket.setSlaHours(60);

            assertEquals("BREACHED", slaComputationService.computePhase(ticket, now));
        }

        @Test
        @DisplayName("A ticket past the at-risk threshold but not yet breached is AT_RISK")
        void nearDeadlineIsAtRisk() {
            Ticket ticket = ticket24x7();
            LocalDateTime now = LocalDateTime.now();
            // 100-minute SLA window, created 90 minutes ago -> 90% consumed, above the 75% threshold.
            ticket.setCreatedAt(now.minusMinutes(90));
            ticket.setSlaHours(100);
            ticket.setSlaDeadline(now.plusMinutes(10));

            assertEquals("AT_RISK", slaComputationService.computePhase(ticket, now));
        }

        @Test
        @DisplayName("A freshly created ticket is ON_TRACK")
        void freshTicketIsOnTrack() {
            Ticket ticket = ticket24x7();
            LocalDateTime now = LocalDateTime.now();
            ticket.setCreatedAt(now);
            ticket.setSlaHours(480);
            ticket.setSlaDeadline(now.plusMinutes(480));

            assertEquals("ON_TRACK", slaComputationService.computePhase(ticket, now));
        }
    }

    @Nested
    @DisplayName("resumeSla")
    class ResumeSlaTests {

        @Test
        @DisplayName("Resuming a ticket that isn't paused is a no-op that returns zero")
        void notPausedReturnsZero() {
            Ticket ticket = ticket24x7();
            ticket.setSlaPaused(false);

            long paused = slaComputationService.resumeSla(ticket, LocalDateTime.now());

            assertEquals(0L, paused);
            assertFalse(ticket.getSlaPaused());
        }

        @Test
        @DisplayName("Resuming a paused ticket pushes the deadline out by the paused duration")
        void resumingExtendsDeadlineByPausedTime() {
            Ticket ticket = ticket24x7();
            LocalDateTime pausedAt = LocalDateTime.now().minusMinutes(30);
            LocalDateTime deadline = LocalDateTime.now().plusHours(1);
            ticket.setSlaPaused(true);
            ticket.setSlaPausedAt(pausedAt);
            ticket.setSlaDeadline(deadline);
            ticket.setSlaTotalPausedMinutes(0L);

            LocalDateTime resumedAt = pausedAt.plusMinutes(30);
            long pausedMinutes = slaComputationService.resumeSla(ticket, resumedAt);

            assertEquals(30L, pausedMinutes);
            assertEquals(deadline.plusMinutes(30), ticket.getSlaDeadline());
            assertFalse(ticket.getSlaPaused());
            assertNull(ticket.getSlaPausedAt());
            assertEquals(30L, ticket.getSlaTotalPausedMinutes());
        }
    }

    @Nested
    @DisplayName("extendSla")
    class ExtendSlaTests {

        @Test
        @DisplayName("Extending pushes the deadline forward and records the reason")
        void extendsDeadlineAndRecordsReason() {
            Ticket ticket = ticket24x7();
            LocalDateTime deadline = LocalDateTime.now().plusMinutes(10);
            ticket.setSlaDeadline(deadline);
            ticket.setSlaExtendedMinutes(0);

            slaComputationService.extendSla(ticket, 60, "Client requested more time", LocalDateTime.now());

            assertEquals(deadline.plusMinutes(60), ticket.getSlaDeadline());
            assertEquals(60, ticket.getSlaExtendedMinutes());
            assertEquals("Client requested more time", ticket.getSlaExtensionReason());
        }

        @Test
        @DisplayName("Extending accumulates on top of a previous extension")
        void accumulatesMultipleExtensions() {
            Ticket ticket = ticket24x7();
            ticket.setSlaDeadline(LocalDateTime.now().plusMinutes(10));
            ticket.setSlaExtendedMinutes(15);

            slaComputationService.extendSla(ticket, 20, "Second extension", LocalDateTime.now());

            assertEquals(35, ticket.getSlaExtendedMinutes());
        }
    }
}
