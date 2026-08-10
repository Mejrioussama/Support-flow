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

    $pendingTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/wait-for-customer" -f $createdTicket.id) -Token $agentToken -Payload @{
        waitingOn = "CLIENT"
        pendingReason = "Merci de confirmer si le dysfonctionnement est encore present et de fournir l'heure exacte du dernier incident."
    }
    Add-Result -Results $results -Step "Attente client" -Status "OK" -Details ("Statut apres mise en attente: {0}, waitingOn={1}" -f $pendingTicket.status, $pendingTicket.waitingOn)

    $clientReply = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/comments" -f $createdTicket.id) -Token $clientToken -Payload @{
        content = "Le probleme est toujours present. Nous avons observe un nouvel incident a 10h12 ce matin."
        isInternal = $false
    }
    Add-Result -Results $results -Step "Reponse client" -Status "OK" -Details ("Commentaire client cree id={0}" -f $clientReply.id)

    $resumedTicket = Invoke-ApiGet -Uri ("http://localhost:8082/api/tickets/{0}" -f $createdTicket.id) -Token $agentToken
    Add-Result -Results $results -Step "Reprise ticket apres reponse client" -Status "OK" -Details ("Statut={0}; lastCustomerResponseAt={1}" -f $resumedTicket.status, $resumedTicket.lastCustomerResponseAt)

    $firstResolutionPayload = @{
        resolutionSummary = "Cause identifiee sur le connecteur d'authentification, corrigee et validee avec le client."
        resolutionDetails = @{
            diagnostic = "L'analyse des journaux a montre une expiration de session prematuree sur le connecteur d'authentification frontal."
            rootCause = "La configuration de renouvellement de session etait incomplete apres la derniere mise a jour de securite."
            actionsTaken = "Le parametre de renouvellement a ete corrige, le service a ete redemarre puis un test de connexion complet a ete execute."
            nextRecommendation = "Surveiller les renouvellements de session pendant 24 heures et documenter la procedure dans la base de connaissance."
        }
    }
    $resolvedTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/resolve" -f $createdTicket.id) -Token $agentToken -Payload $firstResolutionPayload
    Add-Result -Results $results -Step "Resolution agent" -Status "OK" -Details ("Statut apres resolution: {0}" -f $resolvedTicket.status)

    $rejectedTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/reject-resolution" -f $createdTicket.id) -Token $clientToken -Payload @{
        reason = "La correction ameliore la situation mais le probleme reapparait encore sur certains postes clients."
    }
    Add-Result -Results $results -Step "Refus client" -Status "OK" -Details ("Statut apres refus: {0}; motif={1}" -f $rejectedTicket.status, $rejectedTicket.resolutionRejectedReason)

    $secondResolutionPayload = @{
        resolutionSummary = "Correctif definitif applique sur les postes clients et service valide en production."
        resolutionDetails = @{
            diagnostic = "Le comportement residuel provenait d'un cache navigateur obsolete sur certains postes clients."
            rootCause = "Les ressources statiques n'etaient pas forcees a se recharger immediatement apres la correction cote serveur."
            actionsTaken = "Le cache a ete purge, les utilisateurs ont ete reconnectes et la politique de cache a ete durcie pour les prochains deploiements."
            nextRecommendation = "Verifier la purge de cache apres chaque mise a jour frontend critique et maintenir un mode de validation utilisateur apres incident."
        }
    }
    $resolvedAgainTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/resolve" -f $createdTicket.id) -Token $agentToken -Payload $secondResolutionPayload
    Add-Result -Results $results -Step "Resolution agent definitive" -Status "OK" -Details ("Statut apres seconde resolution: {0}" -f $resolvedAgainTicket.status)

    $closedTicket = Invoke-ApiPost -Uri ("http://localhost:8082/api/tickets/{0}/close" -f $createdTicket.id) -Token $clientToken -Payload @{
        satisfactionRating = 5
        satisfactionComment = "Resolution claire et conforme au guide."
    }
    Add-Result -Results $results -Step "Cloture client" -Status "OK" -Details ("Statut final: {0}, satisfaction={1}/5" -f $closedTicket.status, $closedTicket.satisfactionRating)

    $now = Get-Date
    $monthlyReport = Invoke-ApiPost -Uri ("http://localhost:8082/api/reports/monthly/{0}/{1}" -f $now.Year, $now.Month) -Token $managerToken
    $alfrescoLocation = if ($monthlyReport.alfrescoFolderPath) { $monthlyReport.alfrescoFolderPath } else { "non archive dans Alfresco" }
    Add-Result -Results $results -Step "Generation rapport mensuel" -Status "OK" -Details ("PDF={0}; Excel={1}; Alfresco={2}" -f $monthlyReport.pdfReference, $monthlyReport.excelReference, $alfrescoLocation)

    $finalTicket = Invoke-ApiGet -Uri ("http://localhost:8082/api/tickets/{0}" -f $createdTicket.id) -Token $clientToken
    if ($finalTicket.status -ne "CLOSED" -or -not $finalTicket.archived -or [string]::IsNullOrWhiteSpace($finalTicket.archiveReference)) {
        throw "Etat final invalide: status=$($finalTicket.status), archived=$($finalTicket.archived), archiveReference=$($finalTicket.archiveReference)"
    }
    Add-Result -Results $results -Step "Persistance et archivage ticket" -Status "OK" -Details ("Statut CLOSED, archiveReference={0}" -f $finalTicket.archiveReference)

    $history = Invoke-ApiGet -Uri ("http://localhost:8082/api/tickets/{0}/history" -f $createdTicket.id) -Token $clientToken
    $historyActions = @($history.content | ForEach-Object { $_.action })
    foreach ($requiredAction in @("CREATED", "ASSIGNMENT", "WAITING_ON_CLIENT", "CUSTOMER_RESPONSE_RECEIVED", "RESOLUTION_REJECTED", "FERMETURE", "ARCHIVAGE")) {
        if ($requiredAction -notin $historyActions) {
            throw "Historique incomplet: action $requiredAction absente"
        }
    }
    Add-Result -Results $results -Step "Historique cycle de vie" -Status "OK" -Details ("{0} evenements, actions critiques presentes" -f $history.totalElements)

    $workflowTrace = Invoke-ApiGet -Uri ("http://localhost:8082/api/tickets/{0}/workflow-trace" -f $createdTicket.id) -Token $managerToken
    if ($workflowTrace.processStatus -ne "COMPLETED" -or -not $workflowTrace.processInstanceId) {
        throw "Workflow Camunda non termine: status=$($workflowTrace.processStatus)"
    }
    $workflowStart = [datetime]$workflowTrace.steps[0].startTime
    $ticketCreatedAt = [datetime]$finalTicket.createdAt
    if ([math]::Abs(($workflowStart - $ticketCreatedAt).TotalMinutes) -gt 5) {
        throw "Collision Camunda detectee: workflowStart=$workflowStart, ticketCreatedAt=$ticketCreatedAt"
    }
    Add-Result -Results $results -Step "Coherence workflow Camunda" -Status "OK" -Details ("Processus {0} termine et cree avec ce ticket" -f $workflowTrace.processInstanceId)

    $integrationHealth = Invoke-RestMethod -Uri "http://localhost:8082/api/actuator/health/integrations"
    $sync = $integrationHealth.components.workflowSync.details
    if ($integrationHealth.status -ne "UP" -or $sync.pending -ne 0 -or $sync.failed -ne 0) {
        throw "Synchronisation non saine: status=$($integrationHealth.status), pending=$($sync.pending), failed=$($sync.failed)"
    }
    Add-Result -Results $results -Step "Sante synchronisation" -Status "OK" -Details "Integrations UP, workflow pending=0, failed=0"
}
catch {
    $message = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        $message = "$message | $($_.ErrorDetails.Message)"
    }
    Add-Result -Results $results -Step "Execution" -Status "ERROR" -Details $message
}

$results | ConvertTo-Json -Depth 5
