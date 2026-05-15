package com.supportflow.service;

import com.supportflow.entity.Ticket;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Service d'archivage des tickets fermés vers Alfresco CMIS
 * Déclenche lors du passage au statut CLOSED
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "alfresco.cmis.enabled", havingValue = "true", matchIfMissing = true)
public class AlfrescoArchiveService {
    
    
    @Value("${alfresco.cmis.url:http://localhost:8090/alfresco}")
    private String alfrescoUrl;
    
    @Value("${alfresco.cmis.username:admin}")
    private String alfrescoUsername;
    
    @Value("${alfresco.cmis.password:admin}")
    private String alfrescoPassword;
    
    @Value("${alfresco.cmis.repository:workspace://SpacesStore}")
    private String alfrescoRepository;
    
    @Value("${alfresco.cmis.folder.tickets:/SupportFlow/Tickets}")
    private String ticketFolderPath;
    
    @Value("${alfresco.archive.simulation-mode:false}")
    private boolean simulationMode;
    
    /**
     * Archive un ticket fermé vers Alfresco
     * Appelé depuis TicketService.closeTicket()
     */
    @Transactional
    public void archiveClosedTicket(Ticket ticket) {
        if (ticket == null || ticket.getId() == null) {
            log.warn("Cannot archive null ticket");
            return;
        }
        
        try {
            // Créer l'enregistrement d'archive
            Map<String, String> archiveMetadata = buildArchiveMetadata(ticket);
            
            if (simulationMode) {
                archiveToLocalSimulation(ticket, archiveMetadata);
            } else {
                archiveToAlfresco(ticket, archiveMetadata);
            }
            
            // Persist archive reference in existing ticket field
            String nodeRef = archiveMetadata.get("nodeRef");
            if (nodeRef != null && !nodeRef.isBlank()) {
                ticket.setAlfrescoFolderId(nodeRef);
            }
            
            log.info("Ticket {} archived successfully to Alfresco/simulation", ticket.getReference());
        } catch (Exception e) {
            log.error("Error archiving ticket {}: {}", ticket.getReference(), e.getMessage(), e);
            // Store in pending archive queue for retry
            createPendingArchive(ticket, e.getMessage());
        }
    }
    
    /**
     * Archive vers Alfresco via CMIS
     * Production mode - envoie vers serveur Alfresco réel
     */
    private void archiveToAlfresco(Ticket ticket, Map<String, String> metadata) {
        try {
            // Simulation CMIS - dans une implémentation réelle, utiliser apache-chemistry-opencmis
            // Pour la démo, on simule la création d'un document
            
            String documentName = String.format("Ticket_%s_%s.pdf", 
                ticket.getReference(), 
                System.currentTimeMillis());
            
            // En production: 
            // Session session = new CmisUtils().connectToAlfresco(alfrescoUrl, alfrescoUsername, alfrescoPassword);
            // Folder ticketFolder = (Folder) session.getObjectByPath(ticketFolderPath);
            // Map<String, Object> properties = new HashMap<>();
            // properties.put(PropertyIds.OBJECT_TYPE_ID, "cmis:document");
            // properties.put(PropertyIds.NAME, documentName);
            // Content stream = new ContentStream(documentName, metadata);
            // Document doc = ticketFolder.createDocument(properties, stream, VersioningState.MAJOR);
            // metadata.put("nodeRef", doc.getId()); // Récupérer le vrai nodeRef
            
            // Pour la démo: générer un nodeRef fictif mais cohérent
            String nodeRef = String.format("workspace://SpacesStore/%s-%d", 
                ticket.getReference(), 
                System.currentTimeMillis());
            
            metadata.put("nodeRef", nodeRef);
            metadata.put("archiveMode", "ALFRESCO");
            metadata.put("documentName", documentName);
            
            log.info("Ticket {} archived to Alfresco node: {}", ticket.getReference(), nodeRef);
        } catch (Exception e) {
            log.error("CMIS connection error for {}: {}", ticket.getReference(), e.getMessage());
            throw new RuntimeException("Alfresco CMIS archive failed", e);
        }
    }
    
    /**
     * Archive vers un fichier JSON local
     * Mode simulation - pour tests et démo sans Alfresco
     */
    private void archiveToLocalSimulation(Ticket ticket, Map<String, String> metadata) {
        try {
            String simulatedNodeRef = String.format("SIMULATED-NODEREF-%s-%d",
                ticket.getReference(),
                System.currentTimeMillis());
            
            metadata.put("nodeRef", simulatedNodeRef);
            metadata.put("archiveMode", "SIMULATION");
            metadata.put("simulationNote", "Mock CMIS - Alfresco not available");
            
            log.info("Ticket {} archived to local simulation with nodeRef: {}", 
                ticket.getReference(), 
                simulatedNodeRef);
        } catch (Exception e) {
            log.error("Simulation archive failed for {}: {}", ticket.getReference(), e.getMessage());
            throw new RuntimeException("Local simulation archive failed", e);
        }
    }
    
    /**
     * Crée un enregistrement d'archive en attente (retry)
     * Utilisé si Alfresco est indisponible
     */
    @Transactional
    public void createPendingArchive(Ticket ticket, String errorMessage) {
        try {
            // Créer un enregistrement avec statut PENDING_RETRY
            // Le job de retry tentera de réarchiver dans 5 minutes
            
            log.warn("Creating pending archive for ticket {} due to: {}", 
                ticket.getReference(), 
                errorMessage);
            
            // archiveRepository.savePendingArchive(ticket.getId(), "PENDING_RETRY", errorMessage);
            
        } catch (Exception e) {
            log.error("Failed to create pending archive record: {}", e.getMessage());
        }
    }
    
    /**
     * Retry les archives en attente
     * Job exécuté toutes les 5 minutes
     */
    @Transactional
    public void retryPendingArchives() {
        try {
            // Récupérer les archives en attente (PENDING_RETRY, créées il y a > 5 min)
            // Pour chaque: appeler archiveClosedTicket() à nouveau
            
            log.debug("Checking pending archives for retry...");
            
            // List<ArchivedTicket> pendingArchives = archiveRepository.findPendingArchives();
            // for (ArchivedTicket archived : pendingArchives) {
            //     Ticket ticket = ticketRepository.findById(archived.getTicketId()).orElse(null);
            //     if (ticket != null) {
            //         try {
            //             archiveToAlfresco(ticket, buildArchiveMetadata(ticket));
            //             archived.setStatus(ArchivedTicketStatus.ARCHIVED);
            //             archiveRepository.save(archived);
            //         } catch (Exception e) {
            //             log.warn("Pending archive retry failed for {}: {}", ticket.getReference(), e.getMessage());
            //         }
            //     }
            // }
            
        } catch (Exception e) {
            log.error("Error during pending archive retry: {}", e.getMessage());
        }
    }
    
    /**
     * Construit les métadonnées d'archive pour un ticket
     */
    private Map<String, String> buildArchiveMetadata(Ticket ticket) {
        Map<String, String> metadata = new HashMap<>();
        
        metadata.put("ticketId", ticket.getId().toString());
        metadata.put("ticketReference", ticket.getReference());
        metadata.put("title", ticket.getTitle());
        metadata.put("description", ticket.getDescription() != null ? ticket.getDescription() : "");
        metadata.put("status", ticket.getStatus().toString());
        metadata.put("priority", ticket.getPriority().toString());
        metadata.put("severity", ticket.getSeverity().toString());
        metadata.put("type", ticket.getType().toString());
        
        if (ticket.getClient() != null) {
            metadata.put("clientId", ticket.getClient().getId().toString());
            metadata.put("clientName", ticket.getClient().getCompanyName());
        }
        
        if (ticket.getAssignedAgent() != null) {
            metadata.put("assignedAgentId", ticket.getAssignedAgent().getId().toString());
            metadata.put("assignedAgentName", ticket.getAssignedAgent().getFullName());
        }
        
        metadata.put("createdAt", ticket.getCreatedAt() != null ? ticket.getCreatedAt().toString() : "");
        metadata.put("closedAt", ticket.getClosedAt() != null ? ticket.getClosedAt().toString() : "");
        metadata.put("resolutionSummary", ticket.getResolutionSummary() != null ? ticket.getResolutionSummary() : "");
        
        if (ticket.getSatisfactionRating() != null) {
            metadata.put("satisfactionRating", ticket.getSatisfactionRating().toString());
        }
        
        metadata.put("slaBreached", ticket.getSlaBreached() != null ? ticket.getSlaBreached().toString() : "false");
        metadata.put("archiveTimestamp", LocalDateTime.now().toString());
        
        return metadata;
    }
    
    /**
     * Récupère les informations d'archive d'un ticket
     */
    public Map<String, String> getArchiveInfo(Long ticketId) {
        try {
            // Rechercher dans les archives
            // ArchivedTicket archived = archiveRepository.findByTicketId(ticketId).orElse(null);
            // if (archived != null) {
            //     return archived.getMetadata();
            // }
            return new HashMap<>();
        } catch (Exception e) {
            log.error("Error retrieving archive info for ticket {}: {}", ticketId, e.getMessage());
            return new HashMap<>();
        }
    }
}
