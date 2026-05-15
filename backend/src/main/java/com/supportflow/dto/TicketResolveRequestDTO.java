package com.supportflow.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResolveRequestDTO {

    @NotBlank
    @Size(min = 10, max = 1200)
    private String resolutionSummary;

    @Valid
    @NotNull
    private TicketResolutionDetailsPayload resolutionDetails;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TicketResolutionDetailsPayload {
        @NotBlank
        @Size(min = 10, max = 2000)
        private String diagnostic;

        @NotBlank
        @Size(min = 10, max = 2000)
        private String rootCause;

        @NotBlank
        @Size(min = 10, max = 2000)
        private String actionsTaken;

        @NotBlank
        @Size(min = 5, max = 1000)
        private String nextRecommendation;
    }
}
