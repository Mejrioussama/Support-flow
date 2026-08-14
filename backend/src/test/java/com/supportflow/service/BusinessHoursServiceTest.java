package com.supportflow.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * BusinessHoursService is the calendar arithmetic every non-24/7 SLA deadline is built on:
 * if it drifts, every ticket's deadline and every breach decision drifts with it. It is pure
 * logic with no collaborators, so it can be pinned down exactly - which also makes it the
 * cheapest place in the codebase to buy real confidence.
 *
 * All tests below use the shipped defaults (08h-18h, Monday to Friday). Dates are chosen
 * deliberately: 2026-08-10 is a Monday, so 2026-08-15/16 are Saturday/Sunday.
 */
class BusinessHoursServiceTest {

    private BusinessHoursService service;

    @BeforeEach
    void setUp() {
        service = new BusinessHoursService();
        // @Value fields are never populated outside a Spring context; mirror application.yml.
        ReflectionTestUtils.setField(service, "startHour", 8);
        ReflectionTestUtils.setField(service, "endHour", 18);
        ReflectionTestUtils.setField(service, "includeSaturday", false);
        ReflectionTestUtils.setField(service, "includeSunday", false);
    }

    private static LocalDateTime at(int day, int hour, int minute) {
        return LocalDateTime.of(2026, 8, day, hour, minute);
    }

    @Nested
    @DisplayName("isBusinessHours")
    class IsBusinessHours {

        @Test
        @DisplayName("un mardi a 10h est ouvre")
        void weekdayMidMorningIsOpen() {
            assertTrue(service.isBusinessHours(at(11, 10, 0)));
        }

        @Test
        @DisplayName("les bornes 08h00 et 17h59 sont ouvertes, 18h00 est ferme")
        void boundariesAreHalfOpen() {
            assertTrue(service.isBusinessHours(at(11, 8, 0)), "08h00 doit etre ouvert");
            assertTrue(service.isBusinessHours(at(11, 17, 59)), "17h59 doit etre ouvert");
            // endHour is exclusive: at 18h00 sharp the window is already closed.
            assertFalse(service.isBusinessHours(at(11, 18, 0)), "18h00 doit etre ferme");
        }

        @Test
        @DisplayName("avant l'ouverture le creneau est ferme")
        void beforeOpeningIsClosed() {
            assertFalse(service.isBusinessHours(at(11, 7, 59)));
        }

        @Test
        @DisplayName("samedi et dimanche sont fermes meme en pleine journee")
        void weekendIsClosed() {
            assertFalse(service.isBusinessHours(at(15, 10, 0)), "samedi");
            assertFalse(service.isBusinessHours(at(16, 10, 0)), "dimanche");
        }

        @Test
        @DisplayName("le samedi devient ouvre quand il est active en configuration")
        void saturdayOpensWhenConfigured() {
            ReflectionTestUtils.setField(service, "includeSaturday", true);
            assertTrue(service.isBusinessHours(at(15, 10, 0)));
        }
    }

    @Nested
    @DisplayName("advanceToNextBusinessHour")
    class AdvanceToNextBusinessHour {

        @Test
        @DisplayName("avance a l'ouverture du jour meme si on est avant 08h")
        void jumpsToSameDayOpening() {
            assertEquals(at(11, 8, 0), service.advanceToNextBusinessHour(at(11, 6, 30)));
        }

        @Test
        @DisplayName("apres la fermeture, avance au lendemain ouvre")
        void jumpsToNextDayAfterClosing() {
            assertEquals(at(12, 8, 0), service.advanceToNextBusinessHour(at(11, 19, 0)));
        }

        @Test
        @DisplayName("depuis un vendredi soir, saute le week-end jusqu'au lundi")
        void skipsWeekendFromFridayEvening() {
            // Vendredi 14/08 20h -> lundi 17/08 08h
            assertEquals(at(17, 8, 0), service.advanceToNextBusinessHour(at(14, 20, 0)));
        }

        @Test
        @DisplayName("depuis un samedi, avance au lundi")
        void skipsWeekendFromSaturday() {
            assertEquals(at(17, 8, 0), service.advanceToNextBusinessHour(at(15, 10, 0)));
        }
    }

    @Nested
    @DisplayName("calculateBusinessHoursDeadline")
    class Deadline {

        @Test
        @DisplayName("reste dans la journee quand le SLA tient avant la fermeture")
        void staysWithinSameDay() {
            // Mardi 09h00 + 120 min -> 11h00 le meme jour
            assertEquals(at(11, 11, 0), service.calculateBusinessHoursDeadline(at(11, 9, 0), 120));
        }

        @Test
        @DisplayName("reporte au lendemain le reliquat qui depasse la fermeture")
        void spillsOverToNextDay() {
            // Mardi 17h00 + 120 min : 60 min avant 18h, puis 60 min des mercredi 08h -> 09h00
            assertEquals(at(12, 9, 0), service.calculateBusinessHoursDeadline(at(11, 17, 0), 120));
        }

        @Test
        @DisplayName("un depart hors horaires demarre a la prochaine ouverture")
        void startingOutsideHoursWaitsForOpening() {
            // Mardi 06h00 + 60 min : le compteur ne demarre qu'a 08h00 -> 09h00
            assertEquals(at(11, 9, 0), service.calculateBusinessHoursDeadline(at(11, 6, 0), 60));
        }

        @Test
        @DisplayName("un SLA demarre vendredi soir se termine lundi matin")
        void weekendIsNotConsumed() {
            // Vendredi 17h30 + 60 min : 30 min le vendredi, 30 min des lundi 08h -> 08h30
            assertEquals(at(17, 8, 30), service.calculateBusinessHoursDeadline(at(14, 17, 30), 60));
        }

        @Test
        @DisplayName("un SLA long s'etale sur plusieurs jours ouvres")
        void spansMultipleBusinessDays() {
            // Une journee ouvree = 600 min. Lundi 08h00 + 1500 min = 2 jours pleins + 300 min
            // -> mercredi 13h00
            assertEquals(at(12, 13, 0), service.calculateBusinessHoursDeadline(at(10, 8, 0), 1500));
        }
    }

    @Nested
    @DisplayName("calculateEffectiveBusinessMinutes")
    class EffectiveMinutes {

        @Test
        @DisplayName("compte les minutes d'un intervalle entierement ouvre")
        void countsPlainInterval() {
            assertEquals(120, service.calculateEffectiveBusinessMinutes(at(11, 9, 0), at(11, 11, 0)));
        }

        @Test
        @DisplayName("exclut la nuit entre deux jours ouvres")
        void excludesOvernight() {
            // Mardi 17h00 -> mercredi 09h00 : 60 min mardi + 60 min mercredi
            assertEquals(120, service.calculateEffectiveBusinessMinutes(at(11, 17, 0), at(12, 9, 0)));
        }

        @Test
        @DisplayName("exclut totalement le week-end")
        void excludesWeekend() {
            // Vendredi 17h00 -> lundi 09h00 : 60 min vendredi + 60 min lundi, week-end ignore
            assertEquals(120, service.calculateEffectiveBusinessMinutes(at(14, 17, 0), at(17, 9, 0)));
        }

        @Test
        @DisplayName("renvoie zero pour un intervalle entierement hors horaires")
        void returnsZeroForClosedInterval() {
            // Samedi matin -> samedi soir : aucune minute ouvree
            assertEquals(0, service.calculateEffectiveBusinessMinutes(at(15, 9, 0), at(15, 17, 0)));
        }

        @Test
        @DisplayName("renvoie zero quand la fin precede le debut ou qu'un argument est null")
        void returnsZeroForInvalidRange() {
            assertEquals(0, service.calculateEffectiveBusinessMinutes(at(11, 11, 0), at(11, 9, 0)));
            assertEquals(0, service.calculateEffectiveBusinessMinutes(at(11, 11, 0), at(11, 11, 0)));
            assertEquals(0, service.calculateEffectiveBusinessMinutes(null, at(11, 11, 0)));
            assertEquals(0, service.calculateEffectiveBusinessMinutes(at(11, 11, 0), null));
        }

        @Test
        @DisplayName("calculateRemainingBusinessMinutes delegue au meme calcul")
        void remainingDelegatesToEffective() {
            LocalDateTime now = at(11, 9, 0);
            LocalDateTime deadline = at(11, 12, 0);
            assertEquals(service.calculateEffectiveBusinessMinutes(now, deadline),
                service.calculateRemainingBusinessMinutes(now, deadline));
        }
    }

    @Nested
    @DisplayName("Metadonnees de configuration")
    class Metadata {

        @Test
        @DisplayName("expose la fenetre horaire formatee pour l'affichage")
        void exposesWindowLabel() {
            assertEquals("08h-18h", service.getBusinessWindowLabel());
            assertEquals(8, service.getStartHour());
            assertEquals(18, service.getEndHour());
        }
    }
}
