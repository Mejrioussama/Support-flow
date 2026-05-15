# Phase 1 — Exécution Rapide (Quick Start)

**Durée estimée:** 12 heures (Jour 2-3)  
**Priorité:** 🔴 CRITICAL (bloque tout le reste)

---

## ✅ AVANT DE COMMENCER

Vérifiez que vous avez:

```powershell
# 1. Java disponible
java -version
# Expected: openjdk version "17.0.8"

# 2. Maven fonctionnel
cd c:\Users\21655\Desktop\Support-flow\backend
.\mvnw.cmd -version
# Expected: Apache Maven 3.9.6 + Java 17.0.8

# 3. Keycloak configuration
cat c:\Users\21655\Desktop\Support-flow\keycloak\supportflow-realm.json | jq '.roles.realm | length'
# Expected: 4

# 4. BPMN file exists
Test-Path c:\Users\21655\Desktop\Support-flow\backend\src\main\resources\bpmn\ticket-workflow.bpmn
# Expected: True
```

**Status:** Si tous les checks passent ✅, vous êtes prêt.

---

## 🎯 QUICK TASK BREAKDOWN

### Task C1 — BPMN Enhancement (2h)

**What:** Ajouter boundary timers pour SLA escalation au BPMN existant.

**Steps:**
1. Ouvrir `backend/src/main/resources/bpmn/ticket-workflow.bpmn`
2. Chercher la task `<bpmn:userTask id="resolve_ticket"...>`
3. Ajouter 3 boundary timer events:
   ```xml
   <bpmn:boundaryEvent id="timer_sla_50" attachedToRef="resolve_ticket" cancelActivity="false">
     <bpmn:timerEventDefinition>
       <bpmn:timeDuration>PT50%</bpmn:timeDuration>
     </bpmn:timerEventDefinition>
     <bpmn:outgoing>flow_sla_50</bpmn:outgoing>
   </bpmn:boundaryEvent>
   <!-- Similar for 80% and 100% -->
   ```
4. Valider: Ouvrir en Camunda Modeler ou via `mvn validate`
5. Build: `mvn clean package -DskipTests`

**Metrics:** BPMN valide en XML + déploiement sans erreur

### Task C2 — SLA Timer Service (3h)

**What:** Créer `SlaTimerService.java` avec 3 méthodes (50%, 80%, 100%).

**Steps:**
1. Créer `backend/src/main/java/com/supportflow/service/SlaTimerService.java`
2. Implémenter 3 méthodes:
   ```java
   public void onSlaWarning50Percent(DelegateExecution execution) { ... }
   public void onSlaWarning80Percent(DelegateExecution execution) { ... }
   public void onSlaBreached100Percent(DelegateExecution execution) { ... }
   ```
3. Chaque méthode:
   - Met à jour ticket.slaPhase
   - Appelle notificationService (notifications)
   - Pour 100%: escalade statut à ESCALATED_SLA + priorité à CRITICAL
4. Tester: `mvn test -Dtest=SlaTimerServiceTest`

**Metrics:** 3 méthodes testées, notifications envoyées, statuts corrigés

### Task C3 — TicketService Integration (2h)

**What:** Ajouter appels `runtimeService.startProcessInstanceByKey()` et message correlations.

**Steps:**
1. Ouvrir `backend/src/main/java/com/supportflow/service/TicketService.java`
2. Dans chaque méthode de changement d'état, ajouter:
   ```java
   // Après sauvegarde ticket:
   runtimeService.createMessageCorrelation("message_name")
     .processInstanceBusinessKey(ticketId)
     .correlate();
   ```
3. Méthodes à modifier:
   - `createTicket()` → `startProcessInstanceByKey()`
   - `assignTicket()` → correlate "ticket_assigned"
   - `takeCharge()` → correlate "ticket_in_progress"
   - `resolveTicket()` → correlate "ticket_resolved"
   - `validateClientResolution()` → correlate "ticket_closed" ou "ticket_rejected"
4. Tester: Créer ticket, voir process instance dans Camunda Cockpit

**Metrics:** Process instances créées + state transitions correlées

### Task C4 — Monitoring Endpoint (2h)

**What:** Créer `CamundaController.java` avec endpoint `/api/camunda/status/{ticketId}`.

**Steps:**
1. Créer `backend/src/main/java/com/supportflow/controller/CamundaController.java`
2. Implémenter `@GetMapping("/status/{ticketId}")`:
   - Query `runtimeService.createProcessInstanceQuery().processInstanceBusinessKey(ticketId)`
   - Get active activities, variables, jobs (timers)
   - Calculate SLA metrics (remaining seconds, % elapsed)
3. Créer DTOs:
   - `ProcessStatusDto` (response model)
   - `TimerDto` (timer details)
4. Tester: 
   ```bash
   curl http://localhost:8081/api/camunda/status/TKT-TEST-001
   # Expected: JSON avec currentActivity, variables, timers, slaPercent
   ```

**Metrics:** Endpoint répond 200 + retourne données SLA

---

## 🧪 INTEGRATION TEST (30 min)

```powershell
# Terminal 1: Start Backend
$env:JAVA_HOME = "C:\Users\21655\.jdks\jbr-17.0.8"
cd c:\Users\21655\Desktop\Support-flow\backend
.\mvnw.cmd spring-boot:run

# Wait 30 seconds for startup...

# Terminal 2: Create test ticket
$token = "YOUR_JWT_FROM_KEYCLOAK"  # Get from D3 script
curl -X POST http://localhost:8081/api/tickets \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "BUG",
    "urgency": "URGENT",
    "severity": "CRITICAL",
    "impact": "HIGH",
    "description": "Test SLA timer",
    "clientId": "client1"
  }'

# Expected response:
# { "id": "TKT-2026-001", "status": "NEW", "slaDeadline": "2026-04-01T14:30:00Z" }

# Terminal 3: Monitor in Camunda Cockpit
# Open: http://localhost:8080/camunda/app/cockpit
# See process instance with businessKey = TKT-2026-001

# Terminal 2: Query endpoint after 30 seconds
curl http://localhost:8081/api/camunda/status/TKT-2026-001

# Expected:
# {
#   "ticketId": "TKT-2026-001",
#   "currentActivity": ["resolve_ticket"],
#   "slaRemainingSeconds": 1800,
#   "slaPercentComplete": 50,
#   "timers": [
#     { "type": "timer", "dueDate": "2026-04-01T14:35:00Z" }
#   ]
# }
```

---

## 📋 QUALITY CHECKLIST

Before marking Phase 1 complete:

- [ ] BPMN file modified with 3 boundary timers
- [ ] `mvn clean package -DskipTests` succeeds
- [ ] SlaTimerService class created with 3 methods
- [ ] TicketService updated with runtimeService calls
- [ ] CamundaController created with /status endpoint
- [ ] Backend starts without errors: `mvn spring-boot:run`
- [ ] Test ticket created via POST /api/tickets
- [ ] Process instance visible in Camunda Cockpit
- [ ] Endpoint /api/camunda/status/{ticketId} returns 200
- [ ] SLA metrics calculated correctly
- [ ] (Bonus) Boundary timers fire at 50%/80%/100%

---

## 🔧 TROUBLESHOOTING

### "BPMN deployment failed"
```
Cause: XML malformed or process not found
Fix: 
  1. Validate BPMN: mvn validate
  2. Check Spring logs for deployment error
  3. Verify bean instantiation of CamundaController
```

### "No process instances created"
```
Cause: startProcessInstanceByKey() not called or process key wrong
Fix:
  1. Check TicketService.createTicket() has runtimeService call
  2. Verify process key matches BPMN: id="ticket-workflow"
  3. Add @Autowired RuntimeService to TicketService
```

### "Endpoint /api/camunda/status returns 404"
```
Cause: CamundaController not mapped or not registered
Fix:
  1. Check @RestController annotation on class
  2. Check @RequestMapping("/api/camunda") on class
  3. Verify Spring Boot sees the controller: mvn spring-boot:run logs
```

### "SLA percent calculation wrong"
```
Cause: DateTime calculation faulty or slaDeadline null
Fix:
  1. Debug: System.out.println(ticket.getSlaDeadline())
  2. Verify slaDeadline set in createTicket()
  3. Check timezone: Use Instant.now() not LocalDateTime
```

---

## 📁 FILES TO CREATE/MODIFY

```
backend/src/main/java/com/supportflow/
  service/
    SlaTimerService.java              [NEW]
    TicketService.java                [MODIFY] Add runtimeService calls
  controller/
    CamundaController.java            [NEW]
  dto/
    ProcessStatusDto.java             [NEW]
    TimerDto.java                     [NEW]

backend/src/main/resources/
  bpmn/
    ticket-workflow.bpmn              [MODIFY] Add boundary timers
```

---

## ⏱️ TIME ESTIMATE

| Task | Time | Buffer | Total |
|------|------|--------|-------|
| C1: BPMN | 1.5h | 0.5h | 2h |
| C2: SlaTimerService | 2h | 1h | 3h |
| C3: TicketService | 1.5h | 0.5h | 2h |
| C4: CamundaController | 1.5h | 0.5h | 2h |
| Integration Test | 0.5h | — | 0.5h |
| **TOTAL** | **7h** | **2.5h** | **9.5h** |

**Prudent estimate with contingency: 12 hours (1.5 days)**

---

## 🚀 GO/NO-GO DECISION

### Go if:
- ✅ BPMN with timers deploys
- ✅ SlaTimerService instantiates
- ✅ Test ticket creates process instance
- ✅ Endpoint returns SLA metrics

### No-Go if:
- ❌ Compilation fails (Java/Maven issue)
- ❌ Camunda deployment error (BPMN syntax)
- ❌ Process instance not created (integration bug)
- ❌ Endpoint 404 (Spring wiring issue)

---

## 📞 NEXT CHECKPOINT

After Phase 1 completion, proceed to:
- **Phase 2 Day 1:** K1-K2 tasks (Keycloak RBAC + Spring Security)
- **Phase 2 Day 2:** K3 task (Frontend RBAC filtering)

Estimated Phase 1 finish: **2 avril 18:00**
Estimated Phase 2 start: **2 avril 19:00**

---

**Status:** 🟡 Ready to execute  
**Start:** 1 avril morning  
**Finish:** 2 avril evening  
**Next Review:** After C1 BPMN deployment success
