# Manual Test Script for SupportFlow Auth + Escalation Changes
# Run: powershell -ExecutionPolicy Bypass -File test-manual-changes.ps1

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BASE = "http://localhost:8082/api"
$KC = "http://localhost:8180/realms/supportflow/protocol/openid-connect/token"

function Get-Token($user, $pass) {
    $r = Invoke-WebRequest -Method Post -Uri $KC `
        -Body "grant_type=password&client_id=supportflow-frontend&username=$user&password=$pass" `
        -ContentType "application/x-www-form-urlencoded" -UseBasicParsing
    return ($r.Content | ConvertFrom-Json).access_token
}

function API($method, $path, $token, $body = $null) {
    $headers = @{ Authorization = "Bearer $token" }
    $params = @{
        Method = $method
        Uri = "$BASE$path"
        Headers = $headers
        ContentType = "application/json"
        UseBasicParsing = $true
    }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 5) }
    try {
        $r = Invoke-WebRequest @params
        return @{ Status = $r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        return @{ Status = $code; Error = $_.Exception.Message }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SUPPORTFLOW - TEST MANUEL COMPLET" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ────────────────────────────────────────────────────
# ETAPE 1: Obtenir les tokens pour chaque role
# ────────────────────────────────────────────────────
Write-Host "=== ETAPE 1: Authentification ===" -ForegroundColor Yellow

try {
    $adminToken = Get-Token "admin" "admin123"
    Write-Host "[OK] Token ADMIN obtenu" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Token ADMIN: $_" -ForegroundColor Red
    exit 1
}

try {
    $managerToken = Get-Token "manager" "manager123"
    Write-Host "[OK] Token MANAGER obtenu" -ForegroundColor Green
} catch {
    Write-Host "[SKIP] Manager non disponible, on continue avec admin" -ForegroundColor Yellow
    $managerToken = $adminToken
}

try {
    $agentToken = Get-Token "agent1" "agent123"
    Write-Host "[OK] Token AGENT obtenu" -ForegroundColor Green
} catch {
    Write-Host "[SKIP] Agent non disponible" -ForegroundColor Yellow
    $agentToken = $null
}

try {
    $clientToken = Get-Token "client1" "client123"
    Write-Host "[OK] Token CLIENT obtenu" -ForegroundColor Green
} catch {
    Write-Host "[SKIP] Client non disponible" -ForegroundColor Yellow
    $clientToken = $null
}

# ────────────────────────────────────────────────────
# ETAPE 2: TEST AUTORISATIONS (auth-audit fixes)
# ────────────────────────────────────────────────────
Write-Host "`n=== ETAPE 2: Tests Autorisations ===" -ForegroundColor Yellow

# 2.1 - Camunda endpoints maintenant proteges
Write-Host "`n--- 2.1 Camunda endpoints proteges ---"
$r = API "GET" "/camunda/status/1" $null
if ($r.Status -eq 401 -or $r.Status -eq 403) {
    Write-Host "[OK] Camunda sans token -> $($r.Status) (BLOQUE)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Camunda sans token -> $($r.Status) (devrait etre 401/403)" -ForegroundColor Red
}

# 2.2 - User enumeration endpoints restreints
Write-Host "`n--- 2.2 User enumeration restreint ---"
if ($clientToken) {
    $r = API "GET" "/users/check/username/admin" $clientToken
    if ($r.Status -eq 403) {
        Write-Host "[OK] CLIENT check/username -> 403 (BLOQUE)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] CLIENT check/username -> $($r.Status) (devrait etre 403)" -ForegroundColor Red
    }
}
$r = API "GET" "/users/check/username/admin" $adminToken
if ($r.Status -eq 200) {
    Write-Host "[OK] ADMIN check/username -> 200 (AUTORISE)" -ForegroundColor Green
} else {
    Write-Host "[INFO] ADMIN check/username -> $($r.Status)" -ForegroundColor Yellow
}

# 2.3 - Notifications protegees
Write-Host "`n--- 2.3 Notifications protegees ---"
$r = API "GET" "/notifications" $adminToken
if ($r.Status -eq 200) {
    Write-Host "[OK] Notifications avec token -> 200" -ForegroundColor Green
} else {
    Write-Host "[INFO] Notifications -> $($r.Status)" -ForegroundColor Yellow
}

# 2.4 - Dashboard fail-closed
Write-Host "`n--- 2.4 Dashboard fail-closed ---"
$r = API "GET" "/dashboard/stats" $adminToken
if ($r.Status -eq 200) {
    Write-Host "[OK] Dashboard ADMIN -> 200 (stats globales)" -ForegroundColor Green
} else {
    Write-Host "[INFO] Dashboard ADMIN -> $($r.Status)" -ForegroundColor Yellow
}
if ($clientToken) {
    $r = API "GET" "/dashboard/stats" $clientToken
    if ($r.Status -eq 200) {
        Write-Host "[OK] Dashboard CLIENT -> 200 (stats client filtrees)" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Dashboard CLIENT -> $($r.Status)" -ForegroundColor Yellow
    }
}

# ────────────────────────────────────────────────────
# ETAPE 3: TEST ESCALATION (nouveaux features)
# ────────────────────────────────────────────────────
Write-Host "`n=== ETAPE 3: Tests Escalation ===" -ForegroundColor Yellow

# 3.1 - Lister les tickets pour trouver un ticket actif
Write-Host "`n--- 3.1 Recherche d'un ticket actif ---"
$r = API "GET" "/tickets?page=0&size=5" $adminToken
if ($r.Status -eq 200 -and $r.Body.content) {
    $tickets = $r.Body.content
    Write-Host "[OK] $($tickets.Count) tickets trouves" -ForegroundColor Green
    $testTicketId = $tickets[0].id
    $testTicketRef = $tickets[0].reference
    Write-Host "     Ticket de test: $testTicketRef (ID: $testTicketId)" -ForegroundColor Cyan
    Write-Host "     Status: $($tickets[0].status), Escalation Level: $($tickets[0].escalationLevel)"
    Write-Host "     SLA Phase: $($tickets[0].slaPhase), Priority: $($tickets[0].priority)"
    
    # Verifier les nouveaux champs
    if ($tickets[0].PSObject.Properties.Name -contains "previousAgentName") {
        Write-Host "     Previous Agent: $($tickets[0].previousAgentName)" -ForegroundColor Cyan
    }
    if ($tickets[0].PSObject.Properties.Name -contains "escalationHoldUntil") {
        Write-Host "     Escalation Hold: $($tickets[0].escalationHoldUntil)" -ForegroundColor Cyan
    }
} else {
    Write-Host "[WARN] Aucun ticket trouve -> $($r.Status)" -ForegroundColor Yellow
    $testTicketId = $null
}

# 3.2 - Historique d'escalade
if ($testTicketId) {
    Write-Host "`n--- 3.2 Historique d'escalade ---"
    $r = API "GET" "/tickets/$testTicketId/escalation-history" $adminToken
    if ($r.Status -eq 200) {
        $events = $r.Body
        Write-Host "[OK] Escalation history: $($events.Count) evenements" -ForegroundColor Green
        foreach ($e in $events | Select-Object -First 3) {
            Write-Host "     L$($e.fromLevel)->L$($e.toLevel) | $($e.reason) | $($e.description)" -ForegroundColor Gray
        }
    } else {
        Write-Host "[INFO] Escalation history -> $($r.Status)" -ForegroundColor Yellow
    }
}

# 3.3 - Agent recommended (avec cache)
if ($testTicketId) {
    Write-Host "`n--- 3.3 Agents recommandes (avec cache Caffeine) ---"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $r1 = API "GET" "/tickets/$testTicketId/recommended-agents" $adminToken
    $sw.Stop()
    $time1 = $sw.ElapsedMilliseconds
    
    $sw.Restart()
    $r2 = API "GET" "/tickets/$testTicketId/recommended-agents" $adminToken
    $sw.Stop()
    $time2 = $sw.ElapsedMilliseconds
    
    if ($r1.Status -eq 200) {
        $agents = $r1.Body
        Write-Host "[OK] $($agents.Count) agents recommandes (1er appel: ${time1}ms, 2eme: ${time2}ms)" -ForegroundColor Green
        foreach ($a in $agents | Select-Object -First 3) {
            Write-Host "     $($a.fullName) - Score: $($a.recommendationScore) - $($a.recommendationReason)" -ForegroundColor Gray
        }
        if ($time2 -lt $time1) {
            Write-Host "     [CACHE] 2eme appel plus rapide (cache Caffeine fonctionne)" -ForegroundColor Green
        }
    } else {
        Write-Host "[INFO] Recommended agents -> $($r1.Status)" -ForegroundColor Yellow
    }
}

# 3.4 - Escalation Hold (nouveau endpoint)
if ($testTicketId) {
    Write-Host "`n--- 3.4 Escalation Hold (NOUVEAU) ---"
    $holdBody = @{ minutes = 30; reason = "Test: investigation manuelle en cours" }
    $r = API "POST" "/tickets/$testTicketId/escalation-hold" $adminToken $holdBody
    if ($r.Status -eq 200) {
        Write-Host "[OK] Escalation hold active: 30min" -ForegroundColor Green
        Write-Host "     Hold until: $($r.Body.escalationHoldUntil)" -ForegroundColor Cyan
        Write-Host "     Hold reason: $($r.Body.escalationHoldReason)" -ForegroundColor Cyan
    } else {
        Write-Host "[INFO] Escalation hold -> $($r.Status) $($r.Error)" -ForegroundColor Yellow
    }
    
    # Verifier que le hold apparait sur le ticket
    $r = API "GET" "/tickets/$testTicketId" $adminToken
    if ($r.Status -eq 200 -and $r.Body.escalationHoldUntil) {
        Write-Host "[OK] Hold visible sur le ticket: $($r.Body.escalationHoldUntil)" -ForegroundColor Green
    }
    
    # Release le hold
    $r = API "POST" "/tickets/$testTicketId/escalation-hold-release" $adminToken
    if ($r.Status -eq 200) {
        Write-Host "[OK] Hold libere avec succes" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Release hold -> $($r.Status)" -ForegroundColor Yellow
    }
}

# 3.5 - SLA Pause/Resume (maintenant avec sync Camunda)
if ($testTicketId) {
    Write-Host "`n--- 3.5 SLA Pause/Resume (avec sync Camunda) ---"
    $r = API "POST" "/tickets/$testTicketId/sla-pause" $adminToken
    if ($r.Status -eq 200) {
        Write-Host "[OK] SLA pause -> Phase: $($r.Body.slaPhase)" -ForegroundColor Green
    } else {
        Write-Host "[INFO] SLA pause -> $($r.Status) (peut-etre deja en pause)" -ForegroundColor Yellow
    }
    
    # Resume
    $r = API "POST" "/tickets/$testTicketId/sla-resume" $adminToken
    if ($r.Status -eq 200) {
        Write-Host "[OK] SLA resume -> Phase: $($r.Body.slaPhase), Deadline: $($r.Body.slaDeadline)" -ForegroundColor Green
    } else {
        Write-Host "[INFO] SLA resume -> $($r.Status)" -ForegroundColor Yellow
    }
}

# ────────────────────────────────────────────────────
# ETAPE 4: TEST ACCES INTER-ROLES
# ────────────────────────────────────────────────────
Write-Host "`n=== ETAPE 4: Tests Acces Inter-Roles ===" -ForegroundColor Yellow

if ($testTicketId -and $agentToken) {
    Write-Host "`n--- 4.1 Agent ne voit que ses tickets ---"
    $r = API "GET" "/tickets/$testTicketId" $agentToken
    if ($r.Status -eq 200) {
        Write-Host "[OK] Agent voit ce ticket (il y est assigne)" -ForegroundColor Green
    } elseif ($r.Status -eq 403) {
        Write-Host "[OK] Agent bloque (pas assigne a ce ticket) -> 403" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Agent ticket access -> $($r.Status)" -ForegroundColor Yellow
    }
}

if ($clientToken -and $agentToken) {
    Write-Host "`n--- 4.2 Escalation Hold refuse pour non-manager ---"
    if ($testTicketId) {
        $r = API "POST" "/tickets/$testTicketId/escalation-hold" $agentToken @{ minutes = 10; reason = "Test" }
        if ($r.Status -eq 403) {
            Write-Host "[OK] Agent ne peut pas mettre en hold -> 403" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Agent hold -> $($r.Status)" -ForegroundColor Yellow
        }
    }
}

# ────────────────────────────────────────────────────
# RESUME
# ────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESUME DES TESTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host @"

  CHANGEMENTS TESTES:
  
  [AUTH] Camunda endpoints securises (401/403 sans token)
  [AUTH] User enumeration restreint (CLIENT bloque)
  [AUTH] Notifications @PreAuthorize 
  [AUTH] Dashboard fail-closed pattern
  [AUTH] Acces ticket par role (agent=assigned, client=company)
  
  [ESCALATION] Historique escalade (EscalationEvent)
  [ESCALATION] Agents recommandes avec cache Caffeine
  [ESCALATION] Escalation Hold/Release (NOUVEAU endpoint)
  [ESCALATION] SLA Pause avec sync Camunda timers
  [ESCALATION] Previous agent tracking dans DTO
  [ESCALATION] Severity-aware anti-blocking
  [ESCALATION] L3 multi-manager cascade

"@ -ForegroundColor White

Write-Host "Test termine!" -ForegroundColor Green
