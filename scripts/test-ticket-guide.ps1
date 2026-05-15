$ErrorActionPreference = "Stop"

function Get-KeycloakToken {
    param(
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][string]$Password
    )

    $body = "client_id=supportflow-frontend&grant_type=password&username=$Username&password=$Password"
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "http://localhost:8180/realms/supportflow/protocol/openid-connect/token" `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body
    return $response.access_token
}

function Get-AuthHeaders {
    param([Parameter(Mandatory = $true)][string]$Token)
    return @{ Authorization = "Bearer $Token" }
}

function Invoke-ApiGet {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Token
    )

    return Invoke-RestMethod -Method Get -Uri $Uri -Headers (Get-AuthHeaders -Token $Token)
}

function Invoke-ApiPost {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Token,
        $Payload = $null
    )

    $body = if ($null -eq $Payload) { "{}" } else { $Payload | ConvertTo-Json -Depth 8 }
    return Invoke-RestMethod `
        -Method Post `
        -Uri $Uri `
        -Headers (Get-AuthHeaders -Token $Token) `
        -ContentType "application/json" `
        -Body $body
}

function Add-Result {
    param(
        [System.Collections.Generic.List[object]]$Results,
        [string]$Step,
        [string]$Status,
        [string]$Details
    )

    $Results.Add([pscustomobject]@{
        step = $Step
        status = $Status
        details = $Details
    }) | Out-Null
}

$results = [System.Collections.Generic.List[object]]::new()

try {
    $clientToken = Get-KeycloakToken -Username "client1" -Password "client123"
    Add-Result -Results $results -Step "Login client Keycloak" -Status "OK" -Details "client1 authentifie via Keycloak"

    $managerToken = Get-KeycloakToken -Username "manager" -Password "manager123"
    Add-Result -Results $results -Step "Login manager Keycloak" -Status "OK" -Details "manager authentifie via Keycloak"

    $agentToken = Get-KeycloakToken -Username "agent1" -Password "agent123"
    Add-Result -Results $results -Step "Login agent Keycloak" -Status "OK" -Details "agent1 authentifie via Keycloak"

    $agentList = Invoke-ApiGet -Uri "http://localhost:8082/api/users/agents" -Token $managerToken
    $agent1 = $agentList | Where-Object { $_.username -eq "agent1" } | Select-Object -First 1
    if (-not $agent1) {
        throw "agent1 introuvable dans /users/agents"
    }

    $agentRole = if ($agent1.role) { $agent1.role } elseif ($agent1.roles) { ($agent1.roles -join ",") } else { "UNKNOWN" }
    Add-Result -Results $results -Step "Lecture agents" -Status "OK" -Details ("agent1 id={0}, role={1}" -f $agent1.id, $agentRole)

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $ticketPayload = @{
        title = "Test guide SupportFlow $timestamp"
        description = "Scenario de validation guide utilisateur: creation, assignation, prise en charge, resolution et cloture."
        type = "INCIDENT"
        severity = "HIGH"
        impact = "HIGH"
        category = "Support"
    }

    $createdTicket = Invoke-ApiPost -Uri "http://localhost:8082/api/tickets" -Token $clientToken -Payload $ticketPayload
    Add-Result -Results $results -Step "Creation ticket client" -Status "OK" -Details ("Ticket #{0} cree avec reference {1}, statut {2}, priorite {3}" -f $createdTicket.id, $createdTicket.reference, $createdTicket.status, $createdTicket.priority)

    $candidateList = Invoke-ApiGet -Uri ("http://localhost:8082/api/tickets/{0}/assignment-candidates" -f $createdTicket.id) -Token $managerToken
    $candidateNames = (($candidateList | Select-Object -First 4 | ForEach-Object { "{0} [{1}]" -f $_.fullName, $_.assignmentStatusLabel }) -join "; ")
    if ([string]::IsNullOrWhiteSpace($candidateNames)) {
        $candidateNames = "Aucun candidat retourne"
    }
    Add-Result -Results $results -Step "Lecture candidats assignation" -Status "OK" -Details $candidateNames

    $assignedTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/assign/{1}" -f $createdTicket.id, $agent1.id) -Token $managerToken -Payload @{ source = "MANUAL" }
    Add-Result -Results $results -Step "Assignation manager" -Status "OK" -Details ("Ticket assigne a {0}, statut {1}" -f $assignedTicket.assignedAgent.fullName, $assignedTicket.status)

    try {
        $myAgentTickets = Invoke-ApiGet -Uri "http://localhost:8082/api/tickets/my-tickets" -Token $agentToken
        $agentHasTicket = $myAgentTickets.content | Where-Object { $_.id -eq $createdTicket.id } | Select-Object -First 1
        $agentVisibility = if ($agentHasTicket) { "Le ticket apparait dans la file agent." } else { "Le ticket n'apparait pas dans la file agent." }
        Add-Result -Results $results -Step "Visibilite agent" -Status ($(if ($agentHasTicket) { "OK" } else { "WARN" })) -Details $agentVisibility
    }
    catch {
        Add-Result -Results $results -Step "Visibilite agent" -Status "ERROR" -Details "L'endpoint /tickets/my-tickets renvoie un acces refuse pour agent1."
    }

    $inProgressTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/take-charge" -f $createdTicket.id) -Token $agentToken
    Add-Result -Results $results -Step "Prise en charge agent" -Status "OK" -Details ("Statut apres prise en charge: {0}" -f $inProgressTicket.status)

    $comment = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/comments" -f $createdTicket.id) -Token $agentToken -Payload @{
        content = "Diagnostic en cours via test automatise du guide utilisateur."
        isInternal = $false
    }
    Add-Result -Results $results -Step "Commentaire agent" -Status "OK" -Details ("Commentaire cree id={0}" -f $comment.id)

    $publicComments = Invoke-ApiGet -Uri ("http://localhost:8082/api/tickets/{0}/comments/public" -f $createdTicket.id) -Token $clientToken
    Add-Result -Results $results -Step "Lecture commentaires client" -Status "OK" -Details ("Commentaires publics visibles: {0}" -f @($publicComments).Count)

    $resolvedTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/resolve" -f $createdTicket.id) -Token $agentToken -Payload @{
        resolutionSummary = "Incident reproduit puis resolu durant le test de validation guide utilisateur."
    }
    Add-Result -Results $results -Step "Resolution agent" -Status "OK" -Details ("Statut apres resolution: {0}" -f $resolvedTicket.status)

    $closedTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/close" -f $createdTicket.id) -Token $clientToken -Payload @{
        satisfactionRating = 5
        satisfactionComment = "Resolution claire et conforme au guide."
    }
    Add-Result -Results $results -Step "Cloture client" -Status "OK" -Details ("Statut final: {0}, satisfaction={1}/5" -f $closedTicket.status, $closedTicket.satisfactionRating)

    $now = Get-Date
    $monthlyReport = Invoke-ApiPost -Uri ("http://localhost:8082/api/reports/monthly/{0}/{1}" -f $now.Year, $now.Month) -Token $managerToken
    $alfrescoLocation = if ($monthlyReport.alfrescoFolderPath) { $monthlyReport.alfrescoFolderPath } else { "non archive dans Alfresco" }
    Add-Result -Results $results -Step "Generation rapport mensuel" -Status "OK" -Details ("PDF={0}; Excel={1}; Alfresco={2}" -f $monthlyReport.pdfReference, $monthlyReport.excelReference, $alfrescoLocation)
}
catch {
    $message = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        $message = "$message | $($_.ErrorDetails.Message)"
    }
    Add-Result -Results $results -Step "Execution" -Status "ERROR" -Details $message
}

$results | ConvertTo-Json -Depth 5
