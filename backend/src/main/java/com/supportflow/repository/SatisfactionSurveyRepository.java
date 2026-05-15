package com.supportflow.repository;

import com.supportflow.entity.SatisfactionSurvey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SatisfactionSurveyRepository extends JpaRepository<SatisfactionSurvey, Long> {

    Optional<SatisfactionSurvey> findByTicketId(Long ticketId);

    boolean existsByTicketId(Long ticketId);

    @Query("SELECT AVG(s.rating) FROM SatisfactionSurvey s WHERE s.surveyCompleted = true")
    Double averageRating();

    @Query("SELECT AVG(s.rating) FROM SatisfactionSurvey s WHERE s.surveyCompleted = true AND s.wasEscalated = true")
    Double averageRatingForEscalated();

    @Query("SELECT AVG(s.rating) FROM SatisfactionSurvey s " +
           "JOIN s.ticket t WHERE s.surveyCompleted = true AND t.assignedAgent.id = :agentId")
    Double averageRatingByAgent(@Param("agentId") Long agentId);

    @Query("SELECT s FROM SatisfactionSurvey s WHERE s.surveyCompleted = true AND s.rating <= 2 AND s.wasEscalated = true")
    List<SatisfactionSurvey> findLowRatedEscalated();

    List<SatisfactionSurvey> findBySurveySentTrueAndSurveyCompletedFalse();

    @Query("SELECT COUNT(s) FROM SatisfactionSurvey s WHERE s.surveyCompleted = true AND s.createdAt >= :since")
    long countCompletedSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(s) FROM SatisfactionSurvey s WHERE s.surveySent = true AND s.createdAt >= :since")
    long countSentSince(@Param("since") LocalDateTime since);
}
