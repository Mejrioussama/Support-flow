# D4_TEST_SMOKE_CAMUNDA.ps1
# Minimal Camunda smoke test (ASCII-safe)

$ErrorActionPreference = "Stop"
$BACKEND_URL = "http://localhost:8081"
$COCKPIT_URL = "http://localhost:8080/camunda/app/cockpit"
$ticketId = "TKT-TEST-$(Get-Date -Format yyyyMMddHHmmss)"

Write-Host "=== D4 CAMUNDA SMOKE TEST ===" -ForegroundColor Cyan
Write-Host "Ticket: $ticketId"

# 1) Health
try {
    $health = Invoke-RestMethod -Uri "$BACKEND_URL/actuator/health" -Method Get -TimeoutSec 8
    Write-Host "Backend health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "Backend is not reachable at $BACKEND_URL" -ForegroundColor Red
    exit 1
}

# 2) Start process
$payload = @{
    ticketId = $ticketId
    priority = "MEDIUM"
    slaDeadline = (Get-Date).AddHours(1).ToString("o")
    clientId = "user-test-123"
    description = "Camunda smoke test"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "$BACKEND_URL/api/camunda/start" -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 12
    $instanceId = $null
    if ($res -and $res.PSObject.Properties.Name -contains "processInstanceId") {
        $instanceId = $res.processInstanceId
    } elseif ($res -and $res.PSObject.Properties.Name -contains "id") {
        $instanceId = $res.id
    }

    Write-Host "Process started successfully" -ForegroundColor Green
    if ($instanceId) {
        Write-Host "ProcessInstanceId: $instanceId"
    }
} catch {
    Write-Host "Failed to start process" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "Open cockpit: $COCKPIT_URL"
Write-Host "Look for business key / ticketId: $ticketId"
Write-Host "=== DONE ===" -ForegroundColor Cyan
