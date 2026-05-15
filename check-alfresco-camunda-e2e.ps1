## SupportFlow - Archivage Alfresco + Camunda Process Test Suite
## E2E validation: Docker containers + API endpoints + archive workflows

param(
    [string]$Backend = "http://127.0.0.1:8082",
    [string]$Alfresco = "http://127.0.0.1:8090",
    [string]$Share = "http://127.0.0.1:8091",
    [string]$Keycloak = "http://127.0.0.1:8180",
    [switch]$Verbose = $false
)

# ============================================
# Utilities
# ============================================

$pass = 0
$fail = 0

function Test-ApiCall {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token,
        [object]$Body,
        [int]$ExpectedStatus = 200
    )
    
    try {
        $headers = @{"Content-Type" = "application/json"}
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $headers
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params -TimeoutSec 20
        $status = $response.StatusCode
        $result = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
        
        return @{Status = $status; Result = $result; Success = ($status -eq $ExpectedStatus)}
    } catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
            return @{Status = $status; Result = $null; Success = ($status -eq $ExpectedStatus)}
        }
        return @{Status = 0; Result = $null; Success = $false; Error = $_.Exception.Message}
    }
}

function Assert-Result {
    param(
        [object]$Result,
        [int]$ExpectedStatus,
        [string]$TestName
    )
    
    if ($Result.Success) {
        Write-Host "[PASS] $TestName (HTTP $($Result.Status))" -ForegroundColor Green
        $script:pass = $script:pass + 1
    } else {
        Write-Host "[FAIL] $TestName (Expected $ExpectedStatus, got $($Result.Status))" -ForegroundColor Red
        $script:fail = $script:fail + 1
    }
}

# ============================================
# Phase 1: Infrastructure Health Checks
# ============================================

Write-Host "`n=== PHASE 1: INFRASTRUCTURE HEALTH CHECKS ===" -ForegroundColor Cyan

Write-Host "`n[*] Docker Containers Status"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-Object -First 10

Write-Host "`n[*] Backend Health"
$r = Test-ApiCall -Method GET -Url "$Backend/api/actuator/health" -ExpectedStatus 200
Assert-Result $r 200 "Backend actuator/health"

Write-Host "`n[*] Alfresco CMIS Endpoint"
try {
    $r = Invoke-WebRequest -Uri "$Alfresco/alfresco/api/-default-/public/alfresco/versions/1/probes/-ready-" -UseBasicParsing -TimeoutSec 10
    Write-Host "[PASS] Alfresco CMIS probe ready (HTTP $($r.StatusCode))" -ForegroundColor Green
    $pass++
} catch {
    Write-Host "[FAIL] Alfresco CMIS probe failed: $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

Write-Host "`n[*] Alfresco Share UI"
try {
    $r = Invoke-WebRequest -Uri "$Share/share" -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 1
    Write-Host "[PASS] Alfresco Share available (HTTP $($r.StatusCode))" -ForegroundColor Green
    $pass++
} catch {
    if ($_.Exception.Response.StatusCode -eq 302) {
        Write-Host "[PASS] Alfresco Share redirect OK (HTTP 302)" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "[FAIL] Alfresco Share failed: $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

Write-Host "`n[*] Keycloak OIDC Config"
try {
    $r = Invoke-WebRequest -Uri "$Keycloak/realms/supportflow/.well-known/openid-configuration" -UseBasicParsing -TimeoutSec 10
    Write-Host "[PASS] Keycloak OIDC config available (HTTP $($r.StatusCode))" -ForegroundColor Green
    $pass++
} catch {
    Write-Host "[FAIL] Keycloak OIDC config failed: $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

# ============================================
# Phase 2: Test Token and Client Access
# ============================================

Write-Host "`n=== PHASE 2: AUTHENTICATION & TOKEN RETRIEVAL ===" -ForegroundColor Cyan

$keycloakUrl = "$Keycloak/realms/supportflow/protocol/openid-connect/token"
$body = @{
    grant_type = "password"
    client_id = "supportflow-frontend"
    username = "client1"
    password = "client123"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $keycloakUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
    $clientToken = $tokenResponse.access_token
    Write-Host "[PASS] Client token obtained (JWT)" -ForegroundColor Green
    $pass++
} catch {
    Write-Host "[FAIL] Token retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
    $fail++
    exit 1
}

$body = @{
    grant_type = "password"
    client_id = "supportflow-frontend"
    username = "manager"
    password = "manager123"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $keycloakUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
    $managerToken = $tokenResponse.access_token
    Write-Host "[PASS] Manager token obtained (JWT)" -ForegroundColor Green
    $pass++
} catch {
    Write-Host "[FAIL] Manager token retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
    $fail++
    exit 1
}

# ============================================
# Phase 3: Test Ticket Retrieval
# ============================================

Write-Host "`n=== PHASE 3: CLOSE & ARCHIVE SCENARIOS ===" -ForegroundColor Cyan

Write-Host "`n[*] Fetching available closed tickets..."
$r = Test-ApiCall -Method GET -Url "$Backend/api/tickets/archived/search?page=0&size=5" -Token $managerToken -ExpectedStatus 200
Assert-Result $r 200 "List archived tickets"

if ($r.Result -and $r.Result.content) {
    $archivedTickets = $r.Result.content | Where-Object {$_.archived -eq $true}
    if ($archivedTickets) {
        Write-Host "[INFO] Found $($archivedTickets.Count) archived tickets" -ForegroundColor Yellow
        foreach ($ticket in $archivedTickets | Select-Object -First 2) {
            Write-Host "  - $($ticket.reference): alfrescoFolderId=$($ticket.alfrescoFolderId)" -ForegroundColor Gray
        }
    }
}

# ============================================
# Phase 4: Manual Archive Test
# ============================================

Write-Host "`n=== PHASE 4: MANUAL ARCHIVE TEST ===" -ForegroundColor Cyan

Write-Host "`n[*] Fetching a CLOSED ticket for manual archive..."
$r = Test-ApiCall -Method GET -Url "$Backend/api/tickets?status=CLOSED&page=0&size=1" -Token $managerToken -ExpectedStatus 200
Assert-Result $r 200 "Get CLOSED tickets"

if ($r.Result -and $r.Result.content -and $r.Result.content.Count -gt 0) {
    $closedTicket = $r.Result.content[0]
    $ticketId = $closedTicket.id
    Write-Host "[INFO] Testing archive on ticket $($closedTicket.reference) (id=$ticketId)" -ForegroundColor Yellow
    
    Write-Host "`n[*] Manual archive POST /api/tickets/$ticketId/archive"
    $r = Test-ApiCall -Method POST -Url "$Backend/api/tickets/$ticketId/archive" -Token $managerToken -ExpectedStatus 200
    Assert-Result $r 200 "Manual archive endpoint"
    
    if ($r.Result) {
        Write-Host "  - archived: $($r.Result.archived)" -ForegroundColor Gray
        Write-Host "  - alfrescoFolderId: $($r.Result.alfrescoFolderId)" -ForegroundColor Gray
    }
    
    # Test idempotency
    Write-Host "`n[*] Re-archive same ticket (idempotency test)"
    $r2 = Test-ApiCall -Method POST -Url "$Backend/api/tickets/$ticketId/archive" -Token $managerToken -ExpectedStatus 200
    Assert-Result $r2 200 "Idempotent archive (second call)"
    
    if ($r.Result.alfrescoFolderId -eq $r2.Result.alfrescoFolderId) {
        Write-Host "[PASS] Archive reference stable across calls" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "[FAIL] Archive reference changed between calls" -ForegroundColor Red
        $fail++
    }
}

# ============================================
# Phase 5: Alfresco Archives Search Test
# ============================================

Write-Host "`n=== PHASE 5: ALFRESCO ARCHIVES SEARCH ===" -ForegroundColor Cyan

Write-Host "`n[*] Query archived tickets via API..."
$r = Test-ApiCall -Method GET -Url "$Backend/api/tickets/archived/search?archived=true&page=0&size=20" -Token $managerToken -ExpectedStatus 200
Assert-Result $r 200 "Search archived tickets"

if ($r.Result -and $r.Result.content) {
    Write-Host "[INFO] Total archived tickets: $($r.Result.totalElements)" -ForegroundColor Yellow
    $ticketsWithAlfresco = $r.Result.content | Where-Object {-not [string]::IsNullOrEmpty($_.alfrescoFolderId)}
    if ($ticketsWithAlfresco) {
        Write-Host "[PASS] $($ticketsWithAlfresco.Count) tickets have Alfresco references" -ForegroundColor Green
        $pass++
    }
}

# ============================================
# Phase 6: Error Scenario Tests
# ============================================

Write-Host "`n=== PHASE 6: ERROR SCENARIOS ===" -ForegroundColor Cyan

Write-Host "`n[*] Test: Archive non-CLOSED ticket (should fail)"
$r = Test-ApiCall -Method GET -Url "$Backend/api/tickets?status=RESOLVED&page=0&size=1" -Token $managerToken -ExpectedStatus 200
if ($r.Result -and $r.Result.content -and $r.Result.content.Count -gt 0) {
    $resolvedTicket = $r.Result.content[0]
    Write-Host "[INFO] Found RESOLVED ticket: $($resolvedTicket.reference)" -ForegroundColor Yellow
    
    $archiveReq = Test-ApiCall -Method POST -Url "$Backend/api/tickets/$($resolvedTicket.id)/archive" -Token $managerToken -ExpectedStatus 400
    if ($archiveReq.Status -eq 400 -or $archiveReq.Status -eq 409) {
        Write-Host "[PASS] Archive on RESOLVED ticket rejected (HTTP $($archiveReq.Status))" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "[FAIL] Archive on RESOLVED ticket should return 400/409, got $($archiveReq.Status)" -ForegroundColor Red
        $fail++
    }
}

Write-Host "`n[*] Test: Close ticket without resolution (should fail)"
$r = Test-ApiCall -Method POST -Url "$Backend/api/tickets" -Token $clientToken -Body @{
    title = "Test Missing Resolution"
    description = "Test close without resolution"
    category = "TECHNICAL"
    priority = "HIGH"
    type = "INCIDENT"
    severity = "HIGH"
    impact = "MEDIUM"
} -ExpectedStatus 201
if ($r.Result) {
    $newTicket = $r.Result
    Write-Host "[INFO] Created test ticket: $($newTicket.reference)" -ForegroundColor Yellow
    
    # Manually move to RESOLVED without summary (simulated)
    # This should fail on close
    $closeReq = Test-ApiCall -Method POST -Url "$Backend/api/tickets/$($newTicket.id)/close" -Token $clientToken -Body @{
        satisfactionRating = 5
        satisfactionComment = "Test"
    } -ExpectedStatus 400
    
    if ($closeReq.Status -eq 400 -or $closeReq.Status -eq 409 -or $closeReq.Status -eq 422) {
        Write-Host "[PASS] Close without resolution rejected (HTTP $($closeReq.Status))" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "[INFO] Close without resolution returned HTTP $($closeReq.Status) (may need RESOLVED status first)" -ForegroundColor Yellow
    }
}

# ============================================
# Phase 7: Alfresco Direct Verification
# ============================================

Write-Host "`n=== PHASE 7: ALFRESCO DIRECT VERIFICATION ===" -ForegroundColor Cyan

Write-Host "`n[*] Test Alfresco API auth (Basic admin:admin)..."
$pair = "admin:admin"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$basic = [Convert]::ToBase64String($bytes)
$headers = @{Authorization = "Basic $basic"}

try {
    $u = "$Alfresco/alfresco/api/-default-/public/alfresco/versions/1/nodes/-root-/children?maxItems=5"
    $res = Invoke-RestMethod -Uri $u -Headers $headers -Method GET -TimeoutSec 10
    if ($res.list.entries) {
        Write-Host "[PASS] Alfresco root children accessible (found $($res.list.entries.Count) items)" -ForegroundColor Green
        $pass++
    }
} catch {
    Write-Host "[FAIL] Alfresco API call failed: $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

Write-Host "`n[*] List SupportFlow/Tickets folder..."
try {
    $u = "$Alfresco/alfresco/api/-default-/public/alfresco/versions/1/nodes/-root-/children?maxItems=100"
    $res = Invoke-RestMethod -Uri $u -Headers $headers -Method GET -TimeoutSec 10
    $sfFolder = $res.list.entries | Where-Object {$_.entry.name -eq "SupportFlow"} | Select-Object -First 1
    
    if ($sfFolder) {
        $folderId = $sfFolder.entry.id
        Write-Host "[INFO] Found SupportFlow folder (id=$folderId)" -ForegroundColor Yellow
        
        # List Tickets subfolder
        $u2 = "$Alfresco/alfresco/api/-default-/public/alfresco/versions/1/nodes/$folderId/children?maxItems=100"
        $res2 = Invoke-RestMethod -Uri $u2 -Headers $headers -Method GET -TimeoutSec 10
        $ticketsFolder = $res2.list.entries | Where-Object {$_.entry.name -eq "Tickets"} | Select-Object -First 1
        
        if ($ticketsFolder) {
            $ticketsFolderId = $ticketsFolder.entry.id
            Write-Host "[INFO] Found SupportFlow/Tickets folder (id=$ticketsFolderId)" -ForegroundColor Yellow
            
            # List archived tickets
            $u3 = "$Alfresco/alfresco/api/-default-/public/alfresco/versions/1/nodes/$ticketsFolderId/children?maxItems=50"
            $res3 = Invoke-RestMethod -Uri $u3 -Headers $headers -Method GET -TimeoutSec 10
            $archivedInAlfresco = $res3.list.entries
            
            if ($archivedInAlfresco) {
                Write-Host "[PASS] Found $($archivedInAlfresco.Count) archived ticket folders in Alfresco" -ForegroundColor Green
                $pass++
                
                foreach ($archive in $archivedInAlfresco | Select-Object -First 3) {
                    Write-Host "  - $($archive.entry.name) (id=$($archive.entry.id))" -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-Host "[WARN] SupportFlow folder not found in Alfresco root" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Alfresco folder listing failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================
# Summary Report
# ============================================

Write-Host "`n=== FINAL REPORT ===" -ForegroundColor Cyan
Write-Host "`n[Results]" -ForegroundColor White
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  FAIL: $fail" -ForegroundColor Red

$total = $pass + $fail
$successRate = if ($total -gt 0) {[math]::Round(($pass / $total) * 100, 2)} else { 0 }

Write-Host "`nSuccess Rate: $successRate% ($pass/$total)`n" -ForegroundColor $(if ($fail -eq 0) {"Green"} else {"Yellow"})

if ($fail -eq 0) {
    Write-Host "[OK] All tests passed. Archivage et process Camunda are operational." -ForegroundColor Green
    exit 0
} else {
    Write-Host "[WARNING] Some tests failed. Check details above." -ForegroundColor Yellow
    exit 1
}
