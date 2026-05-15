## Premium scenario verification (8 elements)

$baseUrl = "http://127.0.0.1:8082/api"
$keycloakUrl = "http://127.0.0.1:8180/realms/supportflow/protocol/openid-connect/token"

function Get-Token($username, $password) {
    $body = @{grant_type="password"; client_id="supportflow-frontend"; username=$username; password=$password}
    (Invoke-RestMethod -Uri $keycloakUrl -Method Post -Body $body).access_token
}

function Invoke-Api {
    param([string]$Method, [string]$Url, [string]$Token, [object]$Body = $null)
    $headers = @{Authorization = "Bearer $Token"}
    try {
        if ($Body -ne $null) {
            return Invoke-RestMethod -Uri "$baseUrl$Url" -Method $Method -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 8)
        }
        return Invoke-RestMethod -Uri "$baseUrl$Url" -Method $Method -Headers $headers
    } catch {
        Write-Host "API ERROR $Method $Url -> $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

Write-Host "=== Premium Scenario (8 elements) ===" -ForegroundColor Cyan

$clientToken = Get-Token "client1" "client123"
$managerToken = Get-Token "manager" "manager123"
$agentToken = Get-Token "agent1" "agent123"

# 1) Create incident (war-room mode by context)
$clientProfile = Invoke-Api -Method GET -Url "/clients/me" -Token $clientToken
$ticket = Invoke-Api -Method POST -Url "/tickets" -Token $clientToken -Body @{
    title = "Premium incident war-room test"
    description = "API paiement instable - war-room"
    clientId = $clientProfile.id
    category = "TECHNICAL"
    priority = "CRITICAL"
    type = "INCIDENT"
    severity = "CRITICAL"
    impact = "CRITICAL"
    tags = @("WAR_ROOM","EXEC")
}
Write-Host "Ticket created: $($ticket.reference) ($($ticket.id))"

# 2) Manager assign
$agentSearch = Invoke-Api -Method GET -Url "/users/search?q=agent1" -Token $managerToken
$agentId = if ($agentSearch.content.Count -gt 0) { $agentSearch.content[0].id } else { 3 }
$ticket = Invoke-Api -Method POST -Url "/tickets/$($ticket.id)/assign/$agentId" -Token $managerToken
Write-Host "Assigned -> status=$($ticket.status)"

# 3) Agent take charge
$ticket = Invoke-Api -Method POST -Url "/tickets/$($ticket.id)/take-charge" -Token $agentToken
Write-Host "Take-charge -> status=$($ticket.status)"

# 4) Force SLA risk/escalation
$ticket = Invoke-Api -Method POST -Url "/tickets/$($ticket.id)/escalate-sla" -Token $managerToken
Write-Host "SLA escalation -> status=$($ticket.status), priority=$($ticket.priority), slaState=$($ticket.slaState)"

# 5) Status change with reason
$ticket = Invoke-Api -Method PATCH -Url "/tickets/$($ticket.id)/status" -Token $managerToken -Body @{
    status = "IN_PROGRESS"
    reason = "War-room escalation handoff"
}
Write-Host "Status change with reason -> $($ticket.status)"

# 6) Resolve
$ticket = Invoke-Api -Method POST -Url "/tickets/$($ticket.id)/resolve" -Token $agentToken -Body @{
    resolutionSummary = "Root cause fixed in API gateway routing"
}
Write-Host "Resolved -> $($ticket.status)"

# 7) Close with strict validation fields
$ticket = Invoke-Api -Method POST -Url "/tickets/$($ticket.id)/close" -Token $clientToken -Body @{
    satisfactionRating = 5
    satisfactionComment = "Excellent recovery and communication"
}
Write-Host "Closed -> $($ticket.status)"

# 8) Check dashboard KPIs
$stats = Invoke-Api -Method GET -Url "/dashboard/stats" -Token $managerToken
Write-Host "KPIs: escalatedManual=$($stats.escalatedManualTickets), escalatedSLA=$($stats.escalatedSlaTickets), slaAtRisk=$($stats.slaAtRiskTickets), slaBreached=$($stats.slaBreachedTickets)"

Write-Host "=== Done ===" -ForegroundColor Green
