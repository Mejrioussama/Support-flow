package com.supportflow.dto;

import com.supportflow.entity.enums.AgentStatus;
import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentAvailabilityDTO {
    private Long agentId;
    private String agentName;
    private AgentStatus status;
    private LocalDateTime statusSince;
    private String statusReason;
    private Integer maxConcurrentTickets;
    private Integer currentTicketCount;
    private Boolean isInShift;
}
