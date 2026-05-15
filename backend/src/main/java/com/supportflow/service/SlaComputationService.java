package com.supportflow.service;

import com.supportflow.entity.Client;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.Severity;
import com.supportflow.entity.enums.TicketStatus;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SlaComputationService {

    private final BusinessHoursService businessHoursService;

    @Value("${supportflow.sla.super-critical-minutes:2}")
    private int slaSuperCriticalMinutes;

    @Value("${supportflow.sla.critical-hours:4}")
    private int slaCriticalHours;

    @Value("${supportflow.sla.high-hours:8}")
    private int slaHighHours;

    @Value("${supportflow.sla.medium-hours:24}")
    private int slaMediumHours;

    @Value("${supportflow.sla.low-hours:72}")
    private int slaLowHours;

    @Value("${supportflow.sla.standard-multiplier:1.0}")
    private double standardMultiplier;

    @Value("${supportflow.sla.business-multiplier:0.75}")
    private double businessMultiplier;

    @Value("${supportflow.sla.premium-multiplier:0.5}")
    private double premiumMultiplier;

    @Value("${supportflow.notifications.sla-warning-threshold:0.75}")
    private double atRiskThreshold;

    public SlaComputationService(BusinessHoursService businessHoursService) {
        this.businessHoursService = businessHoursService;
    }

    public int resolveSlaMinutes(Severity severity, Client client) {
        int baseMinutes = switch (severity) {
            case SUPER_CRITICAL -> slaSuperCriticalMinutes;
            case CRITICAL -> slaCriticalHours * 60;
            case HIGH -> slaHighHours * 60;
            case MEDIUM -> slaMediumHours * 60;
            case LOW -> slaLowHours * 60;
        };

        double multiplier = resolveClientMultiplier(client);
        return Math.max(1, (int) Math.ceil(baseMinutes * multiplier));
    }

    public void initializeSla(Ticket ticket, int slaMinutes, LocalDateTime startTime) {
        LocalDateTime effectiveStart = startTime != null ? startTime : LocalDateTime.now();
        ticket.setSlaHours(slaMinutes);
        ticket.setSlaTotalPausedMinutes(0L);
        ticket.setSlaExtendedMinutes(0);
        ticket.setSlaPaused(false);
        ticket.setSlaPausedAt(null);
        ticket.setSlaBreached(false);
        ticket.setSlaWarningSent(false);
        ticket.setSlaBusinessHoursOnly(ticket.getSeverity() != Severity.SUPER_CRITICAL);
        ticket.setSlaDeadline(calculateDeadline(ticket, effectiveStart, slaMinutes));
        ticket.setSlaPhase(computePhase(ticket, LocalDateTime.now()));
    }

    public LocalDateTime calculateDeadline(Ticket ticket, LocalDateTime startTime, int slaMinutes) {
        LocalDateTime effectiveStart = startTime != null ? startTime : LocalDateTime.now();
        if (usesBusinessHours(ticket)) {
            return businessHoursService.calculateBusinessHoursDeadline(effectiveStart, slaMinutes);
        }
        return effectiveStart.plusMinutes(slaMinutes);
    }

    public long resumeSla(Ticket ticket, LocalDateTime resumedAt) {
        if (!Boolean.TRUE.equals(ticket.getSlaPaused()) || ticket.getSlaPausedAt() == null) {
            ticket.setSlaPaused(false);
            ticket.setSlaPausedAt(null);
            return 0L;
        }

        LocalDateTime now = resumedAt != null ? resumedAt : LocalDateTime.now();
        long pausedMinutes = usesBusinessHours(ticket)
            ? businessHoursService.calculateEffectiveBusinessMinutes(ticket.getSlaPausedAt(), now)
            : Math.max(0L, Duration.between(ticket.getSlaPausedAt(), now).toMinutes());

        ticket.setSlaTotalPausedMinutes((ticket.getSlaTotalPausedMinutes() != null ? ticket.getSlaTotalPausedMinutes() : 0L) + pausedMinutes);

        if (ticket.getSlaDeadline() != null && pausedMinutes > 0) {
            ticket.setSlaDeadline(usesBusinessHours(ticket)
                ? businessHoursService.calculateBusinessHoursDeadline(ticket.getSlaDeadline(), (int) pausedMinutes)
                : ticket.getSlaDeadline().plusMinutes(pausedMinutes));
        }

        ticket.setSlaPaused(false);
        ticket.setSlaPausedAt(null);
        ticket.setSlaBreached(isBreached(ticket, now));
        ticket.setSlaPhase(computePhase(ticket, now));
        return pausedMinutes;
    }

    public void extendSla(Ticket ticket, int additionalMinutes, String reason, LocalDateTime extendedAt) {
        ticket.setSlaExtendedMinutes((ticket.getSlaExtendedMinutes() != null ? ticket.getSlaExtendedMinutes() : 0) + additionalMinutes);
        ticket.setSlaExtensionReason(reason);
        if (ticket.getSlaDeadline() != null) {
            ticket.setSlaDeadline(usesBusinessHours(ticket)
                ? businessHoursService.calculateBusinessHoursDeadline(ticket.getSlaDeadline(), additionalMinutes)
                : ticket.getSlaDeadline().plusMinutes(additionalMinutes));
        }
        LocalDateTime now = extendedAt != null ? extendedAt : LocalDateTime.now();
        ticket.setSlaBreached(isBreached(ticket, now));
        ticket.setSlaPhase(computePhase(ticket, now));
    }

    public double calculateConsumedPercent(Ticket ticket) {
        return calculateConsumedPercent(ticket, LocalDateTime.now());
    }

    public double calculateConsumedPercent(Ticket ticket, LocalDateTime now) {
        if (ticket == null || ticket.getSlaHours() == null || ticket.getSlaHours() <= 0) {
            return 0.0;
        }
        int totalSlaMinutes = ticket.getSlaHours() + (ticket.getSlaExtendedMinutes() != null ? ticket.getSlaExtendedMinutes() : 0);
        if (totalSlaMinutes <= 0) {
            return 0.0;
        }
        long elapsedMinutes = calculateEffectiveElapsedMinutes(ticket, now);
        return Math.max(0.0, Math.min(100.0, (elapsedMinutes * 100.0) / totalSlaMinutes));
    }

    public long calculateEffectiveElapsedMinutes(Ticket ticket, LocalDateTime now) {
        if (ticket == null || ticket.getCreatedAt() == null) {
            return 0L;
        }
        LocalDateTime effectiveNow = ticket.getResolvedAt() != null
            ? ticket.getResolvedAt()
            : (ticket.getClosedAt() != null ? ticket.getClosedAt() : (now != null ? now : LocalDateTime.now()));
        long totalElapsed = usesBusinessHours(ticket)
            ? businessHoursService.calculateEffectiveBusinessMinutes(ticket.getCreatedAt(), effectiveNow)
            : Math.max(0L, Duration.between(ticket.getCreatedAt(), effectiveNow).toMinutes());

        long paused = ticket.getSlaTotalPausedMinutes() != null ? ticket.getSlaTotalPausedMinutes() : 0L;
        if (Boolean.TRUE.equals(ticket.getSlaPaused()) && ticket.getSlaPausedAt() != null) {
            paused += usesBusinessHours(ticket)
                ? businessHoursService.calculateEffectiveBusinessMinutes(ticket.getSlaPausedAt(), effectiveNow)
                : Math.max(0L, Duration.between(ticket.getSlaPausedAt(), effectiveNow).toMinutes());
        }
        return Math.max(0L, totalElapsed - paused);
    }

    public boolean isBreached(Ticket ticket) {
        return isBreached(ticket, LocalDateTime.now());
    }

    public boolean isBreached(Ticket ticket, LocalDateTime now) {
        if (ticket == null || ticket.getSlaDeadline() == null) {
            return false;
        }
        if (ticket.getResolvedAt() != null) {
            return ticket.getResolvedAt().isAfter(ticket.getSlaDeadline());
        }
        return (now != null ? now : LocalDateTime.now()).isAfter(ticket.getSlaDeadline());
    }

    public String computePhase(Ticket ticket) {
        return computePhase(ticket, LocalDateTime.now());
    }

    public String computePhase(Ticket ticket, LocalDateTime now) {
        if (ticket == null) {
            return "UNKNOWN";
        }
        if (Boolean.TRUE.equals(ticket.getSlaPaused())) {
            return "PAUSED";
        }
        if (isBreached(ticket, now)) {
            return "BREACHED";
        }
        if (calculateConsumedPercent(ticket, now) >= atRiskThreshold * 100.0) {
            return "AT_RISK";
        }
        return "ON_TRACK";
    }

    public String formatRemainingTime(Ticket ticket) {
        return formatRemainingTime(ticket, LocalDateTime.now());
    }

    public String formatRemainingTime(Ticket ticket, LocalDateTime now) {
        if (ticket == null || ticket.getSlaDeadline() == null) {
            return "N/A";
        }
        LocalDateTime effectiveNow = now != null ? now : LocalDateTime.now();
        if (!ticket.getSlaDeadline().isAfter(effectiveNow)) {
            return "00h 00m";
        }

        long remainingMinutes = usesBusinessHours(ticket)
            ? businessHoursService.calculateRemainingBusinessMinutes(effectiveNow, ticket.getSlaDeadline())
            : Math.max(0L, Duration.between(effectiveNow, ticket.getSlaDeadline()).toMinutes());

        if (usesBusinessHours(ticket)
            && remainingMinutes == 0
            && ticket.getSlaDeadline().isAfter(effectiveNow)
            && !businessHoursService.isBusinessHours(effectiveNow)) {
            return "Reprise " + String.format("%02dh", businessHoursService.getStartHour());
        }

        return formatMinutes(remainingMinutes);
    }

    public String resolveSlaState(Ticket ticket) {
        String phase = computePhase(ticket);
        return switch (phase) {
            case "BREACHED" -> "BREACHED";
            case "AT_RISK" -> "AT_RISK";
            case "PAUSED" -> "PAUSED";
            default -> "ON_TRACK";
        };
    }

    public String resolveCalendarLabel(Ticket ticket) {
        if (usesBusinessHours(ticket)) {
            return "Heures ouvrees " + businessHoursService.getBusinessWindowLabel();
        }
        return "24/7";
    }

    public String resolveOperationalStatus(Ticket ticket) {
        LocalDateTime now = LocalDateTime.now();
        if (ticket == null) {
            return "Indisponible";
        }
        if (ticket.getStatus() == TicketStatus.CLOSED) {
            return "Ticket clos";
        }
        if (ticket.getStatus() == TicketStatus.RESOLVED) {
            return "Resolution en attente de validation";
        }
        if (Boolean.TRUE.equals(ticket.getSlaPaused())) {
            return "Chrono en pause";
        }
        if (isBreached(ticket, now)) {
            return "Deadline depassee";
        }
        if (usesBusinessHours(ticket) && !businessHoursService.isBusinessHours(now)) {
            return "Hors horaires";
        }
        return usesBusinessHours(ticket) ? "Fenetre SLA ouverte" : "Chrono 24/7 actif";
    }

    public boolean usesBusinessHours(Ticket ticket) {
        return ticket != null && Boolean.TRUE.equals(ticket.getSlaBusinessHoursOnly());
    }

    private double resolveClientMultiplier(Client client) {
        if (client == null || client.getSlaLevel() == null || client.getSlaLevel().isBlank()) {
            return standardMultiplier;
        }
        return switch (client.getSlaLevel().trim().toUpperCase(Locale.ROOT)) {
            case "PREMIUM" -> premiumMultiplier;
            case "BUSINESS" -> businessMultiplier;
            default -> standardMultiplier;
        };
    }

    private String formatMinutes(long totalMinutes) {
        long hours = totalMinutes / 60;
        long minutes = totalMinutes % 60;
        return String.format("%02dh %02dm", hours, minutes);
    }
}
