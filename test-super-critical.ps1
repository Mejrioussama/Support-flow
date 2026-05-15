$ErrorActionPreference = "Stop"
$body = "grant_type=password&client_id=supportflow-frontend&username=admin&password=admin123"
$resp = Invoke-RestMethod -Uri "http://localhost:8180/realms/supportflow/protocol/openid-connect/token" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded" -TimeoutSec 10
$token = $resp.access_token
Write-Host "Token OK (length: $($token.Length))" -ForegroundColor Green

$ticket = @{
    title = "SUPER CRITICAL - Serveur principal en panne"
    description = "Le serveur de production est completement hors service - SLA 2 minutes"
    type = "INCIDENT"
    severity = "SUPER_CRITICAL"
    impact = "CRITICAL"
    clientId = 1
} | ConvertTo-Json

Write-Host "`nCreating SUPER_CRITICAL ticket..." -ForegroundColor Cyan
$result = Invoke-RestMethod -Uri "http://localhost:8082/api/tickets" -Method POST -Headers @{Authorization="Bearer $token"} -Body $ticket -ContentType "application/json" -TimeoutSec 15

Write-Host "`n========== TICKET SUPER_CRITICAL CREE ==========" -ForegroundColor Green
Write-Host "ID:           $($result.id)"
Write-Host "Reference:    $($result.reference)"
Write-Host "Severity:     $($result.severity)" -ForegroundColor Red
Write-Host "Impact:       $($result.impact)"
Write-Host "Priority:     $($result.priority)" -ForegroundColor Red
Write-Host "Score:        $($result.score)"
Write-Host "SLA (min):    $($result.slaHours) minutes" -ForegroundColor Yellow
Write-Host "SLA Deadline: $($result.slaDeadline)" -ForegroundColor Yellow
Write-Host "Status:       $($result.status)"
Write-Host "Process ID:   $($result.processInstanceId)"
Write-Host "=================================================" -ForegroundColor Green

# Compare with a CRITICAL ticket
Write-Host "`nCreating CRITICAL ticket for comparison..." -ForegroundColor Cyan
$ticket2 = @{
    title = "CRITICAL - Service down"
    description = "Service down - SLA 4 hours for comparison"
    type = "INCIDENT"
    severity = "CRITICAL"
    impact = "CRITICAL"
    clientId = 1
} | ConvertTo-Json

$result2 = Invoke-RestMethod -Uri "http://localhost:8082/api/tickets" -Method POST -Headers @{Authorization="Bearer $token"} -Body $ticket2 -ContentType "application/json" -TimeoutSec 15

Write-Host "`n========== TICKET CRITICAL (comparaison) ==========" -ForegroundColor Cyan
Write-Host "ID:           $($result2.id)"
Write-Host "Reference:    $($result2.reference)"
Write-Host "Severity:     $($result2.severity)"
Write-Host "Priority:     $($result2.priority)"
Write-Host "Score:        $($result2.score)"
Write-Host "SLA (min):    $($result2.slaHours) minutes" -ForegroundColor Yellow
Write-Host "SLA Deadline: $($result2.slaDeadline)" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

Write-Host "`n--- COMPARAISON ---" -ForegroundColor Magenta
Write-Host "SUPER_CRITICAL: SLA = $($result.slaHours) min, Score = $($result.score), Priority = $($result.priority)"
Write-Host "CRITICAL:       SLA = $($result2.slaHours) min, Score = $($result2.score), Priority = $($result2.priority)"
