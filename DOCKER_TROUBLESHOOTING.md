# Ã°ÂÂÂ³ Docker Stack - Guide de Troubleshooting

## Ã°ÂÂÂ´ Problèmes Courants & Solutions

### 1. Docker Daemon Crash / HTTP 500 Errors

**Symptôme**:
```
docker: request returned 500 Internal Server Error for API route
```

**Solutions** (dans l'ordre):

#### A. Restart léger (30 sec)
```powershell
# Les conteneurs tournent généralement toujours
docker compose down
Start-Sleep -Seconds 30
docker system prune -f
docker compose up -d
```

#### B. Restart complet Docker Desktop
```powershell
# Windows Task Manager → Terminate "Docker Desktop" process
# Ou via PowerShell:
taskkill /IM "Docker Desktop.exe" /F
Start-Sleep -Seconds 10
# Restart Docker Desktop manually from Start menu
# Wait 20 seconds for daemon to come online
docker ps  # Verify
```

#### C. Factory Reset (Last Resort)
```powershell
# WARNING: Deletes all Docker images/containers!
docker system prune -af --volumes
taskkill /IM "Docker Desktop.exe" /F
Start-Sleep -Seconds 5
# Delete Docker Desktop data:
Remove-Item -Recurse "$env:LocalAppData\Docker" 
# Reinstall Docker Desktop or:
# Restart & let it auto-reinitialize
```

---

### 2. Backend Container Exits Immediately

**Symptôme**:
```
docker ps shows: supportflow-backend is Exited (1)
```

**Debug**:
```powershell
# Check logs
docker logs supportflow-backend --tail 50

# Common causes:
# 1. Port 8082 already in use by another process
netstat -ano | findstr :8082  # Show process using port

# 2. Java heap memory limited
docker logs supportflow-backend | grep -i "OutOfMemory"

# 3. Database connection failed
docker logs supportflow-backend | grep -i "mysql\|database\|connection"
```

**Fix**:
```powershell
# Kill process using port 8082
taskkill /PID <PID> /F

# Or expose different port in docker-compose.yml:
# - "8083:8080"  # Changed from 8082:8080

# Restart
docker compose up -d backend
```

---

### 3. Alfresco Not Accessible (CMIS Timeout)

**Symptôme**:
```
CMIS probe failed: The operation has timed out
```

**Possible Causes**:
1. Alfresco container still warmup (~60 sec needed)
2. PostgreSQL not healthy yet
3. Java heap too low
4. Alfresco services not running (should now start by default)

**Solutions**:

```powershell
# Verify Alfresco containers are present (default startup should include them)
docker ps | findstr "supportflow-alfresco"

# Check PostgreSQL is healthy
docker ps | findstr postgres
# Should show: "Up ... (healthy)"

# Wait for Alfresco warmup
Start-Sleep -Seconds 60

# Retry CMIS probe
Invoke-WebRequest http://127.0.0.1:8090/alfresco/api/-default-/public/cmis/versions/1.1/atom `
  -Headers @{"Authorization"="Basic admin:admin"} `
  -TimeoutSec 10

# If still timeout, check Alfresco logs
docker logs supportflow-alfresco --tail 50 | grep -i "error\|exception"
```

---

### 4. Backend Can't Reach Alfresco (502 Errors on Archive)

**Symptôme** (in API responses):
```json
{
  "status": 502,
  "message": "Alfresco: impossible de se connecter"
}
```

**Root Cause Check**:
```powershell
# Verify env vars are set in backend container
docker inspect supportflow-backend | grep -A 50 "Env"

# Should show:
# "ALFRESCO_URL=http://alfresco:8080/alfresco/api/-default-/public/cmis/versions/1.1/atom"
# "ALFRESCO_USERNAME=admin"
# "ALFRESCO_PASSWORD=admin"
```

**If Missing**:
1. Edit `docker-compose.yml` backend service
2. Add environment vars (see IMPLEMENTATION_COMPLETE.md)
3. Rebuild: `docker compose up -d --build backend`

**If Present but Still 502**:
```powershell
# Test backend-to-Alfresco connectivity
docker exec supportflow-backend sh -c "curl -u admin:admin http://alfresco:8080/alfresco/api/-default-/public/cmis/versions/1.1/atom"

# Should return 200 + CMIS XML
```

---

### 5. Keycloak Tokens Not Working

**Symptom**:
```
401 Unauthorized on /api/tickets endpoints
```

**Check Token Validity**:
```powershell
# Get token
$token_response = Invoke-WebRequest `
  "http://127.0.0.1:8080/auth/realms/supportflow/protocol/openid-connect/token" `
  -Method POST `
  -Headers @{"Content-Type"="application/x-www-form-urlencoded"} `
  -Body "client_id=supportflow-client&username=user@example.com&password=password&grant_type=password"

$token = ($token_response.Content | ConvertFrom-Json).access_token

# Decode JWT (base64)
$parts = $token -split '\.'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($parts[1] + '========')) | ConvertFrom-Json

# Check expiration & scopes
```

---

### 6. Archive Fails with "SupportFlow Folder Not Found"

**Expected (First Run)**: 
- The `/SupportFlow/Tickets` folder doesn't exist yet
- First successful archive creates it
- Future archives use it

**Manual Fix** (if needed):
```powershell
# Create folder structure in Alfresco via API
$curl_cmd = @'
curl -X POST `
  -u admin:admin `
  -H "Content-Type: application/json" `
  http://127.0.0.1:8090/alfresco/api/-default-/private/alfresco/versions/1/nodes/-root-/children `
  -d '{
    "name": "SupportFlow",
    "nodeType": "cm:folder",
    "properties": {
      "cm:title": "SupportFlow Archives"
    }
  }'
@'

# Then create /SupportFlow/Tickets subfolder
```

---

## Ã°ÂÂÂ¢ Health Checks

### Quick Validation Script
```powershell
# save as check-health.ps1
Write-Host "=== Health Check ===" -ForegroundColor Cyan

$checks = @{
    "Backend"     = "http://127.0.0.1:8082/api/actuator/health"
    "Alfresco"    = "http://127.0.0.1:8090/alfresco/api/-default-/public/cmis/versions/1.1/atom"
    "Share"       = "http://127.0.0.1:8091/share"
    "Keycloak"    = "http://127.0.0.1:8080/auth/realms/supportflow/.well-known/openid-configuration"
}

foreach ($service in $checks.Keys) {
    try {
        $resp = Invoke-WebRequest $checks[$service] -TimeoutSec 5 -ErrorAction Stop
        Write-Host "âÂÂ $service : $($resp.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "âÂÂ $service : $_" -ForegroundColor Red
    }
}
```

---

## Ã°ÂÂÂ§ Useful Docker Commands

```powershell
# See all containers with their status
docker ps -a

# See logs of a service (follow mode)
docker logs -f supportflow-backend

# Execute command inside running container
docker exec -it supportflow-backend bash

# Inspect container configuration
docker inspect supportflow-backend | more

# See Docker system usage
docker system df

# Prune unused resources (safe)
docker system prune -f

# Remove everything (nuclear option)
docker system prune -af --volumes

# Rebuild specific service
docker compose up -d --build backend

# Stop all containers
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## Ã°ÂÂÂ Container Memory/CPU

If services are slow or crashing:

```powershell
# Check resource usage
docker stats

# Increase Java heap in docker-compose.yml:
# Environment section → JAVA_OPTS
# OLD: -Xms256m -Xmx512m
# NEW: -Xms512m -Xmx1g

docker compose up -d --build backend
```

---

## âÂÂ Post-Recovery Verification

After any recovery:

```powershell
# 1. Check containers are running
docker ps | Select-Object -Last 10

# 2. Health check all services
powershell -File .\check-health.ps1

# 3. Run full e2e test
powershell -ExecutionPolicy Bypass -File .\check-alfresco-camunda-e2e.ps1 | Tee-Object -FilePath "e2e-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# 4. Test manual archive
$ticket_id = 1  # adjust to valid closed ticket
Invoke-WebRequest -Uri "http://127.0.0.1:8082/api/tickets/$ticket_id/archive" `
  -Method POST `
  -Headers @{"Authorization"="Bearer <token>"} `
  -Body "{"archiveNotes":"Recovery test"}"
```

---

## Ã°ÂÂÂ Performance Tuning

### For Production Load:

1. **Increase Backend Memory**:
```yaml
environment:
  JAVA_OPTS: "-Xms1g -Xmx2g -XX:+UseG1GC"
```

2. **Add Connection Pooling** (MySQL):
```yaml
environment:
  SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: 20
  SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE: 5
```

3. **Alfresco Heap**:
```yaml
environment:
  JAVA_OPTS: "-Xms512m -Xmx1g"
```

---

## Ã°ÂÂÂ¨ Emergency Procedures

### If Stack is Completely Broken:

```powershell
# 1. Backup any critical data
# (e.g., database dumps, Alfresco content)

# 2. Nuclear reset
docker compose down -v
docker system prune -af --volumes
docker rmi $(docker images -aq)

# 3. Rebuild from scratch
docker compose build --no-cache

# 4. Start fresh
docker compose up -d

# 5. Wait and verify
Start-Sleep -Seconds 120
docker ps
```

### Save Logs Before Nuke
```powershell
docker logs supportflow-backend > backend.log 2>&1
docker logs supportflow-alfresco > alfresco.log 2>&1
docker exec supportflow-mysql mysqldump -u root -ppassword > db-backup.sql
```

---

**Last Updated**: 27 Mars 2026  
**Severity Levels**: Ã°ÂÂÂ¢ OK / Ã°ÂÂÂ¡ Minor / Ã°ÂÂÂ´ Critical
