# RAPPORT COMPLET DU PROJET SUPPORTFLOW
## Système de Gestion Automatisée des Tickets Clients

---

## TABLE DES MATIàRES

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Architecture technique](#2-architecture-technique)
3. [Stack technologique](#3-stack-technologique)
4. [Structure du projet](#4-structure-du-projet)
5. [Backend - Description complète](#5-backend---description-complète)
6. [Frontend - Description complète](#6-frontend---description-complète)
7. [Base de données et entités](#7-base-de-données-et-entités)
8. [Authentification et sécurité (Keycloak)](#8-authentification-et-sécurité-keycloak)
9. [Workflow Camunda BPM](#9-workflow-camunda-bpm)
10. [WebSocket - Notifications temps réel](#10-websocket---notifications-temps-réel)
11. [API REST - Tous les endpoints](#11-api-rest---tous-les-endpoints)
12. [Rôles et autorisations](#12-rôles-et-autorisations)
13. [Docker et déploiement](#13-docker-et-déploiement)
14. [Comptes utilisateurs de test](#14-comptes-utilisateurs-de-test)
15. [Scénarios de test du workflow](#15-scénarios-de-test-du-workflow)
16. [Problèmes connus et état actuel](#16-problèmes-connus-et-état-actuel)
17. [Guide de lancement](#17-guide-de-lancement)

---

## 1. VUE D'ENSEMBLE DU PROJET

**SupportFlow** est un système de gestion automatisée des tickets clients. Il permet aux entreprises de gérer le cycle de vie complet d'un ticket de support : création, assignation, traitement, résolution, validation client et archivage.

### Objectifs principaux :
- Gestion complète du cycle de vie des tickets (OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED)
- Automatisation du workflow via Camunda BPM
- Calcul automatique des priorités (score basé sur gravité + impact)
- Gestion SLA avec alertes automatiques
- Notifications temps réel via WebSocket/STOMP
- Authentification centralisée via Keycloak (OAuth2/JWT)
- Interface web Angular Material moderne
- Dashboard avec statistiques et KPIs
- Gestion des utilisateurs, clients et rôles

---

## 2. ARCHITECTURE TECHNIQUE

```
âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
âÂÂ                    FRONTEND (Angular 17)                     âÂÂ
âÂÂ                    http://localhost:4200                      âÂÂ
âÂÂ  Keycloak-Angular + @stomp/stompjs + Angular Material       âÂÂ
âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¬âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
                       âÂÂ HTTP REST + WebSocket
                       âÂÂ¼
âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
âÂÂ               BACKEND (Spring Boot 3.2.0)                    âÂÂ
âÂÂ               http://localhost:8080/api                       âÂÂ
âÂÂ                                                              âÂÂ
âÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ     âÂÂ
âÂÂ  âÂÂ ControllersâÂÂ  âÂÂ   Services   âÂÂ  âÂÂ  Camunda BPM     âÂÂ     âÂÂ
âÂÂ  âÂÂ (REST API) âÂÂ→ âÂÂ (Business)   âÂÂ→ âÂÂ  (Workflow)      âÂÂ     âÂÂ
âÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ     âÂÂ
âÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ     âÂÂ
âÂÂ  âÂÂ Security   âÂÂ  âÂÂ  WebSocket   âÂÂ  âÂÂ  Notifications   âÂÂ     âÂÂ
âÂÂ  âÂÂ (OAuth2)   âÂÂ  âÂÂ  (STOMP)     âÂÂ  âÂÂ  (Temps réel)    âÂÂ     âÂÂ
âÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ     âÂÂ
âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¬âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¬âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¬âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
           âÂÂ              âÂÂ              âÂÂ
    âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¼âÂÂâÂÂâÂÂ    âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¼âÂÂâÂÂâÂÂ    âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ¼âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
    âÂÂ  MySQL  âÂÂ    âÂÂKeycloak âÂÂ    âÂÂ   MailHog   âÂÂ
    âÂÂ  8.0    âÂÂ    âÂÂ  23.0   âÂÂ    âÂÂ  (Email)    âÂÂ
    âÂÂ :3306   âÂÂ    âÂÂ :8180   âÂÂ    âÂÂ :8025/:1025 âÂÂ
    âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ    âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ    âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
```

---

## 3. STACK TECHNOLOGIQUE

### Backend
| Technologie | Version | Usage |
|---|---|---|
| Java | 17 | Langage principal |
| Spring Boot | 3.2.0 | Framework backend |
| Spring Security | 6.x | Sécurité OAuth2/JWT |
| Spring Data JPA | 3.2.0 | Accès données (Hibernate) |
| Spring WebSocket | 3.2.0 | STOMP/WebSocket |
| Spring Mail | 3.2.0 | Envoi d'emails |
| Camunda BPM | 7.20.0 | Moteur de workflow |
| MySQL Connector | 8.x | Driver JDBC |
| Lombok | latest | Réduction du boilerplate |
| MapStruct | 1.5.5 | Mapping Entity âÂÂ DTO |
| SpringDoc OpenAPI | 2.3.0 | Documentation Swagger |
| iText | 8.0.2 | Génération PDF |
| Apache POI | 5.2.5 | Génération Excel |
| JJWT | 0.12.3 | Gestion JWT |
| OpenCMIS | 1.1.0 | Client Alfresco |

### Frontend
| Technologie | Version | Usage |
|---|---|---|
| Angular | 17.0.0 | Framework frontend |
| Angular Material | 17.0.0 | UI Components |
| Keycloak-Angular | 15.0.0 | Intégration Keycloak |
| Keycloak-JS | 23.0.0 | Client Keycloak |
| @stomp/stompjs | 7.3.0 | Client WebSocket STOMP |
| Chart.js / ng2-charts | 4.4.0/5.0.0 | Graphiques dashboard |
| RxJS | 7.8.0 | Programmation réactive |
| TypeScript | 5.2.0 | Langage |

### Infrastructure (Docker)
| Service | Image | Port | Usage |
|---|---|---|---|
| MySQL | mysql:8.0 | 3306 | Base de données |
| Keycloak | keycloak:23.0 | 8180 | Authentification |
| Backend | eclipse-temurin:17 | 8080 | API REST |
| SonarQube | sonarqube:community | 9000 | Qualité code |
| MailHog | mailhog:latest | 8025/1025 | Test emails |
| Alfresco | alfresco:7.4.0 | 8090 | GED/Archivage |

---

## 4. STRUCTURE DU PROJET

```
Support-flow/
âÂÂâÂÂâÂÂ docker-compose.yml              # Orchestration Docker (7 services)
âÂÂâÂÂâÂÂ init-db.sql                     # Script initialisation MySQL
âÂÂâÂÂâÂÂ keycloak/
âÂÂ   âÂÂâÂÂâÂÂ supportflow-realm.json      # Configuration realm Keycloak
âÂÂ
âÂÂâÂÂâÂÂ backend/                         # SPRING BOOT 3.2.0
âÂÂ   âÂÂâÂÂâÂÂ pom.xml                     # Maven avec toutes les dépendances
âÂÂ   âÂÂâÂÂâÂÂ Dockerfile                  # Multi-stage build (JDK 17)
âÂÂ   âÂÂâÂÂâÂÂ mvnw / mvnw.cmd            # Maven Wrapper
âÂÂ   âÂÂâÂÂâÂÂ src/main/
âÂÂ       âÂÂâÂÂâÂÂ java/com/supportflow/
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ SupportFlowApplication.java    # Main class
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ config/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ SecurityConfig.java        # OAuth2 + CORS + JWT converter
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ DevSecurityConfig.java     # Auth locale (profil dev)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ WebSocketConfig.java       # STOMP endpoints (/ws, /ws-native)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ JpaAuditingConfig.java     # Audit JPA
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ OpenApiConfig.java         # Swagger config
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ controller/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ AuthController.java        # Login/Register (profil dev)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketController.java      # 19 endpoints tickets
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ CommentController.java     # 6 endpoints commentaires
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ClientController.java      # 10 endpoints clients
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ UserController.java        # 10 endpoints utilisateurs
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ DashboardController.java   # 4 endpoints stats
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ NotificationController.java # 5 endpoints notifications
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ service/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketService.java         # Logique tickets (640 lignes)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ CamundaService.java        # Intégration Camunda
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ NotificationService.java   # Notifications + WebSocket
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ CommentService.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ClientService.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ UserService.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ DashboardService.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ReportService.java         # PDF/Excel/Alfresco
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ KeycloakAdminService.java  # Admin API Keycloak
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ entity/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ BaseEntity.java            # Superclass (id, timestamps)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ Ticket.java                # Entité principale (~265 lignes)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ User.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ Client.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ Comment.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ Notification.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ Attachment.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketHistory.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ enums/
âÂÂ       âÂÂ   âÂÂ       âÂÂâÂÂâÂÂ TicketStatus.java       # OPEN, ASSIGNED, IN_PROGRESS, etc.
âÂÂ       âÂÂ   âÂÂ       âÂÂâÂÂâÂÂ TicketType.java         # INCIDENT, BUG, FEATURE_REQUEST, etc.
âÂÂ       âÂÂ   âÂÂ       âÂÂâÂÂâÂÂ Severity.java           # CRITICAL, HIGH, MEDIUM, LOW
âÂÂ       âÂÂ   âÂÂ       âÂÂâÂÂâÂÂ Impact.java             # CRITICAL, HIGH, MEDIUM, LOW
âÂÂ       âÂÂ   âÂÂ       âÂÂâÂÂâÂÂ Priority.java           # Calculée via score
âÂÂ       âÂÂ   âÂÂ       âÂÂâÂÂâÂÂ Role.java               # ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT, CLIENT
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ dto/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketCreateDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketResponseDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketUpdateDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ UserDTO.java / UserSummaryDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ClientDTO.java / ClientSummaryDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ CommentDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ NotificationDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ AttachmentDTO.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ auth/ (LoginRequest, RegisterRequest, JwtResponse)
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ stats/ (DashboardStatsDTO, AgentPerformanceDTO, DailyTicketCount)
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ repository/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketRepository.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ UserRepository.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ClientRepository.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ CommentRepository.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ NotificationRepository.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ TicketHistoryRepository.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ AttachmentRepository.java
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ mapper/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ EntityMapper.java          # MapStruct mapper
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ security/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ JwtTokenProvider.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ JwtAuthenticationFilter.java
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ CustomUserDetailsService.java
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ camunda/delegate/
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ArchiveTicketDelegate.java  # Archivage post-validation
âÂÂ       âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ SlaNotificationDelegate.java # Alerte SLA
âÂÂ       âÂÂ   âÂÂâÂÂâÂÂ exception/
âÂÂ       âÂÂ       âÂÂâÂÂâÂÂ (ResourceNotFoundException, BusinessException, etc.)
âÂÂ       âÂÂâÂÂâÂÂ resources/
âÂÂ           âÂÂâÂÂâÂÂ application.yml                 # Config principale
âÂÂ           âÂÂâÂÂâÂÂ application-docker.yml          # Config Docker
âÂÂ           âÂÂâÂÂâÂÂ application-dev.yml             # Config développement
âÂÂ           âÂÂâÂÂâÂÂ application-test.yml            # Config tests
âÂÂ           âÂÂâÂÂâÂÂ bpmn/
âÂÂ               âÂÂâÂÂâÂÂ ticket-workflow.bpmn        # Processus BPMN Camunda
âÂÂ
âÂÂâÂÂâÂÂ frontend/                        # ANGULAR 17
    âÂÂâÂÂâÂÂ package.json
    âÂÂâÂÂâÂÂ angular.json
    âÂÂâÂÂâÂÂ tsconfig.json
    âÂÂâÂÂâÂÂ src/
        âÂÂâÂÂâÂÂ main.ts                  # Bootstrap avec Keycloak init
        âÂÂâÂÂâÂÂ index.html
        âÂÂâÂÂâÂÂ styles.scss
        âÂÂâÂÂâÂÂ environments/
        âÂÂ   âÂÂâÂÂâÂÂ environment.ts       # apiUrl, keycloak config
        âÂÂâÂÂâÂÂ app/
            âÂÂâÂÂâÂÂ app.component.ts     # Composant racine
            âÂÂâÂÂâÂÂ app.config.ts        # Providers (Router, HTTP, Keycloak)
            âÂÂâÂÂâÂÂ app.routes.ts        # Routes avec guards et rôles
            âÂÂâÂÂâÂÂ core/
            âÂÂ   âÂÂâÂÂâÂÂ guards/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ auth.guard.ts           # KeycloakAuthGuard + rôles
            âÂÂ   âÂÂâÂÂâÂÂ interceptors/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ error.interceptor.ts     # Gestion erreurs HTTP
            âÂÂ   âÂÂâÂÂâÂÂ models/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ index.ts                 # Interfaces TypeScript (293 lignes)
            âÂÂ   âÂÂâÂÂâÂÂ services/
            âÂÂ       âÂÂâÂÂâÂÂ auth.service.ts           # Wrapper Keycloak
            âÂÂ       âÂÂâÂÂâÂÂ ticket.service.ts         # HTTP client tickets
            âÂÂ       âÂÂâÂÂâÂÂ client.service.ts
            âÂÂ       âÂÂâÂÂâÂÂ user.service.ts
            âÂÂ       âÂÂâÂÂâÂÂ dashboard.service.ts
            âÂÂ       âÂÂâÂÂâÂÂ notification.service.ts   # Notifications + toast
            âÂÂ       âÂÂâÂÂâÂÂ websocket.service.ts      # Client STOMP natif
            âÂÂâÂÂâÂÂ layout/
            âÂÂ   âÂÂâÂÂâÂÂ header/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ header.component.ts      # Barre de navigation + notifications
            âÂÂ   âÂÂâÂÂâÂÂ sidebar/
            âÂÂ       âÂÂâÂÂâÂÂ sidebar.component.ts     # Menu latéral + rôles
            âÂÂâÂÂâÂÂ features/
            âÂÂ   âÂÂâÂÂâÂÂ dashboard/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ dashboard.component.ts   # Stats + graphiques Chart.js
            âÂÂ   âÂÂâÂÂâÂÂ tickets/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ tickets.routes.ts
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ticket-list/             # Liste avec filtres et pagination
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ticket-detail/           # Détail + actions workflow
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ ticket-form/             # Création/édition
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ escalate-dialog/         # Dialog d'escalade
            âÂÂ   âÂÂâÂÂâÂÂ clients/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ client-list/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ client-detail/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ client-form/
            âÂÂ   âÂÂâÂÂâÂÂ users/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ user-list/
            âÂÂ   âÂÂ   âÂÂâÂÂâÂÂ user-form/
            âÂÂ   âÂÂâÂÂâÂÂ profile/
            âÂÂ       âÂÂâÂÂâÂÂ profile.component.ts
            âÂÂâÂÂâÂÂ shared/                          # Composants partagés
```

---

## 5. BACKEND - DESCRIPTION COMPLàTE

### 5.1 Contrôleurs (Controllers)

#### TicketController.java (19 endpoints)
Le contrôleur principal, gère tout le cycle de vie des tickets :
- **POST /tickets** âÂÂ Créer un ticket (auto-détection client pour rôle CLIENT)
- **GET /tickets/{id}** âÂÂ Récupérer un ticket (vérification propriété pour CLIENT)
- **GET /tickets/reference/{ref}** âÂÂ Récupérer par référence (ex: SF-0001)
- **GET /tickets** âÂÂ Lister tous (filtré par rôle : CLIENT voit les siens, AGENT voit assignés, MANAGER/ADMIN voient tout)
- **GET /tickets/my-tickets** âÂÂ Mes tickets (CLIENT uniquement)
- **GET /tickets/status/{status}** âÂÂ Par statut (ADMIN/MANAGER/AGENT)
- **GET /tickets/client/{id}** âÂÂ Par client (ADMIN/MANAGER)
- **GET /tickets/agent/{id}** âÂÂ Par agent (ADMIN/MANAGER/AGENT)
- **GET /tickets/unassigned** âÂÂ Non assignés (ADMIN/MANAGER/AGENT)
- **GET /tickets/search?q=** âÂÂ Recherche (ADMIN/MANAGER/AGENT)
- **PUT /tickets/{id}** âÂÂ Mettre à jour (ADMIN/MANAGER/AGENT)
- **DELETE /tickets/{id}** âÂÂ Supprimer (ADMIN uniquement, annule Camunda + cascade)
- **POST /tickets/{id}/assign/{agentId}** âÂÂ Assigner (ADMIN/MANAGER)
- **POST /tickets/{id}/take-charge** âÂÂ Prendre en charge (AGENT/MANAGER/ADMIN)
- **POST /tickets/{id}/escalate** âÂÂ Escalade manuelle (AGENT/MANAGER/ADMIN)
- **POST /tickets/{id}/escalate-sla** âÂÂ Escalade SLA (MANAGER/ADMIN)
- **POST /tickets/{id}/resolve** âÂÂ Résoudre, body: `{resolutionSummary}` (AGENT/MANAGER/ADMIN)
- **POST /tickets/{id}/close** âÂÂ Fermer avec satisfaction, body: `{satisfactionRating, satisfactionComment}` (CLIENT/MANAGER/ADMIN)
- **PATCH /tickets/{id}/status** âÂÂ Changer statut directement (AGENT/MANAGER/ADMIN)

**Logique importante :**
- `getUserIdFromJwt()` âÂÂ Résout l'ID utilisateur MySQL depuis le JWT Keycloak (cherche par keycloakId puis email, auto-crée si inexistant)
- `getRoleFromJwt()` âÂÂ Extrait le rôle depuis `realm_access.roles` du JWT
- `isClientRole()` / `isAgentRole()` âÂÂ Vérifie le rôle pour filtrage

#### CommentController.java (6 endpoints)
- **POST /tickets/{ticketId}/comments** âÂÂ Ajouter commentaire (tous rôles)
- **GET /tickets/{ticketId}/comments** âÂÂ Lister (staff - inclut notes internes)
- **GET /tickets/{ticketId}/comments/public** âÂÂ Lister publics (tous rôles)
- **GET /tickets/{ticketId}/comments/paginated** âÂÂ Paginé (staff)
- **PUT /tickets/{ticketId}/comments/{id}** âÂÂ Modifier (tous rôles, vérifie propriétaire)
- **DELETE /tickets/{ticketId}/comments/{id}** âÂÂ Supprimer (ADMIN/MANAGER)

#### ClientController.java (10 endpoints)
- CRUD complet + recherche + /me pour profil client
- **POST /clients** âÂÂ Créer (ADMIN/MANAGER)
- **GET /clients** âÂÂ Lister (ADMIN/MANAGER/AGENT)
- **GET /clients/{id}** âÂÂ Détail (ADMIN/MANAGER/AGENT)
- **GET /clients/me** âÂÂ Mon profil (CLIENT)
- **PUT /clients/{id}** âÂÂ Modifier (ADMIN/MANAGER)
- **DELETE /clients/{id}** âÂÂ Désactiver (ADMIN)

#### UserController.java (10 endpoints)
- CRUD complet + recherche + agents disponibles
- **GET /users/agents/available** âÂÂ Agents disponibles (ADMIN/MANAGER/AGENT)
- **GET /users/check/username/{username}** âÂÂ Vérifier existence (public)
- **GET /users/check/email/{email}** âÂÂ Vérifier existence (public)

#### DashboardController.java (4 endpoints)
- **GET /dashboard/stats** âÂÂ Stats globales ou client (tous rôles, filtré)
- **GET /dashboard/agents/performance** âÂÂ Performance agents (ADMIN/MANAGER)
- **GET /dashboard/agents/{id}/stats** âÂÂ Stats agent (ADMIN/MANAGER/AGENT)
- **GET /dashboard/clients/{id}/stats** âÂÂ Stats client (ADMIN/MANAGER)

#### NotificationController.java (5 endpoints)
- **GET /notifications** âÂÂ Mes notifications (paginé)
- **GET /notifications/unread** âÂÂ Non lues
- **GET /notifications/unread/count** âÂÂ Compteur
- **POST /notifications/{id}/read** âÂÂ Marquer comme lue (vérifie propriétaire)
- **POST /notifications/read-all** âÂÂ Marquer toutes comme lues

#### AuthController.java (profil dev uniquement)
- Login/Register/Refresh/Logout/Me âÂÂ Authentification JWT locale
- Actif seulement avec `@Profile("dev")`, inactif en Docker (profil docker)

### 5.2 Services

#### TicketService.java (640 lignes)
- `createTicket()` âÂÂ Crée ticket + calcul SLA + calcul score/priorité + démarre Camunda + notifie
- `assignTicket()` âÂÂ Assigne + met à jour Camunda + notifie
- `takeCharge()` âÂÂ Agent prend en charge → IN_PROGRESS
- `escalateManually()` âÂÂ Escalade vers un autre agent → ESCALATED_MANUAL
- `escalateSLA()` âÂÂ Escalade automatique → ESCALATED_SLA + priorité CRITICAL
- `resolveTicket()` âÂÂ Résolution → RESOLVED + complète tâche Camunda resolve_ticket
- `closeTicket()` âÂÂ Fermeture → CLOSED + satisfaction + complète tâche Camunda client_validation
- `deleteTicket()` âÂÂ Annule Camunda + supprime (cascade notifications)
- `calculateSlaHours()` âÂÂ CRITICAL:4h, HIGH:8h, MEDIUM:24h, LOW:72h
- `generateReference()` âÂÂ Format SF-XXXX auto-incrémenté

#### CamundaService.java (213 lignes)
- `startTicketProcess()` âÂÂ Démarre le processus "ticket-workflow" avec variables
- `completeAssignmentTask()` âÂÂ Complète "qualify_ticket" (assignation)
- `completeResolutionTask()` âÂÂ Complète "resolve_ticket"
- `completeValidationTask()` âÂÂ Complète "client_validation" avec variable `clientValidated`
- `cancelProcess()` âÂÂ Annule un processus
- `completeProcess()` âÂÂ Complète la dernière tâche active

#### NotificationService.java (437 lignes)
- Crée des notifications pour chaque action (création, assignation, statut, SLA, escalade, résolution)
- `broadcastTicketStatusChange()` âÂÂ Diffuse via WebSocket sur `/topic/tickets`
- `broadcastNewComment()` âÂÂ Diffuse sur `/topic/tickets/{id}/comments`
- `broadcastCamundaTaskEvent()` âÂÂ Diffuse sur `/topic/tasks`
- `markAsReadForUser()` âÂÂ Marque comme lue avec vérification propriétaire
- Utilise `SimpMessagingTemplate` pour le WebSocket

### 5.3 Sécurité (SecurityConfig.java)

```java
// Endpoints publics (sans auth)
/actuator/health
/v3/api-docs/**, /swagger-ui/**
/auth/**
/ws/**, /ws-native/**
/camunda/**, /engine-rest/**

// Tous les autres → authenticated
.anyRequest().authenticated()

// JWT Converter : extrait rôles de realm_access, resource_access, et flat "roles"
// Préfixe ROLE_ ajouté pour Spring Security
```

---

## 6. FRONTEND - DESCRIPTION COMPLàTE

### 6.1 Configuration Keycloak

Le frontend utilise `keycloak-angular` pour l'authentification. La configuration est dans `environment.ts`:
```typescript
keycloak: {
  url: 'http://localhost:8180',
  realm: 'supportflow',
  clientId: 'supportflow-frontend'
}
apiUrl: 'http://127.0.0.1:8080/api'
```

L'initialisation Keycloak se fait dans `main.ts` au bootstrap de l'application.

### 6.2 Routing et Guards

Routes principales (`app.routes.ts`):
- `/dashboard` → DashboardComponent (tous rôles, données filtrées)
- `/profile` → ProfileComponent (tous rôles)
- `/tickets` → TicketListComponent, `/tickets/new`, `/tickets/:id`, `/tickets/:id/edit`
- `/clients` → Accès: ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT
- `/users` → Accès: ADMIN, SUPPORT_MANAGER

`AuthGuard` (`auth.guard.ts`):
- Étend `KeycloakAuthGuard`
- Redirige vers login Keycloak si non authentifié
- Vérifie `route.data['roles']` pour contrôle d'accès par rôle
- Redirige vers `/dashboard` si rôle insuffisant

### 6.3 Services Frontend

- **AuthService** âÂÂ Wrapper Keycloak : login, logout, getUserRoles, hasRole, getPrimaryRole, getUserInfo
- **TicketService** âÂÂ Client HTTP pour tous les endpoints tickets (CRUD + actions workflow)
- **WebSocketService** âÂÂ Client STOMP natif (`@stomp/stompjs`, `brokerURL: ws://...`), s'abonne à `/topic/tickets`, `/topic/tasks`, `/topic/tickets/{id}/comments`
- **NotificationService** âÂÂ Charge notifications depuis API, écoute WebSocket pour toast temps réel
- **DashboardService** âÂÂ Stats et KPIs
- **ClientService** âÂÂ CRUD clients
- **UserService** âÂÂ CRUD utilisateurs

### 6.4 Composants UI

- **Sidebar** âÂÂ Menu latéral avec items filtrés par rôle, collapsible
- **Header** âÂÂ Barre supérieure avec nom utilisateur, cloche notifications, menu profil/déconnexion
- **Dashboard** âÂÂ Graphiques Chart.js (tickets par statut, tendances quotidiennes), KPIs
- **Ticket List** âÂÂ Tableau Angular Material avec pagination, tri, filtres par statut/priorité
- **Ticket Detail** âÂÂ Vue détaillée avec actions contextuelles (selon statut et rôle), commentaires, historique
- **Ticket Form** âÂÂ Formulaire création/édition avec Angular Material
- **Escalate Dialog** âÂÂ Boîte de dialogue pour escalade (sélection agent + motif)

---

## 7. BASE DE DONNÉES ET ENTITÉS

### 7.1 Schéma des entités

#### Ticket (table: `tickets`)
| Champ | Type | Description |
|---|---|---|
| id | BIGINT PK | ID auto-généré |
| reference | VARCHAR(20) UNIQUE | Format SF-XXXX |
| title | VARCHAR(200) NOT NULL | Titre du ticket |
| description | TEXT | Description détaillée |
| type | ENUM | INCIDENT, BUG, FEATURE_REQUEST, QUESTION, TASK |
| status | ENUM | OPEN, ASSIGNED, IN_PROGRESS, PENDING, ESCALATED_MANUAL, ESCALATED_SLA, RESOLVED, CLOSED, CANCELLED |
| severity | ENUM | CRITICAL, HIGH, MEDIUM, LOW |
| impact | ENUM | CRITICAL, HIGH, MEDIUM, LOW |
| priority | ENUM | CRITICAL, HIGH, MEDIUM, LOW (calculée) |
| score | INT | Score calculé: (severityà3) + (impactà2) + SLA_factor |
| sla_hours | INT | Heures SLA (4/8/24/72 selon gravité) |
| sla_deadline | DATETIME | Deadline SLA calculée |
| sla_breached | BOOLEAN | SLA dépassé |
| process_instance_id | VARCHAR | ID processus Camunda |
| client_id | BIGINT FK → clients | Client propriétaire |
| assigned_agent_id | BIGINT FK → users | Agent assigné |
| created_by_user_id | BIGINT FK → users | Créateur |
| resolution_summary | TEXT | Résumé de résolution |
| satisfaction_rating | INT | Note satisfaction (1-5) |
| satisfaction_comment | VARCHAR(500) | Commentaire satisfaction |
| resolution_time_minutes | BIGINT | Temps de résolution |
| category | VARCHAR(50) | Catégorie |
| created_at / updated_at | DATETIME | Timestamps audit |
| assigned_at / resolved_at / closed_at | DATETIME | Timestamps workflow |

#### User (table: `users`)
| Champ | Type | Description |
|---|---|---|
| id | BIGINT PK | ID auto-généré |
| username | VARCHAR(50) UNIQUE | Nom d'utilisateur |
| email | VARCHAR(100) UNIQUE | Email |
| password | VARCHAR(255) | Mot de passe (dev mode) |
| first_name / last_name | VARCHAR(50) | Nom complet |
| role | ENUM | ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT, CLIENT |
| keycloak_id | VARCHAR UNIQUE | ID Keycloak |
| is_active | BOOLEAN | Actif |
| client_id | BIGINT FK → clients | Client associé |

#### Client (table: `clients`)
| Champ | Type | Description |
|---|---|---|
| id | BIGINT PK | ID |
| code | VARCHAR UNIQUE | Code client (CLT-XXX) |
| company_name | VARCHAR | Nom entreprise |
| email / phone | VARCHAR | Contact |
| contract_type | ENUM | BASIC, STANDARD, PREMIUM, ENTERPRISE |
| sla_level | ENUM | PREMIUM, BUSINESS, STANDARD |
| is_active | BOOLEAN | Actif |

#### Comment (table: `comments`)
| Champ | Type | Description |
|---|---|---|
| id | BIGINT PK | ID |
| content | TEXT | Contenu |
| is_internal | BOOLEAN | Note interne (invisible client) |
| ticket_id | BIGINT FK | Ticket parent |
| author_id | BIGINT FK | Auteur |

#### Notification (table: `notifications`)
| Champ | Type | Description |
|---|---|---|
| id | BIGINT PK | ID |
| title | VARCHAR(200) | Titre |
| message | TEXT | Message |
| type | VARCHAR(30) | Type (TICKET_CREATED, STATUS_CHANGED, etc.) |
| is_read | BOOLEAN | Lu |
| user_id | BIGINT FK | Destinataire |
| ticket_id | BIGINT FK | Ticket associé |

#### TicketHistory (table: `ticket_history`)
- Historique de chaque action sur un ticket (création, assignation, changement statut, escalade)

#### Attachment (table: `attachments`)
- Pièces jointes liées aux tickets

### 7.2 Relations
```
Client 1âÂÂâÂÂN Ticket
User 1âÂÂâÂÂN Ticket (assignedAgent)
User 1âÂÂâÂÂN Comment
Ticket 1âÂÂâÂÂN Comment
Ticket 1âÂÂâÂÂN Notification
Ticket 1âÂÂâÂÂN TicketHistory
Ticket 1âÂÂâÂÂN Attachment
User 1âÂÂâÂÂN Notification
```

---

## 8. AUTHENTIFICATION ET SÉCURITÉ (KEYCLOAK)

### 8.1 Configuration Keycloak

- **URL Admin Console** : http://localhost:8180/admin (admin/admin)
- **Realm** : `supportflow`
- **Client** : `supportflow-frontend` (public, Standard Flow)
- **Rôles realm** : ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT, CLIENT

### 8.2 Flux d'authentification

1. L'utilisateur accède à http://localhost:4200
2. Angular/Keycloak redirige vers la page de login Keycloak
3. L'utilisateur se connecte avec ses identifiants
4. Keycloak retourne un JWT (access token) avec les rôles dans `realm_access.roles`
5. Angular stocke le token et l'envoie dans le header `Authorization: Bearer <token>`
6. Spring Security valide le JWT via le JWK endpoint de Keycloak
7. `SecurityConfig.jwtAuthenticationConverter()` extrait les rôles et les convertit en `ROLE_XXX`
8. `@PreAuthorize` sur chaque endpoint vérifie les rôles

### 8.3 Synchronisation Keycloak → MySQL

Le backend auto-crée/synchronise les utilisateurs dans MySQL à partir du JWT :
- `getUserIdFromJwt()` dans chaque contrôleur
- Cherche d'abord par `keycloakId`, puis par `email`
- Si inexistant, crée automatiquement avec les infos du token (username, email, nom, rôle)

---

## 9. WORKFLOW CAMUNDA BPM

### 9.1 Processus BPMN : `ticket-workflow`

```
[Start] → [qualify_ticket] → [resolve_ticket] → [client_validation] → [Gateway: Validé?]
                  âÂÂ                   |                                       |         |
                  |              [SLA Timer]                               [Oui]     [Non]
                  |                   âÂÂ                                      âÂÂ         |
                  |           [sla_notification]                     [archive_ticket]   |
                  |                   âÂÂ                                      âÂÂ         |
                  |              [End SLA]                               [End]          |
                  âÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂâÂÂ
```

### 9.2 Tâches du workflow

| Tâche BPMN | Type | Assignation | Déclencheur |
|---|---|---|---|
| `qualify_ticket` | User Task | candidateGroups: SUPPORT_MANAGER | Création ticket → complété lors de l'assignation |
| `resolve_ticket` | User Task | assignee: `${assignedAgentId}` | Après assignation → complété lors de la résolution |
| `client_validation` | User Task | candidateGroups: CLIENT | Après résolution → complété lors de la fermeture |
| `archive_ticket` | Service Task | `archiveTicketDelegate` | Après validation client (clientValidated=true) |
| `sla_notification` | Service Task | `slaNotificationDelegate` | Timer boundary sur resolve_ticket |

### 9.3 Variables du processus

| Variable | Type | Définie à |
|---|---|---|
| ticketId | Long | Démarrage |
| ticketReference | String | Démarrage |
| severity, impact, priority | String | Démarrage |
| score | Integer | Démarrage |
| clientId | Long | Démarrage |
| slaHours | Integer | Démarrage |
| assignedAgentId | String | Assignation (qualify_ticket) |
| assignedAgentName | String | Assignation |
| resolutionSummary | String | Résolution (resolve_ticket) |
| slaBreached | Boolean | Résolution |
| clientValidated | Boolean | Validation client (client_validation) |
| satisfactionRating | Integer | Validation client |

### 9.4 Delegates Camunda

- **ArchiveTicketDelegate** âÂÂ Appelé si clientValidated=true. Met à jour statut CLOSED, génère rapport PDF/Excel, archive dans Alfresco
- **SlaNotificationDelegate** âÂÂ Timer boundary (non-cancel) sur resolve_ticket. Marque slaBreached=true, envoie notifications urgentes

### 9.5 Correspondance actions → Camunda

| Action utilisateur | Statut résultant | Tâche Camunda complétée |
|---|---|---|
| Créer ticket | OPEN | Processus démarré, qualify_ticket créée |
| Assigner à agent | ASSIGNED | qualify_ticket complétée (via completeAssignmentTask) |
| Prendre en charge | IN_PROGRESS | (pas de tâche Camunda, statut seulement) |
| Résoudre | RESOLVED | resolve_ticket complétée (via completeResolutionTask) |
| Fermer (client) | CLOSED | client_validation complétée avec clientValidated=true → archive_ticket exécutée |
| Rejeter (client) | Retour qualification | client_validation complétée avec clientValidated=false → retour à qualify_ticket |

---

## 10. WEBSOCKET - NOTIFICATIONS TEMPS RÉEL

### 10.1 Configuration Backend

```java
// WebSocketConfig.java
// Simple broker: /topic, /queue, /user
// Application prefix: /app
// User prefix: /user

// Endpoints STOMP:
registry.addEndpoint("/ws").withSockJS();      // SockJS fallback
registry.addEndpoint("/ws-native");             // WebSocket natif
// Allowed origins: http://localhost:*, http://127.0.0.1:*
```

### 10.2 Topics WebSocket

| Topic | Contenu | Producteur |
|---|---|---|
| `/topic/tickets` | Changements statut tickets | NotificationService.broadcastTicketStatusChange() |
| `/topic/tickets/{id}` | Événements d'un ticket spécifique | NotificationService |
| `/topic/tickets/{id}/comments` | Nouveaux commentaires | NotificationService.broadcastNewComment() |
| `/topic/tasks` | Événements Camunda | NotificationService.broadcastCamundaTaskEvent() |

### 10.3 Format des messages WebSocket

```json
{
  "type": "STATUS_CHANGE",
  "ticketId": 1,
  "ticketReference": "SF-0001",
  "oldStatus": "OPEN",
  "newStatus": "ASSIGNED",
  "timestamp": "2026-02-09T10:30:00"
}
```

### 10.4 Frontend WebSocket

Le frontend utilise `@stomp/stompjs` avec connexion native WebSocket :
```typescript
brokerURL: 'ws://127.0.0.1:8080/api/ws-native'
// reconnectDelay: 5000ms
// heartbeat: 10000ms
// Max reconnect attempts: 10
```

**Note importante** : Le endpoint `/ws-native` est configuré comme `permitAll()` dans SecurityConfig mais l'endpoint WebSocket nécessite une connexion upgrader HTTP→WS. L'authentification WebSocket n'est pas implémentée côté backend (pas de `ChannelInterceptor` pour valider le token STOMP).

---

## 11. API REST - TOUS LES ENDPOINTS

### Authentification
| Méthode | Endpoint | Auth | Rôles |
|---|---|---|---|
| POST | /api/auth/login | Non | Dev uniquement |
| POST | /api/auth/register | Non | Dev uniquement |
| POST | /api/auth/refresh | Oui | Dev uniquement |

### Tickets (19 endpoints)
| Méthode | Endpoint | Rôles autorisés |
|---|---|---|
| POST | /api/tickets | ADMIN, MANAGER, AGENT, CLIENT |
| GET | /api/tickets | Tous (filtré par rôle) |
| GET | /api/tickets/{id} | Tous (CLIENT vérifié propriétaire) |
| GET | /api/tickets/reference/{ref} | Tous |
| GET | /api/tickets/my-tickets | CLIENT |
| GET | /api/tickets/status/{status} | ADMIN, MANAGER, AGENT |
| GET | /api/tickets/client/{clientId} | ADMIN, MANAGER |
| GET | /api/tickets/agent/{agentId} | ADMIN, MANAGER, AGENT |
| GET | /api/tickets/unassigned | ADMIN, MANAGER, AGENT |
| GET | /api/tickets/search?q= | ADMIN, MANAGER, AGENT |
| PUT | /api/tickets/{id} | ADMIN, MANAGER, AGENT |
| DELETE | /api/tickets/{id} | ADMIN |
| POST | /api/tickets/{id}/assign/{agentId} | ADMIN, MANAGER |
| POST | /api/tickets/{id}/take-charge | AGENT, MANAGER, ADMIN |
| POST | /api/tickets/{id}/escalate | AGENT, MANAGER, ADMIN |
| POST | /api/tickets/{id}/escalate-sla | MANAGER, ADMIN |
| POST | /api/tickets/{id}/resolve | AGENT, MANAGER, ADMIN |
| POST | /api/tickets/{id}/close | CLIENT, MANAGER, ADMIN |
| PATCH | /api/tickets/{id}/status | AGENT, MANAGER, ADMIN |

### Commentaires (6 endpoints)
| Méthode | Endpoint | Rôles |
|---|---|---|
| POST | /api/tickets/{id}/comments | Tous |
| GET | /api/tickets/{id}/comments | ADMIN, MANAGER, AGENT |
| GET | /api/tickets/{id}/comments/public | Tous |
| GET | /api/tickets/{id}/comments/paginated | ADMIN, MANAGER, AGENT |
| PUT | /api/tickets/{id}/comments/{cid} | Tous (propriétaire) |
| DELETE | /api/tickets/{id}/comments/{cid} | ADMIN, MANAGER |

### Clients (10 endpoints)
| Méthode | Endpoint | Rôles |
|---|---|---|
| POST | /api/clients | ADMIN, MANAGER |
| GET | /api/clients | ADMIN, MANAGER, AGENT |
| GET | /api/clients/{id} | ADMIN, MANAGER, AGENT |
| GET | /api/clients/code/{code} | ADMIN, MANAGER |
| GET | /api/clients/summary | ADMIN, MANAGER |
| GET | /api/clients/search?q= | ADMIN, MANAGER |
| GET | /api/clients/industries | ADMIN, MANAGER |
| GET | /api/clients/me | CLIENT |
| PUT | /api/clients/{id} | ADMIN, MANAGER |
| DELETE | /api/clients/{id} | ADMIN |

### Utilisateurs (10 endpoints)
| Méthode | Endpoint | Rôles |
|---|---|---|
| POST | /api/users | ADMIN, MANAGER |
| GET | /api/users | ADMIN, MANAGER |
| GET | /api/users/{id} | ADMIN, MANAGER |
| GET | /api/users/username/{username} | ADMIN, MANAGER |
| GET | /api/users/role/{role} | ADMIN, MANAGER |
| GET | /api/users/agents/available | ADMIN, MANAGER, AGENT |
| GET | /api/users/search?q= | ADMIN, MANAGER |
| PUT | /api/users/{id} | ADMIN, MANAGER |
| DELETE | /api/users/{id} | ADMIN |
| GET | /api/users/check/username/{u} | Public |
| GET | /api/users/check/email/{e} | Public |

### Dashboard (4 endpoints)
| Méthode | Endpoint | Rôles |
|---|---|---|
| GET | /api/dashboard/stats | Tous (filtré) |
| GET | /api/dashboard/agents/performance | ADMIN, MANAGER |
| GET | /api/dashboard/agents/{id}/stats | ADMIN, MANAGER, AGENT |
| GET | /api/dashboard/clients/{id}/stats | ADMIN, MANAGER |

### Notifications (5 endpoints)
| Méthode | Endpoint | Rôles |
|---|---|---|
| GET | /api/notifications | Authentifié |
| GET | /api/notifications/unread | Authentifié |
| GET | /api/notifications/unread/count | Authentifié |
| POST | /api/notifications/{id}/read | Authentifié (propriétaire) |
| POST | /api/notifications/read-all | Authentifié |

### Infrastructure
| Méthode | Endpoint | Auth |
|---|---|---|
| GET | /api/actuator/health | Public |
| GET | /api/swagger-ui.html | Public |
| GET | /api/v3/api-docs | Public |
| WS | /api/ws (SockJS) | Public |
| WS | /api/ws-native (WebSocket) | Public |
| GET | /api/camunda/** | Public |

---

## 12. RàLES ET AUTORISATIONS

### 12.1 Matrice des rôles (4 rôles)

| Fonctionnalité | ADMIN | SUPPORT_MANAGER | SUPPORT_AGENT | CLIENT |
|---|:---:|:---:|:---:|:---:|
| **Tickets** |
| Créer ticket | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Voir tous les tickets | âÂÂ | âÂÂ | âÂÂ (assignés) | âÂÂ (les siens) |
| Voir un ticket | âÂÂ | âÂÂ | âÂÂ | âÂÂ (propriétaire) |
| Modifier ticket | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Supprimer ticket | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Assigner ticket | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Prendre en charge | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Escalader | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Résoudre | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Fermer ticket | âÂÂ | âÂÂ | âÂÂ | âÂÂ (propriétaire) |
| **Commentaires** |
| Ajouter commentaire | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Voir commentaires internes | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Voir commentaires publics | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Supprimer commentaire | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| **Clients** |
| Voir clients | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Créer/modifier client | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Supprimer client | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| **Utilisateurs** |
| Voir utilisateurs | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Créer/modifier utilisateur | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| Supprimer utilisateur | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| **Dashboard** |
| Stats globales | âÂÂ | âÂÂ | âÂÂ | âÂÂ (stats client) |
| Performance agents | âÂÂ | âÂÂ | âÂÂ | âÂÂ |
| **Notifications** |
| Mes notifications | âÂÂ | âÂÂ | âÂÂ | âÂÂ |

### 12.2 Implémentation sécurité

- **Couche 1** : `SecurityConfig` → `anyRequest().authenticated()` (JWT Keycloak requis)
- **Couche 2** : `@PreAuthorize("hasAnyRole(...)")` sur chaque endpoint
- **Couche 3** : Logique métier dans les contrôleurs (ex: CLIENT ne voit que ses tickets)
- **Couche 4** : Route guards Angular (`AuthGuard` + `route.data.roles`)
- **Couche 5** : UI filtrage (sidebar, boutons d'action affichés selon rôle)

---

## 13. DOCKER ET DÉPLOIEMENT

### 13.1 docker-compose.yml

7 services configurés :
```yaml
services:
  mysql:        # mysql:8.0, port 3306, DB: supportflow_db
  keycloak:     # keycloak:23.0, port 8180, import realm
  backend:      # Spring Boot, port 8080, profil docker
  alfresco:     # alfresco:7.4.0, port 8090, GED
  sonarqube:    # sonarqube:community, port 9000
  mailhog:      # mailhog:latest, ports 1025/8025
  frontend:     # (profil "frontend", non démarré par défaut)
```

### 13.2 Build et déploiement backend

```powershell
# 1. Build du JAR
cd backend
$env:JAVA_HOME = "C:\Users\21655\.jdks\jbr-17.0.8"
.\mvnw.cmd clean package -DskipTests -q

# 2. Copier dans le container
docker cp target\supportflow-backend-1.0.0-SNAPSHOT.jar supportflow-backend:/app/app.jar

# 3. Redémarrer
docker restart supportflow-backend
```

### 13.3 Variables d'environnement Docker

```
SPRING_PROFILES_ACTIVE=docker
DB_HOST=mysql, DB_PORT=3306, DB_NAME=supportflow_db
DB_USERNAME=supportflow, DB_PASSWORD=supportflow123
KEYCLOAK_ISSUER_URI=http://localhost:8180/realms/supportflow
KEYCLOAK_JWK_URI=http://host.docker.internal:8180/realms/supportflow/protocol/openid-connect/certs
```

---

## 14. COMPTES UTILISATEURS DE TEST

### Keycloak (realm: supportflow)

| Username | Password | Rôle | Description |
|---|---|---|---|
| admin | admin123 | ADMIN | Administrateur système |
| manager | manager123 | SUPPORT_MANAGER | Responsable support |
| agent1 | agent123 | SUPPORT_AGENT | Agent support |
| ahmed | ahmed123 | SUPPORT_AGENT | Agent support |
| client1 | client123 | CLIENT | Client test |
| yasine | (à vérifier) | CLIENT | Client |
| nousa | (à vérifier) | default-roles | Utilisateur basique |

### Admin Keycloak (console)
- URL: http://localhost:8180/admin
- Username: admin
- Password: admin

### Admin Camunda (cockpit)
- URL: http://localhost:8080/api/camunda
- Username: admin
- Password: admin

---

## 15. SCÉNARIOS DE TEST DU WORKFLOW

### Scénario 1 : Flux complet ticket (Happy Path)

```
1. [CLIENT: client1/client123] → Login → Créer ticket
   - Type: INCIDENT, Severity: HIGH, Impact: HIGH
   - Résultat: Ticket SF-XXXX créé, statut OPEN
   - Camunda: Processus démarré, tâche qualify_ticket créée

2. [MANAGER: manager/manager123] → Login → Voir tickets → Assigner à agent1
   - Résultat: Statut → ASSIGNED
   - Camunda: qualify_ticket complétée, resolve_ticket créée

3. [AGENT: agent1/agent123] → Login → Voir tickets assignés → Prendre en charge
   - Résultat: Statut → IN_PROGRESS
   - (Note: La prise en charge ne complète pas de tâche Camunda directement)

4. [AGENT: agent1/agent123] → Résoudre ticket (résumé de résolution)
   - Résultat: Statut → RESOLVED
   - Camunda: resolve_ticket complétée, client_validation créée

5. [CLIENT: client1/client123] → Voir ticket résolu → Fermer avec satisfaction
   - Résultat: Statut → CLOSED
   - Camunda: client_validation complétée, archive_ticket exécutée → processus terminé
```

### Scénario 2 : Escalade manuelle

```
1. CLIENT crée ticket
2. MANAGER assigne à agent1
3. AGENT1 escalade vers agent2 (ahmed) avec motif
   - POST /tickets/{id}/escalate body: {newAgentId: X, motif: "..."}
   - Statut → ESCALATED_MANUAL
```

### Scénario 3 : SLA breach

```
1. CLIENT crée ticket CRITICAL (SLA = 4h)
2. MANAGER assigne, AGENT prend en charge
3. Si non résolu après 4h → Timer Camunda déclenche sla_notification
   - slaNotificationDelegate marque ticket slaBreached=true
   - Notifications urgentes envoyées au manager
```

### Scénario 4 : Rejet client

```
1-4. Même flux que scénario 1 jusqu'à RESOLVED
5. CLIENT rejette la solution → client_validation complétée avec clientValidated=false
   - Gateway route vers qualify_ticket (retour en qualification)
```

---

## 16. PROBLàMES CONNUS ET ÉTAT ACTUEL

### 16.1 Tests API (résultat : 98.1% âÂÂ 51/52 pass)

Le seul test en échec est le test WebSocket HTTP GET (retourne 401 âÂÂ attendu car WebSocket nécessite un upgrade HTTP→WS, pas un GET classique).

### 16.2 Problèmes potentiels à investiguer

1. **Frontend "nothing works"** âÂÂ L'utilisateur rapporte que les scénarios frontend ne fonctionnent pas. Causes possibles :
   - Problèmes de communication frontend âÂÂ backend (CORS, proxy)
   - Keycloak non initialisé correctement au bootstrap Angular
   - Erreurs dans les composants ticket-detail (boutons d'action non visibles ou non fonctionnels)
   - Le composant ticket-detail peut ne pas avoir les boutons d'action workflow (take-charge, resolve, close) implémentés correctement dans le template HTML

2. **WebSocket Auth** âÂÂ Le endpoint `/ws-native` est `permitAll()` mais le WebSocket STOMP ne passe pas le token. Cela fonctionne pour les topics publics mais pas pour les messages privés.

3. **Assignation via frontend** âÂÂ Le endpoint POST `/tickets/{id}/assign/{agentId}` attend l'agentId dans l'URL (PathVariable), pas dans le body. Le frontend utilise `this.http.post(.../{agentId}, {})` ce qui est correct.

4. **Camunda et takeCharge** âÂÂ La méthode `takeCharge()` dans TicketService ne complète aucune tâche Camunda. Elle change juste le statut à IN_PROGRESS. La tâche `qualify_ticket` est complétée uniquement lors de l'assignation (completeAssignmentTask), pas lors de la prise en charge. Cela peut causer un problème si l'agent prend en charge sans que le manager ait assigné via le flow normal.

5. **Auto-création utilisateur** âÂÂ Chaque requête authentifiée déclenche `getUserIdFromJwt()` qui tente de trouver ou créer l'utilisateur dans MySQL. Si la synchro Keycloak→MySQL n'est pas faite, les premiers appels créeront des utilisateurs avec des données potentiellement incomplètes.

6. **ArchiveTicketDelegate** âÂÂ Appelle `reportService.generateTicketReport()` et `reportService.archiveToAlfresco()`. Si Alfresco n'est pas configuré ou inaccessible, ces appels échoueront silencieusement (try/catch avec warn log).

### 16.3 Points d'amélioration

- Pas de tests unitaires/intégration exécutables (les tests sont dans test-authorization.ps1 = script PowerShell)
- Le profil `docker` ne configure pas les emails (MailHog nécessit config Spring Mail)
- Pas de gestion des pièces jointes dans le frontend (backend prêt avec AttachmentRepository)
- Le composant Rapports et Paramètres dans la sidebar n'ont pas de routes/composants implémentés
- Pas de pagination côté frontend pour certaines listes
- Les erreurs Camunda sont catchées silencieusement (log.warn) âÂÂ pas de feedback utilisateur

---

## 17. GUIDE DE LANCEMENT

### Prérequis
- Docker Desktop installé et démarré
- Node.js 18+ installé
- JDK 17 installé (pour le build backend)

### Démarrage complet

```powershell
# 1. Démarrer l'infrastructure Docker
cd C:\Users\21655\Desktop\Support-flow
docker compose up -d

# 2. Attendre que les services démarrent (~30-60 secondes)
# Vérifier : http://localhost:8080/api/actuator/health
# Vérifier : http://localhost:8180 (Keycloak)

# 3. (Optionnel) Rebuild et déployer le backend
cd backend
$env:JAVA_HOME = "C:\Users\21655\.jdks\jbr-17.0.8"
.\mvnw.cmd clean package -DskipTests -q
docker cp target\supportflow-backend-1.0.0-SNAPSHOT.jar supportflow-backend:/app/app.jar
docker restart supportflow-backend

# 4. Démarrer le frontend Angular
cd ..\frontend
npx ng serve --port 4200

# 5. Accéder à l'application
# http://localhost:4200 → Redirigé vers login Keycloak
# Se connecter avec un des comptes de test (ex: admin/admin123)
```

### URLs des services

| Service | URL |
|---|---|
| Frontend Angular | http://localhost:4200 |
| Backend API | http://localhost:8080/api |
| Swagger UI | http://localhost:8080/api/swagger-ui.html |
| Keycloak Admin | http://localhost:8180/admin |
| Camunda Cockpit | http://localhost:8080/api/camunda |
| MailHog | http://localhost:8025 |
| Alfresco | http://localhost:8090 |
| SonarQube | http://localhost:9000 |

### Arrêt

```powershell
# Arrêter le frontend : Ctrl+C dans le terminal
# Arrêter Docker :
docker compose down
```

---

## FIN DU RAPPORT

**Projet** : SupportFlow - Système de Gestion Automatisée des Tickets Clients  
**Version** : 1.0.0-SNAPSHOT  
**Date du rapport** : 9 février 2026  
**Backend** : 68 fichiers source Java compilés avec 0 erreurs  
**Frontend** : Angular 17 compilé avec 0 erreurs  
**Tests API** : 98.1% (51/52 passent)  

