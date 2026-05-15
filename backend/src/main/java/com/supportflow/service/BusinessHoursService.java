package com.supportflow.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Service de calcul des heures ouvrées.
 * Le SLA ne tourne que pendant les heures de travail (configurable).
 * SUPER_CRITICAL est exempt : court 24/7.
 */
@Service
public class BusinessHoursService {

    @Value("${supportflow.business-hours.start:08}")
    private int startHour;

    @Value("${supportflow.business-hours.end:18}")
    private int endHour;

    @Value("${supportflow.business-hours.include-saturday:false}")
    private boolean includeSaturday;

    @Value("${supportflow.business-hours.include-sunday:false}")
    private boolean includeSunday;

    /**
     * Vérifie si l'instant donné est dans les heures ouvrées
     */
    public boolean isBusinessHours(LocalDateTime dateTime) {
        DayOfWeek day = dateTime.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY && !includeSaturday) return false;
        if (day == DayOfWeek.SUNDAY && !includeSunday) return false;
        int hour = dateTime.getHour();
        return hour >= startHour && hour < endHour;
    }

    public int getStartHour() {
        return startHour;
    }

    public int getEndHour() {
        return endHour;
    }

    public String getBusinessWindowLabel() {
        return String.format("%02dh-%02dh", startHour, endHour);
    }

    /**
     * Calcule la deadline SLA en tenant compte des heures ouvrées.
     * Pour N minutes de SLA, on avance uniquement pendant les heures ouvrées.
     */
    public LocalDateTime calculateBusinessHoursDeadline(LocalDateTime startTime, int slaMinutes) {
        LocalDateTime cursor = startTime;
        int remainingMinutes = slaMinutes;

        while (remainingMinutes > 0) {
            if (!isBusinessHours(cursor)) {
                cursor = advanceToNextBusinessHour(cursor);
                continue;
            }

            // Minutes remaining in current business hour window
            LocalTime endOfDay = LocalTime.of(endHour, 0);
            long minutesUntilClose = java.time.Duration.between(cursor.toLocalTime(), endOfDay).toMinutes();
            
            if (minutesUntilClose <= 0) {
                cursor = advanceToNextBusinessHour(cursor);
                continue;
            }

            if (remainingMinutes <= minutesUntilClose) {
                cursor = cursor.plusMinutes(remainingMinutes);
                remainingMinutes = 0;
            } else {
                cursor = cursor.plusMinutes(minutesUntilClose);
                remainingMinutes -= (int) minutesUntilClose;
                cursor = advanceToNextBusinessHour(cursor);
            }
        }
        return cursor;
    }

    /**
     * Avance jusqu'à la prochaine ouverture (prochain jour ouvré à startHour)
     */
    public LocalDateTime advanceToNextBusinessHour(LocalDateTime from) {
        if (isWorkingDay(from)) {
            LocalTime time = from.toLocalTime();
            if (time.isBefore(LocalTime.of(startHour, 0))) {
                return from.toLocalDate().atTime(startHour, 0);
            }
        }

        LocalDateTime next = from.toLocalDate().plusDays(1).atTime(startHour, 0);
        while (!isWorkingDay(next)) {
            next = next.plusDays(1);
        }
        return next;
    }

    private boolean isWorkingDay(LocalDateTime dt) {
        DayOfWeek day = dt.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY && !includeSaturday) return false;
        if (day == DayOfWeek.SUNDAY && !includeSunday) return false;
        return true;
    }

    /**
     * Calcule les minutes ouvrées effectives entre deux instants
     */
    public long calculateEffectiveBusinessMinutes(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null || !end.isAfter(start)) return 0;
        long totalMinutes = 0;
        LocalDateTime cursor = start;

        while (cursor.isBefore(end)) {
            if (!isBusinessHours(cursor)) {
                cursor = advanceToNextBusinessHour(cursor);
                if (cursor.isAfter(end)) break;
                continue;
            }

            LocalTime endOfDay = LocalTime.of(endHour, 0);
            long minutesUntilClose = java.time.Duration.between(cursor.toLocalTime(), endOfDay).toMinutes();
            long minutesUntilEnd = java.time.Duration.between(cursor, end).toMinutes();
            long minutesToCount = Math.min(minutesUntilClose, minutesUntilEnd);

            if (minutesToCount <= 0) {
                cursor = advanceToNextBusinessHour(cursor);
                continue;
            }

            totalMinutes += minutesToCount;
            cursor = cursor.plusMinutes(minutesToCount);
        }
        return totalMinutes;
    }

    public long calculateRemainingBusinessMinutes(LocalDateTime now, LocalDateTime deadline) {
        return calculateEffectiveBusinessMinutes(now, deadline);
    }
}
