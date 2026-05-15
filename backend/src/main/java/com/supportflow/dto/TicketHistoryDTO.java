package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketHistoryDTO {

    private Long id;
    private String action;
    private String fieldName;
    private String oldValue;
    private String newValue;
    private String description;
    private String performedBy;
    private Long ticketId;
    private Long userId;
    private LocalDateTime createdAt;
}
