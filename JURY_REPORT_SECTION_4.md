# SupportFlow - Jury Presentation Report

## Section 4: Architecture & Innovation — Process Automation, Identity Management, and Enterprise Integration

### 4.1 Process Automation with Apache Camunda

#### 4.1.1 Challenge Statement

Traditional ticket management systems rely on manual workflow progression, where system administrators must monitor SLA thresholds and manually escalate tickets when deadlines approach. This approach introduces three critical risks:

1. **Human Oversight**: SLA breaches occur due to missed notifications rather than technical limitations
2. **Inconsistent Enforcement**: Different teams apply escalation policies inconsistently
3. **No Audit Trail**: Manual interventions create compliance gaps in regulated environments

#### 4.1.2 Solution Architecture

SupportFlow implements **Apache Camunda 7.x** with BPMN 2.0 (Business Process Model and Notation) as the process orchestration engine. This design provides:

**Automated SLA Escalation via Boundary Timers:**

The ticket workflow includes three boundary events attached to the "resolve_ticket" task:

```
Timeline (from ticket creation):
  T = 0%     → Ticket enters resolution phase
  T = 50%    → SLA Warning: Priority raised to HIGH
  T = 80%    → SLA Critical Alert: Assigned agent escalates to manager
  T = 100%   → SLA Breach: Ticket status = ESCALATED_SLA, Priority = CRITICAL
```

Each boundary event triggers a dedicated service task that executes the `SlaTimerService` callback method. This callback performs three actions:

1. **Update SLA Phase**: Stores the current escalation level (WARNING_50, ALERT_80, BREACHED_100) in ticket metadata
2. **Notify Stakeholders**: Sends real-time notifications to assigned agent and manager via NotificationService
3. **Preserve Audit Trail**: Records timestamp of escalation in the TicketHistory table

**Observable Implementation (REST API):**

The CamundaController exposes two endpoints for jury verification:

```
GET /api/camunda/status/{processInstanceId}
  → Returns: currentActivity, processStatus, variables (including slaPhase)
  → Demonstrates: Real-time process state visibility

GET /api/camunda/status/ticket/{ticketReference}
  → Returns: Ticket reference lookup with process correlation
  → Demonstrates: Business key matching (ticket ↔ process instance)
```

#### 4.1.3 Business Value

**For Support Managers:**
- Automatic escalation detection eliminates manual SLA monitoring
- Dashboard alerts show tickets approaching breach (sortable by urgency)
- Workflow continuity guaranteed even when staff unavailable

**For Support Agents:**
- Clear priority indicators guide workload prioritization
- Automatic notifications prevent ticket abandonment
- Performance metrics based on SLA compliance rate

**For Compliance & Audit:**
- Every escalation timestamped and correlated to process instance
- No missed breaches due to system failures
- Configurable SLA policies per ticket type (incident vs. request)

---

### 4.2 Identity Management and Role-Based Access Control (RBAC) via Keycloak

#### 4.2.1 Challenge Statement

Multi-role systems require careful access control to prevent unauthorized privilege escalation. A compromised ticket-assignment endpoint, for example, could allow a support agent to unilaterally escalate support requests or re-assign tickets to bypass proper workflow approval. 

SupportFlow addresses this through **OAuth2/OpenID Connect (OIDC)** standards implemented in Keycloak, ensuring:

1. **Centralized Identity**: Single user directory with cryptographic JWT token validation
2. **Role-Based Enforcement**: API-level authorization (not just UI-level hiding)
3. **Compliance Ready**: Standards-based implementation suitable for regulated industries (banking, healthcare)

#### 4.2.2 Solution Architecture

**Keycloak Configuration (4 Realm Roles):**

| Role | Permissions | Use Case |
|------|-------------|----------|
| **ADMIN** | Full system control, user management, configuration | IT system owner, DevOps team |
| **SUPPORT_MANAGER** | View all tickets, assign to agents, generate reports | Team lead, shift supervisor |
| **SUPPORT_AGENT** | View assigned tickets, take charge, resolve, escalate | L1/L2 support technician |
| **CLIENT** | Create tickets, view own tickets, rate satisfaction | End-user, business stakeholder |

**JWT Token Structure:**

When a user authenticates, Keycloak issues a JWT token containing role claims:

```json
{
  "preferred_username": "agent1",
  "email": "karim.agent@example.com",
  "realm_access": {
    "roles": ["SUPPORT_AGENT", "offline_access", "uma_authorization"]
  },
  "resource_access": {
    "supportflow-backend": {
      "roles": ["SUPPORT_AGENT"]
    }
  },
  "aud": ["account", "supportflow-backend"],
  "exp": 1714556000
}
```

**Spring Security Integration:**

Backend authorization uses three layers:

1. **JwtAuthenticationConverter**: Extracts roles from three sources (realm_access, resource_access, flat roles) and converts to Spring Security authorities (ROLE_ADMIN, ROLE_SUPPORT_MANAGER, etc.)

2. **@PreAuthorize Annotations**: Each REST endpoint declares required roles:
   ```java
   @GetMapping("/tickets")
   @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')")
   public ResponseEntity<?> listTickets() { ... }
   
   @PostMapping("/tickets/{id}/assign/{agentId}")
   @PreAuthorize("hasRole('SUPPORT_MANAGER')")
   public ResponseEntity<?> assignTicket(...) { ... }
   ```

3. **HTTP 403 Enforcement**: Unauthorized requests are rejected at the Spring Security filter level (before controller code executes)

**Frontend Role Filtering:**

The Angular frontend complements backend authorization with conditional UI rendering:

```typescript
@if (authService.canActOnTicket(ticket, 'assign')) {
  <button (click)="assignTicket(ticket)">
    <mat-icon>person_add</mat-icon>
    Assign to Agent
  </button>
}
```

The `canActOnTicket()` method implements a permission matrix that prevents UI elements from being displayed to unauthorized users, improving UX while backend authorization remains the authoritative enforcer.

#### 4.2.3 Business Value

**For End-Users & Clients:**
- Simple OAuth2 login (compatible with Active Directory, LDAP via Keycloak federation)
- Secure token-based authentication (no passwords transmitted to backend)
- Time-limited JWT tokens (60 minutes) reduce risk of compromise

**For System Administrators:**
- Centralized user management (add/remove users in Keycloak, impacts all services immediately)
- Audit logs show who accessed which resources and when
- Role policies configurable without code deployment

**For Security & Compliance:**
- OpenID Connect is industry-standard (OAuth2 profile)
- JWT tokens are stateless (no session database needed)
- Multi-factor authentication (MFA) available in Keycloak for sensitive roles

---

### 4.3 Enterprise Document Management and Long-Term Retention via Alfresco

#### 4.3.1 Challenge Statement

Ticket information typically contains sensitive business data (customer complaints, internal processes, employee information). Regulations in many jurisdictions require:

1. **Long-Term Retention**: Archive closed tickets for 7+ years (GDPR, SOX)
2. **Audit Immutability**: Archived records cannot be modified after creation
3. **Controlled Access**: Only authorized users can retrieve archived documents
4. **Metadata Capture**: Full context preserved (who, what, when, where, why)

Ad-hoc file storage (shared drives, email archives) fails these requirements. SupportFlow implements **Apache Alfresco Content Management System** via CMIS (Content Management Interoperability Services) protocol to create a permanent, compliant archive.

#### 4.3.2 Solution Architecture

**Archival Trigger (Ticket Lifecycle):**

When a ticket reaches CLOSED status:

1. **Metadata Extraction**: System captures 20+ fields:
   - Ticket reference, title, description,author (client name)  
   - Assigned agent, manager, resolution date
   - Status progression (timestamps for each state change)
   - SLA compliance metrics (breach Y/N, escalation count)
   - Client satisfaction rating
   - Attachments (if any)

2. **Document Creation in Alfresco**:
   - Format: PDF + XML metadata (ensures long-term readability)
   - Permissions: Read-only for support team; full access for compliance officer
   - Retention Schedule: Automatically purges after statutory retention period

3. **Persistent Storage**:
   - Alfresco node reference (e.g., `workspace://SpacesStore/abc123...`) stored in Ticket.alfrescoFolderId
   - Node ID enables future lookups without additional metadata
   - Audit trail in Alfresco shows archival timestamp and user

**Fallback Strategy for Failure Modes:**

In production deployment, if Alfresco is temporarily unavailable:

```
Scenario: User closes ticket, Alfresco service returns timeout
                          ↓
       Backend catches exception, creates PendingArchive record
       (status: PENDING_RETRY, ticketId, metadata captured)
                          ↓
       Ticket closes successfully (non-blocking!)
       User receives confirmation immediately
                          ↓
       Background job runs every 5 minutes:
       → Queries PENDING_RETRY records
       → Retries archival (up to 3 attempts)
       → Marks successful or FAILED after exhaustion
                          ↓
       Admin is alerted if FAILED:
       "Ticket TK-001 manual archival required"
```

This pattern ensures **zero-blocking ticket closure** even during infrastructure issues.

**Simulation Mode for Demonstrations:**

For jury presentations without requiring a running Alfresco instance, SupportFlow supports simulation mode:

```yaml
# In application-demo.yml
alfresco:
  archive:
    simulation-mode: true
```

When enabled, closed tickets generate realistic mock nodeRef values:

```
Generated: SIMULATED-NODEREF-TK-001-1743408612000
  ↑                              ↑    ↑           ↑
  Indicator                Ticket Ref ID      Timestamp
```

This provides UI/testing completeness without external dependencies. Production deployment simply sets `simulation-mode: false` and provides Alfresco connection details.

#### 4.3.3 Business Value

**For Compliance & Risk:**
- **Regulatory Adherence**: GDPR retention schedules, SOX audit trail
- **Litigation Support**: Complete context available for legal discovery (email metadata, escalation history)
- **Data Protection**: Alfresco permissions prevent unauthorized disclosure

**For Business Continuity:**
- **Searchable Archive**: Historical ticket data accessible for root-cause analysis
- **Trend Analysis**: Support team identifies recurring issues from archived tickets
- **Knowledge Base**: Closed tickets with resolutions aid future troubleshooting

**For Operations:**
- **Scalability**: Alfresco handles unlimited archival growth (enterprise storage)
- **Backup Integration**: ERP systems can include Alfresco in disaster recovery procedures
- **Metadata Standardization**: All archived tickets follow same structure (ease of parsing)

---

### 4.4 Integration & Orchestration

The three subsystems (Camunda, Keycloak, Alfresco) work cohesively through **message-driven architecture**:

```
TicketService receives request
    ↓
Validates authorization (via Keycloak JWT in @PreAuthorize)
    ↓
Updates Ticket entity in database
    ↓
Calls CamundaService.correlateMessage() 
    → Signals Camunda process instance
    → Process advances to next task (e.g., resolution → closure)
    → Boundary timers continue monitoring SLA
    ↓
If ticket closed:
  → Calls AlfrescoArchiveService.archiveClosedTicket()
  → Captures metadata
  → Creates CMIS document
  → Stores nodeRef in Ticket.alfrescoFolderId
```

This **loose coupling** allows each component to be updated independently:
- Keycloak version upgrade doesn't affect Camunda
- Camunda process changes don't require code redeployment (BPMN XML is data)
- Alfresco unavailability doesn't prevent ticket closure (fallback retry queue)

---

### 4.5 Conclusion

SupportFlow demonstrates a **production-ready support ticket system** combining three enterprise technologies:

| Component | Innovation |
|-----------|------------|
| **Camunda** | Automated SLA enforcement eliminates manual escalation |
| **Keycloak** | Standards-based RBAC prevents privilege escalation |
| **Alfresco** | Compliant archival enables regulatory adherence |

The integration pattern is message-driven, fault-tolerant, and follows industry best practices (BPMN 2.0, OAuth2/OIDC, CMIS). The system scales horizontally (stateless REST API) and maintains full audit trails for compliance.

**Key Achievement**: The jury can observe all three technologies in operation during live demonstrations:
1. **Full A→Z Flow** (demo-full-flow.sh) shows message correlation between ticket lifecycle and Camunda process
2. **SLA Escalation** (demo-sla-escalation.sh) demonstrates boundary timers triggering automatic escalation
3. **RBAC Tour** (demo-rbac-tour.sh) shows JWT-based authorization with 403 enforcement
4. **Archive Status** (verified in ticket close event) shows Alfresco integration and fallback strategy

---

## Appendix: Deployment & Testing

### Test Users (Jury Credentials)

| Role | Username | Password | Purpose |
|------|----------|----------|---------|
| ADMIN | admin | admin123 | Full system access |
| MANAGER | manager | manager123 | Assignment and oversight |
| AGENT | agent1 | agent123 | Ticket resolution |
| CLIENT | client1 | client123 | Ticket creation |

### Quick Start for Jury

```bash
# 1. Start backend, frontend, PostgreSQL, Keycloak
docker-compose up -d

# 2. Run full end-to-end demo
bash demo-full-flow.sh

# 3. Run SLA escalation demo (30 seconds)
bash demo-sla-escalation.sh

# 4. Run RBAC authorization tour (3 minutes)
bash demo-rbac-tour.sh
```

### Expected Outcomes

✅ All tests complete successfully
✅ SLA escalation events observable in Camunda Cockpit
✅ JWT tokens parsed and authorized at each API call
✅ Closed tickets archived with realistic nodeRef

---

**Document Version**: 1.0  
**Date**: March 31, 2026  
**Project**: SupportFlow Ticket Management System  
**Audience**: Jury, Stakeholders
