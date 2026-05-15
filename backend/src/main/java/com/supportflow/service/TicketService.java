package com.supportflow.service;

import com.supportflow.dto.AgentRecommendationDTO;
import com.supportflow.dto.AgentWorkbenchDTO;
import com.supportflow.dto.TicketArchiveDocumentDTO;
import com.supportflow.dto.TicketCreateDTO;
import com.supportflow.dto.TicketHistoryDTO;
import com.supportflow.dto.TicketResolveRequestDTO;
import com.supportflow.dto.TicketResponseDTO;
import com.supportflow.dto.TicketUpdateDTO;
import com.supportflow.entity.Client;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.TicketHistory;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Priority;
import com.supportflow.entity.enums.Severity;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.entity.enums.WaitingOn;
import com.supportflow.exception.ArchiveIntegrationException;
import com.supportflow.exception.BusinessException;
import com.supportflow.exception.ResourceNotFoundException;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.ClientRepository;
import com.supportflow.repository.TicketHistoryRepository;
import com.supportflow.repository.TicketRepository;
import com.supportflow.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.LinkedHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional
public class TicketService {
   private static final Logger log = LoggerFactory.getLogger(TicketService.class);
   private final TicketRepository ticketRepository;
   private final ClientRepository clientRepository;
   private final UserRepository userRepository;
   private final TicketHistoryRepository historyRepository;
   private final EntityMapper mapper;
   private final NotificationService notificationService;
   private final CamundaAsyncService camundaAsyncService;
   private final KeycloakAdminService keycloakAdminService;
   private final ReportService reportService;
   private final SlaComputationService slaComputationService;
   @Autowired(required = false)
   private BusinessHoursService businessHoursService;
   @Autowired(
      required = false
   )
   private CamundaService camundaService;
   @Autowired
   private EscalationService escalationService;
   @Autowired
   private SupportCategoryService supportCategoryService;
   @Autowired(required = false)
   private AlfrescoCmisService alfrescoCmisService;
   @Value("${supportflow.sla.super-critical-minutes:2}")
   private int slaSuperCriticalMinutes;
   @Value("${supportflow.sla.critical-hours:4}")
   private int slaCriticalHours;
   @Value("${supportflow.sla.high-hours:8}")
   private int slaHighHours;
   @Value("${supportflow.sla.medium-hours:24}")
   private int slaMediumHours;
   @Value("${supportflow.sla.low-hours:72}")
   private int slaLowHours;

   @Autowired
   public TicketService(TicketRepository ticketRepository, ClientRepository clientRepository, UserRepository userRepository, TicketHistoryRepository historyRepository, EntityMapper mapper, NotificationService notificationService, CamundaAsyncService camundaAsyncService, KeycloakAdminService keycloakAdminService, ReportService reportService, SlaComputationService slaComputationService) {
      this.ticketRepository = ticketRepository;
      this.clientRepository = clientRepository;
      this.userRepository = userRepository;
      this.historyRepository = historyRepository;
      this.mapper = mapper;
      this.notificationService = notificationService;
      this.camundaAsyncService = camundaAsyncService;
      this.keycloakAdminService = keycloakAdminService;
      this.reportService = reportService;
      this.slaComputationService = slaComputationService;
   }

   public TicketResponseDTO createTicket(TicketCreateDTO dto, Long userId) {
      log.info("CrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ation d'un nouveau ticket: {}", dto.getTitle());
      if (dto.getClientId() == null) {
         throw new ResourceNotFoundException("Client ID requis pour crÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©er un ticket");
      } else {
         Client client = (Client)this.clientRepository.findById(dto.getClientId()).orElseThrow(() -> new ResourceNotFoundException("Client non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + dto.getClientId()));
         User creator = userId != null ? (User)this.userRepository.findById(userId).orElse(null) : null;
         Ticket ticket = this.mapper.toTicket(dto);
         ticket.setReference(this.generateReference());
         ticket.setClient(client);
         ticket.setCreatedByUser(creator);
         ticket.setStatus(TicketStatus.NEW);
         ticket.setCreatedAt(LocalDateTime.now());
         int slaMinutes = this.slaComputationService.resolveSlaMinutes(dto.getSeverity(), client);
         this.slaComputationService.initializeSla(ticket, slaMinutes, ticket.getCreatedAt());
         this.supportCategoryService.normalizeTicketCategory(ticket);
         ticket.calculateScore();
         ticket = (Ticket)this.ticketRepository.save(ticket);
         TicketHistory history = TicketHistory.createCreation(ticket, creator);
         this.historyRepository.save(history);
         if (false && this.camundaService != null) {
            try {
               String processInstanceId = this.camundaService.startTicketProcess(ticket);
               ticket.setProcessInstanceId(processInstanceId);
               ticket = (Ticket)this.ticketRepository.save(ticket);
            } catch (Exception e) {
               log.warn("Impossible de dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©marrer le processus Camunda: {}", e.getMessage());
               this.recordCamundaSyncIssue(ticket, "CREATE", e.getMessage());
            }
         }

         this.scheduleTicketCreationSideEffects(ticket.getId());
         log.info("Ticket crÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© avec succÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨s: {}", ticket.getReference());
         return this.mapper.toTicketResponseDTO(ticket);
      }
   }

   public TicketResponseDTO updateTicket(Long ticketId, TicketUpdateDTO dto, Long userId) {
      log.info("Mise ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  jour du ticket: {}", ticketId);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      User user = userId != null ? (User)this.userRepository.findById(userId).orElse(null) : null;
      TicketStatus oldStatus = ticket.getStatus();
      if (dto.getTitle() != null) {
         ticket.setTitle(dto.getTitle());
      }

      if (dto.getDescription() != null) {
         ticket.setDescription(dto.getDescription());
      }

      if (dto.getType() != null) {
         ticket.setType(dto.getType());
      }

      if (dto.getSeverity() != null) {
         ticket.setSeverity(dto.getSeverity());
      }

      if (dto.getImpact() != null) {
         ticket.setImpact(dto.getImpact());
      }

      if (dto.getCategory() != null) {
         ticket.setCategory(dto.getCategory());
      }

      if (dto.getTags() != null) {
         ticket.setTags(dto.getTags());
      }

      if (dto.getResolutionSummary() != null) {
         ticket.setResolutionSummary(dto.getResolutionSummary());
      }

      if (dto.getResolutionDetails() != null) {
         ticket.setResolutionDiagnostic(dto.getResolutionDetails().getDiagnostic());
         ticket.setResolutionRootCause(dto.getResolutionDetails().getRootCause());
         ticket.setResolutionActionsTaken(dto.getResolutionDetails().getActionsTaken());
         ticket.setResolutionNextRecommendation(dto.getResolutionDetails().getNextRecommendation());
      }

      if (dto.getWaitingOn() != null) {
         ticket.setWaitingOn(dto.getWaitingOn());
      }

      if (dto.getPendingReason() != null) {
         ticket.setPendingReason(dto.getPendingReason());
      }

      if (dto.getSlaPauseReason() != null) {
         ticket.setSlaPauseReason(dto.getSlaPauseReason());
      }

      if (dto.getManagerReviewReason() != null) {
         ticket.setManagerReviewReason(dto.getManagerReviewReason());
      }

      if (dto.getResolutionRejectedReason() != null) {
         ticket.setResolutionRejectedReason(dto.getResolutionRejectedReason());
      }

      if (dto.getStatus() != null && dto.getStatus() != oldStatus) {
         this.updateTicketStatus(ticket, dto.getStatus(), user);
      }

      if (dto.getAssignedAgentId() != null) {
         this.assignTicket(ticket, dto.getAssignedAgentId(), user);
      }

      if (dto.getSatisfactionRating() != null) {
         ticket.setSatisfactionRating(dto.getSatisfactionRating());
         ticket.setSatisfactionComment(dto.getSatisfactionComment());
      }

      this.supportCategoryService.normalizeTicketCategory(ticket);
      ticket.calculateScore();
      ticket = (Ticket)this.ticketRepository.save(ticket);
      log.info("Ticket mis ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  jour: {}", ticket.getReference());
      return this.mapper.toTicketResponseDTO(ticket);
   }

   public TicketResponseDTO assignTicket(Long ticketId, Long agentId, Long performedByUserId) {
      return this.assignTicket(ticketId, agentId, performedByUserId, (String)null);
   }

   public TicketResponseDTO assignTicket(Long ticketId, Long agentId, Long performedByUserId, String source) {
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      User performedBy = performedByUserId != null ? (User)this.userRepository.findById(performedByUserId).orElse(null) : null;
      this.assignTicket(ticket, agentId, performedBy, source);
      ticket = (Ticket)this.ticketRepository.save(ticket);
      return this.mapper.toTicketResponseDTO(ticket);
   }

   private void assignTicket(Ticket ticket, Long agentId, User performedBy) {
      this.assignTicket(ticket, agentId, performedBy, (String)null);
   }

   private void assignTicket(Ticket ticket, Long agentId, User performedBy, String source) {
      User agent = (User)this.userRepository.findById(agentId).orElseThrow(() -> new ResourceNotFoundException("Agent non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + agentId));
      if (!agent.isSupportAgent() && !agent.isSupportManager()) {
         throw new BusinessException("L'utilisateur n'est pas un agent support");
      } else if (ticket.getStatus() == TicketStatus.RESOLVED || ticket.getStatus() == TicketStatus.CLOSED || ticket.getStatus() == TicketStatus.CANCELLED) {
         throw new BusinessException("Impossible d'assigner un ticket deja finalise");
      } else {
         ticket.setAssignedAgent(agent);
         ticket.setAssignedAt(LocalDateTime.now());
         if (ticket.getStatus() == TicketStatus.OPEN || ticket.getStatus() == TicketStatus.NEW) {
            ticket.setStatus(TicketStatus.ASSIGNED);
         }

         TicketHistory history = TicketHistory.createAssignment(ticket, performedBy, agent, source);
         this.historyRepository.save(history);
         this.notificationService.notifyTicketAssigned(ticket, agent);
         if (this.camundaService != null) {
            try {
               this.completeAssignmentTaskWhenReady(ticket, "ASSIGN");
            } catch (Exception e) {
               log.warn("Impossible de complÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ter la tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢che Camunda: {}", e.getMessage());
               this.recordCamundaSyncIssue(ticket, "ASSIGN", e.getMessage());
            }
         }

      }
   }

   private void updateTicketStatus(Ticket ticket, TicketStatus newStatus, User user) {
      TicketStatus oldStatus = ticket.getStatus();
      ticket.setStatus(newStatus);
      switch (newStatus) {
         case IN_PROGRESS:
            break;
         case RESOLVED:
            ticket.setResolvedAt(LocalDateTime.now());
            ticket.calculateResolutionTime();
            ticket.setSlaBreached(this.slaComputationService.isBreached(ticket));
            this.notificationService.notifyTicketResolved(ticket);
            break;
         case CLOSED:
            ticket.setClosedAt(LocalDateTime.now());
            break;
         default:
            break;
      }

      TicketHistory history = TicketHistory.createStatusChange(ticket, user, oldStatus.name(), newStatus.name());
      this.historyRepository.save(history);
      this.notificationService.notifyStatusChanged(ticket, newStatus);
      this.notificationService.broadcastTicketStatusChange(ticket, oldStatus.name(), newStatus.name());
   }

   @Transactional(
      readOnly = true
   )
   public TicketResponseDTO getTicketById(Long id) {
      Ticket ticket = (Ticket)this.ticketRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + id));
      return this.mapper.toTicketResponseDTO(ticket);
   }

   @Transactional(
      readOnly = true
   )
   public TicketResponseDTO getTicketByReference(String reference) {
      Ticket ticket = (Ticket)this.ticketRepository.findByReference(reference).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + reference));
      return this.mapper.toTicketResponseDTO(ticket);
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getAllTickets(Pageable pageable) {
      Page<Ticket> page = this.ticketRepository.findAll(pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(readOnly = true)
   public Page<TicketResponseDTO> getManagerTickets(TicketStatus status, Priority priority, WaitingOn waitingOn,
                                                    String actionBucket, Boolean hasCustomerReply,
                                                    Boolean resolutionRejected, Boolean unassigned,
                                                    String slaState, Pageable pageable) {
      Specification<Ticket> specification = Specification.where(null);

      if (status != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("status"), status));
      }
      if (priority != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("priority"), priority));
      }
      if (waitingOn != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("waitingOn"), waitingOn));
      }
      if (Boolean.TRUE.equals(hasCustomerReply)) {
         specification = specification.and((root, query, cb) -> cb.isNotNull(root.get("lastCustomerResponseAt")));
      }
      if (Boolean.TRUE.equals(resolutionRejected)) {
         specification = specification.and((root, query, cb) -> cb.and(
            cb.isNotNull(root.get("resolutionRejectedReason")),
            cb.notEqual(root.get("resolutionRejectedReason"), "")
         ));
      }
      if (unassigned != null) {
         specification = specification.and((root, query, cb) -> unassigned
            ? cb.isNull(root.get("assignedAgent"))
            : cb.isNotNull(root.get("assignedAgent")));
      }
      if (slaState != null && !slaState.isBlank()) {
         specification = specification.and(buildSlaStateSpecification(slaState));
      }
      if (actionBucket != null && !actionBucket.isBlank()) {
         specification = specification.and(buildActionBucketSpecification(actionBucket));
      }

      Page<Ticket> page = this.ticketRepository.findAll(specification, pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByStatus(TicketStatus status, Pageable pageable) {
      Page<Ticket> page = this.ticketRepository.findByStatus(status, pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByClient(Long clientId, Pageable pageable) {
      return this.getTicketsByClient(clientId, (TicketStatus)null, pageable);
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByClient(Long clientId, TicketStatus status, Pageable pageable) {
      if (status != null) {
         Page<Ticket> page = this.ticketRepository.findByClientIdAndStatus(clientId, status, pageable);
         return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
      } else {
         Page<Ticket> page = this.ticketRepository.findByClientId(clientId, pageable);
         return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
      }
   }

   @Transactional(readOnly = true)
   public Page<TicketResponseDTO> getTicketsByClient(Long clientId, TicketStatus status, Priority priority,
                                                     WaitingOn waitingOn, Boolean hasCustomerReply,
                                                     Boolean resolutionRejected, String slaState,
                                                     String search, Pageable pageable) {
      Specification<Ticket> specification = buildOwnedTicketSpecification(clientId, null);
      specification = specification.and(buildSharedTicketFilters(status, priority, waitingOn,
         hasCustomerReply, resolutionRejected, slaState, search));
      Page<Ticket> page = this.ticketRepository.findAll(specification, pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByAgent(Long agentId, Pageable pageable) {
      return this.getTicketsByAgent(agentId, (TicketStatus)null, pageable);
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByAgent(Long agentId, TicketStatus status, Pageable pageable) {
      if (status != null) {
         Page<Ticket> page = this.ticketRepository.findByAssignedAgentIdAndStatus(agentId, status, pageable);
         return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
      } else {
         Page<Ticket> page = this.ticketRepository.findByAssignedAgentId(agentId, pageable);
         return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
      }
   }

   @Transactional(readOnly = true)
   public Page<TicketResponseDTO> getTicketsByAgent(Long agentId, TicketStatus status, Priority priority,
                                                    WaitingOn waitingOn, Boolean hasCustomerReply,
                                                    Boolean resolutionRejected, String slaState,
                                                    String search, Pageable pageable) {
      Specification<Ticket> specification = buildOwnedTicketSpecification(null, agentId);
      specification = specification.and(buildSharedTicketFilters(status, priority, waitingOn,
         hasCustomerReply, resolutionRejected, slaState, search));
      Page<Ticket> page = this.ticketRepository.findAll(specification, pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(readOnly = true)
   public AgentWorkbenchDTO getAgentWorkbench(Long agentId, int limit) {
      int boundedLimit = Math.min(Math.max(limit, 1), 20);

      return AgentWorkbenchDTO.builder()
         .availableToTake(loadWorkbenchBucket(buildActionBucketSpecification("unassigned"), boundedLimit))
         .assignedOpen(loadWorkbenchBucket(buildAgentWorkbenchSpecification(agentId, "assigned-open"), boundedLimit))
         .waitingCustomer(loadWorkbenchBucket(buildAgentWorkbenchSpecification(agentId, "waiting-client"), boundedLimit))
         .customerReplied(loadWorkbenchBucket(buildAgentWorkbenchSpecification(agentId, "customer-replied"), boundedLimit))
         .resolutionRejected(loadWorkbenchBucket(buildAgentWorkbenchSpecification(agentId, "resolution-rejected"), boundedLimit))
         .build();
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> searchTickets(String query, Pageable pageable) {
      Page<Ticket> page = this.ticketRepository.searchTickets(query, pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> searchArchivedTickets(Long clientId, Long collaboratorId, Severity severity, LocalDate fromDate, LocalDate toDate, Pageable pageable) {
      Specification<Ticket> specification = (root, query, cb) -> cb.and(cb.isNotNull(root.get("alfrescoFolderId")), cb.notEqual(root.get("alfrescoFolderId"), ""));
      if (clientId != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("client").get("id"), clientId));
      }

      if (collaboratorId != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("assignedAgent").get("id"), collaboratorId));
      }

      if (severity != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("severity"), severity));
      }

      if (fromDate != null) {
         LocalDateTime fromDateTime = fromDate.atStartOfDay();
         specification = specification.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("closedAt"), fromDateTime));
      }

      if (toDate != null) {
         LocalDateTime toDateTime = toDate.atTime(LocalTime.MAX);
         specification = specification.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("closedAt"), toDateTime));
      }

      Page<Ticket> page = this.ticketRepository.findAll(specification, pageable);
      return page.map(ticket -> this.mapper.toTicketResponseDTO(ticket));
   }

   @Transactional(
      readOnly = true
   )
   public List<TicketResponseDTO> getUnassignedTickets() {
      return this.mapper.toTicketResponseDTOList(this.ticketRepository.findUnassignedTickets());
   }

   public void deleteTicket(Long id) {
      Ticket ticket = (Ticket)this.ticketRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + id));
      if (this.camundaService != null && ticket.getProcessInstanceId() != null) {
         try {
            this.camundaService.cancelProcess(ticket.getProcessInstanceId(), "Ticket supprime");
         } catch (Exception e) {
            log.warn("Impossible d'annuler le processus Camunda: {}", e.getMessage());
            this.recordCamundaSyncIssue(ticket, "DELETE", e.getMessage());
         }
      }

      this.ticketRepository.delete(ticket);
      log.info("Ticket supprime: {}", id);
   }


   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByClientEmail(String email, Pageable pageable) {
      return this.getTicketsByClientEmail(email, (TicketStatus)null, pageable);
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketResponseDTO> getTicketsByClientEmail(String email, TicketStatus status, Pageable pageable) {
      log.info("Recherche tickets pour client email: {}", email);
      Client client = (Client)this.clientRepository.findByEmail(email).orElse(null);
      if (client == null) {
         User user = (User)this.userRepository.findByEmail(email).orElse(null);
         if (user != null) {
            client = user.getClient();
         }
      }

      if (client == null) {
         log.warn("Aucun client trouve avec email: {}", email);
         return Page.empty(pageable);
      } else {
         return this.getTicketsByClient(client.getId(), status, pageable);
      }
   }

   @Transactional(
      readOnly = true
   )
   public boolean isTicketOwnedByClientEmail(Long ticketId, String email) {
      Optional<Ticket> ticketOpt = this.ticketRepository.findById(ticketId);
      if (ticketOpt.isEmpty()) {
         return false;
      } else {
         Ticket ticket = (Ticket)ticketOpt.get();
         if (ticket.getClient() == null) {
            return false;
         } else {
            return email != null && email.equalsIgnoreCase(ticket.getClient().getEmail());
         }
      }
   }

   private String generateReference() {
      Integer maxNumber = this.ticketRepository.findMaxReferenceNumber();
      int nextNumber = (maxNumber != null ? maxNumber : 0) + 1;
      return String.format("SF-%04d", nextNumber);
   }

   /**
    * Calcule la durée SLA en minutes selon la sévérité
    */
   private int calculateSlaMinutes(Severity severity) {
      return switch (severity) {
         case SUPER_CRITICAL -> this.slaSuperCriticalMinutes;
         case CRITICAL -> this.slaCriticalHours * 60;
         case HIGH -> this.slaHighHours * 60;
         case MEDIUM -> this.slaMediumHours * 60;
         case LOW -> this.slaLowHours * 60;
      };
   }

   public TicketResponseDTO takeCharge(Long ticketId, Long agentId) {
      log.info("Agent {} prend en charge le ticket {}", agentId, ticketId);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      User agent = (User)this.userRepository.findById(agentId).orElseThrow(() -> new ResourceNotFoundException("Agent non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + agentId));
      if (!agent.isSupportAgent() && !agent.isSupportManager() && !agent.isAdmin()) {
         throw new BusinessException("Seul un agent support/manager/admin peut prendre en charge ce ticket");
      } else if (ticket.getStatus() != TicketStatus.CLOSED && ticket.getStatus() != TicketStatus.CANCELLED) {
         if (ticket.getAssignedAgent() != null && !ticket.getAssignedAgent().getId().equals(agentId)) {
            throw new BusinessException("Ce ticket est assignÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  un autre agent");
         } else {
            if (ticket.getAssignedAgent() == null) {
               ticket.setAssignedAgent(agent);
               ticket.setAssignedAt(LocalDateTime.now());
            }

            if (Boolean.TRUE.equals(ticket.getSlaPaused()) && ticket.getStatus() == TicketStatus.PENDING) {
               this.slaComputationService.resumeSla(ticket, LocalDateTime.now());
            }
            ticket.setWaitingOn(null);
            ticket.setPendingReason(null);
            ticket.setSlaPauseReason(null);
            ticket.setManagerReviewReason(null);

            TicketStatus oldStatus = ticket.getStatus();
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticket.setSlaPhase(this.slaComputationService.computePhase(ticket));
            TicketHistory history = TicketHistory.createStatusChange(ticket, agent, oldStatus.name(), TicketStatus.IN_PROGRESS.name());
            this.historyRepository.save(history);
            ticket = (Ticket)this.ticketRepository.save(ticket);
            if (this.camundaService != null && (oldStatus == TicketStatus.OPEN || oldStatus == TicketStatus.NEW)) {
               try {
                  this.completeAssignmentTaskWhenReady(ticket, "TAKE_CHARGE");
               } catch (Exception e) {
                  log.warn("Impossible de complÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ter la tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢che Camunda lors de la prise en charge: {}", e.getMessage());
                  this.recordCamundaSyncIssue(ticket, "TAKE_CHARGE", e.getMessage());
               }
            }

            this.notificationService.notifyStatusChanged(ticket, TicketStatus.IN_PROGRESS);
            this.notificationService.broadcastTicketStatusChange(ticket, oldStatus.name(), "IN_PROGRESS");
            log.info("Ticket {} pris en charge par {}", ticket.getReference(), agent.getUsername());
            return this.mapper.toTicketResponseDTO(ticket);
         }
      } else {
         throw new BusinessException("Impossible de prendre en charge un ticket fermÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ou annulÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©");
      }
   }

   public TicketResponseDTO escalateManually(Long ticketId, Long newAgentId, String motif, Long performedByUserId) {
      log.info("Escalade manuelle du ticket {} vers agent {}", ticketId, newAgentId);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      User newAgent = (User)this.userRepository.findById(newAgentId).orElseThrow(() -> new ResourceNotFoundException("Agent non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + newAgentId));
      if (!newAgent.isSupportAgent() && !newAgent.isSupportManager() && !newAgent.isAdmin()) {
         throw new BusinessException("L'utilisateur cible n'est pas un agent support");
      } else {
         User performedBy = performedByUserId != null ? (User)this.userRepository.findById(performedByUserId).orElse(null) : null;
         User oldAgent = ticket.getAssignedAgent();
         TicketStatus oldStatus = ticket.getStatus();
         if (oldStatus != TicketStatus.CLOSED && oldStatus != TicketStatus.CANCELLED && oldStatus != TicketStatus.RESOLVED) {
            ticket.setAssignedAgent(newAgent);
            ticket.setAssignedAt(LocalDateTime.now());
            ticket.setStatus(TicketStatus.ESCALATED_MANUAL);
            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction("ESCALADE_MANUELLE");
            history.setOldValue(oldAgent != null ? oldAgent.getUsername() : "Non assignÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©");
            String var10001 = newAgent.getUsername();
            history.setNewValue(var10001 + " - Motif: " + motif);
            history.setPerformedBy(performedBy != null ? performedBy.getFullName() : "System");
            history.setCreatedAt(LocalDateTime.now());
            this.historyRepository.save(history);
            ticket = (Ticket)this.ticketRepository.save(ticket);
            this.notificationService.notifyTicketEscalated(ticket, newAgent, motif);
            if (this.camundaService != null) {
               try {
                  this.camundaService.reassignResolutionTask(ticket);
               } catch (Exception e) {
                  log.warn("Impossible de rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©assigner la tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢che Camunda: {}", e.getMessage());
                  this.recordCamundaSyncIssue(ticket, "ESCALATE_MANUAL", e.getMessage());
               }
            }

            this.notificationService.broadcastTicketStatusChange(ticket, oldStatus.name(), "ESCALATED_MANUAL");
            log.info("Ticket {} escaladÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© manuellement vers {}", ticket.getReference(), newAgent.getUsername());
            return this.mapper.toTicketResponseDTO(ticket);
         } else {
            throw new BusinessException("Impossible d'escalader un ticket dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©jÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  finalisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©");
         }
      }
   }

   public TicketResponseDTO escalateSLA(Long ticketId) {
      log.info("Escalade SLA manuelle/compatibilite du ticket {}", ticketId);
      return this.requestManagerReview(ticketId);
   }

   public TicketResponseDTO requestManagerReview(Long ticketId) {
      return this.requestManagerReview(ticketId, null, null);
   }

   public TicketResponseDTO requestManagerReview(Long ticketId, String reason, Long userId) {
      log.info("Demande de revue manager pour le ticket {}", ticketId);
      Ticket ticket = this.ticketRepository.findById(ticketId)
         .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      User user = userId != null ? this.userRepository.findById(userId).orElse(null) : null;
      if (reason != null && !reason.isBlank()) {
         ticket.setManagerReviewReason(reason.trim());
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setUser(user);
         history.setAction("MANAGER_REVIEW_REQUESTED");
         history.setDescription("Revue manager demandee: " + reason.trim());
         history.setPerformedBy(user != null ? user.getFullName() : "System");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
         ticket = this.ticketRepository.save(ticket);
         this.notificationService.notifyManagerReviewRequested(ticket, reason.trim(), user);
      }
      return this.escalationService.evaluateEscalation(ticketId, com.supportflow.entity.enums.EscalationEvaluationTrigger.MANUAL_MANAGER_REVIEW);
   }

   /**
    * Pause le SLA d'un ticket (ex: en attente de réponse client)
    */
   public TicketResponseDTO pauseSla(Long ticketId, String reason, Long userId) {
      log.info("Pause SLA du ticket {}", ticketId);
      Ticket ticket = this.ticketRepository.findById(ticketId)
         .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      User user = userId != null ? this.userRepository.findById(userId).orElse(null) : null;
      
      ticket.pauseSla();
      ticket.setSlaPhase("PAUSED");
      ticket.setSlaPauseReason(reason != null ? reason.trim() : null);
      ticket.setSlaBreached(this.slaComputationService.isBreached(ticket));

      // Suspend Camunda SLA timers
      if (this.camundaService != null && ticket.getProcessInstanceId() != null) {
         try {
            this.camundaService.suspendSlaTimers(ticket);
         } catch (Exception e) {
            log.warn("Could not suspend Camunda timers after SLA pause: {}", e.getMessage());
         }
      }
      
      TicketHistory history = new TicketHistory();
      history.setTicket(ticket);
      history.setAction("SLA_PAUSED_MANUAL");
      history.setDescription("SLA mis en pause: " + (reason != null && !reason.isBlank() ? reason.trim() : "motif non renseigne"));
      history.setPerformedBy(user != null ? user.getUsername() : "System");
      history.setCreatedAt(LocalDateTime.now());
      this.historyRepository.save(history);
      
      ticket = this.ticketRepository.save(ticket);
      log.info("SLA pause pour le ticket {}", ticket.getReference());
      return this.mapper.toTicketResponseDTO(ticket);
   }

   /**
    * Reprend le SLA d'un ticket (client a répondu)
    */
   public TicketResponseDTO resumeSla(Long ticketId, Long userId) {
      log.info("Reprise SLA du ticket {}", ticketId);
      Ticket ticket = this.ticketRepository.findById(ticketId)
         .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      User user = userId != null ? this.userRepository.findById(userId).orElse(null) : null;
      
      long pausedMinutes = this.slaComputationService.resumeSla(ticket, LocalDateTime.now());
      ticket.setSlaPauseReason(null);
      
      // Reschedule Camunda timers with new deadline
      if (this.camundaService != null && ticket.getProcessInstanceId() != null) {
         try {
            this.camundaService.rescheduleSlaTimer(ticket, ticket.getSlaDeadline());
         } catch (Exception e) {
            log.warn("Could not reschedule Camunda timers after SLA resume: {}", e.getMessage());
         }
      }
      
      TicketHistory history = new TicketHistory();
      history.setTicket(ticket);
      history.setAction("SLA_RESUMED");
      history.setDescription("SLA repris apres " + pausedMinutes + " minutes de pause. Nouvelle deadline: " + ticket.getSlaDeadline());
      history.setPerformedBy(user != null ? user.getUsername() : "System");
      history.setCreatedAt(LocalDateTime.now());
      this.historyRepository.save(history);
      
      ticket = this.ticketRepository.save(ticket);
      log.info("SLA repris pour le ticket {} (+{} min pause)", ticket.getReference(), pausedMinutes);
      return this.mapper.toTicketResponseDTO(ticket);
   }

   public TicketResponseDTO waitForCustomer(Long ticketId, WaitingOn waitingOn, String reason, Long userId) {
      log.info("Mise en attente client du ticket {}", ticketId);
      Ticket ticket = this.ticketRepository.findById(ticketId)
         .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      User user = userId != null ? this.userRepository.findById(userId).orElse(null) : null;
      if (ticket.getStatus() == TicketStatus.RESOLVED || ticket.getStatus() == TicketStatus.CLOSED || ticket.getStatus() == TicketStatus.CANCELLED) {
         throw new BusinessException("Impossible de mettre en attente client un ticket finalise");
      }

      TicketStatus oldStatus = ticket.getStatus();
      boolean wasPaused = Boolean.TRUE.equals(ticket.getSlaPaused());
      ticket.setStatus(TicketStatus.PENDING);
      ticket.setWaitingOn(waitingOn != null ? waitingOn : WaitingOn.CLIENT);
      ticket.setPendingReason(reason != null ? reason.trim() : null);
      ticket.setManagerReviewReason(null);
      if (!wasPaused) {
         ticket.pauseSla();
      }
      ticket.setSlaPhase("PAUSED");
      ticket.setSlaPauseReason(reason != null ? reason.trim() : ticket.getSlaPauseReason());

      TicketHistory history = new TicketHistory();
      history.setTicket(ticket);
      history.setAction("WAITING_ON_" + ticket.getWaitingOn().name());
      history.setOldValue(oldStatus.name());
      history.setNewValue(TicketStatus.PENDING.name());
      history.setDescription(reason != null && !reason.isBlank()
         ? "En attente de " + ticket.getWaitingOn().getLabel().toLowerCase(Locale.ROOT) + ": " + reason.trim()
         : "Ticket mis en attente");
      history.setPerformedBy(user != null ? user.getFullName() : "System");
      history.setCreatedAt(LocalDateTime.now());
      this.historyRepository.save(history);

      ticket = this.ticketRepository.save(ticket);

      if (!wasPaused && this.camundaService != null && ticket.getProcessInstanceId() != null) {
         try {
            this.camundaService.suspendSlaTimers(ticket);
         } catch (Exception e) {
            log.warn("Could not suspend Camunda timers after wait-for-customer: {}", e.getMessage());
         }
      }

      this.notificationService.broadcastTicketStatusChange(ticket, oldStatus.name(), TicketStatus.PENDING.name());
      return this.mapper.toTicketResponseDTO(ticket);
   }

   /**
    * Prolonge le SLA d'un ticket (par le manager)
    */
   public TicketResponseDTO extendSla(Long ticketId, int additionalMinutes, String reason, Long userId) {
      log.info("Extension SLA du ticket {} de {} minutes", ticketId, additionalMinutes);
      Ticket ticket = this.ticketRepository.findById(ticketId)
         .orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      User user = userId != null ? this.userRepository.findById(userId).orElse(null) : null;
      
      LocalDateTime oldDeadline = ticket.getSlaDeadline();
      this.slaComputationService.extendSla(ticket, additionalMinutes, reason, LocalDateTime.now());
      
      // Reschedule Camunda timers
      if (this.camundaService != null && ticket.getProcessInstanceId() != null) {
         try {
            this.camundaService.rescheduleSlaTimer(ticket, ticket.getSlaDeadline());
         } catch (Exception e) {
            log.warn("Could not reschedule Camunda timers after SLA extension: {}", e.getMessage());
         }
      }
      
      TicketHistory history = new TicketHistory();
      history.setTicket(ticket);
      history.setAction("SLA_EXTENDED");
      history.setOldValue(oldDeadline != null ? oldDeadline.toString() : "N/A");
      history.setNewValue(ticket.getSlaDeadline() != null ? ticket.getSlaDeadline().toString() : "N/A");
      history.setDescription("SLA prolonge de " + additionalMinutes + " min. Raison: " + reason);
      history.setPerformedBy(user != null ? user.getUsername() : "System");
      history.setCreatedAt(LocalDateTime.now());
      this.historyRepository.save(history);
      
      ticket = this.ticketRepository.save(ticket);
      log.info("SLA prolonge pour {} de {} min", ticket.getReference(), additionalMinutes);
      return this.mapper.toTicketResponseDTO(ticket);
   }

   public TicketResponseDTO resolveTicket(Long ticketId, TicketResolveRequestDTO request, Long agentId) {
      log.info("RÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©solution du ticket {}", ticketId);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      User agent = agentId != null ? (User)this.userRepository.findById(agentId).orElse(null) : null;
      if (agent == null) {
         throw new BusinessException("Utilisateur non valide pour la resolution");
      } else if (ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(agent.getId())) {
         String oldStatus = ticket.getStatus().name();
         if (Boolean.TRUE.equals(ticket.getSlaPaused())) {
            this.slaComputationService.resumeSla(ticket, LocalDateTime.now());
         }
         ticket.setStatus(TicketStatus.RESOLVED);
         ticket.setResolutionSummary(request.getResolutionSummary().trim());
         ticket.setResolutionDiagnostic(request.getResolutionDetails().getDiagnostic().trim());
         ticket.setResolutionRootCause(request.getResolutionDetails().getRootCause().trim());
         ticket.setResolutionActionsTaken(request.getResolutionDetails().getActionsTaken().trim());
         ticket.setResolutionNextRecommendation(request.getResolutionDetails().getNextRecommendation().trim());
         ticket.setWaitingOn(null);
         ticket.setPendingReason(null);
         ticket.setSlaPauseReason(null);
         ticket.setManagerReviewReason(null);
         ticket.setResolutionRejectedReason(null);
         ticket.setResolvedAt(LocalDateTime.now());
         ticket.calculateResolutionTime();
         ticket.setSlaBreached(this.slaComputationService.isBreached(ticket));
         ticket.setSlaPhase(this.slaComputationService.computePhase(ticket));
         TicketHistory history = TicketHistory.createStatusChange(ticket, agent, oldStatus, TicketStatus.RESOLVED.name());
         this.historyRepository.save(history);
         TicketHistory detailsHistory = new TicketHistory();
         detailsHistory.setTicket(ticket);
         detailsHistory.setUser(agent);
         detailsHistory.setAction("RESOLUTION_CAPTURED");
         detailsHistory.setDescription("Resolution structuree enregistree");
         detailsHistory.setPerformedBy(agent.getFullName());
         detailsHistory.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(detailsHistory);
         ticket = (Ticket)this.ticketRepository.save(ticket);
         this.notificationService.notifyTicketResolved(ticket);
         this.notificationService.broadcastTicketStatusChange(ticket, oldStatus, "RESOLVED");
         if (this.camundaService != null) {
            try {
               this.camundaService.completeResolutionTask(ticket);
            } catch (Exception e) {
               log.warn("Impossible de complÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ter la tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢che Camunda: {}", e.getMessage());
               this.recordCamundaSyncIssue(ticket, "RESOLVE", e.getMessage());
            }
         }

         log.info("Ticket {} rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©solu", ticket.getReference());
         return this.mapper.toTicketResponseDTO(ticket);
      } else {
         throw new BusinessException("Seul l'agent assigne peut resoudre ce ticket. Reassignez-le d'abord.");
      }
   }

   public TicketResponseDTO rejectResolution(Long ticketId, String rejectionComment, Long userId) {
      log.info("Rejet de resolution pour ticket {}", ticketId);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      if (ticket.getStatus() != TicketStatus.RESOLVED) {
         throw new BusinessException("Le ticket doit etre RESOLVED pour pouvoir etre rejete");
      } else {
         User user = userId != null ? (User)this.userRepository.findById(userId).orElse(null) : null;
         TicketStatus oldStatus = ticket.getStatus();
         if (Boolean.TRUE.equals(ticket.getSlaPaused())) {
            this.slaComputationService.resumeSla(ticket, LocalDateTime.now());
         }
         ticket.setStatus(TicketStatus.IN_PROGRESS);
         ticket.setResolutionRejectedReason(rejectionComment != null ? rejectionComment.trim() : null);
         ticket.setWaitingOn(null);
         ticket.setPendingReason(null);
         ticket.setSlaPhase(this.slaComputationService.computePhase(ticket));
         ticket = (Ticket)this.ticketRepository.save(ticket);
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setAction("RESOLUTION_REJECTED");
         history.setOldValue(oldStatus.name());
         history.setNewValue(TicketStatus.IN_PROGRESS.name());
         history.setDescription(rejectionComment != null && !rejectionComment.isBlank() ? "Motif rejet: " + rejectionComment.trim() : "Le client a rejete la resolution");
         history.setPerformedBy(user != null ? user.getFullName() : "Client");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
         this.notificationService.notifyResolutionRejected(ticket, user, rejectionComment);
         this.notificationService.notifyStatusChanged(ticket, TicketStatus.IN_PROGRESS);
         this.notificationService.broadcastTicketStatusChange(ticket, oldStatus.name(), TicketStatus.IN_PROGRESS.name());
         if (this.camundaService != null) {
            try {
               this.camundaService.completeValidationTask(ticket, false);
            } catch (Exception e) {
               log.warn("Impossible de synchroniser Camunda apres rejet client: {}", e.getMessage());
               this.recordCamundaSyncIssue(ticket, "REJECT_RESOLUTION", e.getMessage());
            }
         }

         return this.mapper.toTicketResponseDTO(ticket);
      }
   }

   public TicketResponseDTO closeTicket(Long ticketId, Integer satisfactionRating, String satisfactionComment) {
      log.info("Fermeture du ticket {} avec satisfaction {}", ticketId, satisfactionRating);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      if (ticket.getStatus() != TicketStatus.RESOLVED) {
         throw new BusinessException("Le ticket doit ?tre r?solu avant d'?tre ferm?");
      } else if (ticket.getResolutionSummary() != null && !ticket.getResolutionSummary().isBlank()) {
         if (satisfactionRating != null && satisfactionRating >= 1 && satisfactionRating <= 5) {
            ticket.setStatus(TicketStatus.CLOSED);
            ticket.setClosedAt(LocalDateTime.now());
            ticket.setSatisfactionRating(satisfactionRating);
            ticket.setSatisfactionComment(satisfactionComment);
            TicketHistory history = new TicketHistory();
            history.setTicket(ticket);
            history.setAction("FERMETURE");
            history.setOldValue(TicketStatus.RESOLVED.name());
            history.setNewValue("CLOSED - Satisfaction: " + satisfactionRating + "/5");
            history.setCreatedAt(LocalDateTime.now());
            this.historyRepository.save(history);
            ticket = (Ticket)this.ticketRepository.saveAndFlush(ticket);

            if (this.camundaService != null) {
               try {
                  this.camundaAsyncService.completeValidationTaskAsync(ticket, true);
               } catch (Exception e) {
                  log.warn("Impossible de lancer la synchronisation Camunda apres fermeture du ticket {}: {}", ticket.getReference(), e.getMessage());
                  this.recordCamundaSyncIssue(ticket, "CLOSE", e.getMessage());
               }
            }

            try {
               this.archiveTicketInternal(ticket, (User)null, true);
               ticket = (Ticket)this.ticketRepository.saveAndFlush(ticket);
            } catch (ArchiveIntegrationException e) {
               log.warn("Archivage Alfresco indisponible pour {}: {}", ticket.getReference(), e.getMessage());
               this.recordArchiveSyncIssue(ticket, "CLOSE", e.getMessage());
            }

            log.info("Ticket {} ferme avec satisfaction {}/5, archivage GED traite et synchronisation Camunda declenchee", ticket.getReference(), satisfactionRating);
            return this.mapper.toTicketResponseDTO(ticket);
         } else {
            throw new BusinessException("La note de satisfaction doit etre comprise entre 1 et 5");
         }
      } else {
         throw new BusinessException("La cloture exige un resume de resolution");
      }
   }

   public TicketResponseDTO archiveTicket(Long ticketId, Long userId) {
      Ticket ticket = (Ticket)this.ticketRepository.findByIdForUpdate(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      User user = userId != null ? (User)this.userRepository.findById(userId).orElse(null) : null;
      try {
         this.archiveTicketInternal(ticket, user, false);
      } catch (ArchiveIntegrationException e) {
         log.warn("Archivage manuel Alfresco indisponible pour {}: {}", ticket.getReference(), e.getMessage());
         this.recordArchiveSyncIssue(ticket, "MANUAL_ARCHIVE", e.getMessage());
      }
      ticket = (Ticket)this.ticketRepository.saveAndFlush(ticket);
      return this.mapper.toTicketResponseDTO(ticket);
   }

   public void archiveTicketFromWorkflow(Long ticketId) {
      Ticket ticket = (Ticket)this.ticketRepository.findByIdForUpdate(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      if (ticket.getStatus() != TicketStatus.CLOSED) {
         ticket.setStatus(TicketStatus.CLOSED);
         if (ticket.getClosedAt() == null) {
            ticket.setClosedAt(LocalDateTime.now());
         }

         ticket = (Ticket)this.ticketRepository.saveAndFlush(ticket);
      }

      this.archiveTicketInternal(ticket, (User)null, true);
      this.ticketRepository.saveAndFlush(ticket);
   }

   public TicketResponseDTO changeStatus(Long ticketId, TicketStatus newStatus, Long userId) {
      return this.changeStatus(ticketId, newStatus, userId, (String)null);
   }

   public TicketResponseDTO changeStatus(Long ticketId, TicketStatus newStatus, Long userId, String reason) {
      log.info("Changement de statut du ticket {} vers {}", ticketId, newStatus);
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      User user = userId != null ? (User)this.userRepository.findById(userId).orElse(null) : null;
      this.updateTicketStatus(ticket, newStatus, user);
      if (newStatus != TicketStatus.PENDING) {
         ticket.setWaitingOn(null);
         ticket.setPendingReason(null);
      }
      if (reason != null && !reason.isBlank()) {
         TicketHistory reasonHistory = new TicketHistory();
         reasonHistory.setTicket(ticket);
         reasonHistory.setAction("STATUS_REASON");
         reasonHistory.setFieldName("status");
         reasonHistory.setDescription("Motif changement statut: " + reason.trim());
         reasonHistory.setPerformedBy(user != null ? user.getFullName() : "System");
         reasonHistory.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(reasonHistory);
      }

      ticket = (Ticket)this.ticketRepository.save(ticket);
      return this.mapper.toTicketResponseDTO(ticket);
   }

   @Transactional(
      readOnly = true
   )
   public Page<TicketHistoryDTO> getTicketHistory(Long ticketId, Pageable pageable) {
      if (!this.ticketRepository.existsById(ticketId)) {
         throw new ResourceNotFoundException("Ticket non trouve: " + ticketId);
      } else {
         Page<TicketHistory> page = this.historyRepository.findByTicketId(ticketId, pageable);
         return page.map(history -> this.mapper.toTicketHistoryDTO(history));
      }
   }

   public TicketResponseDTO updateSlaDueDate(Long ticketId, LocalDateTime dueDate, Long userId) {
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      if (dueDate == null) {
         throw new BusinessException("La date SLA est obligatoire");
      } else if (dueDate.isBefore(LocalDateTime.now().minusSeconds(5L))) {
         throw new BusinessException("La date SLA doit etre dans le futur");
      } else {
         User user = userId != null ? (User)this.userRepository.findById(userId).orElse(null) : null;
         LocalDateTime oldDeadline = ticket.getSlaDeadline();
         ticket.setSlaDeadline(dueDate);
         ticket.setSlaWarningSent(false);
         ticket = (Ticket)this.ticketRepository.save(ticket);
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setAction("SLA_DUE_DATE_UPDATED");
         history.setOldValue(oldDeadline != null ? oldDeadline.toString() : "null");
         history.setNewValue(dueDate.toString());
         history.setPerformedBy(user != null ? user.getFullName() : "System");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
         if (this.camundaService != null) {
            this.camundaService.rescheduleSlaTimer(ticket, dueDate);
         }

         return this.mapper.toTicketResponseDTO(ticket);
      }
   }


   public TicketResponseDTO autoReassignStuckAssignedTicket(Long ticketId) {
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©: " + ticketId));
      if (ticket.getStatus() != TicketStatus.ASSIGNED) {
         return this.mapper.toTicketResponseDTO(ticket);
      } else {
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setAction("ASSIGNED_STUCK_ALERT");
         history.setDescription("Ticket ASSIGNED sans prise en charge: alerte envoyee agent + manager");
         history.setPerformedBy("System");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
         ticket = (Ticket)this.ticketRepository.save(ticket);
         this.notificationService.notifySlaWarning(ticket);
         return this.mapper.toTicketResponseDTO(ticket);
      }
   }

   @Transactional(
      readOnly = true
   )
   @org.springframework.cache.annotation.Cacheable(value = "agentRecommendations", key = "#ticketId", unless = "#result.isEmpty()")
   public List<AgentRecommendationDTO> getRecommendedAgents(Long ticketId) {
      return this.escalationService.getRecommendedAgents(ticketId);
   }

   private Specification<Ticket> buildSlaStateSpecification(String slaState) {
      final String normalized = slaState.trim().toUpperCase(Locale.ROOT);
      return (root, query, cb) -> switch (normalized) {
         case "BREACHED" -> cb.or(
            cb.isTrue(root.get("slaBreached")),
            cb.equal(root.get("slaPhase"), "BREACHED"),
            cb.equal(root.get("status"), TicketStatus.ESCALATED_SLA)
         );
         case "AT_RISK" -> cb.equal(root.get("slaPhase"), "AT_RISK");
         case "PAUSED" -> cb.isTrue(root.get("slaPaused"));
         default -> cb.equal(root.get("slaPhase"), "ON_TRACK");
      };
   }

   private Specification<Ticket> buildOwnedTicketSpecification(Long clientId, Long agentId) {
      Specification<Ticket> specification = Specification.where((root, query, cb) ->
         cb.notEqual(root.get("status"), TicketStatus.CANCELLED));
      if (clientId != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("client").get("id"), clientId));
      }
      if (agentId != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("assignedAgent").get("id"), agentId));
      }
      return specification;
   }

   private Specification<Ticket> buildSharedTicketFilters(TicketStatus status, Priority priority, WaitingOn waitingOn,
                                                          Boolean hasCustomerReply, Boolean resolutionRejected,
                                                          String slaState, String search) {
      Specification<Ticket> specification = Specification.where(null);

      if (status != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("status"), status));
      }
      if (priority != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("priority"), priority));
      }
      if (waitingOn != null) {
         specification = specification.and((root, query, cb) -> cb.equal(root.get("waitingOn"), waitingOn));
      }
      if (Boolean.TRUE.equals(hasCustomerReply)) {
         specification = specification.and((root, query, cb) -> cb.isNotNull(root.get("lastCustomerResponseAt")));
      }
      if (Boolean.TRUE.equals(resolutionRejected)) {
         specification = specification.and((root, query, cb) -> cb.and(
            cb.isNotNull(root.get("resolutionRejectedReason")),
            cb.notEqual(root.get("resolutionRejectedReason"), "")
         ));
      }
      if (slaState != null && !slaState.isBlank()) {
         specification = specification.and(buildSlaStateSpecification(slaState));
      }
      if (search != null && !search.isBlank()) {
         String normalizedSearch = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
         specification = specification.and((root, query, cb) -> cb.or(
            cb.like(cb.lower(root.get("reference")), normalizedSearch),
            cb.like(cb.lower(root.get("title")), normalizedSearch),
            cb.like(cb.lower(root.get("description")), normalizedSearch)
         ));
      }

      return specification;
   }

   private Specification<Ticket> buildActionBucketSpecification(String actionBucket) {
      final String normalized = actionBucket.trim().toLowerCase(Locale.ROOT);
      final LocalDateTime blockedThreshold = LocalDateTime.now().minusHours(24);
      return switch (normalized) {
         case "unassigned" -> (root, query, cb) -> cb.isNull(root.get("assignedAgent"));
         case "waiting-client" -> (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), TicketStatus.PENDING),
            cb.equal(root.get("waitingOn"), WaitingOn.CLIENT)
         );
         case "waiting-third-party" -> (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), TicketStatus.PENDING),
            cb.equal(root.get("waitingOn"), WaitingOn.THIRD_PARTY)
         );
         case "at-risk" -> (root, query, cb) -> cb.equal(root.get("slaPhase"), "AT_RISK");
         case "breached" -> (root, query, cb) -> cb.or(
            cb.isTrue(root.get("slaBreached")),
            cb.equal(root.get("status"), TicketStatus.ESCALATED_SLA),
            cb.equal(root.get("slaPhase"), "BREACHED")
         );
         case "customer-replied" -> (root, query, cb) -> cb.and(
            cb.isNotNull(root.get("lastCustomerResponseAt")),
            cb.equal(root.get("status"), TicketStatus.IN_PROGRESS)
         );
         case "resolution-rejected" -> (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), TicketStatus.IN_PROGRESS),
            cb.isNotNull(root.get("resolutionRejectedReason")),
            cb.notEqual(root.get("resolutionRejectedReason"), "")
         );
         case "blocked" -> (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), TicketStatus.PENDING),
            cb.lessThanOrEqualTo(root.get("updatedAt"), blockedThreshold)
         );
         default -> (root, query, cb) -> cb.conjunction();
      };
   }

   private Specification<Ticket> buildAgentWorkbenchSpecification(Long agentId, String bucket) {
      Specification<Ticket> ownership = buildOwnedTicketSpecification(null, agentId);
      return switch (bucket) {
         case "assigned-open" -> ownership.and((root, query, cb) -> root.get("status").in(
            TicketStatus.ASSIGNED,
            TicketStatus.IN_PROGRESS,
            TicketStatus.ESCALATED_MANUAL,
            TicketStatus.ESCALATED_SLA
         ));
         case "waiting-client" -> ownership.and(buildActionBucketSpecification("waiting-client"));
         case "customer-replied" -> ownership.and(buildActionBucketSpecification("customer-replied"));
         case "resolution-rejected" -> ownership.and(buildActionBucketSpecification("resolution-rejected"));
         default -> ownership;
      };
   }

   private List<TicketResponseDTO> loadWorkbenchBucket(Specification<Ticket> specification, int limit) {
      List<TicketResponseDTO> tickets = this.ticketRepository.findAll(specification).stream()
         .map(ticket -> this.mapper.toTicketResponseDTO(ticket))
         .sorted(agentWorkbenchComparator())
         .limit(limit)
         .toList();
      return new ArrayList<>(tickets);
   }

   private Comparator<TicketResponseDTO> agentWorkbenchComparator() {
      return Comparator
         .comparingInt(this::getWorkbenchSlaWeight)
         .thenComparingInt(this::getWorkbenchPriorityWeight)
         .thenComparing((TicketResponseDTO ticket) -> Optional.ofNullable(ticket.getLastCustomerResponseAt()).orElse(LocalDateTime.MIN), Comparator.reverseOrder())
         .thenComparing((TicketResponseDTO ticket) -> Optional.ofNullable(ticket.getCreatedAt()).orElse(LocalDateTime.MIN), Comparator.naturalOrder());
   }

   private int getWorkbenchSlaWeight(TicketResponseDTO ticket) {
      if (Boolean.TRUE.equals(ticket.getSlaBreached()) || "BREACHED".equalsIgnoreCase(ticket.getSlaPhase())
         || ticket.getStatus() == TicketStatus.ESCALATED_SLA) {
         return 0;
      }
      if ("AT_RISK".equalsIgnoreCase(ticket.getSlaPhase())) {
         return 1;
      }
      return 2;
   }

   private int getWorkbenchPriorityWeight(TicketResponseDTO ticket) {
      Priority priority = ticket.getPriority();
      if (priority == null) {
         return 10;
      }
      return switch (priority) {
         case SUPER_CRITICAL -> 0;
         case CRITICAL -> 1;
         case HIGH -> 2;
         case MEDIUM -> 3;
         case LOW -> 4;
      };
   }

   @Transactional(
      readOnly = true
   )
   public List<AgentRecommendationDTO> getAssignmentCandidates(Long ticketId) {
      return this.escalationService.getAssignmentCandidates(ticketId);
   }

   @Transactional(
      readOnly = true
   )
   public List<AgentRecommendationDTO> getRecommendedAgentsForDraft(String category, String type, String title, String description) {
      return this.escalationService.getRecommendedAgentsForDraft(category, type, title, description);
   }

   @Transactional(readOnly = true)
   public List<TicketArchiveDocumentDTO> getAlfrescoDocuments(Long ticketId) {
      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      List<TicketArchiveDocumentDTO> documents = new java.util.ArrayList<>();

      List<com.supportflow.entity.Attachment> attachments = ticket.getAttachments() == null
         ? List.of()
         : ticket.getAttachments().stream()
            .sorted(java.util.Comparator.comparing(com.supportflow.entity.Attachment::getCreatedAt, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
            .toList();

      Map<String, com.supportflow.entity.Attachment> attachmentsByNodeRef = new LinkedHashMap<>();
      for (com.supportflow.entity.Attachment attachment : attachments) {
         String normalized = normalizeNodeRef(attachment.getAlfrescoNodeId());
         if (normalized != null) {
            attachmentsByNodeRef.put(normalized, attachment);
         }
      }

      java.util.Set<Long> includedAttachmentIds = new java.util.LinkedHashSet<>();

      if (this.alfrescoCmisService != null && ticket.getAlfrescoFolderId() != null && !ticket.getAlfrescoFolderId().isBlank()) {
         try {
            List<AlfrescoCmisService.ArchiveEntryInfo> archiveEntries = this.alfrescoCmisService.listArchiveEntries(ticket.getAlfrescoFolderId());
            for (AlfrescoCmisService.ArchiveEntryInfo entry : archiveEntries) {
               String normalizedRef = normalizeNodeRef(entry.objectId());
               com.supportflow.entity.Attachment matchingAttachment = normalizedRef != null ? attachmentsByNodeRef.get(normalizedRef) : null;
               if (matchingAttachment != null && matchingAttachment.getId() != null) {
                  includedAttachmentIds.add(matchingAttachment.getId());
               }

               String kind;
               if (entry.relativePath() == null || entry.relativePath().isBlank()) {
                  kind = "archive";
               } else if (entry.folder()) {
                  kind = "folder";
               } else if (matchingAttachment != null) {
                  kind = "attachment";
               } else {
                  kind = "document";
               }

               documents.add(TicketArchiveDocumentDTO.builder()
                  .id(entry.objectId())
                  .label(entry.name())
                  .kind(kind)
                  .synced(true)
                  .ref(entry.objectId())
                  .relativePath(entry.relativePath() == null || entry.relativePath().isBlank() ? ticket.getReference() : entry.relativePath())
                  .fileSize(entry.fileSize() != null ? entry.fileSize().longValue() : null)
                  .mimeType(entry.mimeType())
                  .attachmentId(matchingAttachment != null ? matchingAttachment.getId() : null)
                  .build());
            }
         } catch (ArchiveIntegrationException e) {
            log.warn("Lecture Alfresco indisponible pour {}: {}", ticket.getReference(), e.getMessage());
         }
      }

      for (com.supportflow.entity.Attachment attachment : attachments) {
         if (attachment.getId() != null && includedAttachmentIds.contains(attachment.getId())) {
            continue;
         }

         documents.add(TicketArchiveDocumentDTO.builder()
            .id("attachment-" + attachment.getId())
            .label(attachment.getOriginalName() != null ? attachment.getOriginalName() : attachment.getFileName())
            .kind("attachment")
            .synced(attachment.getAlfrescoNodeId() != null && !attachment.getAlfrescoNodeId().isBlank())
            .ref(attachment.getAlfrescoNodeId())
            .relativePath(attachment.getOriginalName() != null ? attachment.getOriginalName() : attachment.getFileName())
            .fileSize(attachment.getFileSize())
            .mimeType(attachment.getContentType())
            .attachmentId(attachment.getId())
            .build());
      }

      return documents;
   }

   @Transactional(readOnly = true)
   public AlfrescoCmisService.DocumentContentResult getAlfrescoDocumentContent(Long ticketId, String objectId) {
      if (objectId == null || objectId.isBlank()) {
         throw new BusinessException("Identifiant document Alfresco obligatoire");
      }
      if (this.alfrescoCmisService == null) {
         throw new BusinessException("Lecture Alfresco indisponible");
      }

      Ticket ticket = (Ticket)this.ticketRepository.findById(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket non trouve: " + ticketId));
      List<TicketArchiveDocumentDTO> documents = this.getAlfrescoDocuments(ticketId);
      TicketArchiveDocumentDTO target = documents.stream()
         .filter(document -> objectId.equals(document.getId()) || objectId.equals(document.getRef()))
         .findFirst()
         .orElseThrow(() -> new ResourceNotFoundException("Document Alfresco non trouve pour le ticket: " + objectId));

      if ("archive".equals(target.getKind()) || "folder".equals(target.getKind())) {
         throw new BusinessException("Le contenu d'un dossier Alfresco ne peut pas etre telecharge directement");
      }

      String nodeRef = target.getRef();
      if (nodeRef == null || nodeRef.isBlank()) {
         throw new BusinessException("Le document n'est pas encore synchronise dans Alfresco");
      }

      log.info("Lecture du document Alfresco {} pour ticket {}", objectId, ticket.getReference());
      return this.alfrescoCmisService.getDocumentContent(nodeRef);
   }

   private List<AgentRecommendationDTO> buildRecommendations(String category, String type, String title, String description) {
      List<User> agents = this.loadRecommendationAgents();
      String resolvedCategory = this.resolveRecommendationCategory(category, type, title, description);
      List<TicketStatus> activeStatuses = List.of(TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED_MANUAL, TicketStatus.ESCALATED_SLA);
      return agents.stream().map((agent) -> this.buildRecommendation(agent, resolvedCategory, activeStatuses)).sorted((a, b) -> Double.compare(b.getRecommendationScore(), a.getRecommendationScore())).toList();
   }

   private List<User> loadRecommendationAgents() {
      List<User> agents;

      try {
         agents = this.keycloakAdminService.syncAndGetAgents();
         if (agents == null || agents.isEmpty()) {
            agents = this.userRepository.findAvailableSupportAgents();
         }
      } catch (Exception e) {
         log.warn("Erreur sync Keycloak pour recommandation agents, fallback DB: {}", e.getMessage());
         agents = this.userRepository.findAvailableSupportAgents();
      }

      return agents;
   }

   private String resolveRecommendationCategory(String category, String type, String title, String description) {
      if (category != null && !category.isBlank()) {
         return category.trim();
      }

      String text = String.join(" ",
         title != null ? title : "",
         description != null ? description : "",
         type != null ? type : "")
         .toLowerCase(Locale.ROOT);

      if (containsAny(text, "auth", "oauth", "sso", "mot de passe", "password", "login", "connexion", "compte", "access")) {
         return "Authentification";
      }

      if (containsAny(text, "interface", "ui", "affichage", "ecran", "dashboard", "tableau de bord", "mobile", "graphique", "page")) {
         return "Interface";
      }

      if (containsAny(text, "report", "rapport", "reporting", "excel", "export", "csv", "pdf")) {
         return "Reporting";
      }

      if (containsAny(text, "vpn", "reseau", "réseau", "wifi", "dns", "latence", "internet", "connectiv", "network")) {
         return "Réseau";
      }

      if (containsAny(text, "mail", "email", "smtp", "imap", "outlook", "boite")) {
         return "Email";
      }

      if (containsAny(text, "sql", "database", "base de donnees", "base de données", "mysql", "postgres", "oracle", "db")) {
         return "Base de données";
      }

      if (containsAny(text, "securite", "sécurité", "security", "permission", "mfa", "2fa", "certificat")) {
         return "Sécurité";
      }

      if (containsAny(text, "materiel", "matériel", "imprimante", "pc", "ordinateur", "scanner", "disque", "hardware")) {
         return "Matériel";
      }

      if (containsAny(text, "logiciel", "application", "bug", "api", "service", "erp", "crm")) {
         return "Logiciel";
      }

      return "Support";
   }

   private boolean containsAny(String value, String... needles) {
      for(String needle : needles) {
         if (value.contains(needle)) {
            return true;
         }
      }

      return false;
   }

   private AgentRecommendationDTO buildRecommendation(User agent, String category, List<TicketStatus> activeStatuses) {
      long activeTickets = this.ticketRepository.countByAssignedAgentIdAndStatusIn(agent.getId(), activeStatuses);
      long breachedActive = this.ticketRepository.countByAssignedAgentIdAndSlaBreachedTrueAndStatusIn(agent.getId(), activeStatuses);
      long categoryCount = category != null && !category.isBlank() ? this.ticketRepository.countByAssignedAgentAndCategory(agent.getId(), category) : 0L;
      double availabilityScore = (double)1.0F / ((double)1.0F + (double)activeTickets);
      double slaCompliance = activeTickets == 0L ? (double)100.0F : (double)(activeTickets - breachedActive) * (double)100.0F / (double)activeTickets;
      double slaScore = slaCompliance / (double)100.0F;
      double expertiseScore = category != null && !category.isBlank() ? Math.min((double)1.0F, (double)categoryCount / (double)5.0F) : (double)0.5F;
      double recommendationScore = 0.45 * availabilityScore + 0.35 * slaScore + 0.2 * expertiseScore;
      String competencyMatch = category != null && !category.isBlank()
         ? categoryCount + " ticket(s) similaires traités sur la catégorie " + category
         : "catégorie non renseignée, scoring basé sur charge et SLA";
      String reason = "Match compétence: " + competencyMatch + " · Charge active: " + activeTickets + " · SLA: " + Math.round(slaCompliance) + "%";
      return AgentRecommendationDTO.builder().id(agent.getId()).username(agent.getUsername()).firstName(agent.getFirstName()).lastName(agent.getLastName()).email(agent.getEmail()).fullName(agent.getFullName()).activeTickets(activeTickets).slaComplianceRate((double)Math.round(slaCompliance * (double)100.0F) / (double)100.0F).expertiseScore((double)Math.round(expertiseScore * (double)100.0F) / (double)100.0F).recommendationScore((double)Math.round(recommendationScore * (double)1000.0F) / (double)1000.0F).recommendationReason(reason).build();
   }

   private String normalizeNodeRef(String value) {
      if (value == null || value.isBlank()) {
         return null;
      }

      String normalized = value.trim();
      if (normalized.startsWith("workspace://SpacesStore/")) {
         return normalized;
      }

      if (normalized.contains("://")) {
         return normalized;
      }

      return "workspace://SpacesStore/" + normalized;
   }

   private void archiveTicketInternal(Ticket ticket, User user, boolean automatic) {
      if (ticket.getStatus() != TicketStatus.CLOSED) {
         throw new BusinessException("Seuls les tickets fermes peuvent etre archives");
      } else if (ticket.getAlfrescoFolderId() != null && !ticket.getAlfrescoFolderId().isBlank()) {
         log.info("Ticket {} deja archive sous {}", ticket.getReference(), ticket.getAlfrescoFolderId());
      } else {
         this.reportService.archiveToAlfresco(ticket);
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setAction("ARCHIVAGE");
         history.setOldValue(TicketStatus.CLOSED.name());
         history.setNewValue(ticket.getAlfrescoFolderId());
         history.setDescription(automatic ? "Archivage automatique du ticket" : "Archivage manuel du ticket");
         history.setPerformedBy(user != null ? user.getFullName() : "System");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
      }
   }

   private void recordArchiveSyncIssue(Ticket ticket, String phase, String error) {
      try {
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setAction("ARCHIVE_SYNC_WARNING");
         history.setFieldName("alfresco");
         history.setDescription("Archivage GED indisponible pendant " + phase + ". Ticket ferme mais synchronisation archive a verifier.");
         history.setNewValue(error != null ? error.substring(0, Math.min(error.length(), 450)) : "N/A");
         history.setPerformedBy("System");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
      } catch (Exception var5) {
         log.debug("Impossible d'enregistrer ARCHIVE_SYNC_WARNING pour {}", ticket.getReference());
      }

   }

   private void recordCamundaSyncIssue(Ticket ticket, String phase, String error) {
      try {
         TicketHistory history = new TicketHistory();
         history.setTicket(ticket);
         history.setAction("CAMUNDA_SYNC_WARNING");
         history.setFieldName("workflow");
         history.setDescription("Camunda indisponible pendant " + phase + ". Synchronisation workflow a verifier.");
         history.setNewValue(error != null ? error.substring(0, Math.min(error.length(), 450)) : "N/A");
         history.setPerformedBy("System");
         history.setCreatedAt(LocalDateTime.now());
         this.historyRepository.save(history);
      } catch (Exception var5) {
         log.debug("Impossible d'enregistrer CAMUNDA_SYNC_WARNING pour {}", ticket.getReference());
      }

   }

   private void scheduleTicketCreationSideEffects(Long ticketId) {
      this.runAfterCommit(() -> {
         this.camundaAsyncService.startTicketProcessAsync(ticketId);
         this.camundaAsyncService.notifyTicketCreatedAsync(ticketId);
      });
   }

   private void completeAssignmentTaskWhenReady(Ticket ticket, String phase) {
      if (ticket.getProcessInstanceId() != null) {
         this.camundaService.completeAssignmentTask(ticket);
         return;
      }

      this.runAfterCommit(() -> this.camundaAsyncService.completeAssignmentTaskAsync(ticket.getId(), phase));
   }

   private void runAfterCommit(Runnable action) {
      if (TransactionSynchronizationManager.isSynchronizationActive()) {
         TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
               action.run();
            }
         });
      } else {
         action.run();
      }
   }

}
