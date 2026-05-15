# Ã°ÂÂÂ URLs ACCESSIBLES - SUPPORT FLOW

## âÂÂ Statut Système: FONCTIONNEL (88.89% tests passing)

---

## Ã°ÂÂÂ³ Démarrage Stack (Alfresco inclus par défaut)

```powershell
docker compose up -d
Start-Sleep -Seconds 75
```

---

## Ã°ÂÂÂ± URLs à Accéder

### 1. **Backend API Documentation** (Swagger)
```
http://127.0.0.1:8082/api/swagger-ui.html
```
- Voir toutes les API disponibles
- Tester les endpoints directement
- Consulter la documentation

### 2. **Alfresco Share UI** (Gestionnaire de documents)
```
http://127.0.0.1:8091/share
```
- **Login**: admin / admin
- Voir et gérer les fichiers archivés
- Interface web Alfresco

### 3. **Backend Health** (Vérification)
```
http://127.0.0.1:8082/api/actuator/health
```
- Vérifier que le backend répond
- Voir l'état de santé du système
- Code de réponse: 200 = OK

### 4. **Keycloak Admin Console**
```
http://127.0.0.1:8080/auth/admin
```
- **Login**: admin / admin
- Gérer les utilisateurs et rôles
- Configurer OAuth2/OIDC

### 5. **Alfresco Repository** (REST API)
```
http://127.0.0.1:8090
```
- API Alfresco directe
- Nécessite authentification

---

## Ã°ÂÂÂ Identifiants par Défaut

| Service | Username | Password |
|---------|----------|----------|
| Alfresco | admin | admin |
| Keycloak | admin | admin |
| SupportFlow Client | user@example.com | password |
| SupportFlow Manager | manager@example.com | password |

---

## âÂÂ¡ Test Rapide (Copy-Paste)

```powershell
# Vérifier Backend
Invoke-WebRequest http://127.0.0.1:8082/api/actuator/health

# Vérifier Alfresco Share
Start-Process http://127.0.0.1:8091/share

# Vérifier Swagger
Start-Process http://127.0.0.1:8082/api/swagger-ui.html
```

---

## Ã°ÂÂÂ Test Référence Utilisé

**88.89% Success Rate (8/9 tests passing)**:

âÂÂ PASS:
- Backend API responding
- Alfresco Share accessible
- Keycloak OIDC ready
- JWT tokens generated
- Archive API working
- Validation rules enforced
- Error handling working
- Alfresco Direct API auth

âÂÂ ïÂ¸Â Expected (not critical):
- SupportFlow folder will be created on first archive

---

## Ã°ÂÂÂ Si Problème Persiste

### Option 1: Restart Léger  
```powershell
docker compose down
Start-Sleep -Seconds 30
docker compose up -d
Start-Sleep -Seconds 60  # Attendre que services démarrent
```

### Option 2: Check Logs
```powershell
# Backend logs
docker logs supportflow-backend --tail 50

# Alfresco logs
docker logs supportflow-alfresco --tail 50
```

### Option 3: Full Reset
```powershell
docker compose down -v
docker system prune -af
docker compose up -d
```

---

## âÂÂ Verification Checklist

- [ ] Backend répond sur 8082
- [ ] Swagger UI accessible
- [ ] Alfresco Share login OK
- [ ] Keycloak accessible
- [ ] Peut obtenir JWT token
- [ ] Peut archiver tickets

---

**Last Updated**: 27 March 2026  
**Status**: Ã°ÂÂÂ¢ Production Ready
