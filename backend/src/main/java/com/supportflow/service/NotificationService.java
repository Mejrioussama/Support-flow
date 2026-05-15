package com.supportflow.service;

import com.supportflow.dto.AgentRecommendationDTO;
import com.supportflow.dto.NotificationDTO;
import com.supportflow.entity.Notification;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.User;
import com.supportflow.entity.enums.Role;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.mapper.EntityMapper;
import com.supportflow.repository.NotificationRepository;
import com.supportflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service de gestion des notifications
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final EntityMapper mapper;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired @Lazy
    private TicketService ticketService;
    
    /**
     * Notifie la création d'un nouveau ticket
     */
    public void notifyTicketCreated(Ticket ticket) {
        log.debug("Notification: ticket créé {}", ticket.getReference());
        
        // Notifier les responsables support et admins
        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(Role.ADMIN);
        
        managers.forEach(manager -> {
            Notification notification = Notification.ticketCreated(manager, ticket);
            saveAndSend(notification);
        });
        
        admins.forEach(admin -> {
            Notification notification = Notification.ticketCreated(admin, ticket);
            saveAndSend(notification);
        });
    }
    
    /**
     * Notifie l'assignation d'un ticket
     */
    public void notifyTicketAssigned(Ticket ticket, User agent) {
        log.debug("Notification: ticket {} assigné à {}", ticket.getReference(), agent.getFullName());
        
        Notification notification = Notification.ticketAssigned(agent, ticket);
        saveAndSend(notification);
        
        // Notifier aussi le créateur du ticket
        if (ticket.getCreatedByUser() != null) {
            Notification clientNotification = Notification.builder()
                .user(ticket.getCreatedByUser())
                .ticket(ticket)
                .title("Ã°ÂÂÂ Votre ticket a été pris en charge")
                .message("Le ticket " + ticket.getReference() + " a été assigné à " + agent.getFullName())
                .type("TICKET_ASSIGNED")
                .icon("pi-user")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build();
            saveAndSend(clientNotification);
        }
    }
    
    /**
     * Notifie le changement de statut
     */
    public void notifyStatusChanged(Ticket ticket, TicketStatus newStatus) {
        log.debug("Notification: statut ticket {} -> {}", ticket.getReference(), newStatus);
        
        // Notifier le créateur du ticket
        if (ticket.getCreatedByUser() != null) {
            Notification notification = Notification.ticketStatusChanged(
                ticket.getCreatedByUser(), ticket, newStatus.getLabel());
            saveAndSend(notification);
        }
        
        // Notifier l'agent assigné (si différent du créateur)
        if (ticket.getAssignedAgent() != null && 
            !ticket.getAssignedAgent().equals(ticket.getCreatedByUser())) {
            Notification notification = Notification.ticketStatusChanged(
                ticket.getAssignedAgent(), ticket, newStatus.getLabel());
            saveAndSend(notification);
        }
    }
    
    /**
     * Notifie la résolution d'un ticket
     */
    public void notifyTicketResolved(Ticket ticket) {
        log.debug("Notification: ticket {} résolu", ticket.getReference());
        
        if (ticket.getCreatedByUser() != null) {
            Notification notification = Notification.ticketResolved(ticket.getCreatedByUser(), ticket);
            saveAndSend(notification);
        }
    }
    
    /**
     * Notifie l'alerte SLA
     */
    public void notifySlaWarning(Ticket ticket) {
        log.debug("Notification: alerte SLA pour {}", ticket.getReference());
        
        if (ticket.getAssignedAgent() != null) {
            Notification notification = Notification.slaWarning(ticket.getAssignedAgent(), ticket);
            saveAndSend(notification);
        }
    }

    /**
     * Smart SLA Phase 1 âÂÂ Early Warning (50% du temps SLA consomme).
     * Notifie l'agent avec guidance metier: continuer ou escalader.
     */
    public void notifySlaCheckpoint(Ticket ticket) {
        if (ticket.getAssignedAgent() == null) return;
        saveAndSend(Notification.builder()
            .user(ticket.getAssignedAgent())
            .ticket(ticket)
            .title("âÂÂ³ SLA 50% âÂÂ " + ticket.getReference())
            .message("Le ticket consomme déjà 50% du temps SLA. " +
                     "Veuillez : continuer le traitement ou escalader manuellement au manager si nécessaire.")
            .type("SLA_WARNING_50")
            .icon("pi-clock")
            .slaPercentage(50)
            .actionRequired(false)
            .suggestedActions("[\"Continuer le traitement\",\"Escalader au manager\"]")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build());
        broadcastSlaEvent(ticket, "SLA_WARNING_50", 50, false);
    }

    /**
     * Smart SLA Phase 2 âÂÂ Risk Critical (80% du temps SLA consomme).
     * Notification forte pour l'agent + alerte superviseur.
     * Auto-upgrade priorite vers HIGH.
     */
    public void notifySlaAtRisk(Ticket ticket) {
        if (ticket.getAssignedAgent() != null) {
            saveAndSend(Notification.builder()
                .user(ticket.getAssignedAgent())
                .ticket(ticket)
                .title("Ã°ÂÂÂ¨ SLA 80% âÂÂ Action urgente !")
                .message("Ticket " + ticket.getReference() + " est proche du dépassement SLA. " +
                         "Recommandé : finaliser la résolution rapidement ou notifier le manager immédiatement.")
                .type("SLA_WARNING_80")
                .icon("pi-exclamation-circle")
                .slaPercentage(80)
                .actionRequired(true)
                .suggestedActions("[\"Finaliser la résolution\",\"Notifier le manager\",\"Escalader manuellement\"]")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
        }

        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        managers.forEach(manager -> saveAndSend(Notification.builder()
            .user(manager)
            .ticket(ticket)
            .title("Ã°ÂÂÂ¨ SLA 80% âÂÂ Supervision requise")
            .message("Le ticket " + ticket.getReference() + " est à risque critique (80% SLA consommé). " +
                     "Priorité automatiquement élevée à HIGH. Supervision recommandée.")
            .type("SLA_WARNING_80")
            .icon("pi-bell")
            .slaPercentage(80)
            .actionRequired(true)
            .suggestedActions("[\"Surveiller le ticket\",\"Prendre en charge\",\"Réassigner\"]")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));
        broadcastSlaEvent(ticket, "SLA_WARNING_80", 80, true);
    }
    
    /**
     * Notifie le dépassement SLA
     */
    public void notifySlaBreached(Ticket ticket) {
        log.debug("Notification: SLA dépassé pour {}", ticket.getReference());
        
        if (ticket.getAssignedAgent() != null) {
            Notification notification = Notification.slaBreached(ticket.getAssignedAgent(), ticket);
            saveAndSend(notification);
        }
        
        // Notifier les managers et admins
        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(Role.ADMIN);
        
        managers.forEach(manager -> {
            Notification notification = Notification.slaBreached(manager, ticket);
            saveAndSend(notification);
        });
        
        admins.forEach(admin -> {
            Notification notification = Notification.slaBreached(admin, ticket);
            saveAndSend(notification);
        });
    }
    
    /**
     * Notifie un nouveau commentaire
     */
    public void notifyNewComment(Ticket ticket, User commenter) {
        log.debug("Notification: nouveau commentaire sur {}", ticket.getReference());
        
        // Notifier le créateur du ticket (si pas l'auteur du commentaire)
        if (ticket.getCreatedByUser() != null && !ticket.getCreatedByUser().equals(commenter)) {
            Notification notification = Notification.newComment(
                ticket.getCreatedByUser(), ticket, commenter.getFullName());
            saveAndSend(notification);
        }
        
        // Notifier l'agent assigné (si pas l'auteur du commentaire)
        if (ticket.getAssignedAgent() != null && !ticket.getAssignedAgent().equals(commenter)) {
            Notification notification = Notification.newComment(
                ticket.getAssignedAgent(), ticket, commenter.getFullName());
            saveAndSend(notification);
        }
    }

    /**
     * Notifie qu'un client a repondu et que le ticket repart en traitement
     */
    public void notifyCustomerResponseReceived(Ticket ticket, User customer) {
        log.debug("Notification: reponse client recue sur {}", ticket.getReference());

        Set<Long> notifiedUserIds = new HashSet<>();

        if (ticket.getAssignedAgent() != null && !ticket.getAssignedAgent().equals(customer)) {
            saveAndSend(Notification.customerResponseReceived(
                ticket.getAssignedAgent(), ticket, customer.getFullName()));
            notifiedUserIds.add(ticket.getAssignedAgent().getId());
        }

        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        managers.stream()
            .filter(manager -> !manager.equals(customer))
            .filter(manager -> notifiedUserIds.add(manager.getId()))
            .forEach(manager -> saveAndSend(Notification.customerResponseReceived(
                manager, ticket, customer.getFullName())));
    }

    public void notifyManagerReviewRequested(Ticket ticket, String reason, User requestedBy) {
        if (ticket.getAssignedAgent() == null) {
            return;
        }

        saveAndSend(Notification.builder()
            .user(ticket.getAssignedAgent())
            .ticket(ticket)
            .title("Revue manager demandee")
            .message("Une revue manager a ete demandee sur " + ticket.getReference()
                + (reason != null && !reason.isBlank() ? " : " + reason : ""))
            .type("MANAGER_REVIEW_REQUESTED")
            .icon("manage_accounts")
            .actionRequired(true)
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build());
    }

    public void notifyResolutionRejected(Ticket ticket, User actor, String reason) {
        Set<Long> notifiedUserIds = new HashSet<>();

        if (ticket.getAssignedAgent() != null) {
            saveAndSend(Notification.builder()
                .user(ticket.getAssignedAgent())
                .ticket(ticket)
                .title("Resolution refusee")
                .message("La resolution du ticket " + ticket.getReference() + " a ete refusee"
                    + (reason != null && !reason.isBlank() ? " : " + reason.trim() : ""))
                .type("RESOLUTION_REJECTED")
                .icon("thumb_down")
                .actionRequired(true)
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
            notifiedUserIds.add(ticket.getAssignedAgent().getId());
        }

        userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER).stream()
            .filter(manager -> notifiedUserIds.add(manager.getId()))
            .forEach(manager -> saveAndSend(Notification.builder()
                .user(manager)
                .ticket(ticket)
                .title("Resolution refusee")
                .message("Le ticket " + ticket.getReference() + " necessite une reprise apres refus client.")
                .type("RESOLUTION_REJECTED")
                .icon("thumb_down")
                .actionRequired(true)
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build()));
    }

    public void notifyTicketBlocked(Ticket ticket) {
        userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER).forEach(manager -> saveAndSend(Notification.builder()
            .user(manager)
            .ticket(ticket)
            .title("Ticket bloque en attente")
            .message("Le ticket " + ticket.getReference() + " reste en attente depuis trop longtemps.")
            .type("TICKET_BLOCKED")
            .icon("hourglass_top")
            .actionRequired(true)
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));
    }
    
    /**
     * Notifie l'escalade manuelle d'un ticket
     */
    public void notifyTicketEscalated(Ticket ticket, User newAgent, String motif) {
        log.debug("Notification: ticket {} escaladé vers {}", ticket.getReference(), newAgent.getFullName());
        
        // Notifier le nouvel agent assigné
        Notification agentNotif = Notification.builder()
            .user(newAgent)
            .ticket(ticket)
            .title("Ã°ÂÂÂ© Ticket escaladé vers vous")
            .message("Le ticket " + ticket.getReference() + " a été escaladé vers vous. Motif: " + motif)
            .type("TICKET_ESCALATED")
            .icon("pi-arrow-up")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build();
        saveAndSend(agentNotif);
        
        // Notifier le client (créateur du ticket)
        if (ticket.getCreatedByUser() != null) {
            Notification clientNotif = Notification.builder()
                .user(ticket.getCreatedByUser())
                .ticket(ticket)
                .title("Ã°ÂÂÂ© Votre ticket nécessite une expertise avancée")
                .message("Le ticket " + ticket.getReference() + " a été transmis à un spécialiste pour un traitement approfondi.")
                .type("TICKET_ESCALATED")
                .icon("pi-arrow-up")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build();
            saveAndSend(clientNotif);
        }
    }
    
    /**
     * Smart SLA Phase 3 âÂÂ SLA Overrun (100%+).
     * Smart Decision Notification pour managers/admins avec options d'action.
     * Inclut la recommandation intelligente du meilleur agent disponible.
     */
    public void notifySLAEscalation(Ticket ticket) {
        log.debug("Notification: escalade SLA pour {}", ticket.getReference());

        // Recuperer la recommandation intelligente d'agent
        String recommendedAgentName = null;
        Long recommendedAgentId = null;
        try {
            if (ticketService != null) {
                List<AgentRecommendationDTO> recommendations = ticketService.getRecommendedAgents(ticket.getId());
                if (!recommendations.isEmpty()) {
                    AgentRecommendationDTO best = recommendations.get(0);
                    recommendedAgentName = best.getFullName() +
                        " (SLA: " + Math.round(best.getSlaComplianceRate()) + "%, charge: " + best.getActiveTickets() + " tickets)";
                    recommendedAgentId = best.getId();
                }
            }
        } catch (Exception e) {
            log.warn("Impossible d'obtenir la recommandation agent pour SLA: {}", e.getMessage());
        }

        final String finalRecommendedAgentName = recommendedAgentName;
        final Long finalRecommendedAgentId = recommendedAgentId;

        String managerActions = "[\"Résoudre le ticket vous-même\",\"Réassigner à un autre agent\",\"Maintenir l'assignation actuelle\",\"Ajouter un commentaire métier\"]";
        String managerMsg = "âÂÂ SLA dépassé sur le ticket " + ticket.getReference() + ". Action requise immédiatement." +
            (finalRecommendedAgentName != null
                ? " \n\nÃ°ÂÂ¤Â Meilleure action recommandée : Réassigner à " + finalRecommendedAgentName + "."
                : "");

        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(Role.ADMIN);

        managers.forEach(manager -> saveAndSend(Notification.builder()
            .user(manager)
            .ticket(ticket)
            .title("âÂÂ SLA dépassé âÂÂ Action requise")
            .message(managerMsg)
            .type("SLA_ESCALATION")
            .icon("pi-exclamation-triangle")
            .slaPercentage(100)
            .actionRequired(true)
            .suggestedActions(managerActions)
            .recommendedAgent(finalRecommendedAgentName)
            .recommendedAgentId(finalRecommendedAgentId)
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));

        admins.forEach(admin -> saveAndSend(Notification.builder()
            .user(admin)
            .ticket(ticket)
            .title("âÂÂ SLA dépassé âÂÂ Intervention requise")
            .message(managerMsg)
            .type("SLA_ESCALATION")
            .icon("pi-exclamation-triangle")
            .slaPercentage(100)
            .actionRequired(true)
            .suggestedActions(managerActions)
            .recommendedAgent(finalRecommendedAgentName)
            .recommendedAgentId(finalRecommendedAgentId)
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));

        if (ticket.getAssignedAgent() != null) {
            saveAndSend(Notification.builder()
                .user(ticket.getAssignedAgent())
                .ticket(ticket)
                .title("âÂÂ SLA dépassé âÂÂ Traitement prioritaire")
                .message("Le ticket " + ticket.getReference() + " est en escalade SLA critique. " +
                         "Traitez en priorité absolue ou contactez votre manager immédiatement.")
                .type("SLA_ESCALATION")
                .icon("pi-exclamation-triangle")
                .slaPercentage(100)
                .actionRequired(true)
                .suggestedActions("[\"Finaliser la résolution maintenant\",\"Contacter le manager\"]")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
        }

        if (ticket.getCreatedByUser() != null) {
            saveAndSend(Notification.builder()
                .user(ticket.getCreatedByUser())
                .ticket(ticket)
                .title("Ã°ÂÂÂ Mise à jour SLA âÂÂ " + ticket.getReference())
                .message("Votre ticket est passé en traitement prioritaire (escalade SLA) pour accélérer la résolution. " +
                         "Notre équipe travaille activement sur votre demande.")
                .type("SLA_ESCALATION")
                .icon("pi-bolt")
                .slaPercentage(100)
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
        }
        broadcastSlaEvent(ticket, "SLA_ESCALATION", 100, true);
    }

    /**
     * Notification repetitive si le ticket reste escalade (L2/L3) trop longtemps.
     */
    public void notifyLongRunningEscalation(Ticket ticket) {
        log.debug("Notification: evenement SLA critique pour {}", ticket.getReference());

        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(Role.ADMIN);

        managers.forEach(manager -> saveAndSend(Notification.builder()
            .user(manager)
            .ticket(ticket)
            .title("SLA critique >24h - " + ticket.getReference())
            .message("Le ticket reste en escalade active (niveau " + Math.max(ticket.getEscalationLevel() != null ? ticket.getEscalationLevel() : 2, 2)
                + ") depuis plus de 24h. Action manager requise.")
            .type("SLA_CRITICAL_EVENT")
            .icon("pi-bell")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));

        admins.forEach(admin -> saveAndSend(Notification.builder()
            .user(admin)
            .ticket(ticket)
            .title("SLA critique >24h - " + ticket.getReference())
            .message("Le ticket reste en escalade active depuis plus de 24h.")
            .type("SLA_CRITICAL_EVENT")
            .icon("pi-bell")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));
    }

    /**
     * Notification d'escalade L1: réassignation automatique à un nouvel agent.
     */
    public void notifyEscalationReassignment(Ticket ticket, User newAgent, User oldAgent) {
        log.debug("Notification: escalade L1 reassignation {} -> {}", 
            oldAgent != null ? oldAgent.getUsername() : "N/A", newAgent.getUsername());

        // Notifier le nouvel agent
        saveAndSend(Notification.builder()
            .user(newAgent)
            .ticket(ticket)
            .title("Ticket reassigne vers vous - " + ticket.getReference())
            .message("Le ticket " + ticket.getReference() + " vous a ete reassigne automatiquement. " +
                     "Priorite: " + ticket.getPriority() + ". Traitement immediat requis.")
            .type("ESCALATION_REASSIGNMENT")
            .icon("pi-arrow-right")
            .actionRequired(true)
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build());

        // Notifier l'ancien agent
        if (oldAgent != null) {
            saveAndSend(Notification.builder()
                .user(oldAgent)
                .ticket(ticket)
                .title("Ticket reassigne - " + ticket.getReference())
                .message("Le ticket " + ticket.getReference() + " a ete reassigne a " + newAgent.getFullName() 
                         + " suite a une escalade automatique.")
                .type("ESCALATION_REASSIGNMENT")
                .icon("pi-arrow-right")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
        }

        // Notifier les managers
        List<User> managers = userRepository.findByRoleAndIsActiveTrue(Role.SUPPORT_MANAGER);
        managers.forEach(manager -> saveAndSend(Notification.builder()
            .user(manager)
            .ticket(ticket)
            .title("Reaffectation intelligente - " + ticket.getReference())
            .message("Ticket " + ticket.getReference() + " reassigne de " 
                     + (oldAgent != null ? oldAgent.getFullName() : "non assigne") 
                     + " vers " + newAgent.getFullName() + " (escalade automatique SLA).")
            .type("ESCALATION_REASSIGNMENT")
            .icon("pi-arrow-right")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));
    }

    /**
     * Notification d'escalade L3: prise en charge directe par le manager.
     */
    public void notifyEscalationToManager(Ticket ticket, User manager, User oldAgent) {
        log.debug("Notification: escalade L3 prise en charge manager {} pour {}", 
            manager.getUsername(), ticket.getReference());

        // Notifier le manager qui prend en charge
        saveAndSend(Notification.builder()
            .user(manager)
            .ticket(ticket)
            .title("Prise en charge manager - " + ticket.getReference())
            .message("Le ticket " + ticket.getReference() + " necessite votre prise en charge directe. " +
                     "SLA depasse, aucune action depuis le delai limite. Priorite: " + ticket.getPriority())
            .type("ESCALATION_MANAGER_TAKEOVER")
            .icon("pi-exclamation-circle")
            .actionRequired(true)
            .suggestedActions("[\"Prendre en charge immediatement\",\"Resoudre le ticket\",\"Reassigner a un specialiste\"]")
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build());

        // Notifier l'ancien agent
        if (oldAgent != null) {
            saveAndSend(Notification.builder()
                .user(oldAgent)
                .ticket(ticket)
                .title("Ticket transfere au manager - " + ticket.getReference())
                .message("Le ticket " + ticket.getReference() + " a ete pris en charge par le manager " 
                         + manager.getFullName() + " suite a une escalade manager.")
                .type("ESCALATION_MANAGER_TAKEOVER")
                .icon("pi-exclamation-circle")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
        }

        // Notifier les admins
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(Role.ADMIN);
        admins.forEach(admin -> saveAndSend(Notification.builder()
            .user(admin)
            .ticket(ticket)
            .title("Manager prend en charge - " + ticket.getReference())
            .message("Escalade critique: " + manager.getFullName() + " prend en charge le ticket " 
                     + ticket.getReference() + " (ancien agent: " 
                     + (oldAgent != null ? oldAgent.getFullName() : "N/A") + ").")
            .type("ESCALATION_MANAGER_TAKEOVER")
            .icon("pi-exclamation-circle")
            .actionRequired(true)
            .ticketReference(ticket.getReference())
            .link("/tickets/" + ticket.getId())
            .build()));

        // Notifier le client
        if (ticket.getCreatedByUser() != null) {
            saveAndSend(Notification.builder()
                .user(ticket.getCreatedByUser())
                .ticket(ticket)
                .title("Votre ticket pris en charge par un responsable")
                .message("Le ticket " + ticket.getReference() + " a ete escalade et est maintenant " +
                         "pris en charge directement par un responsable pour accelerer sa resolution.")
                .type("ESCALATION_MANAGER_TAKEOVER")
                .icon("pi-user")
                .ticketReference(ticket.getReference())
                .link("/tickets/" + ticket.getId())
                .build());
        }
    }

    /**
     * Recupere les notifications d'un utilisateur
     */
    @Transactional(readOnly = true)
    public Page<NotificationDTO> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findUserNotifications(userId, pageable)
            .map(mapper::toNotificationDTO);
    }
    
    /**
     * Récupère les notifications non lues
     */
    @Transactional(readOnly = true)
    public List<NotificationDTO> getUnreadNotifications(Long userId) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId)
            .stream()
            .map(mapper::toNotificationDTO)
            .toList();
    }
    
    /**
     * Compte les notifications non lues
     */
    @Transactional(readOnly = true)
    public long countUnreadNotifications(Long userId) {
        return notificationRepository.countUnreadByUserId(userId);
    }
    
    /**
     * Marque une notification comme lue
     */
    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            notification.markAsRead();
            notificationRepository.save(notification);
        });
    }
    
    /**
     * Marque une notification comme lue avec vérification de propriété
     */
    public void markAsReadForUser(Long notificationId, Long userId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            if (notification.getUser() != null && notification.getUser().getId().equals(userId)) {
                notification.markAsRead();
                notificationRepository.save(notification);
            }
        });
    }
    
    /**
     * Marque toutes les notifications d'un utilisateur comme lues
     */
    public int markAllAsRead(Long userId) {
        return notificationRepository.markAllAsReadByUserId(userId, LocalDateTime.now());
    }

    public boolean deleteForUser(Long notificationId, Long userId) {
        return notificationRepository.deleteByIdAndUserId(notificationId, userId) > 0;
    }

    public int deleteReadForUser(Long userId) {
        return notificationRepository.deleteReadByUserId(userId);
    }
    
    // Méthode privée pour sauvegarder et envoyer via WebSocket
    private void saveAndSend(Notification notification) {
        notification = notificationRepository.save(notification);
        
        // Envoyer via WebSocket à l'utilisateur spécifique
        try {
            String destination = "/user/" + notification.getUser().getId() + "/notifications";
            NotificationDTO dto = mapper.toNotificationDTO(notification);
            messagingTemplate.convertAndSend(destination, dto);
        } catch (Exception e) {
            log.warn("Impossible d'envoyer la notification WebSocket: {}", e.getMessage());
        }
    }
    
    // ============================================================
    // Méthodes de broadcast temps réel (WebSocket topics)
    // ============================================================
    
    /**
     * Broadcast un changement de statut en temps réel à tous les abonnés
     */
    public void broadcastTicketStatusChange(Ticket ticket, String oldStatus, String newStatus) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "STATUS_CHANGE");
            event.put("ticketId", ticket.getId());
            event.put("ticketReference", ticket.getReference());
            event.put("oldStatus", oldStatus);
            event.put("newStatus", newStatus);
            event.put("timestamp", LocalDateTime.now().toString());
            
            // Broadcast global (tous les tickets)
            messagingTemplate.convertAndSend("/topic/tickets", event);
            // Broadcast spécifique au ticket
            messagingTemplate.convertAndSend("/topic/tickets/" + ticket.getId(), event);
            
            log.debug("WebSocket broadcast: statut {} -> {} pour {}", oldStatus, newStatus, ticket.getReference());
        } catch (Exception e) {
            log.warn("Erreur broadcast WebSocket status: {}", e.getMessage());
        }
    }
    
    /**
     * Broadcast un nouveau commentaire en temps réel
     */
    public void broadcastNewComment(Long ticketId, String ticketReference, String authorName, String content) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "NEW_COMMENT");
            event.put("ticketId", ticketId);
            event.put("ticketReference", ticketReference);
            event.put("authorName", authorName);
            event.put("content", content.length() > 100 ? content.substring(0, 100) + "..." : content);
            event.put("timestamp", LocalDateTime.now().toString());
            
            messagingTemplate.convertAndSend("/topic/tickets/" + ticketId + "/comments", event);
            messagingTemplate.convertAndSend("/topic/tickets", event);
            
            log.debug("WebSocket broadcast: nouveau commentaire sur {}", ticketReference);
        } catch (Exception e) {
            log.warn("Erreur broadcast WebSocket commentaire: {}", e.getMessage());
        }
    }
    
    /**
     * Broadcast une mise à jour Camunda (tâche créée/complétée)
     */
    public void broadcastCamundaTaskUpdate(Long ticketId, String ticketReference, String taskName, String taskAction) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "CAMUNDA_TASK");
            event.put("ticketId", ticketId);
            event.put("ticketReference", ticketReference);
            event.put("taskName", taskName);
            event.put("taskAction", taskAction); // CREATED, COMPLETED, ASSIGNED
            event.put("timestamp", LocalDateTime.now().toString());
            
            messagingTemplate.convertAndSend("/topic/tasks", event);
            messagingTemplate.convertAndSend("/topic/tickets/" + ticketId, event);
            
            log.debug("WebSocket broadcast: Camunda task {} ({}) pour {}", taskName, taskAction, ticketReference);
        } catch (Exception e) {
            log.warn("Erreur broadcast WebSocket Camunda: {}", e.getMessage());
        }
    }
    
    /**
     * Broadcast un événement de ticket générique
     */
    public void broadcastTicketEvent(Ticket ticket, String eventType, Map<String, Object> extra) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", eventType);
            event.put("ticketId", ticket.getId());
            event.put("ticketReference", ticket.getReference());
            event.put("timestamp", LocalDateTime.now().toString());
            if (extra != null) event.putAll(extra);
            
            messagingTemplate.convertAndSend("/topic/tickets", event);
            
            log.debug("WebSocket broadcast: {} pour {}", eventType, ticket.getReference());
        } catch (Exception e) {
            log.warn("Erreur broadcast WebSocket: {}", e.getMessage());
        }
    }

    /**
     * Broadcast un evenement SLA en temps reel via WebSocket
     */
    public void broadcastSlaEvent(Ticket ticket, String slaEventType, int slaPercentage, boolean actionRequired) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", slaEventType);
            event.put("ticketId", ticket.getId());
            event.put("ticketReference", ticket.getReference());
            event.put("slaPercentage", slaPercentage);
            event.put("actionRequired", actionRequired);
            event.put("priority", ticket.getPriority() != null ? ticket.getPriority().name() : null);
            event.put("assignedAgent", ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getFullName() : null);
            event.put("timestamp", LocalDateTime.now().toString());

            messagingTemplate.convertAndSend("/topic/sla-alerts", event);
            messagingTemplate.convertAndSend("/topic/tickets/" + ticket.getId(), event);
            messagingTemplate.convertAndSend("/topic/tickets", event);

            log.debug("WebSocket SLA broadcast: {} ({}%) pour {}", slaEventType, slaPercentage, ticket.getReference());
        } catch (Exception e) {
            log.warn("Erreur broadcast WebSocket SLA: {}", e.getMessage());
        }
    }
}

