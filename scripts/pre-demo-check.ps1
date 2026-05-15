param(
    [string]$Frontend = "http://localhost:4200",
    [string]$Backend = "http://localhost:8082",
    [string]$Keycloak = "http://localhost:8180",
    [string]$Share = "http://localhost:8091/share",
    [string]$Camunda = "http://localhost:8082/api/camunda/app/cockpit/default/",
    [int]$ReportYear = 2026,
    [int]$ReportMonth = 5
)

$ErrorActionPreference = "Stop"
$script:PassCount = 0
$script:FailCount = 0

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    $script:PassCount++
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[KO] $Message" -ForegroundColor Red
    $script:FailCount++
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Test-HttpEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int[]]$AcceptedStatus = @(200)
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
        if ($AcceptedStatus -contains [int]$response.StatusCode) {
            Write-Pass "$Name ($($response.StatusCode))"
            return $true
        }
        Write-Fail "$Name (HTTP $($response.StatusCode))"
        return $false
    } catch {
        $status = 0
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
        }
        if ($AcceptedStatus -contains $status) {
            Write-Pass "$Name ($status)"
            return $true
        }
        Write-Fail "$Name ($($_.Exception.Message))"
        return $false
    }
}

function Get-Token {
    param(
        [string]$Username,
        [string]$Password
    )

    $body = "client_id=supportflow-frontend&grant_type=password&username=$Username&password=$Password"
    try {
        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$Keycloak/realms/supportflow/protocol/openid-connect/token" `
            -ContentType "application/x-www-form-urlencoded" `
            -Body $body `
            -TimeoutSec 20

        if ($response.access_token) {
            Write-Pass "Connexion Keycloak OK pour $Username"
            return $response.access_token
        }
    } catch {
        Write-Fail "Connexion Keycloak KO pour $Username ($($_.Exception.Message))"
    }

    return $null
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token,
        [object]$Body = $null
    )

    $headers = @{}
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $params = @{
        Method = $Method
        Uri = $Url
        Headers = $headers
        UseBasicParsing = $true
        TimeoutSec = 20
    }

    if ($null -ne $Body) {
        $params["ContentType"] = "application/json"
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
    }

    try {
        $response = Invoke-WebRequest @params
        $payload = $null
        if ($response.Content) {
            try {
                $payload = $response.Content | ConvertFrom-Json
            } catch {
                $payload = $response.Content
            }
        }
        return @{
            Success = $true
            Status = [int]$response.StatusCode
            Result = $payload
        }
    } catch {
        $status = 0
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
        }
        return @{
            Success = $false
            Status = $status
            Result = $null
            Error = $_.Exception.Message
        }
    }
}

function Test-ApiCheck {
    param(
        [string]$Name,
        [hashtable]$Result,
        [int[]]$AcceptedStatus = @(200)
    )

    if ($Result.Success -and ($AcceptedStatus -contains $Result.Status)) {
        Write-Pass "$Name (HTTP $($Result.Status))"
        return $true
    }

    Write-Fail "$Name (HTTP $($Result.Status))"
    return $false
}

function Test-TicketBucket {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Token,
        [scriptblock]$Predicate
    )

    $result = Invoke-Api -Method GET -Url $Url -Token $Token
    if (-not (Test-ApiCheck -Name $Name -Result $result)) {
        return $false
    }

    $items = @()
    if ($result.Result -and $result.Result.content) {
        $items = @($result.Result.content)
    }

    if ($Predicate) {
        $items = @($items | Where-Object $Predicate)
    }

    if ($items.Count -gt 0) {
        Write-Pass "$Name contient au moins un ticket"
        return $true
    }

    Write-Fail "$Name ne contient aucun ticket exploitable"
    return $false
}

Write-Section "1. Docker et endpoints"

try {
    $dockerRows = docker ps --format "{{.Names}}|{{.Status}}"
    $expectedContainers = @(
        "supportflow-backend",
        "supportflow-frontend",
        "supportflow-keycloak",
        "supportflow-alfresco-share"
    )

    foreach ($container in $expectedContainers) {
        $row = $dockerRows | Where-Object { $_ -like "$container|*" } | Select-Object -First 1
        if ($row -and $row -match '\|(Up .*)$') {
            Write-Pass "Conteneur Docker present: $container"
        } else {
            Write-Fail "Conteneur Docker manquant ou KO: $container"
        }
    }
} catch {
    Write-Fail "Impossible de verifier Docker ($($_.Exception.Message))"
}

Test-HttpEndpoint -Name "Frontend accessible" -Url $Frontend | Out-Null
Test-HttpEndpoint -Name "Backend health OK" -Url "$Backend/api/actuator/health" | Out-Null
Test-HttpEndpoint -Name "PWA manifest" -Url "$Frontend/manifest.webmanifest" | Out-Null
Test-HttpEndpoint -Name "Service worker ngsw" -Url "$Frontend/ngsw.json" | Out-Null
Test-HttpEndpoint -Name "Keycloak OIDC" -Url "$Keycloak/realms/supportflow/.well-known/openid-configuration" | Out-Null
Test-HttpEndpoint -Name "Alfresco Share" -Url $Share -AcceptedStatus @(200, 302) | Out-Null
Test-HttpEndpoint -Name "Camunda Cockpit" -Url $Camunda -AcceptedStatus @(200, 302) | Out-Null

Write-Section "2. Comptes de demonstration"

$adminToken = Get-Token -Username "admin" -Password "admin123"
$managerToken = Get-Token -Username "manager" -Password "manager123"
$agentToken = Get-Token -Username "agent1" -Password "agent123"
$clientToken = Get-Token -Username "client1" -Password "client123"

Write-Section "3. Parcours par role"

if ($clientToken) {
    $clientTickets = Invoke-Api -Method GET -Url "$Backend/api/tickets/my-tickets?page=0&size=5" -Token $clientToken
    Test-ApiCheck -Name "Client /my-tickets" -Result $clientTickets | Out-Null
}

if ($agentToken) {
    $agentWorkbench = Invoke-Api -Method GET -Url "$Backend/api/tickets/agent-workbench?limit=5" -Token $agentToken
    Test-ApiCheck -Name "Agent workbench" -Result $agentWorkbench | Out-Null
}

if ($managerToken) {
    $managerTickets = Invoke-Api -Method GET -Url "$Backend/api/tickets?page=0&size=5" -Token $managerToken
    Test-ApiCheck -Name "Manager tickets" -Result $managerTickets | Out-Null

    $notifications = Invoke-Api -Method GET -Url "$Backend/api/notifications?page=0&size=5" -Token $managerToken
    Test-ApiCheck -Name "Manager notifications" -Result $notifications | Out-Null
}

Write-Section "4. Jeu de donnees de demo"

if ($managerToken) {
    Test-TicketBucket `
        -Name "Ticket NEW" `
        -Url "$Backend/api/tickets?status=NEW&page=0&size=3" `
        -Token $managerToken `
        -Predicate { $true } | Out-Null

    Test-TicketBucket `
        -Name "Ticket IN_PROGRESS" `
        -Url "$Backend/api/tickets?status=IN_PROGRESS&page=0&size=3" `
        -Token $managerToken `
        -Predicate { $true } | Out-Null

    Test-TicketBucket `
        -Name "Ticket PENDING attente client" `
        -Url "$Backend/api/tickets?status=PENDING&waitingOn=CLIENT&page=0&size=5" `
        -Token $managerToken `
        -Predicate { $true } | Out-Null

    Test-TicketBucket `
        -Name "Ticket RESOLVED" `
        -Url "$Backend/api/tickets?status=RESOLVED&page=0&size=3" `
        -Token $managerToken `
        -Predicate { $true } | Out-Null

    $archived = Invoke-Api -Method GET -Url "$Backend/api/tickets/archived/search?page=0&size=10" -Token $managerToken
    if (Test-ApiCheck -Name "Tickets archives" -Result $archived) {
        $archivedItems = @()
        if ($archived.Result -and $archived.Result.content) {
            $archivedItems = @($archived.Result.content)
        }

        $archivedWithFolder = @($archivedItems | Where-Object { $_.archived -eq $true -or $_.archiveReference -or $_.alfrescoFolderId })
        if ($archivedWithFolder.Count -gt 0) {
            Write-Pass "Au moins un ticket archive existe"
            $archivedTicket = $archivedWithFolder[0]
            $docs = Invoke-Api -Method GET -Url "$Backend/api/tickets/$($archivedTicket.id)/alfresco-documents" -Token $managerToken
            if (Test-ApiCheck -Name "Documents Alfresco du ticket archive" -Result $docs) {
                $docItems = @()
                if ($docs.Result) {
                    $docItems = @($docs.Result)
                }
                if ($docItems.Count -gt 0) {
                    Write-Pass "Le ticket archive expose des documents GED"
                } else {
                    Write-Fail "Le ticket archive n'expose aucun document GED"
                }
            }
        } else {
            Write-Fail "Aucun ticket archive exploitable pour la demo"
        }
    }
}

Write-Section "5. Rapport mensuel"

if ($managerToken) {
    $report = Invoke-Api -Method POST -Url "$Backend/api/reports/monthly/$ReportYear/$ReportMonth" -Token $managerToken
    if (Test-ApiCheck -Name "Generation rapport mensuel" -Result $report) {
        if ($report.Result -and ($report.Result.pdfGenerated -or $report.Result.excelGenerated -or $report.Result.pdfPath -or $report.Result.excelPath)) {
            Write-Pass "Rapport mensuel genere"
        } else {
            Write-Info "Rapport mensuel repondu sans indicateur detaille, verification manuelle conseillée"
        }
    }
}

Write-Section "6. Resultat final"

Write-Host "PASS: $PassCount" -ForegroundColor Green
Write-Host "KO  : $FailCount" -ForegroundColor Red

if ($FailCount -eq 0) {
    Write-Host ""
    Write-Host "PRE-DEMO CHECK: OK" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "PRE-DEMO CHECK: KO" -ForegroundColor Red
exit 1
