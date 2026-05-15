package com.supportflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentWorkbenchDTO {
    private List<TicketResponseDTO> availableToTake;
    private List<TicketResponseDTO> assignedOpen;
    private List<TicketResponseDTO> waitingCustomer;
    private List<TicketResponseDTO> customerReplied;
    private List<TicketResponseDTO> resolutionRejected;
}
