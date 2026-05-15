package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResolutionDetailsDTO {
    private String diagnostic;
    private String rootCause;
    private String actionsTaken;
    private String nextRecommendation;
}
