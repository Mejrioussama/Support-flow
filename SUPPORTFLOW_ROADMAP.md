# SupportFlow — Roadmap Exécution Complète (31 mars - 6 avril 2026)

**Équipe:** 1 Dev (AI Agent)  
**Jury:** 6 avril 2026 (5 jours)  
**Status:** 🟢 Phase 0 complète → Phase 1 prête

---

## Phase 0 ✅ COMPLÉTÉE (31 mars - 31 mars)

### Diagnostic & Déblocage
- ✅ **D1:** Keycloak config validated (4 roles, 2 clients, 4 users)
- ✅ **D2:** Java 17.0.8 + Maven 3.9.6 configured
- ✅ Backend compiles successfully (`mvn clean compile` ✅)
- ✅ BPMN file exists and valid XML
- ✅ All diagnostic scripts created (D1-D4)

### Artifacts Phase 0
- PHASE_0_DIAGNOSTIC.md
- PHASE_0_EXECUTION.md
- JAVA_HOME_SETUP.md
- DIAGNOSTIC_D1/D3/D4 scripts (PS1 + bash)

**Go/No-Go:** 🟢 **GO FOR PHASE 1**

---

## Phase 1 📋 PLANNING (1-2 avril)

### Process Engine & SLA Management

| Task | Deliverable | Est. Time | Priority |
|------|-------------|-----------|----------|
| **C1** | BPMN ticket-workflow.bpmn (10 states) | 3h | 🔴 CRITICAL |
| **C2** | SLA timers (50%/80%/100%) + notifications | 4h | 🔴 CRITICAL |
| **C3** | TicketService ↔ Camunda integration | 3h | 🔴 CRITICAL |
| **C4** | REST endpoint /api/camunda/status | 2h | 🟠 HIGH |

**Acceptance:** Process instances flow correctly through 10 states with SLA escalation working

**Artifacts:**
- PHASE_1_PLAN.md (detailed specifications)
- ticket-workflow.bpmn (enhanced)
- SlaTimerService.java
- CamundaController.java
- Integration tests

---

## Phase 2 📋 PLANNING (2-3 avril)

### Keycloak Identity & Access Management

| Task | Deliverable | Est. Time | Priority |
|------|-------------|-----------|----------|
| **K1** | Realm export + users (1 per role) | 1h | 🟠 HIGH |
| **K2** | Spring Security guards (RBAC) | 4h | 🔴 CRITICAL |
| **K3** | Frontend UI RBAC filtering | 3h | 🟠 HIGH |
| **K4** | RBAC demo script (4 curl scenarios) | 2h | 🟠 HIGH |

**Acceptance:** 4 users (admin/manager/agent/client) demonstrate different UI/API access levels

**Key Feature:** CLIENT sees only own tickets; AGENT sees assigned; MANAGER sees all; ADMIN complete

---

## Phase 3 📋 PLANNING (4 avril)

### Alfresco GED & Document Archiving

| Task | Deliverable | Est. Time | Priority |
|------|-------------|-----------|----------|
| **A1** | CMIS archive on CLOSED ticket | 2h | 🟡 MEDIUM |
| **A2** | Fallback if Alfresco unavailable | 2h | 🟡 MEDIUM |
| **A3** | Simulation mode (no Alfresco needed) | 1h | 🟡 MEDIUM |
| **A4** | Jury report wording (nodeRef proof) | 1h | 🟡 MEDIUM |

**Acceptance:** Ticket closed → nodeRef generated (real or simulated)

**Risk Mitigation:** If Alfresco fails, simulation mode ensures demo-ready

---

## Phase 4 📋 PLANNING (5-6 avril)

### Demo Scripts & Jury Materials

| Task | Deliverable | Est. Time | Priority |
|------|-------------|-----------|----------|
| **Demo 1** | A→Z complete scenario (script + video) | 2h | 🔴 CRITICAL |
| **Demo 2** | SLA escalation real-time (30s ticket) | 1h | 🟠 HIGH |
| **Demo 3** | RBAC role-switching (3 min walkthrough) | 1.5h | 🟠 HIGH |
| **Demo 4** | Rapport section (Camunda/Keycloak/Alfresco) | 1.5h | 🟡 MEDIUM |

**Acceptance:** Jury can replicate all demos on jury day

---

## Frontend Status (Pre-existing ✅)

### UI Modernization (COMPLETED)
- ✅ Ticket detail page → Celestial OS design (glass morphism, cyan glow)
- ✅ Hero section with SLA indicator
- ✅ Custom tabs (Details/Attachments/Comments/History)
- ✅ Application shell (topbar, left navigation, mobile dock)
- ✅ SLA stage labels (50%/80%/100% visible)
- ✅ Angular build succeeds (1.48 MB, deployable)

### Pending (Phase 2)
- ⏳ RBAC role-based button filtering (K3 task)
- ⏳ Disable/mask forbidden actions per role

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Angular 18)                 │
│         ✅ Celestial UI / 🟡 RBAC filtering             │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP/REST + WebSocket
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Spring Boot 3.x)                   │
├─────────────────────────────────────────────────────────┤
│ ×××××××× PHASE 1: Camunda Process Engine ××××××××      │
│  • Process definition: ticket-workflow.bpmn             │
│  • Service tasks: SLA timers (50%/80%/100%)             │
│  • User tasks: qualify, process, validate               │
│  • Message events: correlate state changes              │
│                                                          │
│ ×××××××× PHASE 2: Keycloak IAM ××××××××                │
│  • Spring Security: role-based endpoint guards          │
│  • JWT token extraction + role validation               │
│  • Audit logging of role-based decisions                │
│                                                          │
│ ×××××××× PHASE 3: Alfresco CMIS GED ××××××××           │
│  • On CLOSED: create document + store nodeRef           │
│  • Fallback: pending_archive DB record + retry job      │
│  • Simulation: JSON file output if unavailable          │
└────────────────┬────────────────────────────────────────┘
                 │ Message correlation
                 ▼
┌─────────────────────────────────────────────────────────┐
│            Camunda Process Engine (H2/Postgres)         │
│  Orchestrates workflow, timers, user assignments        │
└────────────────┬────────────────────────────────────────┘
                 │ REST API
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────────────────┐ ┌──────────────────────┐
│  Keycloak            │ │  Alfresco CMIS       │
│  (Auth + RBAC)       │ │  (Document archive)  │
│ ✅ realm configured  │ │ 🟡 Phase 3 TBD       │
│ 🟡 K2 Spring guards  │ │    (or simulation)    │
│ 🟡 K3 UI filtering   │ │                      │
└──────────────────────┘ └──────────────────────┘
```

---

## Critical Path (5 jours minimum)

```
Day 1 (31 mars):  ✅ Phase 0 — Diagnostic complete
Day 2 (1 avril):  Phase 1.C1-C3 — Process engine foundation
Day 3 (2 avril):  Phase 1.C4 + Phase 2.K1-K2 — Integration
Day 4 (3 avril):  Phase 2.K3 + Phase 3.A1-A3 — UI + Archive
Day 5 (4 avril):  Phase 4 — Demo scripts + polishing
Day 6 (5 avril):  BUFFER — Testing + fixes
Jour 7 (6 avril):  JURY DEMO
```

---

## Key Decisions (Documented)

### 1. JAVA_HOME Resolution ✅
- Environment: Windows 11 + JBR 17.0.8
- Solution: Explicit PATH configuration in PowerShell
- Verified: `mvn clean compile` now works

### 2. Camunda Timer Implementation
- Approach: Boundary events on user tasks (non-interrupting)
- Calculation: 50%, 80%, 100% of slaDeadline
- Actions: Notifications + status updates (no forced reassignment)

### 3. Keycloak RBAC Strategy
- Approach: Spring Security + @PreAuthorize annotations
- Frontend: Parse JWT roles + conditional button rendering
- Testing: 4 curl scenarios per role (Demo K4)

### 4. Alfresco Fallback
- If CMIS unavailable: JSON file simulation mode
- Reason: Ensures jury demo works regardless of infrastructure
- Honest disclosure: Report statements "simulation mode for demo"

---

## Technology Stack

| Component | Version | Status |
|-----------|---------|--------|
| Java | 17.0.8 (JBR) | ✅ Ready |
| Spring Boot | 3.x | ✅ Compiling |
| Maven | 3.9.6 | ✅ Ready |
| Angular | 18+ | ✅ Building |
| Camunda | 7.x | ✅ BPMN ready |
| Keycloak | Latest | ✅ Configured |
| Alfresco | TBD | 🟡 Phase 3 |
| PostgreSQL/H2 | Any | ✅ Via Spring |

---

## Risk Register & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Camunda deployment failure | Low | Critical | Phase 0 tested compilation ✅ |
| Keycloak CORS issues | Low | High | CORS pre-configured in realm JSON ✅ |
| SLA timer miscalculation | Medium | High | Unit tests + manual 1-min test ticket |
| Alfresco unavailable | Medium | Medium | Simulation mode + fallback DB ✅ |
| RBAC role explosion | Low | Low | 4 roles only (CLIENT/AGENT/MANAGER/ADMIN) |
| Jury time pressure | Medium | Medium | Demo scripts pre-recorded as backup |

---

## Success Criteria (Jury)

### Must-Have (100 points)
- ✅ Frontend UI Celestial OS responsive
- 🟡 Ticket creation → workflow visible in Camunda
- 🟡 SLA 50%/80%/100% thresholds visible + escalation
- 🟡 4 users demonstrate role-based access (RBAC)
- 🟡 Resolved ticket → archived (nodeRef proof)

### Nice-to-Have (Bonus)
- Real-time WebSocket updates during demo
- Animated SLA countdown timer
- Export ticket as PDF from Alfresco
- Process history visualization

---

## Immediate Next Steps (1 avril morning)

1. **Review Phase 1 Plan** (`PHASE_1_PLAN.md`)
2. **Create test ticket** with 1-minute SLA
3. **Implement C1** (enhance BPMN if needed)
4. **Implement C2** (SLA timers + notifications)
5. **Test:** Create ticket → watch Camunda flow

**Estimated completion:** 2 avril 18:00 (36 hours)

---

## Files Created (Reference)

### Phase 0 Documents
1. PHASE_0_DIAGNOSTIC.md — Diagnostic checklists D1-D4
2. PHASE_0_EXECUTION.md — Execution summary
3. JAVA_HOME_SETUP.md — Environment configuration
4. DIAGNOSTIC_D1_KEYCLOAK.ps1/sh
5. DIAGNOSTIC_D3_KEYCLOAK_CURL.ps1/sh
6. DIAGNOSTIC_D4_CAMUNDA.ps1/sh

### Phase 1+ Planning
7. PHASE_1_PLAN.md — Detailed C1-C4 tasks
8. This file: SupportFlow_ROADMAP.md

### Code Ready (Pre-existing)
- frontend/ → Celestial UI complete ✅
- backend/src/main/resources/bpmn/ticket-workflow.bpmn ✅
- keycloak/supportflow-realm.json ✅

---

**Document:** SupportFlow Execution Roadmap  
**Date:** 31 mars 2026  
**Status:** 🟢 Phase 0 Complete / Phase 1 Ready to Start  
**Estimated Jury Success:** 95% (assuming Phase 1-4 on schedule)
