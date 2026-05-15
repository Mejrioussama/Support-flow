#!/usr/bin/env pwsh
# test-rbac-scenarios.ps1
# ASCII-safe RBAC test script for jury demo

param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$KeycloakUrl = "http://localhost:8081",
    [string]$Realm = "supportflow",
    [string]$ClientId = "supportflow-backend",
    [string]$ClientSecret = "supportflow-backend-secret"
)

$ErrorActionPreference = "Continue"
$ApiUrl = "$BaseUrl/api"
$TokenUrl = "$KeycloakUrl/realms/$Realm/protocol/openid-connect/token"

$Users = @{
    admin = @{ PlainSecret = "admin123"; Role = "ADMIN" }
    manager = @{ PlainSecret = "manager123"; Role = "SUPPORT_MANAGER" }
    agent1 = @{ PlainSecret = "agent123"; Role = "SUPPORT_AGENT" }
    client1 = @{ PlainSecret = "client123"; Role = "CLIENT" }
}

function Get-AccessToken {
    param(
        [string]$Username,
        [string]$PlainSecret
    )

    $formBody = "grant_type=password&client_id=$ClientId&client_secret=$ClientSecret&username=$Username&password=$PlainSecret&scope=openid%20profile%20email"
    try {
        $resp = Invoke-RestMethod -Uri $TokenUrl -Method Post -ContentType "application/x-www-form-urlencoded" -Body $formBody
        return $resp.access_token
    } catch {
        Write-Host "Token error for ${Username}: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Invoke-ApiTest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Token,
        [string]$Expected,
        [object]$Body = $null,
        [string]$Label = ""
    )

    $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
    $statusCode = 0

    try {
        if ($null -ne $Body) {
            $null = Invoke-WebRequest -Uri "$ApiUrl$Endpoint" -Method $Method -Headers $headers -Body ($Body | ConvertTo-Json) -ErrorAction Stop
        } else {
            $null = Invoke-WebRequest -Uri "$ApiUrl$Endpoint" -Method $Method -Headers $headers -ErrorAction Stop
        }
        $statusCode = 200
    } catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        } else {
            $statusCode = 0
        }
    }

    $ok = ($Expected -eq "200" -and ($statusCode -eq 200 -or $statusCode -eq 201)) -or ($statusCode.ToString() -eq $Expected)
    $mark = if ($ok) { "OK" } else { "KO" }
    $color = if ($ok) { "Green" } else { "Red" }
    Write-Host ("[{0}] {1} -> {2} (expected {3})" -f $mark, $Label, $statusCode, $Expected) -ForegroundColor $color
}

Write-Host "=== SUPPORTFLOW RBAC TEST ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl"
Write-Host "KC : $TokenUrl"

$adminToken = Get-AccessToken -Username "admin" -PlainSecret $Users.admin.PlainSecret
$managerToken = Get-AccessToken -Username "manager" -PlainSecret $Users.manager.PlainSecret
$agentToken = Get-AccessToken -Username "agent1" -PlainSecret $Users.agent1.PlainSecret
$clientToken = Get-AccessToken -Username "client1" -PlainSecret $Users.client1.PlainSecret

if (-not $adminToken -or -not $managerToken -or -not $agentToken -or -not $clientToken) {
    Write-Host "One or more logins failed. Stop." -ForegroundColor Red
    exit 1
}

Write-Host "\n-- ADMIN --" -ForegroundColor Cyan
Invoke-ApiTest -Method "GET" -Endpoint "/tickets" -Token $adminToken -Expected "200" -Label "List all tickets"
Invoke-ApiTest -Method "DELETE" -Endpoint "/tickets/999" -Token $adminToken -Expected "200" -Label "Delete ticket"

Write-Host "\n-- MANAGER --" -ForegroundColor Cyan
Invoke-ApiTest -Method "GET" -Endpoint "/tickets" -Token $managerToken -Expected "200" -Label "List all tickets"
Invoke-ApiTest -Method "POST" -Endpoint "/tickets/1/assign/2" -Token $managerToken -Expected "200" -Label "Assign ticket"
Invoke-ApiTest -Method "DELETE" -Endpoint "/tickets/999" -Token $managerToken -Expected "403" -Label "Delete ticket (forbidden)"

Write-Host "\n-- AGENT --" -ForegroundColor Cyan
Invoke-ApiTest -Method "POST" -Endpoint "/tickets/1/take-charge" -Token $agentToken -Expected "200" -Label "Take charge"
Invoke-ApiTest -Method "POST" -Endpoint "/tickets/1/assign/2" -Token $agentToken -Expected "403" -Label "Assign ticket (forbidden)"

Write-Host "\n-- CLIENT --" -ForegroundColor Cyan
Invoke-ApiTest -Method "GET" -Endpoint "/tickets/my-tickets" -Token $clientToken -Expected "200" -Label "My tickets"
Invoke-ApiTest -Method "GET" -Endpoint "/tickets" -Token $clientToken -Expected "403" -Label "All tickets (forbidden)"

Write-Host "\n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "RBAC matrix exercised (200/403 checks)." -ForegroundColor Green
