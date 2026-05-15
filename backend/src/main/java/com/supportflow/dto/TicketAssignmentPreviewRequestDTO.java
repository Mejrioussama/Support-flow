package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketAssignmentPreviewRequestDTO {
    private Long ticketId;
    private String reference;
    private String title;
    private String description;
    private String type;
    private String severity;
    private String impact;
    private String category;
    private Long assignedAgentId;
}
