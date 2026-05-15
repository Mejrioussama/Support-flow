# SupportFlow âÂÂ Rapport Fonctionnel Complet

## 1. Vue d'ensemble

SupportFlow est une application de gestion de tickets de support IT avec workflow BPM, notifications temps réel et gestion SLA automatisée.

| Couche | Technologie |
|--------|-------------|
| Frontend | Angular 17 + Angular Material |
| Backend | Spring Boot 3.2 + Java 17 |
| BPM | Camunda 7.20 |
| Authentification | Keycloak 23.0 (OAuth2/JWT) |
| Base de données | MySQL 8.0 |
| Temps réel | WebSocket STOMP |
| GED | Alfresco 7.4 (CMIS) |
| Rapports | Apache POI (Excel) + iText (PDF) |
| Qualité | SonarQube |
| Email (dev) | MailHog |

## 2. Rôles et Permissions

| Rôle | Accès |
|------|-------|
| **CLIENT** | Créer tickets, voir ses propres tickets, commenter (public), valider/fermer avec satisfaction |
| **SUPPORT_AGENT** | Voir tickets assignés, prendre en charge, résoudre, escalader, commenter (interne+public), voir clients |
| **SUPPORT_MANAGER** | Tout voir, assigner, qualifier, gérer agents/clients, dashboard performance, supprimer commentaires |
| **ADMIN** | Accès total : CRUD utilisateurs, clients, tickets, suppression, configuration |

## 3. Modules Fonctionnels

### 3.1 Gestion des Tickets (19 endpoints)

| Action | Méthode | Endpoint | Rôles autorisés |
|--------|---------|----------|-----------------|
| Créer un ticket | POST | `/tickets` | Tous |
| Voir un ticket | GET | `/tickets/{id}` | Tous (CLIENT = ses tickets) |
| Lister tickets | GET | `/tickets` | CLIENT=propres, AGENT=assignés, MANAGER/ADMIN=tous |
| Mes tickets | GET | `/tickets/my-tickets` | CLIENT |
| Par statut | GET | `/tickets/status/{s}` | AGENT, MANAGER, ADMIN |
| Par client | GET | `/tickets/client/{id}` | MANAGER, ADMIN |
| Par agent | GET | `/tickets/agent/{id}` | AGENT, MANAGER, ADMIN |
| Non assignés | GET | `/tickets/unassigned` | AGENT, MANAGER, ADMIN |
| Recherche | GET | `/tickets/search?q=` | AGENT, MANAGER, ADMIN |
| Modifier | PUT | `/tickets/{id}` | AGENT, MANAGER, ADMIN |
| Assigner | POST | `/tickets/{id}/assign/{agentId}` | MANAGER, ADMIN |
| Prendre en charge | POST | `/tickets/{id}/take-charge` | AGENT, MANAGER, ADMIN |
| Escalader manuellement | POST | `/tickets/{id}/escalate` | AGENT, MANAGER, ADMIN |
| Escalade SLA | POST | `/tickets/{id}/escalate-sla` | MANAGER, ADMIN |
| Résoudre | POST | `/tickets/{id}/resolve` | AGENT, MANAGER, ADMIN |
| Fermer/Valider | POST | `/tickets/{id}/close` | CLIENT, MANAGER, ADMIN |
| Changer statut | PATCH | `/tickets/{id}/status` | AGENT, MANAGER, ADMIN |
| Supprimer | DELETE | `/tickets/{id}` | ADMIN |

### 3.2 Commentaires (6 endpoints)

| Action | Rôles |
|--------|-------|
| Ajouter commentaire | Tous |
| Voir tous (+ notes internes) | Staff uniquement |
| Voir publics uniquement | Tous |
| Modifier | Auteur du commentaire |
| Supprimer | MANAGER, ADMIN |

### 3.3 Gestion des Clients (10 endpoints)

| Action | Rôles |
|--------|-------|
| Créer client | MANAGER, ADMIN |
| Voir client par ID | AGENT, MANAGER, ADMIN |
| Lister tous les clients | AGENT, MANAGER, ADMIN |
| Résumé clients | MANAGER, ADMIN |
| Rechercher | MANAGER, ADMIN |
| Mon profil client | CLIENT |
| Modifier | MANAGER, ADMIN |
| Supprimer | ADMIN |

### 3.4 Gestion des Utilisateurs (11 endpoints)

| Action | Rôles |
|--------|-------|
| Créer utilisateur | MANAGER, ADMIN |
| Voir par ID/username | MANAGER, ADMIN |
| Lister utilisateurs | MANAGER, ADMIN |
| Agents disponibles | AGENT, MANAGER, ADMIN |
| Rechercher | MANAGER, ADMIN |
| Modifier | MANAGER, ADMIN |
| Supprimer | ADMIN |

### 3.5 Dashboard (4 endpoints)

| KPI | Description |
|-----|-------------|
| Tickets totaux, ouverts, en cours, résolus, fermés | Comptages par statut |
| Taux de conformité SLA | (terminés - SLA dépassé) / terminés à 100 |
| Temps moyen de résolution | Moyenne en minutes |
| Satisfaction moyenne | Note moyenne 1-5 |
| Tendance 30 jours | Tickets créés par jour |
| Distribution par statut/priorité/type | Répartition graphique |
| Performance agents | Classement par résolution/satisfaction |

### 3.6 Notifications (5 endpoints + WebSocket)

| Type | Déclencheur |
|------|-------------|
| TICKET_CREATED | Nouveau ticket → Managers/Admins |
| TICKET_ASSIGNED | Assignation → Agent + Créateur |
| STATUS_CHANGED | Changement statut → Créateur + Agent |
| TICKET_RESOLVED | Résolution → Créateur |
| TICKET_ESCALATED | Escalade → Nouvel agent + Client |
| SLA_WARNING | 75% du SLA → Agent + Managers |
| SLA_BREACHED | SLA expiré → Agent + Managers + Admins |
| NEW_COMMENT | Nouveau commentaire → Créateur + Agent |

## 4. Scoring et SLA

**Formule de score :**

```
Score = (Sévérité à 3) + (Impact à 2) + Facteur SLA
```

**Priorité auto-calculée :** Score âÂÂ¥ 10 → CRITICAL, âÂÂ¥ 7 → HIGH, âÂÂ¥ 4 → MEDIUM, < 4 → LOW

| Sévérité | Délai SLA |
|----------|-----------|
| CRITICAL | 4 heures |
| HIGH | 8 heures |
| MEDIUM | 24 heures |
| LOW | 72 heures |

## 5. Workflow Camunda BPMN

| Étape | Tâche | Acteur | Action |
|-------|-------|--------|--------|
| 1 | Start Event | Système | Création du ticket |
| 2 | qualify_ticket | MANAGER | Qualifier et assigner un agent |
| 3 | resolve_ticket | AGENT assigné | Investiguer et résoudre |
| 4 | sla_timer (boundary) | Système | Timer non-interruptif après X heures SLA |
| 5 | sla_notification | Système | Notification SLA dépassé + escalade auto |
| 6 | client_validation | CLIENT | Valider la résolution (satisfaction 1-5) |
| 7 | Gateway | Système | Si validé → archiver. Si rejeté → retour qualification |
| 8 | archive_ticket | Système | Rapport Excel + archivage Alfresco |
| 9 | End Event | âÂÂ | Ticket clôturé |

## 6. Temps Réel (WebSocket)

| Topic | Événements |
|-------|------------|
| `/topic/tickets` | Changements de statut, nouveaux commentaires (global) |
| `/topic/tickets/{id}` | Événements spécifiques à un ticket |
| `/topic/tasks` | Tâches Camunda (créées/complétées/assignées) |
| `/user/{userId}/notifications` | Notifications personnelles |

## 7. Pages Frontend

| Page | Fonctionnalités |
|------|-----------------|
| **Dashboard** | KPIs, graphiques de tendance, distribution, performance agents |
| **Liste tickets** | Tableau paginé, filtres par statut/priorité, recherche, tri |
| **Détail ticket** | Infos complètes, historique, commentaires, actions workflow |
| **Formulaire ticket** | Création/édition avec auto-complétion client |
| **Liste clients** | Tableau paginé, recherche, filtre industrie |
| **Détail client** | Infos client, tickets associés, statistiques |
| **Liste utilisateurs** | Gestion agents/staff, filtre par rôle |
| **Profil** | Informations personnelles de l'utilisateur connecté |
| **Header** | Cloche notifications avec badge, menu utilisateur, déconnexion |

---

## 8. Alignement avec le code (référence projet)

Ce rapport reflète le cahier des charges SupportFlow. État d'alignement du dépôt actuel :

- **Tickets** : `TicketController` couvre les 19 actions (création, GET/POST/PUT/PATCH/DELETE, assign, take-charge, escalate, resolve, close, status, search, unassigned, by client/agent/status). Rôles et filtres CLIENT/AGENT/MANAGER/ADMIN respectés.
- **Scoring / SLA** : Formule Score = (Sévéritéà3)+(Impactà2)+Facteur SLA et priorité (âÂÂ¥10 CRITICAL, âÂÂ¥7 HIGH, âÂÂ¥4 MEDIUM) implémentées dans `Ticket.calculateScore()` et `Priority.fromScore()`. Délais SLA 4/8/24/72 h configurés dans `TicketService` et `application*.yml`.
- **Workflow BPMN** : `ticket-workflow.bpmn` contient start → qualify_ticket → resolve_ticket → client_validation → gateway → archive_ticket → end, avec boundary timer SLA et `sla_notification` (délégués `ArchiveTicketDelegate`, `SlaNotificationDelegate`).
- **Notifications** : `NotificationService` envoie TICKET_CREATED, TICKET_ASSIGNED, STATUS_CHANGED, TICKET_RESOLVED, TICKET_ESCALATED, SLA_WARNING, SLA_BREACHED, NEW_COMMENT (et SLA_ESCALATION). WebSocket configuré dans `WebSocketConfig`.
- **Dashboard** : `DashboardController` expose `/dashboard/stats`, `/dashboard/agents/performance`, `/dashboard/agents/{id}/stats`, `/dashboard/clients/{id}/stats` avec distinction CLIENT vs staff.
- **Frontend** : Modules dashboard, tickets (liste, détail, formulaire, escalate-dialog), clients (liste, détail, formulaire), users (liste, formulaire), profile, layout (header, sidebar), services (auth, ticket, client, dashboard, notification, websocket).

Pour toute évolution, se baser sur ce rapport et mettre à jour cette section si le code diverge.

