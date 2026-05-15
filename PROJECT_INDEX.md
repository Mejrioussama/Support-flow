# SupportFlow Project Index
**Last Updated**: April 1, 2026  
**Status**: Production Ready  
**Version**: 1.0.0-SNAPSHOT

---

## 📋 Project Overview

SupportFlow is a comprehensive **Client Support Ticket Management System** integrating:
- **Backend**: Spring Boot 3.2 + Camunda BPM
- **Frontend**: Angular
- **Authentication**: Keycloak 23.0
- **Document Management**: Alfresco
- **Database**: MySQL 8.0
- **Infrastructure**: Docker Compose (8 containers)

**Core Features**:
- Automated ticket lifecycle management
- Role-Based Access Control (RBAC)
- Workflow automation with Camunda
- Document archiving with Alfresco
- Real-time SLA monitoring
- Multi-user collaboration

---

## 📁 Project Structure

### Root Level Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Complete containerized environment setup |
| `docker-compose.yml.backup` | Backup of docker configuration |
| `init-db.sql` | Database initialization schema |
| `admin-token.txt` | Stored admin authentication token |
| `manager-token.txt` | Stored manager authentication token |
| `token.txt` | Current session token |

### Documentation

| File | Content |
|------|---------|
| [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) | Implementation status & validation results |
| [PHASE_1_IMPLEMENTATION_COMPLETE.md](PHASE_1_IMPLEMENTATION_COMPLETE.md) | Phase 1 completion report |
| [PHASE_2_IMPLEMENTATION_COMPLETE.md](PHASE_2_IMPLEMENTATION_COMPLETE.md) | Phase 2 completion report |
| [PHASE_3_IMPLEMENTATION_COMPLETE.md](PHASE_3_IMPLEMENTATION_COMPLETE.md) | Phase 3 completion report |
| [QUICKSTART.md](QUICKSTART.md) | Project quickstart guide |
| [SUPPORTFLOW_ROADMAP.md](SUPPORTFLOW_ROADMAP.md) | Development roadmap |
| [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) | Docker issues & solutions |
| [JAVA_HOME_SETUP.md](JAVA_HOME_SETUP.md) | Java environment configuration |

### Configuration Files

| File | Purpose |
|------|---------|
| `account-roles.json` | Account role definitions |
| `default-roles.json` | Default RBAC role mapping |
| `user-roles.json` | User role assignments |
| `roles.json` | Role configuration |
| `clients.json` | OAuth2 client configurations |
| `clients.txt` | Client list reference |
| `users.json` | User account configurations |

### Test & Diagnostic Scripts

| Script | Purpose |
|--------|---------|
| `test-authorization.ps1` | Authorization testing |
| `test-rbac-scenarios.ps1` | RBAC scenario validation |
| `test-scenario-az-strict.ps1` | Strict authorization scenarios |
| `test-premium-scenario.ps1` | Premium feature testing |
| `check-alfresco-camunda-e2e.ps1` | End-to-end Alfresco integration tests |
| `DIAGNOSTIC_D1_KEYCLOAK.ps1` | Keycloak diagnostics (PowerShell) |
| `DIAGNOSTIC_D3_KEYCLOAK_CURL.ps1` | Keycloak diagnostics via curl |
| `DIAGNOSTIC_D4_CAMUNDA.ps1` | Camunda diagnostics |
| `demo-full-flow.sh` | Full workflow demonstration |
| `demo-rbac-tour.sh` | RBAC features demo |
| `demo-sla-escalation.sh` | SLA escalation demo |

---

## 🏗️ Backend (`/backend`)

**Technology Stack**: Java 17 + Spring Boot 3.2.0 + Maven

### Dependencies Overview
- **Spring Boot Starters**: Web, Security, JPA, Validation
- **Camunda BPM**: 7.20.0 (Workflow orchestration)
- **Keycloak**: 23.0.1 (Identity management)
- **Alfresco CMIS**: Document management client
- **Spring Doc OpenAPI**: 2.3.0 (Swagger API docs)
- **Apache POI**: 5.2.5 (Excel export)
- **iText**: 8.0.2 (PDF generation)
- **MySQL Connector**: Database driver
- **Lombok**: Code generation
- **Jackson**: JSON processing

### Source Structure

```
backend/src/main/java/com/supportflow/
├── SupportFlowApplication.java          # Main Spring Boot app
├── camunda/                              # Workflow processes
│   ├── CustomBpmnParseListener.java
│   ├── ProcessManager.java
│   └── ...
├── config/                               # Spring configurations
│   ├── SecurityConfig.java
│   ├── CorsConfig.java
│   ├── AlfrescoConfig.java
│   └── CamundaConfig.java
├── controller/                           # REST API endpoints
│   ├── TicketController.java
│   ├── UserController.java
│   ├── ClientController.java
│   ├── DashboardController.java
│   ├── ArchiveController.java
│   └── ...
├── service/                              # Business logic
│   ├── TicketService.java
│   ├── UserService.java
│   ├── AlfrescoCmisService.java
│   ├── CamundaProcessService.java
│   ├── ExcelExportService.java
│   ├── PdfGenerationService.java
│   └── ...
├── entity/                               # JPA Entities
│   ├── Ticket.java
│   ├── User.java
│   ├── Client.java
│   ├── Role.java
│   └── ...
├── repository/                           # Data access layer
│   ├── TicketRepository.java
│   ├── UserRepository.java
│   └── ...
├── dto/                                  # Data Transfer Objects
├── mapper/                               # Entity-DTO mapping
├── exception/                            # Custom exceptions
├── security/                             # Authentication/Authorization
│   ├── KeycloakJwtValidator.java
│   ├── JwtTokenProvider.java
│   └── RoleBasedAccessControl.java
└── util/                                 # Utility classes
```

### Key Services

| Service | Responsibility |
|---------|-----------------|
| `TicketService` | Ticket CRUD & lifecycle management |
| `UserService` | User account management & RBAC |
| `AlfrescoCmisService` | Document storage & retrieval |
| `CamundaProcessService` | Workflow orchestration |
| `DashboardService` | Analytics & KPI calculations |
| `ExcelExportService` | Report generation (Excel) |
| `PdfGenerationService` | PDF document generation |
| `NotificationService` | Email/SMS notifications |

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tickets` | GET/POST/PUT | Ticket management |
| `/api/tickets/{id}` | GET/PUT/DELETE | Ticket operations |
| `/api/tickets/{id}/archive` | POST | Archive ticket |
| `/api/users` | GET/POST | User management |
| `/api/users/{id}/roles` | GET/PUT | Role assignment |
| `/api/clients` | GET/POST | Client management |
| `/api/dashboard` | GET | KPI metrics |
| `/api/processes` | GET | Camunda processes |
| `/api/health` | GET | Health check |

### Database Schema
**Main Tables**:
- `tickets` - Main ticket records
- `users` - User accounts
- `clients` - Client organizations
- `roles` - RBAC roles
- `user_roles` - User-role mappings
- `archives` - Archived ticket documents
- `audit_logs` - Audit trail

---

## 🎨 Frontend (`/frontend`)

**Technology Stack**: Angular + TypeScript + SCSS

### Key Feature Modules

```
frontend/src/app/
├── app.component.ts                 # Root component
├── app.routes.ts                    # Routing configuration
├── app.config.ts                    # App configuration
├── core/                            # Core services & guards
│   ├── auth/
│   ├── http/
│   └── services/
├── shared/                          # Reusable components
│   ├── components/
│   ├── directives/
│   ├── pipes/
│   └── models/
└── features/                        # Feature modules
    ├── dashboard/                   # KPI dashboard
    ├── tickets/                     # Ticket management UI
    ├── clients/                     # Client management
    ├── users/                       # User administration
    ├── profile/                     # User profile
    └── archives-reports/            # Archiving & reports
```

### Configuration Files
- `angular.json` - Angular CLI configuration
- `tsconfig.json` - TypeScript configuration
- `tsconfig.app.json` - App-specific TS config
- `package.json` - Dependencies & scripts
- `nginx.conf` - Production NGINX configuration

---

## 🔐 Authentication & Security (`/keycloak`)

**Technology**: Keycloak 23.0 - Open source identity provider

### Configuration
- **Realm**: supportflow-realm.json
- **User Database**: MySQL (shared with application)
- **Protocols**: OpenID Connect, SAML 2.0
- **Port**: 8180 (isolated from other services)

### Custom Theme
- **Path**: `/keycloak/themes/supportflow/`
- **Customization**: Branded login UI

### RBAC Roles
- `ADMIN` - Full system access
- `MANAGER` - Ticket management, user management
- `SUPPORT` - Ticket support, client interaction
- `VIEWER` - Read-only access
- `CLIENT` - Client-facing portal access

---

## 📦 Document Management (`/alfresco`)

**Technology**: Alfresco ECM with CMIS API

### Configuration
- **Main Config**: `/alfresco/alfresco-global.properties`
- **Keystore**: `/alfresco/keystore-passwords.properties`
- **Default Port**: 8090
- **Docker Network**: Internal hostname `alfresco:8080`

### Functionality
- Archive ticket documents (PDFs, attachments)
- Full-text search on archived content
- Document versioning & audit trail
- Compliance with retention policies

---

## ⚙️ Workflow Automation (`backend/src/main/resources/processes`)

**Technology**: Camunda BPM 7.20.0

### Process Definitions
- **Ticket Creation Workflow** - Routing & initial assignment
- **Escalation Process** - SLA violation handling
- **Archive Process** - Document management workflow
- **Approval Process** - Multi-level approvals

### Integration Points
- REST API tasks for backend calls
- Keycloak user resolution
- Alfresco document operations
- Email notifications via templates

---

## 🐳 Infrastructure (`docker-compose.yml`)

### Container Services

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `supportflow-mysql` | mysql:8.0 | 3306 | Database |
| `supportflow-keycloak` | keycloak:23.0 | 8180 | Identity provider |
| `supportflow-backend` | custom | 8080 | Spring Boot API |
| `supportflow-frontend` | NGINX | 4200 | Angular app |
| `supportflow-alfresco` | alfresco:latest | 8090 | Document management |
| `supportflow-camunda` | camunda:7.20 | 8081 | Workflow console |
| `supportflow-mailhog` | mailhog:latest | 1025/8025 | Email testing |
| `supportflow-elasticsearch` | elasticsearch:8.0 | 9200 | Logging/search |

### Network
- **Name**: `supportflow-network`
- **Type**: Bridge network for inter-container communication

### Volumes
- `mysql_data` - MySQL persistent storage
- `alfresco_data` - Alfresco content store
- `elasticsearch_data` - Search index
- `./backend:/app/backend` - Live code mounting (dev)
- `./frontend:/app/frontend` - Live code mounting (dev)

---

## 📊 Key Directories

### `/docs`
- `ACCES_CAMUNDA.md` - Camunda access guide
- `GUIDE_TEST_CAMUNDA.md` - Testing procedures
- `SCENARIO_PREMIUM_8_ELEMENTS.md` - Premium feature scenarios
- `RAPPORT_ETAT_APPLICATION_2026-03-31.md` - Application status report
- `RAPPORT_FONCTIONNEL.md` - Functional specification

### `/postman`
- `SupportFlow-Camunda-Tests.postman_collection.json` - API test collection

### `/logs`
- Application runtime logs

### `/uploads`
- Demo documents
- `/uploads/archives/monthly/` - Monthly archive backups

---

## 🔑 Important Environment Variables

### .env File (Create if missing)
```properties
# MySQL
MYSQL_ROOT_PASSWORD=root
MYSQL_USER=supportflow
MYSQL_PASSWORD=supportflow123

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Alfresco
ALFRESCO_USERNAME=admin
ALFRESCO_PASSWORD=admin
ALFRESCO_URL=http://alfresco:8080/alfresco/api/-default-/public/cmis/versions/1.1/atom

# Backend
JAVA_OPTS=-Xmx512m -Xms256m
SPRING_PROFILES_ACTIVE=docker
```

---

## 🚀 Quick Start Commands

### Build & Deploy
```bash
# Build backend
cd backend && mvn clean package

# Build frontend
cd frontend && npm install && npm run build

# Start full stack
docker-compose up -d

# View logs
docker-compose logs -f backend
```

### Access URLs
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8080/api
- **Keycloak**: http://localhost:8180/admin
- **Camunda**: http://localhost:8081/camunda
- **Alfresco**: http://localhost:8090/alfresco
- **API Docs**: http://localhost:8080/swagger-ui.html
- **Mailhog**: http://localhost:8025

---

## 📝 Implementation Status

### Phase 1 ✅
- Core ticket management module
- Basic RBAC implementation
- Keycloak integration

### Phase 2 ✅
- Camunda workflow automation
- SLA monitoring & escalation
- Advanced reporting

### Phase 3 ✅
- Alfresco archiving integration
- Document lifecycle management
- Compliance audit trails

### Performance & Testing
- **E2E Test Results**: 13/15 PASS (86.67%)
- **Core Workflows**: Validated
- **Infrastructure**: All 8 containers healthy
- **Production Status**: Ready

---

## 🔗 Related Documentation Files

- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - Detailed completion status
- [QUICKSTART.md](QUICKSTART.md) - Setup & running guide
- [SUPPORTFLOW_ROADMAP.md](SUPPORTFLOW_ROADMAP.md) - Future enhancements
- [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) - Issue resolution
- [JAVA_HOME_SETUP.md](JAVA_HOME_SETUP.md) - Environment setup
- [RAPPORT_PROJET_COMPLET.md](RAPPORT_PROJET_COMPLET.md) - French project completion report

---

## 💡 Development Notes

- **Java Version**: 17 (Required)
- **Maven**: 3.8+
- **Node.js**: 18+ (for frontend)
- **Docker**: Required for full stack
- **IDE**: VS Code recommended with extensions

---

*This index is auto-generated and maintained for project onboarding and reference.*
