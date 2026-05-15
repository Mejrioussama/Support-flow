package com.supportflow.dto;

import com.supportflow.entity.enums.WaitingOn;
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
public class TicketPendingRequestDTO {

    @NotNull
    private WaitingOn waitingOn;

    @NotBlank
    @Size(min = 5, max = 500)
    private String pendingReason;
}
