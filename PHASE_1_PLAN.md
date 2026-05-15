# Phase 1 — Camunda Process Engine (Jours 2-3)

**Objectif:** Implémenter le workflow complet SupportFlow avec gestion SLA et escalade automatique.

**Tasks:** C1, C2, C3, C4  
**Durée estimée:** 2 jours  
**Priorité:** 🔴 CRITIQUE (toutes les escalades dépendent du workflow Camunda)

---

## C1 — BPMN Cycle Ticket Complet

### Objectif
Générer le fichier BPMN avec tous les états du cycle de vie ticket:
```
NEW → ASSIGNED → IN_PROGRESS → (SLA warning/escalation) → RESOLVED → (client validation) → CLOSED
```

### États requis
1. **NEW** - Start event après création ticket
2. **ASSIGNED** - Manager qualifie et assigne agent
3. **IN_PROGRESS** - Agent prend en charge
4. **SLA_WARNING_50%** - Boundary timer event
5. **SLA_WARNING_80%** - Boundary timer event (alerte critique)
6. **ESCALATED_SLA** - Boundary timer event à 100% (escalade automatique)
7. **RESOLVED** - Agent soumet résolution
8. **CLOSED** - Client valide + archivage

### Variables de processus
```json
{
  "ticketId": "TKT-2024-001",          // Business key
  "priority": "MEDIUM",                // LOW, MEDIUM, HIGH, CRITICAL
  "slaDeadline": "2024-01-15T18:00Z", // ISO 8601 timestamp
  "clientId": "user-sub-xyz",
  "assignedAgentId":""
  "slaElapsedMillis": 0,
  "slaPercentComplete": 0,
  "rejectionCount": 0,
  "clientValidated": false
}
```

### BPMN Structure (pseudo-XML)

```xml
<bpmn:process id="ticket-workflow" name="SupportFlow - Gestion Tickets">
  
  <!-- Start Event -->
  <bpmn:startEvent id="start_ticket" name="Ticket créé">
    <bpmn:outgoing>flow_qualify</bpmn:outgoing>
  </bpmn:startEvent>

  <!-- Task 1: Qualify & Assign -->
  <bpmn:userTask id="qualify_ticket" name="Qualifier ticket"
                 camunda:candidateGroups="SUPPORT_MANAGER">
    <bpmn:documentation>Manager évalue et assigne agent</bpmn:documentation>
    <bpmn:incoming>flow_qualify</bpmn:incoming>
    <bpmn:outgoing>flow_assign</bpmn:outgoing>
  </bpmn:userTask>

  <!-- Task 2: Process (Agent takeover) -->
  <bpmn:userTask id="process_ticket" name="Traiter ticket"
                 camunda:assignee="${assignedAgentId}">
    <bpmn:documentation>Agent résout le problème</bpmn:documentation>
    <bpmn:incoming>flow_assign</bpmn:incoming>
    <bpmn:outgoing>flow_validate</bpmn:outgoing>
    
    <!-- Boundary Timer Events for SLA -->
    <bpmn:boundaryEvent id="timer_sla_50" attachedToRef="process_ticket"
                        cancelActivity="false">
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT50%</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
      <bpmn:outgoing>flow_sla_50</bpmn:outgoing>
    </bpmn:boundaryEvent>

    <bpmn:boundaryEvent id="timer_sla_80" attachedToRef="process_ticket"
                        cancelActivity="false">
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT80%</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
      <bpmn:outgoing>flow_sla_80</bpmn:outgoing>
    </bpmn:boundaryEvent>

    <bpmn:boundaryEvent id="timer_sla_100" attachedToRef="process_ticket"
                        cancelActivity="false">
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT100%</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
      <bpmn:outgoing>flow_escalate_sla</bpmn:outgoing>
    </bpmn:boundaryEvent>
  </bpmn:userTask>

  <!-- SLA Escalation Task (Signal only, no user action) -->
  <bpmn:serviceTask id="escalate_sla" name="Escalade SLA"
                    camunda:delegateExpression="${escalateTicketDelegate}">
    <bpmn:incoming>flow_escalate_sla</bpmn:incoming>
    <bpmn:outgoing>flow_sla_escalated</bpmn:outgoing>
  </bpmn:serviceTask>

  <!-- Task 3: Client Validation -->
  <bpmn:userTask id="validate_client" name="Valider résolution"
                 camunda:candidateRoles="CLIENT">
    <bpmn:incoming>flow_validate</bpmn:incoming>
    <bpmn:incoming>flow_sla_escalated</bpmn:incoming>
    <bpmn:outgoing>flow_client_decision</bpmn:outgoing>
  </bpmn:userTask>

  <!-- Exclusive Gateway: Client accepts or rejects -->
  <bpmn:exclusiveGateway id="gateway_validation">
    <bpmn:incoming>flow_client_decision</bpmn:incoming>
    <bpmn:outgoing>flow_closed</bpmn:outgoing>
    <bpmn:outgoing>flow_reject</bpmn:outgoing>
  </bpmn:exclusiveGateway>
  <!-- If rejected, loop back to assign -->

  <!-- End Event: Ticket Closed -->
  <bpmn:endEvent id="end_ticket_closed" name="Ticket clôturé">
    <bpmn:incoming>flow_closed</bpmn:incoming>
  </bpmn:endEvent>

</bpmn:process>
```

### Fichier cible
- **Path:** `backend/src/main/resources/bpmn/ticket-workflow.bpmn`
- **Status:** Existe déjà mais peut nécessiter mise à jour
- **Vérification:** Valider XML et boundary events configurés

### Checklist C1
- [ ] BPMN contient 8 états (NEW → CLOSED)
- [ ] Boundary timers présents (50%, 80%, 100%)
- [ ] Variables processus déclarées (ticketId, priority, slaDeadline, etc.)
- [ ] Rôles/Groups correctement mappés (SUPPORT_MANAGER, SUPPORT_AGENT, CLIENT)
- [ ] XML valide (utiliser Camunda Modeler pour valider)
- [ ] Déployé à démarrage Spring Boot

---

## C2 — Timers SLA 50% / 80% / 100%

### Objectif
Implémenter la logique de calcul SLA dans Spring Boot:
- À **50% du délai** → Warning agent (notif simple)
- À **80% du délai** → Alerte critique manager (notification urgente)
- À **100% du délai** → Escalade automatique (statut CRITICAL, notify manager)

### Implémentation

#### 1. Service SLA Timer
`backend/src/main/java/com/supportflow/service/SlaTimerService.java`

```java
@Service
public class SlaTimerService {
    
    @Autowired private TicketService ticketService;
    @Autowired private NotificationService notificationService;
    @Autowired private TicketRepository ticketRepository;
    
    /**
     * Called by Camunda boundary timer events
     */
    public void onSlaWarning50Percent(DelegateExecution execution) {
        String ticketId = (String) execution.getVariable("ticketId");
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        
        // Update ticket status (if needed)
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        ticket.setSlaPhase("WARNING_50");
        ticketRepository.save(ticket);
        
        // Notify agent
        notificationService.notifyAgent(
            ticket.getAssignedAgentId(),
            "⚠️ SLA à 50%: " + ticket.getId(),
            "Le ticket est à 50% du délai SLA. Veuillez accélérer la résolution."
        );
    }
    
    public void onSlaWarning80Percent(DelegateExecution execution) {
        String ticketId = (String) execution.getVariable("ticketId");
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        
        ticket.setSlaPhase("WARNING_80");
        ticketRepository.save(ticket);
        
        // Notify manager
        notificationService.notifyManager(
            "🔴 SLA CRITIQUE à 80%: " + ticket.getId(),
            "Ticket en dépassement critique. Intervention manager recommandée."
        );
    }
    
    public void onSlaBreached100Percent(DelegateExecution execution) {
        String ticketId = (String) execution.getVariable("ticketId");
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        
        // Escalade automatique
        ticket.setStatus(TicketStatus.ESCALATED_SLA);
        ticket.setPriority(TicketPriority.CRITICAL);
        ticket.setSlaPhase("ESCALATED_100");
        ticketRepository.save(ticket);
        
        // Critical notification
        notificationService.notifyManager(
            "🚨 SLA DÉPASSÉ - ESCALADE AUTOMATIQUE: " + ticket.getId(),
            "Statut passé à ESCALATED_SLA. Priorité CRITICAL. Action immédiate requise."
        );
    }
}
```

#### 2. BPMN Delegate Configuration
Dans `application.yml`:
```yaml
camunda:
  bpm:
    webapp:
      enabled: true
  rest:
    enabled: true
    context-path: /engine-rest
```

#### 3. Service Task in BPMN
```xml
<bpmn:serviceTask id="escalate_sla"
                  name="Escalade SLA Automatique"
                  camunda:class="com.supportflow.service.SlaTimerService">
  <bpmn:incoming>flow_escalate_sla</bpmn:incoming>
  <bpmn:outgoing>flow_sla_escalated</bpmn:outgoing>
</bpmn:serviceTask>
```

### Checklist C2
- [ ] Service SlaTimerService créé
- [ ] Méthodes for 50%, 80%, 100% implémentées
- [ ] Notificationservice appelé
- [ ] Statut ticket misà jour (ESCALATED_SLA)
- [ ] Priorité auto-escaladée à CRITICAL
- [ ] Tests unitaires pour timers

---

## C3 — Câblage Service Ticket ↔ Camunda

### Objectif
À chaque changement de statut ticket, signaler au processus Camunda via `RuntimeService.signal()`.

### Implémentation

`backend/src/main/java/com/supportflow/service/TicketService.java`

```java
@Service
public class TicketService {
    
    @Autowired private TicketRepository ticketRepository;
    @Autowired private RuntimeService runtimeService;  // Camunda
    @Autowired private HistoryService historyService;
    
    /**
     * Créer et démarrer ticket (Phase A du scenario)
     */
    public Ticket createTicket(TicketCreateRequest request) {
        Ticket ticket = new Ticket();
        ticket.setId("TKT-" + System.currentTimeMillis());
        ticket.setStatus(TicketStatus.NEW);
        ticket.setPriority(calculatePriority(request));
        ticket.setSlaDeadline(calculateSla(ticket.getPriority()));
        ticket.setCreatedAt(LocalDateTime.now());
        
        Ticket saved = ticketRepository.save(ticket);
        
        // Start Camunda process
        Map<String, Object> variables = new HashMap<>();
        variables.put("ticketId", saved.getId());
        variables.put("priority", saved.getPriority().toString());
        variables.put("slaDeadline", saved.getSlaDeadline().toString());
        variables.put("assignedAgentId", ""); // will be set during assign
        
        runtimeService.startProcessInstanceByKey(
            "ticket-workflow",
            saved.getId(),  // businessKey
            variables
        );
        
        return saved;
    }
    
    /**
     * Assigner ticket (Phase B du scenario)
     */
    public void assignTicket(String ticketId, String agentId) {
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        ticket.setStatus(TicketStatus.ASSIGNED);
        ticket.setAssignedAgentId(agentId);
        ticketRepository.save(ticket);
        
        // Signal Camunda process
        runtimeService.createMessageCorrelation("ticket_assigned")
            .processInstanceBusinessKey(ticketId)
            .setVariable("assignedAgentId", agentId)
            .correlate();
    }
    
    /**
     * Agent prend la charge (Phase C du scenario)
     */
    public void takeCharge(String ticketId, String agentId) {
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        ticket.setTakenChargeBy(agentId);
        ticket.setTakenChargeAt(LocalDateTime.now());
        ticketRepository.save(ticket);
        
        runtimeService.createMessageCorrelation("ticket_in_progress")
            .processInstanceBusinessKey(ticketId)
            .correlate();
    }
    
    /**
     * Soumettre résolution (Phase H du scenario)
     */
    public void resolveTicket(String ticketId, String resolution) {
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolution(resolution);
        ticket.setResolvedAt(LocalDateTime.now());
        ticketRepository.save(ticket);
        
        runtimeService.createMessageCorrelation("ticket_resolved")
            .processInstanceBusinessKey(ticketId)
            .correlate();
    }
    
    /**
     * Client valide résolution (Phase I du scenario)
     */
    public void validateClientResolution(String ticketId, boolean validated) {
        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        
        if (validated) {
            ticket.setStatus(TicketStatus.CLOSED);
            ticket.setClosedAt(LocalDateTime.now());
            runtimeService.createMessageCorrelation("ticket_closed")
                .processInstanceBusinessKey(ticketId)
                .correlate();
        } else {
            // Rejection: back to IN_PROGRESS
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticket.setRejectionCount((ticket.getRejectionCount() ?? 0) + 1);
            runtimeService.createMessageCorrelation("ticket_rejected")
                .processInstanceBusinessKey(ticketId)
                .correlate();
        }
        
        ticketRepository.save(ticket);
    }
}
```

### Message Events dans BPMN
```xml
<!-- Message events pour signaler état changes -->
<bpmn:intermediateCatchEvent id="event_assigned" name="Ticket Assigned">
  <bpmn:messageEventDefinition messageRef="Message_ticket_assigned"/>
  <bpmn:outgoing>flow_to_process</bpmn:outgoing>
</bpmn:intermediateCatchEvent>

<bpmn:intermediateCatchEvent id="event_in_progress" name="In Progress">
  <bpmn:messageEventDefinition messageRef="Message_ticket_in_progress"/>
</bpmn:intermediateCatchEvent>

<bpmn:intermediateCatchEvent id="event_resolved" name="Resolved">
  <bpmn:messageEventDefinition messageRef="Message_ticket_resolved"/>
</bpmn:intermediateCatchEvent>

<bpmn:message id="Message_ticket_assigned" name="ticket_assigned"/>
<bpmn:message id="Message_ticket_in_progress" name="ticket_in_progress"/>
<bpmn:message id="Message_ticket_resolved" name="ticket_resolved"/>
<bpmn:message id="Message_ticket_closed" name="ticket_closed"/>
<bpmn:message id="Message_ticket_rejected" name="ticket_rejected"/>
```

### Checklist C3
- [ ] TicketService.startProcessInstanceByKey() implémenté
- [ ] assignTicket() → runtimeService.correlate()
- [ ] takeCharge() → runtimeService.correlate()
- [ ] resolveTicket() → runtimeService.correlate()
- [ ] validateClientResolution() → runtimeService.correlate()
- [ ] Message events définis dans BPMN
- [ ] Tests d'intégration avec Camunda

---

## C4 — Endpoint Monitoring Process

### Objectif
Exposer REST endpoint pour monitorer l'état actuel du processus:
```
GET /api/camunda/status/{ticketId}
```

### Implémentation

`backend/src/main/java/com/supportflow/controller/CamundaController.java`

```java
@RestController
@RequestMapping("/api/camunda")
public class CamundaController {
    
    @Autowired private RuntimeService runtimeService;
    @Autowired private HistoryService historyService;
    @Autowired private TicketService ticketService;
    
    @GetMapping("/status/{ticketId}")
    public ResponseEntity<ProcessStatusDto> getProcessStatus(@PathVariable String ticketId) {
        // Find process instance
        ProcessInstance instance = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(ticketId)
            .singleResult();
        
        if (instance == null) {
            return ResponseEntity.notFound().build();
        }
        
        ProcessStatusDto status = new ProcessStatusDto();
        status.setTicketId(ticketId);
        status.setProcessInstanceId(instance.getId());
        status.setProcessDefinitionKey(instance.getProcessDefinitionId());
        
        // Get current activity
        List<String> activeActivities = runtimeService
            .getActiveActivityIds(instance.getId());
        status.setCurrentActivity(activeActivities);
        
        // Get variables
        Map<String, Object> variables = runtimeService
            .getVariables(instance.getId());
        status.setVariables(variables);
        
        // Get timers (boundary events)
        List<Job> jobs = runtimeService.createJobQuery()
            .processInstanceId(instance.getId())
            .list();
        List<TimerDto> timers = jobs.stream()
            .map(job -> new TimerDto(
                job.getId(),
                job.getJobType(),
                job.getDuedate()
            ))
            .collect(Collectors.toList());
        status.setTimers(timers);
        
        // Calculate SLA metrics
        Ticket ticket = ticketService.getTicket(ticketId);
        if (ticket != null) {
            long remaining = ticket.getSlaDeadline()
                .toInstant().getEpochSecond()
                - System.currentTimeMillis() / 1000;
            status.setSlaRemainingSeconds(remaining);
            status.setSlaPercentComplete(
                Math.max(0, 100 - (remaining * 100 / ticket.getSlaDeadline()
                    .atZone(ZoneId.systemDefault()).toInstant()
                    .getEpochSecond()))
            );
        }
        
        return ResponseEntity.ok(status);
    }
    
    @GetMapping("/processes")
    public ResponseEntity<List<ProcessDefinition>> listProcesses() {
        List<ProcessDefinition> processes = runtimeService
            .createProcessDefinitionQuery()
            .list();
        return ResponseEntity.ok(processes);
    }
    
    @GetMapping("/instances")
    public ResponseEntity<List<ProcessInstanceDto>> listInstances() {
        List<ProcessInstance> instances = runtimeService
            .createProcessInstanceQuery()
            .list();
        // Convert to DTO
        return ResponseEntity.ok(instances.stream()
            .map(this::mapToDto)
            .collect(Collectors.toList()));
    }
}
```

Modèles DTO:
```java
public class ProcessStatusDto {
    private String ticketId;
    private String processInstanceId;
    private String processDefinitionKey;
    private List<String> currentActivity;
    private Map<String, Object> variables;
    private List<TimerDto> timers;
    private long slaRemainingSeconds;
    private int slaPercentComplete;
    // getters/setters
}

public class TimerDto {
    private String jobId;
    private String type;  // "timer"
    private Date dueDate;
    // getters/setters
}
```

### Checklist C4
- [ ] Endpoint `/api/camunda/status/{ticketId}` implémenté
- [ ] Retourne ProcessStatusDto avec variables, timers, activité
- [ ] SLA metrics calculés (% elapsed, remaining seconds)
- [ ] Endpoint `/api/camunda/processes` avec liste processus
- [ ] Endpoint `/api/camunda/instances` avec instances actives
- [ ] Tests unitaires des endpoints
- [ ] Documentation Swagger/API

---

## Validation Phase 1

**Tests d'acceptance:**

1. **Test C1:** BPMN se déploie sans erreur
   ```bash
   mvn clean package -DskipTests
   mvn spring-boot:run
   # Vérifier: Camunda Cockpit → Processes → "ticket-workflow" visible
   ```

2. **Test C2:** Timers se décléchent
   - Créer ticket avec SLA de 1 minute
   - Attendre 30s → Warning 50%
   - Attendre 80s total → Alerte 80%
   - Attendre 100s+ → Escalade automatique

3. **Test C3:** Service integration
   - POST `/api/tickets` → process starts
   - PUT `/api/tickets/{id}/assign` → message correlated
   - Camunda cockpit shows state change

4. **Test C4:** Monitoring endpoint
   - GET `/api/camunda/status/{ticketId}`
   - Retourne current activity + SLA metrics
   - Timers visibles dans réponse

---

## Files à créer/modifier (Phase 1)

```
backend/
  src/main/resources/
    bpmn/
      ticket-workflow.bpmn          ← C1: Mettreà jour
    application.yml                  ← C2: Camunda config
  src/main/java/com/supportflow/
    service/
      SlaTimerService.java          ← C2: NEW
      TicketService.java            ← C3: Modifier (Add msg correlation)
    controller/
      CamundaController.java        ← C4: NEW
    dto/
      ProcessStatusDto.java         ← C4: NEW
      TimerDto.java                 ← C4: NEW
      ProcessInstanceDto.java       ← C4: NEW
    delegate/
      SlaEscalationDelegate.java    ← C2: NEW (if using delegat approach)
```

---

**Status:** 🟡 PRÊT À DÉMARRER  
**Next:** Commencer C1 (BPMN enhancement)
