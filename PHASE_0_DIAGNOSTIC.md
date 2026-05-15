# Phase 0 — Diagnostic & Déblocage (Jour 1)

État initial: Frontend ✅ modernisé / Backend 🔴 bloqué sur JAVA_HOME

## D1 — Diagnostic Keycloak

**Objectif:** Valider que Keycloak est accessible et correctement configuré.

### Checklist Configuration

- [ ] **Realm Keycloak existe:** `supportflow` realm doit exister dans `/keycloak/supportflow-realm.json`
- [ ] **Client déclaré:** Le client `supportflow-frontend` doit être en répertoire clients
- [ ] **CORS autorisé:** `redirectUris` et `webOrigins` contiennent `http://localhost:4200` ou domaine déploiement
- [ ] **Client Secret disponible:** Noté dans le fichier ou admin console
- [ ] **Rôles déclarés:** 4 rôles présents (CLIENT, SUPPORT_AGENT, SUPPORT_MANAGER, ADMIN)
- [ ] **Users de test créés:** Au moins 1 user par rôle
- [ ] **Token Endpoint accessible:** `http://localhost:8080/realms/supportflow/protocol/openid-connect/token` répond

### Checklist Execution

```bash
# Test 1: Keycloak startup
curl -s http://localhost:8080/realms/supportflow > /dev/null && echo "✅ Keycloak accessible" || echo "❌ Keycloak indisponible"

# Test 2: Realm JSON valide (après import)
cat keycloak/supportflow-realm.json | jq . > /dev/null && echo "✅ JSON valide" || echo "❌ JSON invalide"

# Test 3: Clients définis
cat keycloak/supportflow-realm.json | jq '.clients | length' 

# Test 4: Rôles définis
cat keycloak/supportflow-realm.json | jq '.roles.realm[] | .name'
```

**Problèmes courants & solutions:**

| Problème | Cause | Solution |
|----------|-------|----------|
| 404 realm | Port 8080 ou realm name wrong | Vérifier `docker ps` et `keycloak/supportflow-realm.json` |
| CORS 403 | webOrigins incomplet | Ajouter `http://localhost:4200` + redéployer container |
| Token 401 | Client secret mauvais | Récupérer depuis admin console ou realm JSON |
| User pas trouvé | User non créé | Importer realm JSON via admin console |

---

## D2 — Diagnostic Camunda

**Objectif:** Valider que Camunda est accessible et le processus est déployé.

### Checklist Configuration

- [ ] **Camunda Cockpit accessible:** `http://localhost:8080/camunda/app/cockpit` (ou autre port)
- [ ] **H2 Database (ou PostgreSQL) active:** Base de données Camunda contient tables `ACT_*`
- [ ] **BPMN process déployé:** Fichier `backend/src/main/resources/bpmn/ticket-workflow.bpmn` existe
- [ ] **Spring Boot backend démarre:** `mvn spring-boot:run` ou `.jar` exécutable existe
- [ ] **Endpoints Camunda accessibles:** `http://localhost:8081/api/camunda/...` (vérifier port)

### Checklist Execution

```bash
# Test 1: Camunda Cockpit accessible
curl -s http://localhost:8080/camunda/app/cockpit | grep -q "Cockpit" && echo "✅ Cockpit accessible" || echo "❌ Cockpit indisponible"

# Test 2: Backend Spring Boot responsive
curl -s http://localhost:8081/actuator/health | jq .

# Test 3: Process deployed?
curl -s http://localhost:8081/api/camunda/processes | jq '.[] | .key'

# Test 4: BPMN fichier valide
cat backend/src/main/resources/bpmn/ticket-workflow.bpmn | grep -q "bpmn:process" && echo "✅ BPMN valide" || echo "❌ BPMN invalide"
```

**Problèmes courants & solutions:**

| Problème | Cause | Solution |
|----------|-------|----------|
| Cockpit 404 | Maven build KO ou déploiement incomplet | Compiler backend: `mvn clean package` |
| H2 DB locked | Instance précédente pas fermée | Killer process Java, nettoyer `target/` |
| BPMN non trouvé | Chemin resource incorrect | Vérifier `application.yml` et `pom.xml` |
| Endpoint 404 | Backend port différent | Checker `application.yml` `server.port` |

---

## D3 — Test curl Keycloak End-to-End

**Objectif:** Obtenir un JWT token valide et l'utiliser pour appeler une API.

### Étapes

1. **Obtenir token existant (ou générer nouveau user):**
   ```bash
   # User: client@supportflow avec password: password
   curl -X POST http://localhost:8080/realms/supportflow/protocol/openid-connect/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=password" \
     -d "client_id=supportflow-frontend" \
     -d "client_secret=YOUR_SECRET_HERE" \
     -d "username=client@supportflow" \
     -d "password=password" \
     -d "scope=openid profile email"
   ```

2. **Extraire token:**
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8080/realms/supportflow/protocol/openid-connect/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=password" \
     -d "client_id=supportflow-frontend" \
     -d "client_secret=YOUR_SECRET" \
     -d "username=client@supportflow" \
     -d "password=password" | jq -r '.access_token')
   
   echo "Token: $TOKEN"
   ```

3. **Appeler endpoint backend avec token:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8081/api/tickets
   ```

**Résultats attendus:**
- ✅ HTTP 200 + liste tickets (si utilisateur autorisé)
- ❌ HTTP 401 (token expiré ou invalide)
- ❌ HTTP 403 (token valide, but unauthorized pour cette API)

---

## D4 — Test Smoke Camunda

**Objectif:** Créer une instance de processus Camunda et vérifier sa visibilité dans le Cockpit.

### Étapes

1. **Vérifier processus liste:**
   ```bash
   curl -s http://localhost:8081/api/camunda/processes | jq '.[].key'
   # Attendu: "ticket-workflow" ou similar
   ```

2. **Démarrer instance:**
   ```bash
   curl -X POST http://localhost:8081/api/camunda/start \
     -H "Content-Type: application/json" \
     -d '{
       "ticketId": "TKT-TEST-999",
       "priority": "MEDIUM",
       "slaDeadline": "2026-04-01T20:00:00Z"
     }' | jq .
   ```

3. **Vérifier dans Cockpit:**
   - Ouvrir `http://localhost:8080/camunda/app/cockpit/default/#/process-instance`
   - Chercher instance avec `businessKey = TKT-TEST-999`
   - Vérifier variables: `ticketId`, `priority`, `slaDeadline`

**Résultats attendus:**
- ✅ Instance créée avec variables correctes
- ✅ Activité courante = première tâche du processus
- ✅ Timer SLA visible en tant que boundary event

---

## Prochaines étapes après diagnostic

- ✅ D1-D4 Ok → Passer à Phase 1 (C1-C4 Camunda Process Engine)
- ❌ D1-D2 Ko → Fixer infrastructure (JAVA_HOME, keycloak/camunda containers)
- ⚠ D3-D4 Partiel → Implémenter configuration Spring Security et endpoints manquants

---

**État actuel (31 mars 2026):**
- Frontend ✅ (UI Celestial OS, routing OK, build success)
- Backend 🔴 (JAVA_HOME not configured, compilation blocked)
- Keycloak ⏳ (Config file exists, needs validation)
- Camunda ⏳ (BPMN file exists, needs Java to compile)
- Alfresco ⏳ (Not yet evaluated)
