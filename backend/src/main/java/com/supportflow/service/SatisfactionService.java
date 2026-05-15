package com.supportflow.service;

import com.supportflow.dto.SatisfactionSurveyDTO;
import com.supportflow.entity.SatisfactionSurvey;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.User;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.repository.SatisfactionSurveyRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SatisfactionService {

    private final SatisfactionSurveyRepository surveyRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /**
     * Créer et envoyer un sondage quand le ticket est résolu
     */
    public void sendSurvey(Long ticketId) {
        if (surveyRepository.existsByTicketId(ticketId)) {
            log.debug("Sondage déjà envoyé pour ticket {}", ticketId);
            return;
        }

        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvé: " + ticketId));

        boolean wasEscalated = ticket.getEscalationLevel() != null && ticket.getEscalationLevel() > 0;

        SatisfactionSurvey survey = SatisfactionSurvey.builder()
            .ticket(ticket)
            .wasEscalated(wasEscalated)
            .escalationLevelReached(ticket.getEscalationLevel() != null ? ticket.getEscalationLevel() : 0)
            .surveySent(true)
            .surveyCompleted(false)
            .build();

        surveyRepository.save(survey);
        log.info("Sondage satisfaction envoyé pour ticket {}", ticket.getReference());
    }

    /**
     * Le client soumet sa réponse
     */
    public SatisfactionSurveyDTO submitResponse(Long ticketId, Integer rating, String comment, Long respondentId) {
        SatisfactionSurvey survey = surveyRepository.findByTicketId(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Sondage non trouvé pour ticket: " + ticketId));

        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating doit être entre 1 et 5");
        }

        survey.setRating(rating);
        survey.setComment(comment);
        survey.setSurveyCompleted(true);

        if (respondentId != null) {
            userRepository.findById(respondentId).ifPresent(survey::setRespondent);
        }

        // Calculate response time
        if (survey.getCreatedAt() != null) {
            survey.setResponseTimeMinutes(
                Duration.between(survey.getCreatedAt(), LocalDateTime.now()).toMinutes());
        }

        survey = surveyRepository.save(survey);

        // Alerte si satisfaction basse sur ticket escaladé
        if (rating <= 2 && Boolean.TRUE.equals(survey.getWasEscalated())) {
            log.warn("Satisfaction basse ({}) sur ticket escaladé {}", rating, survey.getTicket().getReference());
        }

        return toDTO(survey);
    }

    @Transactional(readOnly = true)
    public SatisfactionSurveyDTO getSurveyByTicket(Long ticketId) {
        return surveyRepository.findByTicketId(ticketId)
            .map(this::toDTO)
            .orElse(null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        Double avgAll = surveyRepository.averageRating();
        Double avgEscalated = surveyRepository.averageRatingForEscalated();
        long completed = surveyRepository.countCompletedSince(LocalDateTime.now().minusDays(30));
        long sent = surveyRepository.countSentSince(LocalDateTime.now().minusDays(30));

        return Map.of(
            "averageRating", avgAll != null ? avgAll : 0.0,
            "averageRatingEscalated", avgEscalated != null ? avgEscalated : 0.0,
            "completedLast30Days", completed,
            "sentLast30Days", sent,
            "responseRate", sent > 0 ? (double) completed / sent * 100 : 0.0
        );
    }

    @Transactional(readOnly = true)
    public List<SatisfactionSurveyDTO> getLowRatedEscalated() {
        return surveyRepository.findLowRatedEscalated().stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    private SatisfactionSurveyDTO toDTO(SatisfactionSurvey s) {
        return SatisfactionSurveyDTO.builder()
            .id(s.getId())
            .ticketId(s.getTicket().getId())
            .ticketReference(s.getTicket().getReference())
            .rating(s.getRating())
            .comment(s.getComment())
            .responseTimeMinutes(s.getResponseTimeMinutes())
            .wasEscalated(s.getWasEscalated())
            .escalationLevelReached(s.getEscalationLevelReached())
            .surveyCompleted(s.getSurveyCompleted())
            .createdAt(s.getCreatedAt())
            .build();
    }
}
