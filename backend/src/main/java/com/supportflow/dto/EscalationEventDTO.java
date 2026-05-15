package com.supportflow.dto;

import com.supportflow.entity.enums.EscalationReason;
import com.supportflow.entity.enums.EscalationTrigger;
import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EscalationEventDTO {
    private Long id;
    private Long ticketId;
    private String ticketReference;
    private Integer fromLevel;
    private Integer toLevel;
    private EscalationReason reason;
    private EscalationTrigger triggeredBy;
    private String fromAgentName;
    private String toAgentName;
    private String description;
    private Double slaPercentAtEscalation;
    private Boolean wasBlocked;
    private LocalDateTime createdAt;
}
