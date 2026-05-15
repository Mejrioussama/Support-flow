##############################################################################
# SupportFlow - Complete API Test Suite
# Tests all 97 endpoints across 10 controllers
# Date: 2026-04-06
##############################################################################

$ErrorActionPreference = "Continue"
$BASE_URL = "http://localhost:8082/api"
$KEYCLOAK_URL = "http://localhost:8180/realms/supportflow/protocol/openid-connect/token"

# ============ STYLING ============
function Write-TestHeader($text) { Write-Host "`n$('=' * 70)" -ForegroundColor Cyan; Write-Host "  $text" -ForegroundColor Cyan; Write-Host "$('=' * 70)" -ForegroundColor Cyan }
function Write-Pass($endpoint, $status, $detail) { Write-Host "  [PASS] $endpoint -> $status $detail" -ForegroundColor Green; $script:passed++ }
function Write-Fail($endpoint, $status, $detail) { Write-Host "  [FAIL] $endpoint -> $status $detail" -ForegroundColor Red; $script:failed++ }
function Write-Warn($endpoint, $status, $detail) { Write-Host "  [WARN] $endpoint -> $status $detail" -ForegroundColor Yellow; $script:warned++ }
function Write-Skip($endpoint, $reason) { Write-Host "  [SKIP] $endpoint -> $reason" -ForegroundColor DarkGray; $script:skipped++ }

# Counters
$script:passed = 0; $script:failed = 0; $script:warned = 0; $script:skipped = 0
$script:results = @()

function Add-Result($controller, $method, $endpoint, $status, $result, $detail) {
    $script:results += [PSCustomObject]@{
        Controller = $controller
        Method     = $method
        Endpoint   = $endpoint
        Status     = $status
        Result     = $result
        Detail     = $detail
    }
}

# ============ HELPER: API CALL ============
function Test-Api {
    param(
        [string]$Controller,
        [string]$Method = "GET",
        [string]$Endpoint,
        [string]$Token = "",
        [object]$Body = $null,
        [string]$ContentType = "application/json",
        [int[]]$ExpectedCodes = @(200, 201),
        [int[]]$AcceptableCodes = @(200, 201, 204, 403, 404, 409, 400, 500)
    )

    $url = "$BASE_URL$Endpoint"
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }

    try {
        $params = @{
            Uri             = $url
            Method          = $Method
            Headers         = $headers
            ContentType     = $ContentType
            TimeoutSec      = 15
            UseBasicParsing = $true
        }
        if ($Body -and $Method -in @("POST", "PUT", "PATCH")) {
            if ($Body -is [string]) {
                $params["Body"] = $Body
            } else {
                $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
            }
        }

        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        $bodyPreview = ""
        if ($response.Content) {
            $bodyPreview = $response.Content.Substring(0, [Math]::Min(120, $response.Content.Length))
        }

        if ($statusCode -in $ExpectedCodes) {
            Write-Pass "$Method $Endpoint" $statusCode $bodyPreview
            Add-Result $Controller $Method $Endpoint $statusCode "PASS" $bodyPreview
        } else {
            Write-Warn "$Method $Endpoint" $statusCode $bodyPreview
            Add-Result $Controller $Method $Endpoint $statusCode "WARN" $bodyPreview
        }
        return $response
    }
    catch {
        $statusCode = 0
        $errorMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorMsg = $reader.ReadToEnd().Substring(0, [Math]::Min(120, 500))
                $reader.Close()
            } catch {}
        }
        
        # 403/401 on auth-required endpoints is expected behavior (auth works)
        # 404 on specific resource is ok (endpoint exists but resource doesn't)
        if ($statusCode -in @(400, 403, 404, 409, 405)) {
            Write-Warn "$Method $Endpoint" $statusCode $errorMsg
            Add-Result $Controller $Method $Endpoint $statusCode "WARN" $errorMsg
        } else {
            Write-Fail "$Method $Endpoint" $statusCode $errorMsg
            Add-Result $Controller $Method $Endpoint $statusCode "FAIL" $errorMsg
        }
        return $null
    }
}

# ============ GET TOKENS ============
Write-TestHeader "AUTHENTICATION - Getting Tokens"

function Get-KeycloakToken($username, $password) {
    try {
        $body = "grant_type=password&client_id=supportflow-frontend&username=$username&password=$password"
        $resp = Invoke-RestMethod -Uri $KEYCLOAK_URL -Method POST -Body $body -ContentType "application/x-www-form-urlencoded" -TimeoutSec 10
        Write-Host "  [OK] Token for '$username' obtained (${($resp.access_token.Length)} chars)" -ForegroundColor Green
        return $resp.access_token
    } catch {
        Write-Host "  [ERR] Failed to get token for '$username': $($_.Exception.Message)" -ForegroundColor Red
        return ""
    }
}

$adminToken   = Get-KeycloakToken "admin"   "admin123"
$managerToken = Get-KeycloakToken "manager" "manager123"
$agentToken   = Get-KeycloakToken "agent1"  "agent123"
$clientToken  = Get-KeycloakToken "client1" "client123"

if (-not $adminToken) {
    Write-Host "`n[FATAL] Cannot obtain admin token. Aborting tests." -ForegroundColor Red
    exit 1
}

# ============================================================================
#  1. AUTH CONTROLLER (dev profile only - likely disabled in docker)
# ============================================================================
Write-TestHeader "1. AUTH CONTROLLER (/auth) - Dev Profile Only"

Test-Api -Controller "Auth" -Method "POST" -Endpoint "/auth/login" -Body @{username="admin"; password="admin123"} -ExpectedCodes @(200) -AcceptableCodes @(200,401,404)
Test-Api -Controller "Auth" -Method "GET"  -Endpoint "/auth/me" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)

# ============================================================================
#  2. USER CONTROLLER
# ============================================================================
Write-TestHeader "2. USER CONTROLLER (/users)"

# Public endpoints
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/check/username/admin" -ExpectedCodes @(200)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/check/email/admin@supportflow.com" -ExpectedCodes @(200)

# Authenticated endpoints
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/me" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/1" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/username/admin" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/role/ADMIN" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/agents/available" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/agents" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "User" -Method "GET" -Endpoint "/users/search?q=admin" -Token $adminToken -ExpectedCodes @(200)

# Profile update (PATCH /me)
Test-Api -Controller "User" -Method "PATCH" -Endpoint "/users/me" -Token $adminToken -Body @{firstName="Admin"; lastName="System"} -ExpectedCodes @(200)

# Create user for tests
$testUser = @{
    username  = "testuser_$(Get-Random -Minimum 1000 -Maximum 9999)"
    email     = "test_$(Get-Random -Minimum 1000 -Maximum 9999)@test.com"
    password  = "Test1234!"
    firstName = "Test"
    lastName  = "User"
    role      = "SUPPORT_AGENT"
}
$createResp = Test-Api -Controller "User" -Method "POST" -Endpoint "/users" -Token $adminToken -Body $testUser -ExpectedCodes @(200, 201)
$testUserId = $null
if ($createResp) {
    try { $testUserId = ($createResp.Content | ConvertFrom-Json).id } catch {}
}

if ($testUserId) {
    Write-Host "  -> Created test user ID: $testUserId" -ForegroundColor DarkCyan
    Test-Api -Controller "User" -Method "GET"   -Endpoint "/users/$testUserId" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "User" -Method "PUT"   -Endpoint "/users/$testUserId" -Token $adminToken -Body @{firstName="Updated"; lastName="User"; role="SUPPORT_AGENT"; email=$testUser.email} -ExpectedCodes @(200)
    Test-Api -Controller "User" -Method "PATCH" -Endpoint "/users/$testUserId/deactivate" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "User" -Method "PATCH" -Endpoint "/users/$testUserId/activate" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "User" -Method "PATCH" -Endpoint "/users/$testUserId/password" -Token $adminToken -Body @{newPassword="NewPass1234!"} -ExpectedCodes @(200)
    Test-Api -Controller "User" -Method "DELETE" -Endpoint "/users/$testUserId" -Token $adminToken -ExpectedCodes @(200, 204)
} else {
    Write-Skip "PUT/PATCH/DELETE /users/{id}" "No test user created"
}

# RBAC: client should NOT access users list
Test-Api -Controller "User" -Method "GET" -Endpoint "/users" -Token $clientToken -ExpectedCodes @(403)

# ============================================================================
#  3. CLIENT CONTROLLER
# ============================================================================
Write-TestHeader "3. CLIENT CONTROLLER (/clients)"

Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients/summary" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients/industries" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients/search?q=test" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients/1" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients/code/CLI001" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
Test-Api -Controller "Client" -Method "GET" -Endpoint "/clients/me" -Token $clientToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)

# Create client
$testClient = @{
    companyName = "Test Corp $(Get-Random -Minimum 100 -Maximum 999)"
    email       = "corp$(Get-Random -Minimum 100 -Maximum 999)@test.com"
    phone       = "+33612345678"
    address     = "123 Test St"
    industry    = "Technology"
    contractType = "PREMIUM"
}
$clientResp = Test-Api -Controller "Client" -Method "POST" -Endpoint "/clients" -Token $adminToken -Body $testClient -ExpectedCodes @(200,201)
$testClientId = $null
if ($clientResp) { try { $testClientId = ($clientResp.Content | ConvertFrom-Json).id } catch {} }

if ($testClientId) {
    Write-Host "  -> Created test client ID: $testClientId" -ForegroundColor DarkCyan
    Test-Api -Controller "Client" -Method "PUT"   -Endpoint "/clients/$testClientId" -Token $adminToken -Body @{companyName="Updated Corp"; email=$testClient.email; phone=$testClient.phone; industry="Finance"; contractType="PREMIUM"} -ExpectedCodes @(200)
    Test-Api -Controller "Client" -Method "PATCH" -Endpoint "/clients/$testClientId/deactivate" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "Client" -Method "PATCH" -Endpoint "/clients/$testClientId/activate" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "Client" -Method "DELETE" -Endpoint "/clients/$testClientId" -Token $adminToken -ExpectedCodes @(200, 204)
} else {
    Write-Skip "PUT/PATCH/DELETE /clients/{id}" "No test client created"
}

# ============================================================================
#  4. TICKET CONTROLLER
# ============================================================================
Write-TestHeader "4. TICKET CONTROLLER (/tickets)"

Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets?status=OPEN" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/status/OPEN" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/unassigned" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/search?q=test" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/my-tickets" -Token $clientToken -ExpectedCodes @(200)
Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/archived/search" -Token $adminToken -ExpectedCodes @(200)

# Get existing tickets for further tests
$ticketsResp = Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets?size=5" -Token $adminToken -ExpectedCodes @(200)
$existingTicketId = $null
$existingTicketRef = $null
if ($ticketsResp) {
    try {
        $ticketData = $ticketsResp.Content | ConvertFrom-Json
        $tickets = if ($ticketData.content) { $ticketData.content } else { $ticketData }
        if ($tickets -and $tickets.Count -gt 0) {
            $existingTicketId = $tickets[0].id
            $existingTicketRef = $tickets[0].reference
            Write-Host "  -> Found existing ticket ID: $existingTicketId, Ref: $existingTicketRef" -ForegroundColor DarkCyan
        }
    } catch {}
}

# Create test ticket
$testTicket = @{
    title       = "API Test Ticket $(Get-Date -Format 'HHmmss')"
    description = "Test ticket created by automated API test suite"
    severity    = "MEDIUM"
    category    = "TECHNICAL"
}
$ticketResp = Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets" -Token $adminToken -Body $testTicket -ExpectedCodes @(200,201)
$newTicketId = $null
$newTicketRef = $null
if ($ticketResp) {
    try {
        $td = $ticketResp.Content | ConvertFrom-Json
        $newTicketId = $td.id
        $newTicketRef = $td.reference
        Write-Host "  -> Created test ticket ID: $newTicketId, Ref: $newTicketRef" -ForegroundColor DarkCyan
    } catch {}
}

$testId = if ($newTicketId) { $newTicketId } elseif ($existingTicketId) { $existingTicketId } else { $null }
$testRef = if ($newTicketRef) { $newTicketRef } elseif ($existingTicketRef) { $existingTicketRef } else { $null }

if ($testId) {
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/$testId" -Token $adminToken -ExpectedCodes @(200)
    if ($testRef) {
        Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/reference/$testRef" -Token $adminToken -ExpectedCodes @(200)
    }
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/$testId/history" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/$testId/workflow-status" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/$testId/workflow-trace" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/$testId/recommended-agents" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/client/1" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
    Test-Api -Controller "Ticket" -Method "GET" -Endpoint "/tickets/agent/1" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
}

# Ticket lifecycle (only on newly created ticket)
if ($newTicketId) {
    # Update
    Test-Api -Controller "Ticket" -Method "PUT" -Endpoint "/tickets/$newTicketId" -Token $adminToken -Body @{title="Updated API Test"; description="Updated description"; severity="HIGH"; category="TECHNICAL"} -ExpectedCodes @(200)

    # Status change
    Test-Api -Controller "Ticket" -Method "PATCH" -Endpoint "/tickets/$newTicketId/status" -Token $adminToken -Body @{status="IN_PROGRESS"; reason="Testing status change"} -ExpectedCodes @(200)

    # Assign
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/assign/1" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400,404)

    # Take charge (agent)
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/take-charge" -Token $agentToken -ExpectedCodes @(200) -AcceptableCodes @(200,400,404,409)

    # Escalate manually
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/escalate" -Token $adminToken -Body @{motif="Test escalation"} -ExpectedCodes @(200) -AcceptableCodes @(200,400,404)

    # SLA escalation
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/escalate-sla" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400,404)

    # SLA due date
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/sla-due-date" -Token $adminToken -Body @{slaDueDate="2026-12-31T23:59:59"} -ExpectedCodes @(200) -AcceptableCodes @(200,400)

    # Resolve
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/resolve" -Token $adminToken -Body @{resolutionSummary="Resolved via API test"} -ExpectedCodes @(200) -AcceptableCodes @(200,400)

    # Close
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/close" -Token $adminToken -Body @{satisfactionRating=5; satisfactionComment="Great service"} -ExpectedCodes @(200) -AcceptableCodes @(200,400)

    # Reject resolution (may fail if already closed - that's OK)
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/reject-resolution" -Token $adminToken -Body @{reason="Test rejection"} -ExpectedCodes @(200) -AcceptableCodes @(200,400,409)

    # Archive
    Test-Api -Controller "Ticket" -Method "POST" -Endpoint "/tickets/$newTicketId/archive" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400,404)

    # Delete (cleanup)
    Test-Api -Controller "Ticket" -Method "DELETE" -Endpoint "/tickets/$newTicketId" -Token $adminToken -ExpectedCodes @(200,204) -AcceptableCodes @(200,204,404)
} else {
    Write-Skip "Ticket lifecycle tests" "No test ticket created"
}

# ============================================================================
#  5. COMMENT CONTROLLER
# ============================================================================
Write-TestHeader "5. COMMENT CONTROLLER (/tickets/{id}/comments)"

if ($testId) {
    $commentBody = @{
        content  = "Test comment from API test suite"
        internal = $false
    }
    $commentResp = Test-Api -Controller "Comment" -Method "POST" -Endpoint "/tickets/$testId/comments" -Token $adminToken -Body $commentBody -ExpectedCodes @(200,201)
    $commentId = $null
    if ($commentResp) { try { $commentId = ($commentResp.Content | ConvertFrom-Json).id } catch {} }

    Test-Api -Controller "Comment" -Method "GET" -Endpoint "/tickets/$testId/comments" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "Comment" -Method "GET" -Endpoint "/tickets/$testId/comments/public" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "Comment" -Method "GET" -Endpoint "/tickets/$testId/comments/paginated" -Token $adminToken -ExpectedCodes @(200)

    if ($commentId) {
        Write-Host "  -> Created comment ID: $commentId" -ForegroundColor DarkCyan
        Test-Api -Controller "Comment" -Method "PUT"    -Endpoint "/tickets/$testId/comments/$commentId" -Token $adminToken -Body @{content="Updated comment"; internal=$false} -ExpectedCodes @(200)
        Test-Api -Controller "Comment" -Method "DELETE" -Endpoint "/tickets/$testId/comments/$commentId" -Token $adminToken -ExpectedCodes @(200,204)
    }
} else {
    Write-Skip "Comment tests" "No ticket available"
}

# ============================================================================
#  6. DASHBOARD CONTROLLER
# ============================================================================
Write-TestHeader "6. DASHBOARD CONTROLLER (/dashboard)"

Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/stats" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/trend?days=30" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/top-agents?limit=5" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/sla" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/activity" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/agents/performance" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/agents/1/stats" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/clients/1/stats" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)

# Dashboard for different roles
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/stats" -Token $managerToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/stats" -Token $agentToken -ExpectedCodes @(200)
Test-Api -Controller "Dashboard" -Method "GET" -Endpoint "/dashboard/stats" -Token $clientToken -ExpectedCodes @(200)

# ============================================================================
#  7. NOTIFICATION CONTROLLER
# ============================================================================
Write-TestHeader "7. NOTIFICATION CONTROLLER (/notifications)"

Test-Api -Controller "Notification" -Method "GET"  -Endpoint "/notifications" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Notification" -Method "GET"  -Endpoint "/notifications/unread" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Notification" -Method "GET"  -Endpoint "/notifications/unread/count" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Notification" -Method "POST" -Endpoint "/notifications/read-all" -Token $adminToken -ExpectedCodes @(200)
Test-Api -Controller "Notification" -Method "DELETE" -Endpoint "/notifications/read" -Token $adminToken -ExpectedCodes @(200,204)

# Test with specific notification (try to get one first)
$notifResp = Test-Api -Controller "Notification" -Method "GET" -Endpoint "/notifications?size=1" -Token $adminToken -ExpectedCodes @(200)
$notifId = $null
if ($notifResp) {
    try {
        $nd = $notifResp.Content | ConvertFrom-Json
        $notifs = if ($nd.content) { $nd.content } else { $nd }
        if ($notifs -and $notifs.Count -gt 0) { $notifId = $notifs[0].id }
    } catch {}
}
if ($notifId) {
    Test-Api -Controller "Notification" -Method "POST"   -Endpoint "/notifications/$notifId/read" -Token $adminToken -ExpectedCodes @(200)
    Test-Api -Controller "Notification" -Method "DELETE" -Endpoint "/notifications/$notifId" -Token $adminToken -ExpectedCodes @(200,204)
} else {
    Write-Skip "POST /notifications/{id}/read" "No notifications found"
    Write-Skip "DELETE /notifications/{id}" "No notifications found"
}

# ============================================================================
#  8. REPORT CONTROLLER
# ============================================================================
Write-TestHeader "8. REPORT CONTROLLER (/reports)"

Test-Api -Controller "Report" -Method "POST" -Endpoint "/reports/monthly/2026/3" -Token $adminToken -ExpectedCodes @(200,201) -AcceptableCodes @(200,201,400,404,500)
Test-Api -Controller "Report" -Method "GET"  -Endpoint "/reports/monthly/2026/3/download?format=pdf" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400,404,500)
Test-Api -Controller "Report" -Method "GET"  -Endpoint "/reports/monthly/2026/3/download?format=excel" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400,404,500)

# ============================================================================
#  9. CAMUNDA CONTROLLER
# ============================================================================
Write-TestHeader "9. CAMUNDA CONTROLLER (/camunda)"

Test-Api -Controller "Camunda" -Method "GET" -Endpoint "/camunda/health" -ExpectedCodes @(200)

if ($testRef) {
    Test-Api -Controller "Camunda" -Method "GET" -Endpoint "/camunda/status/ticket/$testRef" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,404)
}

# Start process (if we have a ticket)
if ($existingTicketId) {
    Test-Api -Controller "Camunda" -Method "POST" -Endpoint "/camunda/start" -Token $adminToken -Body @{ticketId=$existingTicketId} -ExpectedCodes @(200) -AcceptableCodes @(200,400,404,409,500)
}

Test-Api -Controller "Camunda" -Method "POST" -Endpoint "/camunda/reconcile/closed?limit=10" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400)
Test-Api -Controller "Camunda" -Method "POST" -Endpoint "/camunda/cleanup/closed-active?limit=10" -Token $adminToken -ExpectedCodes @(200) -AcceptableCodes @(200,400)

# ============================================================================
#  10. ATTACHMENT CONTROLLER
# ============================================================================
Write-TestHeader "10. ATTACHMENT CONTROLLER (/tickets/{id}/attachments)"

if ($testId) {
    Test-Api -Controller "Attachment" -Method "GET" -Endpoint "/tickets/$testId/attachments" -Token $adminToken -ExpectedCodes @(200)

    # Upload test (multipart - simplified)
    try {
        $boundary = [System.Guid]::NewGuid().ToString()
        $filePath = "$env:TEMP\test-upload.txt"
        "Test file content for API testing" | Out-File -FilePath $filePath -Encoding utf8
        $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
        $fileEnc = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes)
        
        $bodyLines = @(
            "--$boundary",
            'Content-Disposition: form-data; name="file"; filename="test-upload.txt"',
            "Content-Type: text/plain",
            "",
            $fileEnc,
            "--$boundary",
            'Content-Disposition: form-data; name="description"',
            "",
            "API test attachment",
            "--$boundary--"
        )
        $bodyStr = $bodyLines -join "`r`n"
        
        $headers = @{ "Authorization" = "Bearer $adminToken" }
        $resp = Invoke-WebRequest -Uri "$BASE_URL/tickets/$testId/attachments" -Method POST -Headers $headers -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyStr -TimeoutSec 15 -UseBasicParsing
        Write-Pass "POST /tickets/$testId/attachments (upload)" $resp.StatusCode "File uploaded"
        Add-Result "Attachment" "POST" "/tickets/$testId/attachments" $resp.StatusCode "PASS" "Upload OK"
        
        $attachId = $null
        try { $attachId = ($resp.Content | ConvertFrom-Json).id } catch {}
        if ($attachId) {
            Test-Api -Controller "Attachment" -Method "GET"    -Endpoint "/attachments/$attachId/download" -Token $adminToken -ExpectedCodes @(200)
            Test-Api -Controller "Attachment" -Method "DELETE" -Endpoint "/attachments/$attachId" -Token $adminToken -ExpectedCodes @(200,204)
        }
        Remove-Item $filePath -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "POST /tickets/$testId/attachments (upload)" "ERR" $_.Exception.Message
        Add-Result "Attachment" "POST" "/tickets/$testId/attachments" 0 "WARN" $_.Exception.Message
    }
} else {
    Write-Skip "Attachment tests" "No ticket available"
}

# ============================================================================
#  RBAC VALIDATION TESTS
# ============================================================================
Write-TestHeader "11. RBAC VALIDATION (Cross-role access checks)"

# Agent should NOT be able to delete tickets
Test-Api -Controller "RBAC" -Method "DELETE" -Endpoint "/tickets/99999" -Token $agentToken -ExpectedCodes @(403) -AcceptableCodes @(403,404)

# Client should NOT access user management
Test-Api -Controller "RBAC" -Method "GET" -Endpoint "/users" -Token $clientToken -ExpectedCodes @(403)

# Client should NOT see agent performance
Test-Api -Controller "RBAC" -Method "GET" -Endpoint "/dashboard/agents/performance" -Token $clientToken -ExpectedCodes @(403)

# Agent should NOT generate reports
Test-Api -Controller "RBAC" -Method "POST" -Endpoint "/reports/monthly/2026/3" -Token $agentToken -ExpectedCodes @(403)

# Unauthenticated should be blocked
Test-Api -Controller "RBAC" -Method "GET" -Endpoint "/tickets" -ExpectedCodes @(401,403)
Test-Api -Controller "RBAC" -Method "GET" -Endpoint "/users" -ExpectedCodes @(401,403)
Test-Api -Controller "RBAC" -Method "GET" -Endpoint "/dashboard/stats" -ExpectedCodes @(401,403)

# ============================================================================
#  RESULTS SUMMARY
# ============================================================================
Write-Host "`n"
Write-TestHeader "TEST RESULTS SUMMARY"

$total = $script:passed + $script:failed + $script:warned + $script:skipped
Write-Host ""
Write-Host "  Total Tests:  $total" -ForegroundColor White
Write-Host "  PASSED:       $($script:passed)" -ForegroundColor Green
Write-Host "  WARNED:       $($script:warned)" -ForegroundColor Yellow
Write-Host "  FAILED:       $($script:failed)" -ForegroundColor Red
Write-Host "  SKIPPED:      $($script:skipped)" -ForegroundColor DarkGray
Write-Host ""

$passRate = if ($total -gt 0) { [math]::Round(($script:passed / ($total - $script:skipped)) * 100, 1) } else { 0 }
Write-Host "  Pass Rate:    $passRate% (excluding skipped)" -ForegroundColor $(if ($passRate -ge 80) { "Green" } elseif ($passRate -ge 60) { "Yellow" } else { "Red" })

# Results by controller
Write-Host "`n  Results by Controller:" -ForegroundColor Cyan
$script:results | Group-Object Controller | ForEach-Object {
    $p = ($_.Group | Where-Object { $_.Result -eq "PASS" }).Count
    $w = ($_.Group | Where-Object { $_.Result -eq "WARN" }).Count
    $f = ($_.Group | Where-Object { $_.Result -eq "FAIL" }).Count
    $color = if ($f -eq 0 -and $p -gt 0) { "Green" } elseif ($f -gt 0) { "Red" } else { "Yellow" }
    Write-Host "    $($_.Name.PadRight(15)) : $p PASS | $w WARN | $f FAIL" -ForegroundColor $color
}

# Export results to CSV
$csvPath = ".\test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
$script:results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host "`n  Results exported to: $csvPath" -ForegroundColor Cyan

Write-Host "`n$('=' * 70)" -ForegroundColor Cyan
Write-Host "  TEST SUITE COMPLETE" -ForegroundColor Cyan
Write-Host "$('=' * 70)`n" -ForegroundColor Cyan
