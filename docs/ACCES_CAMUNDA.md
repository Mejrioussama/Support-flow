# Ã°ÂÂÂ Accès Camunda BPM - SupportFlow

## âÂÂ ïÂ¸Â IMPORTANT : Context Path

Votre backend Spring Boot utilise le context path `/api`, donc **toutes les URLs Camunda doivent commencer par `/api/camunda`**.

---

## Ã°ÂÂÂ URLs d'accès

### 1. Camunda Cockpit (Monitoring)
```
Docker: http://localhost:8082/api/camunda/app/cockpit/default/
Local : http://localhost:8081/api/camunda/app/cockpit/default/
```
**Fonction** : Visualiser les instances de processus, les tâches actives, l'historique

### 2. Camunda Tasklist (Gestion des tâches)
```
Docker: http://localhost:8082/api/camunda/app/tasklist/default/
Local : http://localhost:8081/api/camunda/app/tasklist/default/
```
**Fonction** : Gérer les tâches utilisateur (User Tasks)

### 3. Camunda Admin (Administration)
```
Docker: http://localhost:8082/api/camunda/app/admin/default/
Local : http://localhost:8081/api/camunda/app/admin/default/
```
**Fonction** : Gérer les utilisateurs, groupes, autorisations

---

## Ã°ÂÂÂ Credentials

### Compte Admin Camunda
- **Username** : `admin`
- **Password** : `admin`

> âÂÂ ïÂ¸Â Ces credentials sont configurés dans [`application.yml`](../backend/src/main/resources/application.yml:84-88)

```yaml
camunda:
  bpm:
    admin-user:
      id: admin
      password: admin
      firstName: Admin
      lastName: SupportFlow
```

---

## âÂÂ Test rapide

### 1. Vérifier que Camunda est démarré

```bash
# Vérifier les logs du backend
docker-compose logs backend | grep -i camunda
```

**âÂÂ Log attendu :**
```
Camunda BPM Platform initialized
Process Engine default created
```

### 2. Accéder au Cockpit

1. Ouvrir :
   - Docker: `http://localhost:8082/api/camunda/app/cockpit/default/`
   - Local : `http://localhost:8081/api/camunda/app/cockpit/default/`
2. Login : `admin` / `admin`
3. Vérifier que vous voyez le dashboard Camunda

**âÂÂ Résultat attendu :**
- Dashboard avec "Processes", "Decisions", "Deployments"
- Aucune erreur 404

---

## Ã°ÂÂÂ Dépannage

### Problème 1 : Erreur 404 sur `/camunda`

**Cause** : Vous utilisez l'URL sans le context path `/api`

**Solution** : Utiliser `http://localhost:8080/api/camunda/...`

### Problème 2 : Redirection vers Jenkins

**Cause** : Vous avez Jenkins qui tourne sur le port 8080

**Solutions** :
1. **Arrêter Jenkins temporairement**
2. **Changer le port du backend** :
   ```yaml
   # application.yml
   server:
     port: 8081  # Au lieu de 8080
   ```
   Puis accéder à : `http://localhost:8081/api/camunda/...`

### Problème 3 : Login refusé

**Vérifier les credentials dans application.yml :**
```bash
grep -A 5 "admin-user" backend/src/main/resources/application.yml
```

**Réinitialiser le mot de passe :**
```yaml
camunda:
  bpm:
    admin-user:
      id: admin
      password: nouveaumotdepasse
```

---

## Ã°ÂÂÂ Vérifier le déploiement du workflow

### Via Cockpit

1. Aller sur `http://localhost:8080/api/camunda/app/cockpit/default/`
2. Cliquer sur **"Processes"**
3. Chercher **"ticket-workflow"**

**âÂÂ Résultat attendu :**
```
Process Definition: ticket-workflow
Name: SupportFlow - Gestion des Tickets
Version: 1
Key: ticket-workflow
```

### Via API REST

```bash
curl http://localhost:8080/api/camunda/engine-rest/process-definition
```

**âÂÂ Réponse attendue :**
```json
[
  {
    "id": "ticket-workflow:1:...",
    "key": "ticket-workflow",
    "name": "SupportFlow - Gestion des Tickets",
    "version": 1,
    "deploymentId": "..."
  }
]
```

---

## Ã°ÂÂÂ¯ Accès rapides

| Interface | URL | Fonction |
|-----------|-----|----------|
| **Cockpit** | `http://localhost:8080/api/camunda/app/cockpit/default/` | Monitoring des processus |
| **Tasklist** | `http://localhost:8080/api/camunda/app/tasklist/default/` | Gestion des tâches |
| **Admin** | `http://localhost:8080/api/camunda/app/admin/default/` | Administration |
| **REST API** | `http://localhost:8080/api/camunda/engine-rest/` | API REST Camunda |
| **Swagger** | `http://localhost:8080/api/swagger-ui/index.html` | Documentation API SupportFlow |

---

## Ã°ÂÂÂ Liens utiles

- **Documentation Camunda** : https://docs.camunda.org/manual/7.20/
- **REST API Reference** : https://docs.camunda.org/manual/7.20/reference/rest/
- **BPMN 2.0** : https://www.omg.org/spec/BPMN/2.0/

---

## Ã°ÂÂÂ Notes pour le jury

**Phrase clé :**
> "Camunda est intégré directement dans le backend Spring Boot via le context path `/api/camunda`. Chaque ticket créé déclenche automatiquement une instance de processus visible dans Camunda Cockpit, avec surveillance SLA en temps réel."

**Démonstration :**
1. Montrer Cockpit vide (0 instances)
2. Créer un ticket via Postman
3. Rafraîchir Cockpit → 1 instance active
4. Montrer le diagramme BPMN avec la tâche en cours
5. Compléter le workflow → Instance dans History
