package com.supportflow.service;

import com.supportflow.dto.TicketResolveRequestDTO;
import com.supportflow.dto.TicketResponseDTO;

public interface TicketLifecycleOperations {
    TicketResponseDTO takeCharge(Long ticketId, Long agentId);
    TicketResponseDTO resolveTicket(Long ticketId, TicketResolveRequestDTO request, Long agentId);
    TicketResponseDTO rejectResolution(Long ticketId, String rejectionComment, Long userId);
    TicketResponseDTO closeTicket(Long ticketId, Integer satisfactionRating, String satisfactionComment);
}
