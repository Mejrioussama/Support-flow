package com.supportflow.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SatisfactionSurveyDTO {
    private Long id;
    private Long ticketId;
    private String ticketReference;
    private Integer rating;
    private String comment;
    private Long responseTimeMinutes;
    private Boolean wasEscalated;
    private Integer escalationLevelReached;
    private Boolean surveyCompleted;
    private LocalDateTime createdAt;
}
