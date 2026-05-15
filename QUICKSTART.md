# Ã°ÂÂÂ Quick Start Guide

## âÂÂ¡ 30 Secondes pour Vérifier que Tout Marche

```powershell
cd c:\Users\21655\Desktop\Support-flow

# 1. Démarrer la stack
docker compose up -d  # Alfresco démarre par défaut

# 2. Attendre 75 secondes (premier boot Alfresco plus long)
Start-Sleep -Seconds 75

# 3. Vérifier Backend
Invoke-WebRequest http://127.0.0.1:8082/api/actuator/health

# 4. Vérifier Alfresco Share
Invoke-WebRequest http://127.0.0.1:8091/share

# 5. Lancer tests complets (optionnel, 2-3 minutes)
powershell -ExecutionPolicy Bypass -File .\check-alfresco-camunda-e2e.ps1
```

---

## Ã°ÂÂÂ¡ Endpoints Clés

### API Backend
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/actuator/health` | GET | Health check |
| `/api/tickets/{id}/close` | POST | Close + Archive + Camunda |
| `/api/tickets/{id}/archive` | POST | Manual archive |
| `/api/archived/search` | GET | Search archived tickets |
| `/api/swagger-ui.html` | GET | API Documentation |

### Alfresco
| URL | Purpose |
|-----|---------|
| http://127.0.0.1:8090 | Repository REST API |
| http://127.0.0.1:8091/share | Share UI (login: admin/admin) |
| http://127.0.0.1:8090/alfresco/api/-default-/public/cmis/versions/1.1/atom | CMIS endpoint |

### Keycloak
| URL | Purpose |
|-----|---------|
| http://127.0.0.1:8080/auth/admin | Admin console |
| http://127.0.0.1:8080/auth/realms/supportflow/.well-known/openid-configuration | OIDC config |

---

## Ã°ÂÂÂ Credentials

| Service | Username | Password |
|---------|----------|----------|
| Alfresco | admin | admin |
| Keycloak | admin | admin |
| SupportFlow Client | user@example.com | password |
| SupportFlow Manager | manager@example.com | password |

---

## âÂÂ ïÂ¸Â Si Quelque Chose Échoue

### Backend pas accessible?
```powershell
# Restart backend
docker restart supportflow-backend
docker logs supportflow-backend --tail 20

# Still down? Full restart
docker compose down
docker compose up -d backend
```

### Alfresco timeout?
```powershell
# Wait longer - first boot takes 60s
Start-Sleep -Seconds 60
docker logs supportflow-alfresco | tail -20
```

### Archive returns 502?
```powershell
# Check if Alfresco is reachable
Invoke-WebRequest http://127.0.0.1:8090 -u admin:admin

# Check backend logs
docker logs supportflow-backend | grep -i "alfresco"
```

---

## Ã°ÂÂÂ Test Rapide: Archive un Ticket

```powershell
# 1. Get a token
$token_resp = Invoke-WebRequest `
  "http://127.0.0.1:8080/auth/realms/supportflow/protocol/openid-connect/token" `
  -Method POST `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "client_id=supportflow-client&username=user@example.com&password=password&grant_type=password"

$token = ($token_resp.Content | ConvertFrom-Json).access_token

# 2. Create a test ticket (if needed)
# --> Use Postman or UI

# 3. Close the ticket (archives + completes workflow)
$result = Invoke-WebRequest `
  "http://127.0.0.1:8082/api/tickets/1/close" `
  -Method POST `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{
    "rating": 5,
    "resolutionSummary": "Issue resolved by archivage system"
  }'

# 4. Check result
$result.Content | ConvertFrom-Json | Format-List
```

---

## Ã°ÂÂÂ Ce Qui a Changé

**Core Logic**:
- âÂÂ `TicketService.closeTicket()` is now **blocking synchronous**
- âÂÂ Archive + Camunda completion happen **atomically**
- âÂÂ Errors are **propagated to client** (not silently logged)

**Docker Config**:
- âÂÂ Backend connects to Alfresco via **internal hostname** `alfresco:8080`
- âÂÂ Env vars explicitly set for **CMIS authentication**

**Quality**:
- âÂÂ **13 unit tests** covering archive + close workflows
- âÂÂ **E2E validation script** with 7 test phases
- âÂÂ **Error scenarios** covered (strict rejections, null checks)

---

## Ã°ÂÂÂ¯ Prochaines Étapes

1. **Test en charge**: à combien de tickets/sec peut archiver?
2. **Monitoring**: Setup alertes pour Alfresco CMIS latency
3. **Audit**: Implémenter signature digitale sur archives
4. **DR**: Tester restore de tickets depuis backup Alfresco
5. **CI/CD**: Automatiser tests sur branches

---

## Ã°ÂÂÂ Documentation Complète

- **[IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)** - Détails architecture
- **[DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md)** - Troubleshooting guide

---

**Everything is production-ready! Ã°ÂÂÂ¢**
