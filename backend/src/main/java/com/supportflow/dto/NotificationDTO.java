package com.supportflow.dto;

import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO pour les notifications
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDTO {
    
    private Long id;
    
    private String title;
    
    private String message;
    
    private String type;
    
    private String icon;
    
    private String link;
    
    private Boolean isRead;
    
    private LocalDateTime readAt;
    
    private String ticketReference;
    
    private Long ticketId;
    
    private LocalDateTime createdAt;

    /** SLA percentage at time of notification (0-100+) */
    private Integer slaPercentage;

    /** Whether manager action is required */
    private Boolean actionRequired;

    /** JSON text of suggested actions */
    private String suggestedActions;

    /** Best recommended agent's full name */
    private String recommendedAgent;

    /** Best recommended agent id */
    private Long recommendedAgentId;
}
