package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO pour le statut d'un processus Camunda
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProcessStatusDTO {
    
    private String processInstanceId;
    private String ticketReference;
    private String ticketId;
    private String currentActivity;
    private String processStatus; // ACTIVE, SUSPENDED, COMPLETED, TERMINATED
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Map<String, Object> variables;
    
    private String slaPhase; // ON_TRACK, AT_RISK, BREACHED, PAUSED
    private LocalDateTime escalatedAt;
    private LocalDateTime slaDeadline;
    
    private String lastErrorMessage;
    private boolean complete;
}
