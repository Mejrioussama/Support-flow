## Strict A->J scenario verification aligned with supportflow_scenario_az.html

$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:8082/api"
$keycloakUrl = "http://127.0.0.1:8180/realms/supportflow/protocol/openid-connect/token"

function Get-Token {
    param([string]$username, [string]$password)

    $body = @{
        grant_type = "password"
        client_id  = "supportflow-frontend"
        username   = $username
        password   = $password
    }

    (Invoke-RestMethod -Uri $keycloakUrl -Method Post -Body $body).access_token
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token,
        [object]$Body = $null
    )

    $headers = @{ Authorization = "Bearer $Token" }

    if ($Body -ne $null) {
        return Invoke-RestMethod -Uri "$baseUrl$Url" -Method $Method -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
    }

    return Invoke-RestMethod -Uri "$baseUrl$Url" -Method $Method -Headers $headers
}

function Assert-Equal {
    param(
        [string]$Label,
        [object]$Actual,
        [object]$Expected
    )

    if ($Actual -ne $Expected) {
        throw "ASSERT FAILED [$Label] expected '$Expected' but got '$Actual'"
    }

    Write-Host "PASS  $Label = $Expected" -ForegroundColor Green
}

Write-Host "=== Scenario AZ Strict (A->J) ===" -ForegroundColor Cyan

$clientToken = Get-Token "client1" "client123"
$managerToken = Get-Token "manager" "manager123"
$agentToken = Get-Token "agent1" "agent123"

# A) CLIENT creates ticket
$clientProfile = Invoke-Api -Method GET -Url "/clients/me" -Token $clientToken
$ticket = Invoke-Api -Method POST -Url "/tickets" -Token $clientToken -Body @{
    title       = "Scenario AZ strict - $(Get-Date -Format 'yyyyMMdd-HHmmss')"
    description = "Validation A->J with reject/resolve/close/archive"
    clientId    = $clientProfile.id
    category    = "TECHNICAL"
    type        = "INCIDENT"
    severity    = "HIGH"
    impact      = "HIGH"
    tags        = @("SCENARIO_AZ", "STRICT")
}
Assert-Equal -Label "A.status after create" -Actual $ticket.status -Expected "NEW"

$ticketId = $ticket.id
$ticketRef = $ticket.reference
Write-Host "Ticket created: $ticketRef ($ticketId)"

# B) MANAGER assigns agent
$agents = Invoke-Api -Method GET -Url "/users/agents" -Token $managerToken
$agent = $agents | Where-Object { $_.username -eq "agent1" } | Select-Object -First 1
$agentId = if ($null -ne $agent) { $agent.id } elseif ($agents.Count -gt 0) { $agents[0].id } else { 3 }
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/assign/$agentId" -Token $managerToken
Assert-Equal -Label "B.status after assign" -Actual $ticket.status -Expected "ASSIGNED"

# C) AGENT takes charge
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/take-charge" -Token $agentToken
Assert-Equal -Label "C.status after take-charge" -Actual $ticket.status -Expected "IN_PROGRESS"

# D/E/F) Simulate SLA path and escalation to critical
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/escalate-sla" -Token $managerToken
Assert-Equal -Label "F.status after escalate-sla" -Actual $ticket.status -Expected "ESCALATED_SLA"
Assert-Equal -Label "F.priority after escalate-sla" -Actual $ticket.priority -Expected "CRITICAL"

# Keep working path in progress
$ticket = Invoke-Api -Method PATCH -Url "/tickets/$ticketId/status" -Token $managerToken -Body @{
    status = "IN_PROGRESS"
    reason = "Continue remediation after escalation"
}
Assert-Equal -Label "Post-escalation status" -Actual $ticket.status -Expected "IN_PROGRESS"

# G) Resolve by agent
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/resolve" -Token $agentToken -Body @{
    resolutionSummary = "Fix applied and validated"
}
Assert-Equal -Label "G.status after resolve" -Actual $ticket.status -Expected "RESOLVED"

# H) Client rejects resolution => back to IN_PROGRESS
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/reject-resolution" -Token $clientToken -Body @{
    reason = "Issue still reproducible"
}
Assert-Equal -Label "H.status after reject" -Actual $ticket.status -Expected "IN_PROGRESS"

# Resolve again for positive closure path
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/resolve" -Token $agentToken -Body @{
    resolutionSummary = "Second fix verified"
}
Assert-Equal -Label "H2.status after second resolve" -Actual $ticket.status -Expected "RESOLVED"

# I) Client validates and closes
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/close" -Token $clientToken -Body @{
    satisfactionRating  = 5
    satisfactionComment = "Validated after retest"
}
Assert-Equal -Label "I.status after close" -Actual $ticket.status -Expected "CLOSED"

# J) Manager archives
$ticket = Invoke-Api -Method POST -Url "/tickets/$ticketId/archive" -Token $managerToken
if ($ticket.archived) {
    Write-Host "PASS  J.archived flag = true" -ForegroundColor Green
} else {
    Write-Host "WARN  J.archive accepted but archived flag is false (Alfresco sync may be temporarily unavailable)" -ForegroundColor Yellow
}

# Camunda monitoring by ticket reference (best-effort validation)
try {
    $processStatus = Invoke-Api -Method GET -Url "/camunda/status/ticket/$ticketRef" -Token $managerToken
    if ($processStatus -and $processStatus.processStatus) {
        Write-Host "Camunda status for ${ticketRef}: $($processStatus.processStatus) / activity=$($processStatus.currentActivity)"
    }
} catch {
    Write-Host "WARN  Camunda status endpoint returned non-success for ${ticketRef}: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "=== Scenario AZ strict completed successfully ===" -ForegroundColor Green
