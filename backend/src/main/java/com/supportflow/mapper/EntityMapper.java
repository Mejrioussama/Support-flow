package com.supportflow.mapper;

import com.supportflow.dto.*;
import com.supportflow.entity.*;
import com.supportflow.service.SlaComputationService;
import org.mapstruct.*;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Mapper MapStruct pour la conversion Entity <-> DTO
 */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public abstract class EntityMapper {

    @Autowired
    protected SlaComputationService slaComputationService;
    
    // User mappings
    @Mapping(target = "fullName", expression = "java(user.getFullName())")
    @Mapping(target = "primarySkillCode", expression = "java(getSkillCode(user, com.supportflow.entity.enums.AgentSkillType.PRIMARY))")
    @Mapping(target = "primarySkillLabel", expression = "java(getSkillLabel(user, com.supportflow.entity.enums.AgentSkillType.PRIMARY))")
    public abstract UserSummaryDTO toUserSummaryDTO(User user);
    
    @Mapping(target = "clientId", source = "client.id")
    @Mapping(target = "clientName", source = "client.companyName")
    @Mapping(target = "assignedTicketsCount", expression = "java(user.getAssignedTickets().size())")
    @Mapping(target = "primarySkillCode", expression = "java(getSkillCode(user, com.supportflow.entity.enums.AgentSkillType.PRIMARY))")
    @Mapping(target = "primarySkillLabel", expression = "java(getSkillLabel(user, com.supportflow.entity.enums.AgentSkillType.PRIMARY))")
    @Mapping(target = "secondarySkillCode", expression = "java(getSkillCode(user, com.supportflow.entity.enums.AgentSkillType.SECONDARY))")
    @Mapping(target = "secondarySkillLabel", expression = "java(getSkillLabel(user, com.supportflow.entity.enums.AgentSkillType.SECONDARY))")
    @Mapping(target = "skills", expression = "java(toAgentSkillDTOList(user.getAgentSkills().stream().toList()))")
    public abstract UserDTO toUserDTO(User user);
    
    public abstract List<UserDTO> toUserDTOList(List<User> users);
    
    // Client mappings
    public abstract ClientSummaryDTO toClientSummaryDTO(Client client);
    
    @Mapping(target = "usersCount", expression = "java(client.getUsers().size())")
    @Mapping(target = "activeTicketsCount", expression = "java(client.getActiveTicketsCount())")
    @Mapping(target = "totalTicketsCount", expression = "java(client.getTickets().size())")
    public abstract ClientDTO toClientDTO(Client client);
    
    public abstract List<ClientDTO> toClientDTOList(List<Client> clients);
    
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "users", ignore = true)
    @Mapping(target = "tickets", ignore = true)
    public abstract Client toClient(ClientDTO dto);
    
    // Ticket mappings
    @Mapping(target = "client", source = "client")
    @Mapping(target = "createdByUser", source = "createdByUser")
    @Mapping(target = "assignedAgent", source = "assignedAgent")
    @Mapping(target = "formattedResolutionTime", expression = "java(ticket.getFormattedResolutionTime())")
    @Mapping(target = "commentsCount", expression = "java(ticket.getComments().size())")
    @Mapping(target = "attachmentsCount", expression = "java(ticket.getAttachments().size())")
    @Mapping(target = "slaBreached", expression = "java(slaComputationService.isBreached(ticket))")
    @Mapping(target = "slaState", expression = "java(resolveSlaState(ticket))")
    @Mapping(target = "slaActionRequired", expression = "java(resolveSlaActionRequired(ticket))")
    @Mapping(target = "slaRemainingTime", expression = "java(slaComputationService.formatRemainingTime(ticket))")
    @Mapping(target = "slaConsumedPercent", expression = "java(slaComputationService.calculateConsumedPercent(ticket))")
    @Mapping(target = "slaPhase", expression = "java(slaComputationService.computePhase(ticket))")
    @Mapping(target = "slaCalendarLabel", expression = "java(slaComputationService.resolveCalendarLabel(ticket))")
    @Mapping(target = "slaOperationalStatus", expression = "java(slaComputationService.resolveOperationalStatus(ticket))")
    @Mapping(target = "archived", expression = "java(isArchived(ticket))")
    @Mapping(target = "archiveReference", source = "alfrescoFolderId")
    @Mapping(target = "previousAgentName", expression = "java(ticket.getPreviousAgent() != null ? ticket.getPreviousAgent().getFullName() : null)")
    @Mapping(target = "normalizedCategory", expression = "java(ticket.getNormalizedCategory() != null ? ticket.getNormalizedCategory().getCode() : null)")
    @Mapping(target = "legacyEscalated", expression = "java(ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.ESCALATED_SLA)")
    @Mapping(target = "resolutionDetails", expression = "java(toResolutionDetailsDTO(ticket))")
    @Mapping(target = "nextExpectedAction", expression = "java(resolveNextExpectedAction(ticket))")
    public abstract TicketResponseDTO toTicketResponseDTO(Ticket ticket);
    
    public abstract List<TicketResponseDTO> toTicketResponseDTOList(List<Ticket> tickets);
    
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "reference", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "priority", ignore = true)
    @Mapping(target = "score", ignore = true)
    @Mapping(target = "client", ignore = true)
    @Mapping(target = "createdByUser", ignore = true)
    @Mapping(target = "assignedAgent", ignore = true)
    @Mapping(target = "comments", ignore = true)
    @Mapping(target = "attachments", ignore = true)
    @Mapping(target = "history", ignore = true)
    public abstract Ticket toTicket(TicketCreateDTO dto);
    
    // Comment mappings
    @Mapping(target = "ticketId", source = "ticket.id")
    @Mapping(target = "parentId", source = "parent.id")
    public abstract CommentDTO toCommentDTO(Comment comment);
    
    public abstract List<CommentDTO> toCommentDTOList(List<Comment> comments);
    
    // Attachment mappings
    @Mapping(target = "ticketId", source = "ticket.id")
    @Mapping(target = "formattedFileSize", expression = "java(attachment.getFormattedFileSize())")
    @Mapping(target = "downloadUrl", expression = "java(\"/api/attachments/\" + attachment.getId() + \"/download\")")
    public abstract AttachmentDTO toAttachmentDTO(Attachment attachment);
    
    public abstract List<AttachmentDTO> toAttachmentDTOList(List<Attachment> attachments);
    
    // Notification mappings
    @Mapping(target = "ticketId", source = "ticket.id")
    public abstract NotificationDTO toNotificationDTO(Notification notification);
    
    public abstract List<NotificationDTO> toNotificationDTOList(List<Notification> notifications);

    // Ticket history mappings
    @Mapping(target = "ticketId", source = "ticket.id")
    @Mapping(target = "userId", source = "user.id")
    public abstract TicketHistoryDTO toTicketHistoryDTO(TicketHistory history);

    public abstract List<TicketHistoryDTO> toTicketHistoryDTOList(List<TicketHistory> history);

    public TicketResolutionDetailsDTO toResolutionDetailsDTO(Ticket ticket) {
        if (ticket == null) {
            return null;
        }
        if ((ticket.getResolutionDiagnostic() == null || ticket.getResolutionDiagnostic().isBlank())
            && (ticket.getResolutionRootCause() == null || ticket.getResolutionRootCause().isBlank())
            && (ticket.getResolutionActionsTaken() == null || ticket.getResolutionActionsTaken().isBlank())
            && (ticket.getResolutionNextRecommendation() == null || ticket.getResolutionNextRecommendation().isBlank())) {
            return null;
        }

        return TicketResolutionDetailsDTO.builder()
            .diagnostic(ticket.getResolutionDiagnostic())
            .rootCause(ticket.getResolutionRootCause())
            .actionsTaken(ticket.getResolutionActionsTaken())
            .nextRecommendation(ticket.getResolutionNextRecommendation())
            .build();
    }

    @Mapping(target = "agentId", source = "agent.id")
    @Mapping(target = "categoryCode", source = "category.code")
    @Mapping(target = "categoryLabel", source = "category.label")
    public abstract AgentSkillDTO toAgentSkillDTO(AgentSkill skill);

    public abstract List<AgentSkillDTO> toAgentSkillDTOList(List<AgentSkill> skills);

    public boolean isTerminal(com.supportflow.entity.enums.TicketStatus status) {
        return status == com.supportflow.entity.enums.TicketStatus.CLOSED
            || status == com.supportflow.entity.enums.TicketStatus.CANCELLED
            || status == com.supportflow.entity.enums.TicketStatus.RESOLVED;
    }

    public String resolveSlaState(Ticket ticket) {
        if (ticket.getSlaDeadline() == null) {
            return "UNKNOWN";
        }
        return slaComputationService.resolveSlaState(ticket);
    }

    public Boolean resolveSlaActionRequired(Ticket ticket) {
        boolean warning = Boolean.TRUE.equals(ticket.getSlaWarningSent());
        boolean breached = slaComputationService.isBreached(ticket);
        return (warning || breached) && !isTerminal(ticket.getStatus());
    }

    public Boolean isArchived(Ticket ticket) {
        return ticket.getAlfrescoFolderId() != null && !ticket.getAlfrescoFolderId().isBlank();
    }

    public String formatSlaRemaining(Ticket ticket) {
        LocalDateTime now = LocalDateTime.now();
        if (ticket.getSlaDeadline() == null) {
            return "N/A";
        }
        LocalDateTime deadline = ticket.getSlaDeadline();
        if (!deadline.isAfter(now)) {
            return "00:00";
        }
        long minutes = Duration.between(now, deadline).toMinutes();
        long hours = minutes / 60;
        long mins = minutes % 60;
        return String.format("%02d:%02d", hours, mins);
    }

    public String getSkillCode(User user, com.supportflow.entity.enums.AgentSkillType type) {
        if (user == null || user.getAgentSkills() == null) {
            return null;
        }
        return user.getAgentSkills().stream()
            .filter(skill -> skill.getSkillType() == type)
            .map(skill -> skill.getCategory().getCode())
            .findFirst()
            .orElse(null);
    }

    public String getSkillLabel(User user, com.supportflow.entity.enums.AgentSkillType type) {
        if (user == null || user.getAgentSkills() == null) {
            return null;
        }
        return user.getAgentSkills().stream()
            .filter(skill -> skill.getSkillType() == type)
            .map(skill -> skill.getCategory().getLabel())
            .findFirst()
            .orElse(null);
    }

    public String resolveNextExpectedAction(Ticket ticket) {
        if (ticket == null) {
            return null;
        }
        if (ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.RESOLVED) {
            return "Validation client attendue";
        }
        if (ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.PENDING) {
            if (ticket.getWaitingOn() != null) {
                return switch (ticket.getWaitingOn()) {
                    case CLIENT -> "Attendre un retour client";
                    case THIRD_PARTY -> "Attendre le tiers/fournisseur";
                    case MANAGER -> "Attendre un arbitrage manager";
                    case AGENT -> "Attendre une reprise agent";
                };
            }
            return "Ticket en attente";
        }
        if (ticket.getLastCustomerResponseAt() != null
            && ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.IN_PROGRESS) {
            return "Traiter la reponse client";
        }
        if (ticket.getResolutionRejectedReason() != null && !ticket.getResolutionRejectedReason().isBlank()) {
            return "Reprendre la resolution apres refus";
        }
        if (ticket.getManagerReviewReason() != null && !ticket.getManagerReviewReason().isBlank()) {
            return "Manager review demandee";
        }
        if (ticket.getAssignedAgent() == null
            && ticket.getStatus() != com.supportflow.entity.enums.TicketStatus.CLOSED
            && ticket.getStatus() != com.supportflow.entity.enums.TicketStatus.CANCELLED
            && ticket.getStatus() != com.supportflow.entity.enums.TicketStatus.RESOLVED) {
            return "Assigner un proprietaire";
        }
        if (ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.ASSIGNED) {
            return "Prendre en charge le ticket";
        }
        if (ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.IN_PROGRESS) {
            return "Poursuivre le traitement";
        }
        if (ticket.getStatus() == com.supportflow.entity.enums.TicketStatus.CLOSED) {
            return "Ticket clos";
        }
        return "Suivi manager";
    }
}
