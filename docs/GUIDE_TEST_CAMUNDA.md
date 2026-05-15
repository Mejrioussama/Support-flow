# Ã°ÂÂ§Âª Guide de Test Camunda BPM - SupportFlow

## Ã°ÂÂÂ¯ Objectif
Vérifier que le workflow Camunda fonctionne correctement avec le système SupportFlow.

---

## Ã°ÂÂÂ Prérequis

1. **Services démarrés** :
```bash
docker-compose up -d mysql keycloak backend
```

2. **Backend accessible** :
   - Docker: `http://localhost:8082`
   - Local : `http://localhost:8081`
3. **Camunda Cockpit** :
   - Docker: `http://localhost:8082/api/camunda/app/cockpit/default/`
   - Local : `http://localhost:8081/api/camunda/app/cockpit/default/`

---

## Ã°ÂÂÂ Accès Camunda Cockpit

### Credentials par défaut
- **URL** :
  - Docker: `http://localhost:8082/api/camunda/app/cockpit/default/`
  - Local : `http://localhost:8081/api/camunda/app/cockpit/default/`
- **Username** : `admin`
- **Password** : `admin`

> âÂÂ ïÂ¸Â Ces credentials sont configurés dans [`application.yml`](../backend/src/main/resources/application.yml)

---

## âÂÂ Test 1 : Vérifier le déploiement du workflow

### Étape 1 : Accéder au Cockpit
1. Ouvrir `http://localhost:8080/api/camunda/app/cockpit/default/`
2. Se connecter avec `admin` / `admin`

### Étape 2 : Vérifier les définitions de processus
1. Cliquer sur **"Processes"** dans le menu
2. Chercher **"ticket-workflow"** ou **"SupportFlow - Gestion des Tickets"**
3. Vérifier que le processus est déployé

**âÂÂ Résultat attendu :**
```
Process Definition: ticket-workflow
Name: SupportFlow - Gestion des Tickets
Version: 1 (ou plus si redéployé)
Instances: 0 (si aucun ticket créé)
```

---

## âÂÂ Test 2 : Créer un ticket et vérifier l'instance Camunda

### Étape 1 : Créer un ticket via API

```bash
# 1. Obtenir un token JWT
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@supportflow.com",
    "password": "admin123"
  }'

# Copier le token reçu

# 2. Créer un ticket
curl -X POST http://localhost:8080/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -d '{
    "title": "Test Camunda - Erreur API",
    "description": "Test du workflow Camunda",
    "type": "INCIDENT",
    "severity": "HIGH",
    "impact": "HIGH",
    "clientId": 1
  }'
```

**âÂÂ Réponse attendue :**
```json
{
  "id": 1,
  "reference": "SF-0001",
  "status": "OPEN",
  "processInstanceId": "abc123-def456-...",
  "priority": "HIGH",
  "score": 10
}
```

### Étape 2 : Vérifier dans Camunda Cockpit

1. Retourner sur `http://localhost:8080/api/camunda/app/cockpit/default/`
2. Cliquer sur **"Processes"** → **"ticket-workflow"**
3. Vérifier que **"Running Instances"** = 1

**âÂÂ Résultat attendu :**
- 1 instance en cours
- Process Instance ID correspond à celui du ticket

---

## âÂÂ Test 3 : Vérifier les tâches utilisateur (User Tasks)

### Étape 1 : Accéder à Tasklist
1. Ouvrir `http://localhost:8080/api/camunda/app/tasklist/default/`
2. Se connecter avec `admin` / `admin`

### Étape 2 : Vérifier la tâche "Qualifier le ticket"
1. Dans **"All Tasks"**, chercher la tâche liée au ticket créé
2. Vérifier :
   - **Task Name** : "Qualifier le ticket"
   - **Assignee** : Groupe `SUPPORT_MANAGER`
   - **Variables** : `ticketId`, `ticketReference`, `severity`, etc.

**âÂÂ Résultat attendu :**
```
Task: Qualifier le ticket
Process: ticket-workflow
Variables:
  - ticketId: 1
  - ticketReference: SF-0001
  - severity: HIGH
  - impact: HIGH
  - slaHours: 8
```

---

## âÂÂ Test 4 : Assigner le ticket et vérifier la progression

### Étape 1 : Assigner via API

```bash
curl -X POST http://localhost:8080/api/tickets/1/assign/2 \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### Étape 2 : Vérifier dans Camunda Cockpit
1. Retourner sur **Cockpit** → **Processes** → **ticket-workflow**
2. Cliquer sur l'instance en cours
3. Vérifier que la tâche **"qualify_ticket"** est complétée
4. Vérifier que la tâche **"resolve_ticket"** est active

**âÂÂ Résultat attendu :**
```
Completed Activities:
  âÂÂ start_ticket
  âÂÂ qualify_ticket

Active Activities:
  Ã°ÂÂÂµ resolve_ticket (assigné à l'agent)
```

---

## âÂÂ Test 5 : Tester l'escalade SLA automatique

### Étape 1 : Créer un ticket avec SLA court

```bash
curl -X POST http://localhost:8080/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -d '{
    "title": "Test SLA - Urgence",
    "description": "Test escalade automatique",
    "type": "INCIDENT",
    "severity": "CRITICAL",
    "impact": "CRITICAL",
    "clientId": 1
  }'
```

> âÂÂ ïÂ¸Â **CRITICAL** = SLA de 4 heures (configurable dans `application.yml`)

### Étape 2 : Vérifier le timer SLA dans Cockpit
1. Aller sur **Cockpit** → **Processes** → Instance du ticket
2. Cliquer sur **"Runtime"** → **"Incidents"** (si SLA dépassé)
3. Vérifier le **Boundary Timer Event** `sla_timer`

**âÂÂ Résultat attendu :**
```
Boundary Event: sla_timer
Type: Timer
Attached to: resolve_ticket
Duration: PT6H (75% du SLA de 8h)
Status: Active
```

### Étape 3 : Forcer le déclenchement (pour test rapide)

**Option A : Modifier le BPMN temporairement**
```xml
<!-- Changer PT${slaEscalationHours}H en PT1M pour 1 minute -->
<bpmn:timeDuration>PT1M</bpmn:timeDuration>
```

**Option B : Appeler l'endpoint manuellement**
```bash
curl -X POST http://localhost:8080/api/tickets/2/escalate-sla \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### Étape 4 : Vérifier l'escalade
```bash
curl -X GET http://localhost:8080/api/tickets/2 \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

**âÂÂ Réponse attendue :**
```json
{
  "id": 2,
  "reference": "SF-0002",
  "status": "ESCALATED_SLA",
  "priority": "CRITICAL",
  "slaWarningSent": true
}
```

---

## âÂÂ Test 6 : Compléter le workflow jusqu'à la fin

### Étape 1 : Résoudre le ticket
```bash
curl -X POST http://localhost:8080/api/tickets/1/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -d '{
    "resolutionSummary": "Problème résolu après redémarrage du service"
  }'
```

### Étape 2 : Valider par le client
```bash
curl -X POST http://localhost:8080/api/tickets/1/close \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -d '{
    "satisfactionRating": 5,
    "satisfactionComment": "Excellent service"
  }'
```

### Étape 3 : Vérifier dans Cockpit
1. Aller sur **Cockpit** → **Processes** → **ticket-workflow**
2. Vérifier que **"Running Instances"** = 0
3. Cliquer sur **"History"** → Chercher l'instance complétée

**âÂÂ Résultat attendu :**
```
Process Instance: COMPLETED
Activities:
  âÂÂ start_ticket
  âÂÂ qualify_ticket
  âÂÂ resolve_ticket
  âÂÂ client_validation
  âÂÂ validation_gateway
  âÂÂ archive_ticket
  âÂÂ end_ticket
```

---

## âÂÂ Test 7 : Vérifier les variables Camunda

### Dans Cockpit → Instance → Variables
```
ticketId: 1
ticketReference: "SF-0001"
severity: "HIGH"
impact: "HIGH"
priority: "HIGH"
score: 10
slaHours: 8
slaEscalationHours: 6
assignedAgentId: "2"
resolutionSummary: "Problème résolu..."
clientValidated: true
satisfactionRating: 5
```

---

## Ã°ÂÂÂ Dépannage

### Problème 1 : Camunda Cockpit inaccessible

**Vérifier que le backend est démarré :**
```bash
docker-compose logs backend | grep "Camunda"
```

**âÂÂ Log attendu :**
```
Camunda BPM Platform initialized
Process Engine default created
```

### Problème 2 : Workflow non déployé

**Vérifier le fichier BPMN :**
```bash
ls -la backend/src/main/resources/bpmn/ticket-workflow.bpmn
```

**Redéployer :**
```bash
docker-compose restart backend
```

### Problème 3 : Tâches non créées

**Vérifier les logs :**
```bash
docker-compose logs backend | grep "Process Instance"
```

**Vérifier que `CamundaService` est actif :**
```bash
curl http://localhost:8080/actuator/health
```

---

## Ã°ÂÂÂ Checklist de validation

| Test | Description | Status |
|------|-------------|--------|
| âÂÂ | Camunda Cockpit accessible | âÂ¬Â |
| âÂÂ | Workflow `ticket-workflow` déployé | âÂ¬Â |
| âÂÂ | Instance créée à la création du ticket | âÂ¬Â |
| âÂÂ | Tâche `qualify_ticket` visible dans Tasklist | âÂ¬Â |
| âÂÂ | Tâche complétée après assignation | âÂ¬Â |
| âÂÂ | Tâche `resolve_ticket` active | âÂ¬Â |
| âÂÂ | Timer SLA configuré | âÂ¬Â |
| âÂÂ | Escalade SLA fonctionne | âÂ¬Â |
| âÂÂ | Workflow complet jusqu'à `end_ticket` | âÂ¬Â |
| âÂÂ | Variables Camunda correctes | âÂ¬Â |

---

## Ã°ÂÂÂ Démonstration pour le jury

### Scénario complet (5 minutes)

1. **Montrer Camunda Cockpit vide** (0 instances)
2. **Créer un ticket via Postman** → Montrer `processInstanceId` dans la réponse
3. **Rafraîchir Cockpit** → 1 instance en cours
4. **Ouvrir Tasklist** → Montrer la tâche "Qualifier le ticket"
5. **Assigner le ticket via API** → Montrer la progression dans Cockpit
6. **Résoudre + Clôturer** → Montrer l'instance complétée dans History
7. **Montrer les variables** → Prouver la traçabilité complète

**Phrase clé :**
> "Chaque ticket déclenche automatiquement une instance Camunda qui orchestre le workflow de bout en bout, avec surveillance SLA en temps réel via boundary timer events."

---

## Ã°ÂÂÂ Ressources

- **Camunda Docs** : https://docs.camunda.org/manual/7.20/
- **BPMN 2.0** : https://www.omg.org/spec/BPMN/2.0/
- **Votre workflow** : [`backend/src/main/resources/bpmn/ticket-workflow.bpmn`](../backend/src/main/resources/bpmn/ticket-workflow.bpmn)

