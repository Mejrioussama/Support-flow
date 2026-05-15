package com.supportflow.service;

import com.supportflow.dto.AgentAvailabilityDTO;
import com.supportflow.entity.AgentAvailability;
import com.supportflow.entity.AgentShift;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.AgentStatus;
import com.supportflow.entity.enums.Role;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.repository.AgentAvailabilityRepository;
import com.supportflow.repository.AgentShiftRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AgentWorkloadService {

    private final UserRepository userRepository;
    private final AgentAvailabilityRepository availabilityRepository;
    private final AgentShiftRepository shiftRepository;
    private final TicketRepository ticketRepository;

    public AgentAvailabilityDTO updateAvailability(Long agentId, AgentStatus status, String reason) {
        User agent = userRepository.findById(agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));

        AgentAvailability avail = availabilityRepository.findByAgentId(agentId)
            .orElseGet(() -> AgentAvailability.builder().agent(agent).build());

        avail.setStatus(status);
        avail.setStatusSince(LocalDateTime.now());
        avail.setStatusReason(reason);
        avail = availabilityRepository.save(avail);

        log.info("Agent {} => {}{}", agent.getUsername(), status, reason != null ? " (" + reason + ")" : "");
        return toDTO(avail);
    }

    public AgentAvailabilityDTO setMaxConcurrentTickets(Long agentId, Integer maxTickets) {
        User agent = userRepository.findById(agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));

        AgentAvailability avail = availabilityRepository.findByAgentId(agentId)
            .orElseGet(() -> AgentAvailability.builder().agent(agent).status(AgentStatus.AVAILABLE).build());

        avail.setMaxConcurrentTickets(maxTickets);
        return toDTO(availabilityRepository.save(avail));
    }

    @Transactional(readOnly = true)
    public List<AgentAvailabilityDTO> getAllAgentStatuses() {
        List<User> agents = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_AGENT);
        return agents.stream().map(agent -> {
            AgentAvailability avail = availabilityRepository.findByAgentId(agent.getId()).orElse(null);
            return buildDTO(agent, avail);
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AgentAvailabilityDTO getAgentStatus(Long agentId) {
        User agent = userRepository.findById(agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        AgentAvailability avail = availabilityRepository.findByAgentId(agentId).orElse(null);
        return buildDTO(agent, avail);
    }

    // Shift management
    public AgentShift createShift(Long agentId, DayOfWeek day, LocalTime start, LocalTime end, boolean onCall) {
        User agent = userRepository.findById(agentId)
            .orElseThrow(() -> new ResourceNotFoundException("Agent non trouvé: " + agentId));
        return shiftRepository.save(AgentShift.builder()
            .agent(agent).dayOfWeek(day).startTime(start).endTime(end).isOnCall(onCall).build());
    }

    @Transactional(readOnly = true)
    public List<AgentShift> getAgentShifts(Long agentId) {
        return shiftRepository.findByAgentId(agentId);
    }

    public void deleteShift(Long shiftId) {
        shiftRepository.deleteById(shiftId);
    }

    private AgentAvailabilityDTO buildDTO(User agent, AgentAvailability avail) {
        List<TicketStatus> active = List.of(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS,
            TicketStatus.ESCALATED_MANUAL, TicketStatus.ESCALATED_SLA);
        long ticketCount = ticketRepository.countByAssignedAgentIdAndStatusIn(agent.getId(), active);

        boolean inShift = isInShift(agent.getId());

        return AgentAvailabilityDTO.builder()
            .agentId(agent.getId())
            .agentName(agent.getFullName())
            .status(avail != null ? avail.getStatus() : AgentStatus.AVAILABLE)
            .statusSince(avail != null ? avail.getStatusSince() : null)
            .statusReason(avail != null ? avail.getStatusReason() : null)
            .maxConcurrentTickets(avail != null ? avail.getMaxConcurrentTickets() : null)
            .currentTicketCount((int) ticketCount)
            .isInShift(inShift)
            .build();
    }

    private boolean isInShift(Long agentId) {
        DayOfWeek today = LocalDateTime.now().getDayOfWeek();
        LocalTime now = LocalTime.now();
        List<AgentShift> shifts = shiftRepository.findByAgentIdAndDayOfWeek(agentId, today);
        if (shifts.isEmpty()) return true;
        return shifts.stream().anyMatch(s ->
            !now.isBefore(s.getStartTime()) && !now.isAfter(s.getEndTime())
            || Boolean.TRUE.equals(s.getIsOnCall()));
    }

    private AgentAvailabilityDTO toDTO(AgentAvailability a) {
        return AgentAvailabilityDTO.builder()
            .agentId(a.getAgent().getId())
            .agentName(a.getAgent().getFullName())
            .status(a.getStatus())
            .statusSince(a.getStatusSince())
            .statusReason(a.getStatusReason())
            .maxConcurrentTickets(a.getMaxConcurrentTickets())
            .build();
    }
}
