package com.supportflow.service;

import com.supportflow.dto.ProcessStatusDTO;
import com.supportflow.dto.WorkflowTraceDTO;
import com.supportflow.dto.WorkflowTraceStepDTO;
import com.supportflow.entity.Ticket;
import com.supportflow.entity.enums.TicketStatus;
import com.supportflow.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.ManagementService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.history.HistoricProcessInstance;
import org.camunda.bpm.engine.history.HistoricActivityInstance;
import org.camunda.bpm.engine.runtime.Job;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.camunda.bpm.engine.task.Task;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service d'intégration avec Camunda BPM
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CamundaService {
    
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final ManagementService managementService;
    private final HistoryService historyService;
    private final TicketRepository ticketRepository;
    
    private static final String PROCESS_KEY = "ticket-workflow";

    @Value("${supportflow.notifications.sla-warning-threshold:0.75}")
    private double slaEscalationThreshold;
    
    /**
     * Démarre un nouveau processus de ticket
     */
    public String startTicketProcess(Ticket ticket) {
        log.info("Démarrage du processus Camunda pour le ticket: {}", ticket.getReference());

        ProcessInstance existingInstance = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(ticket.getReference())
            .active()
            .orderByProcessInstanceId()
            .desc()
            .listPage(0, 1)
            .stream()
            .findFirst()
            .orElse(null);

        if (existingInstance != null) {
            log.info("Processus Camunda déjà actif pour {}: {}", ticket.getReference(), existingInstance.getId());
            return existingInstance.getId();
        }
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("ticketId", ticket.getId());
        variables.put("ticketReference", ticket.getReference());
        variables.put("ticketTitle", ticket.getTitle());
        variables.put("severity", ticket.getSeverity().name());
        variables.put("impact", ticket.getImpact().name());
        variables.put("priority", ticket.getPriority().name());
        variables.put("score", ticket.getScore());
        variables.put("clientId", ticket.getClient().getId());
        variables.put("slaHours", ticket.getSlaHours());
        int slaMinutes = ticket.getSlaHours(); // slaHours field now stores minutes
        variables.put("slaTimerDurationCheckpoint", "PT" + (int)(slaMinutes * 0.5) + "M");
        variables.put("slaTimerDurationAtRisk", "PT" + (int)(slaMinutes * 0.8) + "M");
        variables.put("slaTimerDuration100", "PT" + slaMinutes + "M");
        
        variables.put("slaEscalationMinutes", calculateEscalationMinutes(ticket.getSlaHours()));
        // Absolute timer date so SLA warning is aligned with ticket creation/deadline,
        // not delayed by late assignment or task start.
        variables.put("slaEscalationAt", calculateEscalationTime(ticket));
        
        try {
            ProcessInstance processInstance = runtimeService.startProcessInstanceByKey(
                PROCESS_KEY, 
                ticket.getReference(), 
                variables
            );
            
            log.info("Processus démarré: {}", processInstance.getId());
            return processInstance.getId();
        } catch (Exception e) {
            log.error("Erreur lors du démarrage du processus Camunda", e);
            throw new RuntimeException("Impossible de démarrer le workflow", e);
        }
    }
    
    /**
     * Complète la tâche d'assignation
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeAssignmentTask(Ticket ticket) {
        if (ticket.getProcessInstanceId() == null) {
            log.warn("Pas de processus Camunda associé au ticket: {}", ticket.getReference());
            return;
        }
        
        try {
            Task task = taskService.createTaskQuery()
                .processInstanceId(ticket.getProcessInstanceId())
                .taskDefinitionKey("qualify_ticket")
                .orderByTaskCreateTime()
                .desc()
                .listPage(0, 1)
                .stream()
                .findFirst()
                .orElse(null);
            
            if (task != null) {
                Map<String, Object> variables = new HashMap<>();
                variables.put("assignedAgentId", String.valueOf(ticket.getAssignedAgent().getId()));
                variables.put("assignedAgentName", ticket.getAssignedAgent().getFullName());
                
                taskService.complete(task.getId(), variables);
                log.info("Tâche de qualification complétée pour: {}", ticket.getReference());
            }
        } catch (Exception e) {
            log.error("Erreur lors de la complétion de la tâche Camunda", e);
        }
    }
    
    /**
     * Complète la tâche de résolution
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeResolutionTask(Ticket ticket) {
        if (ticket.getProcessInstanceId() == null) return;
        
        try {
            Task task = taskService.createTaskQuery()
                .processInstanceId(ticket.getProcessInstanceId())
                .taskDefinitionKey("resolve_ticket")
                .orderByTaskCreateTime()
                .desc()
                .listPage(0, 1)
                .stream()
                .findFirst()
                .orElse(null);
            
            if (task != null) {
                Map<String, Object> variables = new HashMap<>();
                variables.put("resolutionSummary", ticket.getResolutionSummary());
                variables.put("resolutionTimeMinutes", ticket.getResolutionTimeMinutes());
                variables.put("slaBreached", ticket.getSlaBreached());
                
                taskService.complete(task.getId(), variables);
                log.info("Tâche de résolution complétée pour: {}", ticket.getReference());
            }
        } catch (Exception e) {
            log.error("Erreur lors de la complétion de la tâche de résolution", e);
        }
    }
    
    /**
     * Complète la tâche de validation client
     * Strict mode: exceptions are propagated to caller (e.g. closeTicket) for transactional consistency.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean completeValidationTask(Ticket ticket, boolean validated) {
        if (ticket.getProcessInstanceId() == null) {
            log.warn("No Camunda process instance for ticket {}, skipping validation task completion", ticket.getReference());
            return false;
        }
        
        Task task = taskService.createTaskQuery()
            .processInstanceId(ticket.getProcessInstanceId())
            .taskDefinitionKey("client_validation")
            .orderByTaskCreateTime()
            .desc()
            .listPage(0, 1)
            .stream()
            .findFirst()
            .orElse(null);
        
        if (task == null) {
            log.warn("No client_validation task found for process {} (ticket {})", ticket.getProcessInstanceId(), ticket.getReference());
            return false;
        }
        
        Map<String, Object> variables = new HashMap<>();
        variables.put("clientValidated", validated);
        variables.put("satisfactionRating", ticket.getSatisfactionRating());
        variables.put("satisfactionComment", ticket.getSatisfactionComment());
        
        try {
            taskService.complete(task.getId(), variables);
            log.info("Tâche de validation client complétée pour: {}", ticket.getReference());
            return true;
        } catch (Exception e) {
            log.error("Erreur lors de la complétion de la tâche de validation pour {}: {}", ticket.getReference(), e.getMessage(), e);
            throw new IllegalStateException(
                "Camunda: impossible de compléter la tâche de validation client pour " + ticket.getReference(), e);
        }
    }
    
    /**
     * Annule un processus
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void cancelProcess(String processInstanceId, String reason) {
        if (processInstanceId == null) return;
        
        try {
            runtimeService.deleteProcessInstance(processInstanceId, reason);
            log.info("Processus annulé: {} - Raison: {}", processInstanceId, reason);
        } catch (Exception e) {
            log.error("Erreur lors de l'annulation du processus", e);
        }
    }
    
    /**
     * Récupère la tâche courante d'un processus
     */
    public String getCurrentTaskId(String processInstanceId) {
        if (processInstanceId == null) return null;
        
        try {
            Task task = taskService.createTaskQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
            
            return task != null ? task.getId() : null;
        } catch (Exception e) {
            log.error("Erreur lors de la récupération de la tâche courante", e);
            return null;
        }
    }
    
    /**
     * Met à jour les variables du processus
     */
    public void updateProcessVariables(String processInstanceId, Map<String, Object> variables) {
        if (processInstanceId == null || variables == null) return;
        
        try {
            runtimeService.setVariables(processInstanceId, variables);
        } catch (Exception e) {
            log.error("Erreur lors de la mise à jour des variables du processus", e);
        }
    }

    /**
     * Réconcilie un ticket CLOSED dont le processus Camunda est resté actif.
     * Avance les user tasks bloquées (qualify -> resolve -> client_validation) jusqu'à terminaison.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Map<String, Object> reconcileClosedTicketProcess(Ticket ticket) {
        Map<String, Object> result = new HashMap<>();
        List<String> transitions = new ArrayList<>();

        result.put("ticketReference", ticket.getReference());

        List<ProcessInstance> activeInstances = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(ticket.getReference())
            .active()
            .list();

        if (activeInstances == null || activeInstances.isEmpty()) {
            result.put("status", "NO_ACTIVE_INSTANCE");
            result.put("completed", true);
            result.put("transitions", transitions);
            return result;
        }

        int instancesCompleted = 0;
        int instancesCancelled = 0;
        List<String> instanceStatuses = new ArrayList<>();

        for (ProcessInstance instance : activeInstances) {
            int steps = 0;
            int maxSteps = 10;
            boolean cancelled = false;

            while (steps < maxSteps) {
                Task task = taskService.createTaskQuery()
                    .processInstanceId(instance.getId())
                    .orderByTaskCreateTime()
                    .desc()
                    .listPage(0, 1)
                    .stream()
                    .findFirst()
                    .orElse(null);

                if (task == null) {
                    break;
                }

                String taskKey = task.getTaskDefinitionKey();
                Map<String, Object> variables = new HashMap<>();

                if ("qualify_ticket".equals(taskKey)) {
                    if (ticket.getAssignedAgent() == null) {
                        instanceStatuses.add(instance.getId() + ":BLOCKED_NO_AGENT");
                        break;
                    }
                    variables.put("assignedAgentId", String.valueOf(ticket.getAssignedAgent().getId()));
                    variables.put("assignedAgentName", ticket.getAssignedAgent().getFullName());
                } else if ("resolve_ticket".equals(taskKey)) {
                    String summary = ticket.getResolutionSummary();
                    if (summary == null || summary.isBlank()) {
                        summary = "Auto reconciliation for closed ticket";
                    }
                    variables.put("resolutionSummary", summary);
                    variables.put("resolutionTimeMinutes", ticket.getResolutionTimeMinutes());
                    variables.put("slaBreached", ticket.getSlaBreached());
                } else if ("client_validation".equals(taskKey)) {
                    Integer rating = ticket.getSatisfactionRating() != null ? ticket.getSatisfactionRating() : 5;
                    String comment = ticket.getSatisfactionComment() != null ? ticket.getSatisfactionComment() : "Validated during workflow reconciliation";
                    variables.put("clientValidated", true);
                    variables.put("satisfactionRating", rating);
                    variables.put("satisfactionComment", comment);
                } else {
                    // Unknown user task on a CLOSED ticket: cancel orphan workflow instance.
                    runtimeService.deleteProcessInstance(instance.getId(), "Closed ticket reconciliation - unsupported task " + taskKey);
                    cancelled = true;
                    instanceStatuses.add(instance.getId() + ":CANCELLED_UNSUPPORTED_" + taskKey);
                    break;
                }

                taskService.complete(task.getId(), variables);
                transitions.add(taskKey);
                steps++;
            }

            ProcessInstance stillActive = runtimeService.createProcessInstanceQuery()
                .processInstanceId(instance.getId())
                .active()
                .listPage(0, 1)
                .stream()
                .findFirst()
                .orElse(null);

            if (stillActive == null) {
                instancesCompleted++;
                if (!cancelled) {
                    instanceStatuses.add(instance.getId() + ":COMPLETED");
                } else {
                    instancesCancelled++;
                }
            } else {
                Task currentTask = taskService.createTaskQuery()
                    .processInstanceId(stillActive.getId())
                    .orderByTaskCreateTime()
                    .desc()
                    .listPage(0, 1)
                    .stream()
                    .findFirst()
                    .orElse(null);

                if (currentTask == null) {
                    runtimeService.deleteProcessInstance(stillActive.getId(), "Closed ticket reconciliation - orphan active instance");
                    instancesCancelled++;
                    instanceStatuses.add(stillActive.getId() + ":CANCELLED_ORPHAN");
                } else {
                    instanceStatuses.add(stillActive.getId() + ":STILL_ACTIVE_" + currentTask.getTaskDefinitionKey());
                }
            }
        }

        long remaining = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(ticket.getReference())
            .active()
            .count();

        result.put("status", remaining == 0 ? "COMPLETED" : "STILL_ACTIVE");
        result.put("completed", remaining == 0);
        result.put("remaining", remaining);
        result.put("instancesProcessed", activeInstances.size());
        result.put("instancesCompleted", instancesCompleted);
        result.put("instancesCancelled", instancesCancelled);
        result.put("transitions", transitions);
        result.put("instanceStatuses", instanceStatuses);
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Map<String, Object> cleanupClosedActiveInstances(int limit) {
        int boundedLimit = Math.max(1, Math.min(limit, 1000));
        List<ProcessInstance> activeInstances = runtimeService.createProcessInstanceQuery()
            .active()
            .listPage(0, boundedLimit);

        int scanned = 0;
        int deleted = 0;
        List<String> deletedRefs = new ArrayList<>();
        List<String> skippedRefs = new ArrayList<>();

        for (ProcessInstance instance : activeInstances) {
            scanned++;
            String businessKey = instance.getBusinessKey();
            if (businessKey == null || businessKey.isBlank()) {
                skippedRefs.add(instance.getId() + ":NO_BUSINESS_KEY");
                continue;
            }

            Ticket ticket = ticketRepository.findByReference(businessKey).orElse(null);
            if (ticket == null || ticket.getStatus() != TicketStatus.CLOSED) {
                skippedRefs.add(businessKey + ":NOT_CLOSED");
                continue;
            }

            runtimeService.deleteProcessInstance(instance.getId(), "Cleanup closed ticket stale active instance");
            deleted++;
            deletedRefs.add(businessKey + ":" + instance.getId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("scanned", scanned);
        result.put("deleted", deleted);
        result.put("deletedInstances", deletedRefs);
        result.put("skipped", skippedRefs);
        return result;
    }

    /**
     * Réassigne la tâche de résolution à l'agent courant du ticket.
     * Utilisé pour les escalades manuelles sans bloquer le workflow.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reassignResolutionTask(Ticket ticket) {
        if (ticket.getProcessInstanceId() == null || ticket.getAssignedAgent() == null) {
            return;
        }

        try {
            Task task = taskService.createTaskQuery()
                .processInstanceId(ticket.getProcessInstanceId())
                .taskDefinitionKey("resolve_ticket")
                .orderByTaskCreateTime()
                .desc()
                .listPage(0, 1)
                .stream()
                .findFirst()
                .orElse(null);

            if (task != null) {
                String newAssignee = String.valueOf(ticket.getAssignedAgent().getId());
                taskService.setAssignee(task.getId(), newAssignee);
                taskService.setVariable(task.getId(), "assignedAgentId", newAssignee);
                taskService.setVariable(task.getId(), "assignedAgentName", ticket.getAssignedAgent().getFullName());
                log.info("Tâche resolve_ticket réassignée à {} pour {}", newAssignee, ticket.getReference());
            }
        } catch (Exception e) {
            log.error("Erreur lors de la réassignation de la tâche de résolution", e);
        }
    }

    /**
     * Suspend les timers SLA d'un processus (SLA en pause).
     * Repousse tous les timers très loin dans le futur pour les neutraliser.
     */
    public void suspendSlaTimers(Ticket ticket) {
        if (ticket.getProcessInstanceId() == null) return;
        try {
            // Push all timer jobs far into the future (effectively pausing them)
            Date farFuture = Date.from(LocalDateTime.now().plusYears(10)
                .atZone(ZoneId.systemDefault()).toInstant());
            var timerJobs = managementService.createJobQuery()
                .processInstanceId(ticket.getProcessInstanceId())
                .timers()
                .list();
            for (Job job : timerJobs) {
                managementService.setJobDuedate(job.getId(), farFuture);
            }
            runtimeService.setVariable(ticket.getProcessInstanceId(), "slaPaused", true);
            log.info("Timers SLA suspendus pour {}", ticket.getReference());
        } catch (Exception e) {
            log.warn("Impossible de suspendre les timers SLA pour {}: {}", ticket.getReference(), e.getMessage());
        }
    }

    /**
     * Reprogramme le timer SLA d'un processus ticket existant.
     */
    public void rescheduleSlaTimer(Ticket ticket, LocalDateTime dueDate) {
        if (ticket.getProcessInstanceId() == null || dueDate == null) {
            return;
        }

        Date dueDateAsDate = Date.from(dueDate.atZone(ZoneId.systemDefault()).toInstant());

        try {
            // Keep process variable in sync for future timer evaluations.
            runtimeService.setVariable(ticket.getProcessInstanceId(), "slaEscalationAt", dueDateAsDate);

            // If timer job already exists, update due date immediately.
            var timerJobs = managementService.createJobQuery()
                .processInstanceId(ticket.getProcessInstanceId())
                .timers()
                .list();

            for (Job job : timerJobs) {
                managementService.setJobDuedate(job.getId(), dueDateAsDate);
            }

            log.info("Timer SLA reprogrammé pour {} à {}", ticket.getReference(), dueDate);
        } catch (Exception e) {
            log.warn("Impossible de reprogrammer le timer SLA pour {}: {}", ticket.getReference(), e.getMessage());
        }
    }
    
    /**
     * Termine le processus (ticket fermé)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeProcess(Ticket ticket) {
        if (ticket.getProcessInstanceId() == null) return;
        
        try {
            // Compléter la dernière tâche active
            Task task = taskService.createTaskQuery()
                .processInstanceId(ticket.getProcessInstanceId())
                .singleResult();
            
            if (task != null) {
                Map<String, Object> variables = new HashMap<>();
                variables.put("ticketClosed", true);
                variables.put("satisfactionRating", ticket.getSatisfactionRating());
                variables.put("closedAt", ticket.getClosedAt());
                
                taskService.complete(task.getId(), variables);
                log.info("Processus terminé pour ticket: {}", ticket.getReference());
            }
        } catch (Exception e) {
            log.error("Erreur lors de la terminaison du processus", e);
        }
    }

    /**
     * Corrèle le message ticket_assigned à un processus
     */
    public void correlateTicketAssignedMessage(String ticketReference) {
        try {
            runtimeService.createMessageCorrelation("ticket_assigned")
                .processInstanceVariableEquals("ticketReference", ticketReference)
                .correlate();
            log.info("Message 'ticket_assigned' corrélé pour: {}", ticketReference);
        } catch (Exception e) {
            log.warn("Impossible de corréler le message 'ticket_assigned' pour {}: {}", ticketReference, e.getMessage());
        }
    }
    
    /**
     * Corrèle le message ticket_in_progress à un processus
     */
    public void correlateTicketInProgressMessage(String ticketReference) {
        try {
            runtimeService.createMessageCorrelation("ticket_in_progress")
                .processInstanceVariableEquals("ticketReference", ticketReference)
                .correlate();
            log.info("Message 'ticket_in_progress' corrélé pour: {}", ticketReference);
        } catch (Exception e) {
            log.warn("Impossible de corréler le message 'ticket_in_progress' pour {}: {}", ticketReference, e.getMessage());
        }
    }
    
    /**
     * Corrèle le message ticket_resolved à un processus
     */
    public void correlateTicketResolvedMessage(String ticketReference) {
        try {
            runtimeService.createMessageCorrelation("ticket_resolved")
                .processInstanceVariableEquals("ticketReference", ticketReference)
                .correlate();
            log.info("Message 'ticket_resolved' corrélé pour: {}", ticketReference);
        } catch (Exception e) {
            log.warn("Impossible de corréler le message 'ticket_resolved' pour {}: {}", ticketReference, e.getMessage());
        }
    }
    
    /**
     * Corrèle le message ticket_closed à un processus
     */
    public void correlateTicketClosedMessage(String ticketReference) {
        try {
            runtimeService.createMessageCorrelation("ticket_closed")
                .processInstanceVariableEquals("ticketReference", ticketReference)
                .correlate();
            log.info("Message 'ticket_closed' corrélé pour: {}", ticketReference);
        } catch (Exception e) {
            log.warn("Impossible de corréler le message 'ticket_closed' pour {}: {}", ticketReference, e.getMessage());
        }
    }
    
    /**
     * Corrèle le message ticket_rejected à un processus
     */
    public void correlateTicketRejectedMessage(String ticketReference) {
        try {
            runtimeService.createMessageCorrelation("ticket_rejected")
                .processInstanceVariableEquals("ticketReference", ticketReference)
                .correlate();
            log.info("Message 'ticket_rejected' corrélé pour: {}", ticketReference);
        } catch (Exception e) {
            log.warn("Impossible de corréler le message 'ticket_rejected' pour {}: {}", ticketReference, e.getMessage());
        }
    }

    /**
     * Récupère le statut d'un processus Camunda par ID de processus
     */
    public ProcessStatusDTO getProcessStatus(String processInstanceId) {
        if (processInstanceId == null) {
            return ProcessStatusDTO.builder().processStatus("NOT_FOUND").build();
        }
        
        try {
            ProcessInstance instance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
            
            if (instance == null) {
                return ProcessStatusDTO.builder().processStatus("NOT_FOUND").build();
            }
            
            // Get current activity
            Task currentTask = taskService.createTaskQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
            
            // Get process variables
            Map<String, Object> variables = runtimeService.getVariables(processInstanceId);
            
            return ProcessStatusDTO.builder()
                .processInstanceId(processInstanceId)
                .ticketReference((String) variables.get("ticketReference"))
                .ticketId(String.valueOf(variables.get("ticketId")))
                .currentActivity(currentTask != null ? currentTask.getName() : "COMPLETED")
                .processStatus(instance.isSuspended() ? "SUSPENDED" : 
                             (instance.isEnded() ? "COMPLETED" : "ACTIVE"))
                .variables(new HashMap<>(variables))
                .complete(instance.isEnded())
                .build();
        } catch (Exception e) {
            log.error("Erreur lors de la récupération du statut du processus: {}", e.getMessage());
            return ProcessStatusDTO.builder()
                .processStatus("ERROR")
                .lastErrorMessage(e.getMessage())
                .build();
        }
    }
    
    /**
     * Récupère le statut d'un processus Camunda par référence de ticket
     */
    public ProcessStatusDTO getProcessStatusByTicketReference(String ticketReference) {
        if (ticketReference == null) {
            return ProcessStatusDTO.builder().processStatus("NOT_FOUND").build();
        }
        
        try {
            ProcessInstance instance = runtimeService.createProcessInstanceQuery()
                .processInstanceBusinessKey(ticketReference)
                .active()
                .orderByProcessInstanceId()
                .desc()
                .listPage(0, 1)
                .stream()
                .findFirst()
                .orElse(null);
            
            if (instance == null) {
                HistoricProcessInstance historicInstance = historyService.createHistoricProcessInstanceQuery()
                    .processInstanceBusinessKey(ticketReference)
                    .orderByProcessInstanceStartTime()
                    .desc()
                    .listPage(0, 1)
                    .stream()
                    .findFirst()
                    .orElse(null);

                if (historicInstance != null) {
                    return ProcessStatusDTO.builder()
                        .processInstanceId(historicInstance.getId())
                        .ticketReference(ticketReference)
                        .currentActivity("COMPLETED")
                        .processStatus("COMPLETED")
                        .startTime(historicInstance.getStartTime() != null
                            ? LocalDateTime.ofInstant(historicInstance.getStartTime().toInstant(), ZoneId.systemDefault())
                            : null)
                        .endTime(historicInstance.getEndTime() != null
                            ? LocalDateTime.ofInstant(historicInstance.getEndTime().toInstant(), ZoneId.systemDefault())
                            : null)
                        .complete(true)
                        .build();
                }

                return ProcessStatusDTO.builder().processStatus("NOT_FOUND").build();
            }
            
            return getProcessStatus(instance.getId());
        } catch (Exception e) {
            log.error("Erreur lors de la récupération du statut pour le ticket: {}", e.getMessage());
            return ProcessStatusDTO.builder()
                .processStatus("ERROR")
                .lastErrorMessage(e.getMessage())
                .build();
        }
    }

    /**
     * Calculate escalation time in minutes (slaMinutes field stores minutes)
     */
    private int calculateEscalationMinutes(Integer slaMinutes) {
        if (slaMinutes == null || slaMinutes <= 0) {
            return 1;
        }
        int minutes = (int) Math.ceil(slaMinutes * slaEscalationThreshold);
        return Math.max(1, Math.min(minutes, slaMinutes));
    }

    private Date calculateEscalationTime(Ticket ticket) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime createdAt = ticket.getCreatedAt() != null ? ticket.getCreatedAt() : now;

        Integer slaHours = ticket.getSlaHours();
        long totalMinutes = (slaHours == null || slaHours <= 0) ? 60L : slaHours * 60L;
        long escalationMinutes = (long) Math.ceil(totalMinutes * slaEscalationThreshold);
        escalationMinutes = Math.max(1L, Math.min(escalationMinutes, totalMinutes));

        LocalDateTime escalationAt = createdAt.plusMinutes(escalationMinutes);

        if (ticket.getSlaDeadline() != null && escalationAt.isAfter(ticket.getSlaDeadline())) {
            escalationAt = ticket.getSlaDeadline().minusMinutes(1);
        }
        if (escalationAt.isBefore(now)) {
            escalationAt = now.plusSeconds(5);
        }

        return Date.from(escalationAt.atZone(ZoneId.systemDefault()).toInstant());
    }

    public WorkflowTraceDTO getWorkflowTraceByTicketReference(String ticketReference) {
        ProcessStatusDTO status = getProcessStatusByTicketReference(ticketReference);

        if (status == null || status.getProcessStatus() == null || "NOT_FOUND".equals(status.getProcessStatus())) {
            return WorkflowTraceDTO.builder()
                .ticketReference(ticketReference)
                .processStatus("NOT_FOUND")
                .steps(List.of())
                .build();
        }

        String processInstanceId = status.getProcessInstanceId();
        List<WorkflowTraceStepDTO> steps = new ArrayList<>();

        if (processInstanceId != null && !processInstanceId.isBlank()) {
            List<HistoricActivityInstance> historicActivities = historyService.createHistoricActivityInstanceQuery()
                .processInstanceId(processInstanceId)
                .orderByHistoricActivityInstanceStartTime()
                .asc()
                .list();

            Set<String> includedTypes = Set.of("startEvent", "userTask", "serviceTask", "exclusiveGateway", "endEvent");

            steps = historicActivities.stream()
                .filter(a -> includedTypes.contains(a.getActivityType()))
                .map(a -> WorkflowTraceStepDTO.builder()
                    .activityId(a.getActivityId())
                    .activityName(a.getActivityName())
                    .activityType(a.getActivityType())
                    .startTime(a.getStartTime() != null
                        ? LocalDateTime.ofInstant(a.getStartTime().toInstant(), ZoneId.systemDefault())
                        : null)
                    .endTime(a.getEndTime() != null
                        ? LocalDateTime.ofInstant(a.getEndTime().toInstant(), ZoneId.systemDefault())
                        : null)
                    .finished(a.getEndTime() != null)
                    .build())
                .collect(Collectors.toList());
        }

        return WorkflowTraceDTO.builder()
            .ticketReference(ticketReference)
            .processInstanceId(processInstanceId)
            .processStatus(status.getProcessStatus())
            .currentActivity(status.getCurrentActivity())
            .steps(steps)
            .build();
    }
}
