package com.supportflow.service;

import com.supportflow.dto.AgentRecommendationDTO;
import com.supportflow.dto.EscalationEventDTO;
import com.supportflow.dto.TicketResponseDTO;
import com.supportflow.entity.AgentAvailability;
import com.supportflow.entity.AgentShift;
import com.supportflow.entity.EscalationEvent;
import com.supportflow.entity.EscalationPolicy;
import com.supportflow.entity.SupportCategory;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.AgentSkillType;
import com.supportflow.entity.enums.AgentStatus;
import com.supportflow.entity.enums.EscalationEvaluationTrigger;
import com.supportflow.entity.enums.EscalationReason;
import com.supportflow.entity.enums.EscalationTrigger;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.Role;
import com.supportflow.entity.enums.SkillMatchType;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.AgentAvailabilityRepository;
import com.supportflow.repository.AgentShiftRepository;
import com.supportflow.repository.EscalationEventRepository;
import com.supportflow.repository.EscalationPolicyRepository;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single source of truth for smart assignment and escalation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class EscalationService {

    private static final List<TicketStatus> ACTIVE_STATUSES = List.of(
        TicketStatus.NEW,
        TicketStatus.OPEN,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.ESCALATED_MANUAL,
        TicketStatus.ESCALATED_SLA
    );

    private static final double REASSIGNMENT_IMPROVEMENT_THRESHOLD = 5.0;

    private final TicketRepository ticketRepository;
    private final TicketHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EntityMapper mapper;
    private final EscalationPolicyRepository policyRepository;
    private final EscalationEventRepository eventRepository;
    private final AgentAvailabilityRepository availabilityRepository;
    private final AgentShiftRepository shiftRepository;
    private final SupportCategoryService supportCategoryService;

    @Value("${supportflow.escalation.level1-threshold:90}")
    private int defaultLevel1Threshold;

    @Value("${supportflow.escalation.level2-delay-minutes:15}")
    private int defaultLevel2DelayMinutes;

    @Value("${supportflow.escalation.stuck-assigned-minutes:15}")
    private int defaultStuckAssignedMinutes;

    @Value("${supportflow.escalation.level3-delay-minutes:30}")
    private int defaultLevel3DelayMinutes;

    @Value("${supportflow.escalation.cooldown-minutes:5}")
    private int defaultCooldownMinutes;

    @Value("${supportflow.escalation.max-escalations:10}")
    private int defaultMaxEscalations;

    public TicketResponseDTO evaluateEscalation(Long ticketId, EscalationEvaluationTrigger trigger) {
        Ticket ticket = findTicket(ticketId);
        return evaluateEscalation(ticket, trigger);
    }

    public TicketResponseDTO escalateLevel1(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        return escalateLevel1(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.SYSTEM);
    }

    public TicketResponseDTO escalateLevel2(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        return escalateLevel2(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.SYSTEM);
    }

    public TicketResponseDTO escalateLevel3(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        return escalateLevel3(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.SYSTEM);
    }

    public List<AgentRecommendationDTO> getRecommendedAgents(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        normalizeTicketCategory(ticket);
        return buildRecommendations(ticket, ticket.getAssignedAgent());
    }

    public List<AgentRecommendationDTO> getAssignmentCandidates(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        normalizeTicketCategory(ticket);
        return buildAssignmentCandidates(ticket);
    }

    public List<AgentRecommendationDTO> getRecommendedAgentsForDraft(String category, String type, String title, String description) {
        SupportCategory normalized = resolveNormalizedCategory(category, type, title, description);
        Ticket draft = Ticket.builder()
            .title(title != null ? title : "Brouillon")
            .description(description)
            .category(category)
            .normalizedCategory(normalized)
            .status(TicketStatus.NEW)
            .priority(Priority.MEDIUM)
            .build();
        return buildRecommendations(draft, null);
    }

    public void handleStuckAssignedTickets(LocalDateTime now) {
        LocalDateTime cutoff = now.minusMinutes(defaultStuckAssignedMinutes);
        List<Ticket> stuckTickets = ticketRepository.findStuckAssignedTickets(cutoff);

        for (Ticket ticket : stuckTickets) {
            EscalationPolicy policy = resolvePolicy(ticket);
            int stuckMinutes = adjustStuckMinutesBySeverity(getStuckMinutes(policy), ticket);
            if (ticket.getAssignedAt() != null && ticket.getAssignedAt().plusMinutes(stuckMinutes).isAfter(now)) {
                continue;
            }
            evaluateEscalation(ticket, EscalationEvaluationTrigger.ASSIGNED_STUCK);
        }
    }

    public void handleStaleEscalations(LocalDateTime now) {
        LocalDateTime cutoff = now.minusMinutes(defaultLevel3DelayMinutes);
        List<Ticket> staleTickets = ticketRepository.findSlaEscalatedWithoutRecentAction(cutoff);

        for (Ticket ticket : staleTickets) {
            EscalationPolicy policy = resolvePolicy(ticket);
            if (ticket.getEscalationLevel() == null || ticket.getEscalationLevel() < 2) {
                continue;
            }
            if (ticket.getLastEscalationAt() != null
                && ticket.getLastEscalationAt().plusMinutes(getLevel3Delay(policy)).isAfter(now)) {
                continue;
            }
            boolean hasRecentL3 = historyRepository.existsByTicketIdAndActionAndCreatedAtAfter(
                ticket.getId(),
                "ESCALATION_L3",
                now.minusMinutes(getLevel3Delay(policy)));
            if (hasRecentL3) {
                continue;
            }
            evaluateEscalation(ticket, EscalationEvaluationTrigger.SLA_BREACHED);
        }
    }

    @Transactional(readOnly = true)
    public List<EscalationEventDTO> getEscalationHistory(Long ticketId) {
        return eventRepository.findByTicketIdOrderByCreatedAtDesc(ticketId).stream()
            .map(this::toEventDTO)
            .toList();
    }

    public TicketResponseDTO holdEscalation(Long ticketId, int holdMinutes, String reason) {
        Ticket ticket = findTicket(ticketId);
        if (holdMinutes < 1 || holdMinutes > 1440) {
            throw new BusinessException("La duree du hold doit etre entre 1 et 1440 minutes");
        }

        ticket.setEscalationHoldUntil(LocalDateTime.now().plusMinutes(holdMinutes));
        ticket.setEscalationHoldReason(reason);
        ticket = ticketRepository.save(ticket);

        recordHistory(ticket, "ESCALATION_HOLD", null, holdMinutes + "min",
            "Escalade en hold " + holdMinutes + "min. Raison: " + reason);
        recordEvent(ticket, currentLevel(ticket), currentLevel(ticket),
            EscalationReason.HOLD_ACTIVE, EscalationTrigger.USER,
            ticket.getAssignedAgent(), null,
            "Hold active: " + holdMinutes + "min - " + reason, false);

        return mapper.toTicketResponseDTO(ticket);
    }

    public TicketResponseDTO releaseEscalationHold(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        if (ticket.getEscalationHoldUntil() == null) {
            throw new BusinessException("Aucun hold actif sur ce ticket");
        }

        ticket.setEscalationHoldUntil(null);
        ticket.setEscalationHoldReason(null);
        ticket = ticketRepository.save(ticket);

        recordHistory(ticket, "ESCALATION_HOLD_RELEASED", null, null, "Hold d'escalade libere manuellement");
        return mapper.toTicketResponseDTO(ticket);
    }

    private TicketResponseDTO evaluateEscalation(Ticket ticket, EscalationEvaluationTrigger trigger) {
        if (isTerminal(ticket)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        normalizeTicketCategory(ticket);
        EscalationPolicy policy = resolvePolicy(ticket);
        int level = currentLevel(ticket);
        LocalDateTime now = LocalDateTime.now();

        return switch (trigger) {
            case SLA_AT_RISK -> mapper.toTicketResponseDTO(ticket);
            case MANUAL_FORCE_TAKEOVER -> escalateLevel3(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.USER);
            case MANUAL_MANAGER_REVIEW -> {
                if (level < 2) {
                    yield escalateLevel2(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.USER);
                }
                yield mapper.toTicketResponseDTO(ticket);
            }
            case ASSIGNED_STUCK, SLA_BREACHED -> {
                if (level < 1) {
                    EscalationReason reason = trigger == EscalationEvaluationTrigger.ASSIGNED_STUCK
                        ? EscalationReason.STUCK_ASSIGNED
                        : EscalationReason.SLA_BREACH;
                    yield escalateLevel1(ticket, reason, EscalationTrigger.SYSTEM);
                }
                if (level < 2 && readyForLevel2(ticket, policy, now)) {
                    yield escalateLevel2(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.SYSTEM);
                }
                if (level < 3 && readyForLevel3(ticket, policy, now)) {
                    yield escalateLevel3(ticket, EscalationReason.SLA_BREACH, EscalationTrigger.SYSTEM);
                }
                yield mapper.toTicketResponseDTO(ticket);
            }
        };
    }

    private TicketResponseDTO escalateLevel1(Ticket ticket, EscalationReason reason, EscalationTrigger trigger) {
        if (isTerminal(ticket)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        EscalationPolicy policy = resolvePolicy(ticket);

        if (!isAutoReassignEnabled(policy)) {
            return escalateLevel2(ticket, reason, trigger);
        }
        if (!checkGuards(ticket, policy, 1, reason, trigger)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        RecommendationCandidate bestCandidate = findBestReassignmentCandidate(ticket, ticket.getAssignedAgent());
        RecommendationCandidate currentCandidate = ticket.getAssignedAgent() != null
            ? buildCandidate(ticket, ticket.getAssignedAgent(), ticket.getAssignedAgent())
            : null;

        if (!canReassign(bestCandidate, currentCandidate, ticket.getAssignedAgent())) {
            recordEvent(ticket, currentLevel(ticket), 2, EscalationReason.NO_AGENT_AVAILABLE,
                trigger, ticket.getAssignedAgent(), null,
                "Aucun meilleur agent disponible, escalation manager", false);
            return escalateLevel2(ticket, EscalationReason.NO_AGENT_AVAILABLE, trigger);
        }

        User oldAgent = ticket.getAssignedAgent();
        User newAgent = bestCandidate.agent();
        int previousLevel = currentLevel(ticket);

        ticket.setPreviousAgent(oldAgent);
        ticket.setAssignedAgent(newAgent);
        ticket.setAssignedAt(LocalDateTime.now());
        ticket.setEscalationLevel(1);
        ticket.setEscalationCount(nextEscalationCount(ticket));
        ticket.setLastEscalationAt(LocalDateTime.now());
        ticket.setEscalationBlocked(false);
        ticket.setSlaBreached(ticket.isSlaBreached() || reason == EscalationReason.SLA_BREACH);

        if (ticket.getStatus() == TicketStatus.NEW || ticket.getStatus() == TicketStatus.OPEN) {
            ticket.setStatus(TicketStatus.ASSIGNED);
        }

        adjustSlaAfterEscalation(ticket);
        ticket = ticketRepository.save(ticket);

        recordHistory(ticket, "ESCALATION_L1",
            oldAgent != null ? oldAgent.getFullName() : "Non assigne",
            newAgent.getFullName(),
            "Reaffectation intelligente vers " + newAgent.getFullName()
                + " [" + bestCandidate.recommendation().getSkillMatchType() + "]");

        recordEvent(ticket, previousLevel, 1, reason, trigger, oldAgent, newAgent,
            "L1 reassignation intelligente (" + bestCandidate.recommendation().getRecommendationScore() + ")",
            false);

        notificationService.notifyEscalationReassignment(ticket, newAgent, oldAgent);
        return mapper.toTicketResponseDTO(ticket);
    }

    private TicketResponseDTO escalateLevel2(Ticket ticket, EscalationReason reason, EscalationTrigger trigger) {
        if (isTerminal(ticket)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        EscalationPolicy policy = resolvePolicy(ticket);
        if (!checkGuards(ticket, policy, 2, reason, trigger)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        int previousLevel = currentLevel(ticket);
        ticket.setStatus(TicketStatus.ESCALATED_SLA);
        ticket.setEscalationLevel(2);
        ticket.setEscalationCount(nextEscalationCount(ticket));
        ticket.setLastEscalationAt(LocalDateTime.now());
        ticket.setEscalatedAt(ticket.getEscalatedAt() != null ? ticket.getEscalatedAt() : LocalDateTime.now());
        ticket.setSlaBreached(true);
        ticket.setEscalationBlocked(false);

        if (ticket.getPriority() != Priority.CRITICAL && ticket.getPriority() != Priority.SUPER_CRITICAL) {
            ticket.setPriority(Priority.CRITICAL);
        }

        ticket = ticketRepository.save(ticket);

        recordHistory(ticket, "ESCALATION_L2",
            String.valueOf(previousLevel), "2",
            "Supervision manager activee. Le ticket reste exploitable mais marque pour compatibilite ESCALATED_SLA.");
        recordEvent(ticket, previousLevel, 2, reason, trigger, ticket.getAssignedAgent(), null,
            "L2 supervision manager", false);

        notificationService.notifySLAEscalation(ticket);
        return mapper.toTicketResponseDTO(ticket);
    }

    private TicketResponseDTO escalateLevel3(Ticket ticket, EscalationReason reason, EscalationTrigger trigger) {
        if (isTerminal(ticket)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        EscalationPolicy policy = resolvePolicy(ticket);
        if (!checkGuards(ticket, policy, 3, reason, trigger)) {
            return mapper.toTicketResponseDTO(ticket);
        }

        User manager = findAvailableManager();
        if (manager == null) {
            recordHistory(ticket, "ESCALATION_L3_FAILED", null, null,
                "Escalade L3 echouee: aucun manager ou admin disponible");
            recordEvent(ticket, currentLevel(ticket), 3, EscalationReason.NO_AGENT_AVAILABLE,
                trigger, ticket.getAssignedAgent(), null,
                "Echec L3: aucun manager ou admin disponible", false);
            return mapper.toTicketResponseDTO(ticket);
        }

        User oldAgent = ticket.getAssignedAgent();
        int previousLevel = currentLevel(ticket);

        ticket.setPreviousAgent(oldAgent);
        ticket.setAssignedAgent(manager);
        ticket.setAssignedAt(LocalDateTime.now());
        ticket.setStatus(TicketStatus.ESCALATED_SLA);
        ticket.setEscalationLevel(3);
        ticket.setEscalationCount(nextEscalationCount(ticket));
        ticket.setLastEscalationAt(LocalDateTime.now());
        ticket.setSlaBreached(true);
        ticket.setEscalationBlocked(false);

        if (ticket.getPriority() != Priority.SUPER_CRITICAL) {
            ticket.setPriority(Priority.CRITICAL);
        }

        ticket = ticketRepository.save(ticket);

        recordHistory(ticket, "ESCALATION_L3",
            oldAgent != null ? oldAgent.getFullName() : "N/A",
            manager.getFullName(),
            "Prise en charge manager par " + manager.getFullName());
        recordEvent(ticket, previousLevel, 3, reason, trigger, oldAgent, manager,
            "L3 prise en charge manager", false);

        notificationService.notifyEscalationToManager(ticket, manager, oldAgent);
        return mapper.toTicketResponseDTO(ticket);
    }

    private List<AgentRecommendationDTO> buildRecommendations(Ticket ticket, User excludedAgent) {
        List<RecommendationCandidate> candidates = userRepository.findAssignableSupportUsers().stream()
            .filter(candidate -> candidate.isSupportAgent() || candidate.isSupportManager())
            .filter(candidate -> excludedAgent == null || !candidate.getId().equals(excludedAgent.getId()))
            .filter(this::isAgentAvailable)
            .filter(this::isAgentInShift)
            .map(candidate -> buildCandidate(ticket, candidate, excludedAgent))
            .sorted(recommendationComparator())
            .toList();

        return candidates.stream()
            .map(RecommendationCandidate::recommendation)
            .toList();
    }

    private List<AgentRecommendationDTO> buildAssignmentCandidates(Ticket ticket) {
        User currentAgent = ticket.getAssignedAgent();

        return userRepository.findAssignableSupportUsers().stream()
            .filter(candidate -> candidate.isSupportAgent() || candidate.isSupportManager())
            .map(candidate -> buildAssignmentCandidate(ticket, candidate, currentAgent))
            .sorted(assignmentCandidateComparator())
            .toList();
    }

    private RecommendationCandidate findBestReassignmentCandidate(Ticket ticket, User excludedAgent) {
        return userRepository.findAssignableSupportUsers().stream()
            .filter(candidate -> candidate.isSupportAgent() || candidate.isSupportManager())
            .filter(candidate -> excludedAgent == null || !candidate.getId().equals(excludedAgent.getId()))
            .filter(this::isAgentAvailable)
            .filter(this::isAgentInShift)
            .map(candidate -> buildCandidate(ticket, candidate, excludedAgent))
            .min(recommendationComparator())
            .orElse(null);
    }

    private RecommendationCandidate buildCandidate(Ticket ticket, User user, User excludedAgent) {
        SupportCategory normalizedCategory = resolveCandidateCategory(ticket);
        long activeTickets = countActiveTickets(user);
        double slaComplianceRate = computeSlaComplianceRate(user, activeTickets);
        AgentAvailability availability = availabilityRepository.findByAgentId(user.getId()).orElse(null);

        if (availability != null
            && availability.getMaxConcurrentTickets() != null
            && activeTickets >= availability.getMaxConcurrentTickets()) {
            return RecommendationCandidate.unavailable(user, normalizedCategory);
        }

        SkillMatchType matchType = resolveSkillMatch(user, normalizedCategory);
        double skillScore = skillScore(matchType);
        double availabilityScore = 100.0 / (1.0 + activeTickets);
        double expertiseScore = categoryExperienceScore(user, normalizedCategory);
        double recommendationScore = (skillScore * 0.60) + (availabilityScore * 0.25) + (slaComplianceRate * 0.15);

        String reason = buildRecommendationReason(matchType, normalizedCategory, activeTickets, slaComplianceRate);

        AgentRecommendationDTO recommendation = AgentRecommendationDTO.builder()
            .id(user.getId())
            .username(user.getUsername())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .activeTickets(activeTickets)
            .slaComplianceRate(round(slaComplianceRate))
            .expertiseScore(round(expertiseScore))
            .recommendationScore(round(recommendationScore))
            .recommendationReason(reason)
            .normalizedCategory(normalizedCategory.getCode())
            .skillMatchType(matchType)
            .primarySkillMatch(matchType == SkillMatchType.PRIMARY)
            .secondarySkillMatch(matchType == SkillMatchType.SECONDARY)
            .primarySkillCode(user.getPrimarySkill() != null ? user.getPrimarySkill().getCategory().getCode() : null)
            .secondarySkillCode(user.getSecondarySkill() != null ? user.getSecondarySkill().getCategory().getCode() : null)
            .assignmentEligible(true)
            .assignmentStatus("AVAILABLE")
            .assignmentStatusLabel("Disponible")
            .build();

        return new RecommendationCandidate(user, recommendation, matchType, recommendationScore, activeTickets);
    }

    private AgentRecommendationDTO buildAssignmentCandidate(Ticket ticket, User user, User currentAgent) {
        SupportCategory normalizedCategory = resolveCandidateCategory(ticket);
        long activeTickets = countActiveTickets(user);
        double slaComplianceRate = computeSlaComplianceRate(user, activeTickets);
        double expertiseScore = categoryExperienceScore(user, normalizedCategory);
        SkillMatchType matchType = resolveSkillMatch(user, normalizedCategory);
        double recommendationScore = computeRecommendationScore(matchType, activeTickets, slaComplianceRate);
        AgentAvailability availability = availabilityRepository.findByAgentId(user.getId()).orElse(null);

        AssignmentState state = resolveAssignmentState(user, currentAgent, availability, activeTickets);
        String reason = state.eligible()
            ? buildRecommendationReason(matchType, normalizedCategory, activeTickets, slaComplianceRate)
            : buildIneligibleReason(state, matchType, normalizedCategory, activeTickets, slaComplianceRate);

        return AgentRecommendationDTO.builder()
            .id(user.getId())
            .username(user.getUsername())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .activeTickets(activeTickets)
            .slaComplianceRate(round(slaComplianceRate))
            .expertiseScore(round(expertiseScore))
            .recommendationScore(round(recommendationScore))
            .recommendationReason(reason)
            .normalizedCategory(normalizedCategory.getCode())
            .skillMatchType(matchType)
            .primarySkillMatch(matchType == SkillMatchType.PRIMARY)
            .secondarySkillMatch(matchType == SkillMatchType.SECONDARY)
            .primarySkillCode(user.getPrimarySkill() != null ? user.getPrimarySkill().getCategory().getCode() : null)
            .secondarySkillCode(user.getSecondarySkill() != null ? user.getSecondarySkill().getCategory().getCode() : null)
            .assignmentEligible(state.eligible())
            .assignmentStatus(state.code())
            .assignmentStatusLabel(state.label())
            .build();
    }

    private Comparator<RecommendationCandidate> recommendationComparator() {
        return Comparator
            .comparingInt((RecommendationCandidate candidate) -> tierRank(candidate.matchType()))
            .thenComparing((RecommendationCandidate candidate) -> -candidate.score())
            .thenComparingLong(RecommendationCandidate::activeTickets)
            .thenComparing(candidate -> candidate.agent().getFullName());
    }

    private Comparator<AgentRecommendationDTO> assignmentCandidateComparator() {
        return Comparator
            .comparing((AgentRecommendationDTO candidate) -> !Boolean.TRUE.equals(candidate.getAssignmentEligible()))
            .thenComparingInt(candidate -> tierRank(candidate.getSkillMatchType() != null ? candidate.getSkillMatchType() : SkillMatchType.FALLBACK))
            .thenComparing(AgentRecommendationDTO::getRecommendationScore, Comparator.reverseOrder())
            .thenComparingLong(AgentRecommendationDTO::getActiveTickets)
            .thenComparing(candidate -> candidate.getFullName() != null ? candidate.getFullName() : candidate.getUsername());
    }

    private boolean canReassign(RecommendationCandidate bestCandidate, RecommendationCandidate currentCandidate, User currentAgent) {
        if (bestCandidate == null || bestCandidate.unavailable()) {
            return false;
        }
        if (currentAgent == null) {
            return true;
        }
        if (currentAgent.getId().equals(bestCandidate.agent().getId())) {
            return false;
        }
        if (currentCandidate == null || currentCandidate.unavailable()) {
            return true;
        }
        return bestCandidate.score() >= currentCandidate.score() + REASSIGNMENT_IMPROVEMENT_THRESHOLD;
    }

    private SkillMatchType resolveSkillMatch(User user, SupportCategory category) {
        if (user.getPrimarySkill() != null && user.getPrimarySkill().getCategory().getCode().equals(category.getCode())) {
            return SkillMatchType.PRIMARY;
        }
        if (user.getSecondarySkill() != null && user.getSecondarySkill().getCategory().getCode().equals(category.getCode())) {
            return SkillMatchType.SECONDARY;
        }
        if (user.isSupportManager()) {
            return SkillMatchType.MANAGER_FALLBACK;
        }
        return SkillMatchType.FALLBACK;
    }

    private double skillScore(SkillMatchType matchType) {
        return switch (matchType) {
            case PRIMARY -> 100.0;
            case SECONDARY -> 70.0;
            case MANAGER_FALLBACK -> 35.0;
            case FALLBACK -> 20.0;
        };
    }

    private int tierRank(SkillMatchType matchType) {
        return switch (matchType) {
            case PRIMARY -> 0;
            case SECONDARY -> 1;
            case FALLBACK -> 2;
            case MANAGER_FALLBACK -> 3;
        };
    }

    private double categoryExperienceScore(User user, SupportCategory category) {
        if (category == null) {
            return 0.0;
        }
        long categoryCount = ticketRepository.countByAssignedAgentAndNormalizedCategory(user.getId(), category.getCode());
        return Math.min(100.0, categoryCount * 20.0);
    }

    private SupportCategory resolveCandidateCategory(Ticket ticket) {
        return ticket.getNormalizedCategory() != null
            ? ticket.getNormalizedCategory()
            : resolveNormalizedCategory(
                ticket.getCategory(),
                ticket.getType() != null ? ticket.getType().name() : null,
                ticket.getTitle(),
                ticket.getDescription());
    }

    private long countActiveTickets(User user) {
        return ticketRepository.countByAssignedAgentIdAndStatusIn(user.getId(), ACTIVE_STATUSES);
    }

    private double computeSlaComplianceRate(User user, long activeTickets) {
        long breachedTickets = ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(user.getId(), ACTIVE_STATUSES);
        return activeTickets == 0
            ? 100.0
            : ((double) (activeTickets - breachedTickets) / activeTickets) * 100.0;
    }

    private double computeRecommendationScore(SkillMatchType matchType, long activeTickets, double slaComplianceRate) {
        double skillScore = skillScore(matchType);
        double availabilityScore = 100.0 / (1.0 + activeTickets);
        return (skillScore * 0.60) + (availabilityScore * 0.25) + (slaComplianceRate * 0.15);
    }

    private String buildRecommendationReason(SkillMatchType matchType, SupportCategory category, long activeTickets, double slaComplianceRate) {
        String matchLabel = switch (matchType) {
            case PRIMARY -> "Match competence principale";
            case SECONDARY -> "Match competence secondaire";
            case MANAGER_FALLBACK -> "Fallback manager";
            case FALLBACK -> "Fallback charge/SLA";
        };
        SupportCategory safeCategory = category != null ? category : defaultCategory();
        return matchLabel + " sur " + safeCategory.getLabel()
            + " · Charge " + activeTickets
            + " · SLA " + Math.round(slaComplianceRate) + "%";
    }

    private AssignmentState resolveAssignmentState(User user, User currentAgent, AgentAvailability availability, long activeTickets) {
        if (currentAgent != null && currentAgent.getId().equals(user.getId())) {
            return new AssignmentState(false, "CURRENTLY_ASSIGNED", "Deja assigne");
        }
        if (availability != null && availability.getStatus() != AgentStatus.AVAILABLE) {
            return switch (availability.getStatus()) {
                case BUSY -> new AssignmentState(false, "BUSY", "Occupe");
                case ON_BREAK -> new AssignmentState(false, "ON_BREAK", "En pause");
                case OFFLINE -> new AssignmentState(false, "OFFLINE", "Hors ligne");
                case AVAILABLE -> new AssignmentState(true, "AVAILABLE", "Disponible");
            };
        }
        if (!isAgentInShift(user)) {
            return new AssignmentState(false, "OUT_OF_SHIFT", "Hors service");
        }
        if (availability != null
            && availability.getMaxConcurrentTickets() != null
            && activeTickets >= availability.getMaxConcurrentTickets()) {
            return new AssignmentState(false, "CAPACITY_REACHED", "Capacite atteinte");
        }
        return new AssignmentState(true, "AVAILABLE", "Disponible");
    }

    private String buildIneligibleReason(AssignmentState state, SkillMatchType matchType, SupportCategory category,
                                         long activeTickets, double slaComplianceRate) {
        return state.label() + " · " + buildRecommendationReason(matchType, category, activeTickets, slaComplianceRate);
    }

    private double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private void normalizeTicketCategory(Ticket ticket) {
        if (ticket == null) {
            return;
        }
        if (supportCategoryService == null) {
            if (ticket.getNormalizedCategory() == null) {
                ticket.setNormalizedCategory(defaultCategory());
            }
            return;
        }
        supportCategoryService.normalizeTicketCategory(ticket);
        if (ticket.getId() != null && ticket.getNormalizedCategory() != null) {
            ticketRepository.save(ticket);
        }
    }

    private SupportCategory resolveNormalizedCategory(String category, String type, String title, String description) {
        if (supportCategoryService == null) {
            return defaultCategory();
        }
        return supportCategoryService.resolveNormalizedCategory(category, type, title, description);
    }

    private SupportCategory defaultCategory() {
        return SupportCategory.builder()
            .code("GENERAL")
            .label("General")
            .description("Categorie de secours")
            .isActive(true)
            .sortOrder(999)
            .build();
    }

    private EscalationPolicy resolvePolicy(Ticket ticket) {
        Long clientId = ticket.getClient() != null ? ticket.getClient().getId() : null;
        return policyRepository.findPolicyForClient(clientId);
    }

    private int getLevel2Delay(EscalationPolicy policy) {
        return policy != null && policy.getLevel2Threshold() != null
            ? policy.getLevel2Threshold()
            : defaultLevel2DelayMinutes;
    }

    private int getLevel3Delay(EscalationPolicy policy) {
        return policy != null && policy.getLevel3DelayMinutes() != null
            ? policy.getLevel3DelayMinutes()
            : defaultLevel3DelayMinutes;
    }

    private int getStuckMinutes(EscalationPolicy policy) {
        return policy != null && policy.getStuckAssignedMinutes() != null
            ? policy.getStuckAssignedMinutes()
            : defaultStuckAssignedMinutes;
    }

    private int getCooldown(EscalationPolicy policy) {
        return policy != null && policy.getCooldownMinutes() != null
            ? policy.getCooldownMinutes()
            : defaultCooldownMinutes;
    }

    private int getMaxEscalations(EscalationPolicy policy) {
        return policy != null && policy.getMaxEscalations() != null
            ? policy.getMaxEscalations()
            : defaultMaxEscalations;
    }

    private boolean isAutoReassignEnabled(EscalationPolicy policy) {
        return policy == null || !Boolean.FALSE.equals(policy.getAutoReassignEnabled());
    }

    private boolean readyForLevel2(Ticket ticket, EscalationPolicy policy, LocalDateTime now) {
        if (currentLevel(ticket) == 0) {
            return true;
        }
        return ticket.getLastEscalationAt() == null
            || !ticket.getLastEscalationAt().plusMinutes(getLevel2Delay(policy)).isAfter(now);
    }

    private boolean readyForLevel3(Ticket ticket, EscalationPolicy policy, LocalDateTime now) {
        return currentLevel(ticket) >= 2
            && (ticket.getLastEscalationAt() == null
                || !ticket.getLastEscalationAt().plusMinutes(getLevel3Delay(policy)).isAfter(now));
    }

    private boolean checkGuards(Ticket ticket, EscalationPolicy policy, int targetLevel,
                                EscalationReason reason, EscalationTrigger trigger) {
        if (ticket.getEscalationHoldUntil() != null && ticket.getEscalationHoldUntil().isAfter(LocalDateTime.now())) {
            recordEvent(ticket, currentLevel(ticket), targetLevel, EscalationReason.HOLD_ACTIVE, trigger,
                ticket.getAssignedAgent(), null,
                "Bloque par hold jusqu'a " + ticket.getEscalationHoldUntil(), true);
            return false;
        }
        if (isCooldownActive(ticket, policy)) {
            recordEvent(ticket, currentLevel(ticket), targetLevel, reason, trigger,
                ticket.getAssignedAgent(), null,
                "Bloque par cooldown (" + getCooldown(policy) + "min)", true);
            return false;
        }
        if (isFatigueBlocked(ticket, policy)) {
            if (!Boolean.TRUE.equals(ticket.getEscalationBlocked())) {
                ticket.setEscalationBlocked(true);
                ticketRepository.save(ticket);
            }
            recordEvent(ticket, currentLevel(ticket), targetLevel, EscalationReason.FATIGUE_BLOCKED, trigger,
                ticket.getAssignedAgent(), null,
                "Blocage fatigue: max " + getMaxEscalations(policy) + " escalades atteint", true);
            return false;
        }
        return true;
    }

    private boolean isCooldownActive(Ticket ticket, EscalationPolicy policy) {
        if (ticket.getLastEscalationAt() == null) {
            return false;
        }
        return ticket.getLastEscalationAt().plusMinutes(getCooldown(policy)).isAfter(LocalDateTime.now());
    }

    private boolean isFatigueBlocked(Ticket ticket, EscalationPolicy policy) {
        return safeEscalationCount(ticket) >= getMaxEscalations(policy);
    }

    private boolean isAgentAvailable(User agent) {
        return availabilityRepository.findByAgentId(agent.getId())
            .map(availability -> availability.getStatus() == AgentStatus.AVAILABLE)
            .orElse(true);
    }

    private boolean isAgentInShift(User agent) {
        LocalDateTime now = LocalDateTime.now();
        DayOfWeek today = now.getDayOfWeek();
        LocalTime currentTime = now.toLocalTime();

        List<AgentShift> shifts = shiftRepository.findByAgentIdAndDayOfWeek(agent.getId(), today);
        if (shifts.isEmpty()) {
            return true;
        }

        return shifts.stream().anyMatch(shift ->
            (!currentTime.isBefore(shift.getStartTime()) && !currentTime.isAfter(shift.getEndTime()))
                || Boolean.TRUE.equals(shift.getIsOnCall()));
    }

    private User findAvailableManager() {
        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        User manager = managers.stream()
            .filter(this::isAgentAvailable)
            .filter(this::isAgentInShift)
            .min(Comparator.comparingLong(candidate ->
                ticketRepository.countByAssignedAgentIdAndStatusIn(candidate.getId(), ACTIVE_STATUSES)))
            .orElse(null);
        if (manager != null) {
            return manager;
        }

        List<User> admins = userRepository.findByRoleAndIsActiveTrue(Role.ADMIN);
        return admins.stream()
            .min(Comparator.comparingLong(candidate ->
                ticketRepository.countByAssignedAgentIdAndStatusIn(candidate.getId(), ACTIVE_STATUSES)))
            .orElse(null);
    }

    private void adjustSlaAfterEscalation(Ticket ticket) {
        if (ticket.getSlaDeadline() == null) {
            return;
        }
        long remainingMinutes = java.time.Duration.between(LocalDateTime.now(), ticket.getSlaDeadline()).toMinutes();
        if (remainingMinutes <= 0) {
            return;
        }
        int bonusMinutes = Math.max(1, (int) Math.round(remainingMinutes * 0.15));
        ticket.setSlaDeadline(ticket.getSlaDeadline().plusMinutes(bonusMinutes));
        ticket.setSlaAdjustedMinutes((ticket.getSlaAdjustedMinutes() != null ? ticket.getSlaAdjustedMinutes() : 0) + bonusMinutes);
    }

    private int adjustStuckMinutesBySeverity(int baseMinutes, Ticket ticket) {
        if (ticket.getSeverity() == null) {
            return baseMinutes;
        }
        return switch (ticket.getSeverity()) {
            case SUPER_CRITICAL -> Math.max(2, (int) (baseMinutes * 0.25));
            case CRITICAL -> Math.max(3, (int) (baseMinutes * 0.50));
            case HIGH -> Math.max(5, (int) (baseMinutes * 0.75));
            default -> baseMinutes;
        };
    }

    private void recordEvent(Ticket ticket, int fromLevel, int toLevel, EscalationReason reason,
                             EscalationTrigger trigger, User fromAgent, User toAgent,
                             String description, boolean wasBlocked) {
        EscalationEvent event = EscalationEvent.builder()
            .ticket(ticket)
            .fromLevel(fromLevel)
            .toLevel(toLevel)
            .reason(reason)
            .triggeredBy(trigger)
            .fromAgent(fromAgent)
            .toAgent(toAgent)
            .description(description)
            .slaPercentAtEscalation(ticket.getSlaConsumedPercent())
            .wasBlocked(wasBlocked)
            .build();
        eventRepository.save(event);
    }

    private EscalationEventDTO toEventDTO(EscalationEvent event) {
        return EscalationEventDTO.builder()
            .id(event.getId())
            .ticketId(event.getTicket().getId())
            .ticketReference(event.getTicket().getReference())
            .fromLevel(event.getFromLevel())
            .toLevel(event.getToLevel())
            .reason(event.getReason())
            .triggeredBy(event.getTriggeredBy())
            .fromAgentName(event.getFromAgent() != null ? event.getFromAgent().getFullName() : null)
            .toAgentName(event.getToAgent() != null ? event.getToAgent().getFullName() : null)
            .description(event.getDescription())
            .slaPercentAtEscalation(event.getSlaPercentAtEscalation())
            .wasBlocked(event.getWasBlocked())
            .createdAt(event.getCreatedAt())
            .build();
    }

    private Ticket findTicket(Long ticketId) {
        return ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
    }

    private boolean isTerminal(Ticket ticket) {
        TicketStatus status = ticket.getStatus();
        return status == TicketStatus.CLOSED
            || status == TicketStatus.CANCELLED
            || status == TicketStatus.RESOLVED;
    }

    private void recordHistory(Ticket ticket, String action, String oldValue, String newValue, String description) {
        TicketHistory history = new TicketHistory();
        history.setTicket(ticket);
        history.setAction(action);
        history.setOldValue(oldValue);
        history.setNewValue(newValue);
        history.setDescription(description);
        history.setPerformedBy("System");
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);
    }

    private int currentLevel(Ticket ticket) {
        return ticket.getEscalationLevel() != null ? ticket.getEscalationLevel() : 0;
    }

    private int safeEscalationCount(Ticket ticket) {
        return ticket.getEscalationCount() != null ? ticket.getEscalationCount() : 0;
    }

    private int nextEscalationCount(Ticket ticket) {
        return safeEscalationCount(ticket) + 1;
    }

    private record RecommendationCandidate(
        User agent,
        AgentRecommendationDTO recommendation,
        SkillMatchType matchType,
        double score,
        long activeTickets,
        boolean unavailable
    ) {
        private RecommendationCandidate(User agent, AgentRecommendationDTO recommendation,
                                        SkillMatchType matchType, double score, long activeTickets) {
            this(agent, recommendation, matchType, score, activeTickets, false);
        }

        private static RecommendationCandidate unavailable(User agent, SupportCategory category) {
            AgentRecommendationDTO recommendation = AgentRecommendationDTO.builder()
                .id(agent.getId())
                .username(agent.getUsername())
                .firstName(agent.getFirstName())
                .lastName(agent.getLastName())
                .email(agent.getEmail())
                .fullName(agent.getFullName())
                .normalizedCategory(category != null ? category.getCode() : "GENERAL")
                .skillMatchType(agent.isSupportManager() ? SkillMatchType.MANAGER_FALLBACK : SkillMatchType.FALLBACK)
                .recommendationReason("Agent sature pour cette capacite")
                .build();
            return new RecommendationCandidate(agent, recommendation, recommendation.getSkillMatchType(), -1, Long.MAX_VALUE, true);
        }
    }

    private record AssignmentState(boolean eligible, String code, String label) {}
}
