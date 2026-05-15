# D1_DIAGNOSTIC_KEYCLOAK.ps1
# Diagnostic complet pour vérifier Keycloak

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "D1 — DIAGNOSTIC KEYCLOAK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$KEYCLOAK_URL = "http://localhost:8080"
$REALM = "supportflow"
$REALM_FILE = "keycloak\supportflow-realm.json"

# [1/7] Vérifier si Keycloak est accessible
Write-Host "[1/7] Vérifier si Keycloak est accessible..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$KEYCLOAK_URL/realms/$REALM" -TimeoutSec 5
    Write-Host "✅ Keycloak est accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Keycloak n'est pas accessible sur $KEYCLOAK_URL" -ForegroundColor Red
    Write-Host "   Solution: Démarrer Keycloak avec docker ou java directement" -ForegroundColor Red
    exit 1
}
Write-Host ""

# [2/7] Vérifier la configuration du realm
Write-Host "[2/7] Vérifier la configuration du realm..." -ForegroundColor Yellow
if (Test-Path $REALM_FILE) {
    Write-Host "✅ Fichier realm trouvé" -ForegroundColor Green
    try {
        $realmJson = Get-Content $REALM_FILE | ConvertFrom-Json
        Write-Host "✅ JSON valide" -ForegroundColor Green
    } catch {
        Write-Host "❌ JSON invalide" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Fichier realm non trouvé: $REALM_FILE" -ForegroundColor Red
    exit 1
}
Write-Host ""

# [3/7] Vérifier les rôles définis
Write-Host "[3/7] Vérifier les rôles définis..." -ForegroundColor Yellow
$roles = $realmJson.roles.realm | ForEach-Object { $_.name }
Write-Host "Rôles trouvés:"
$roles | ForEach-Object { Write-Host "  - $_" }

$expectedRoles = @("ADMIN", "SUPPORT_MANAGER", "SUPPORT_AGENT", "CLIENT")
foreach ($role in $expectedRoles) {
    if ($roles -contains $role) {
        Write-Host "  ✅ $role" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $role MANQUANT" -ForegroundColor Red
    }
}
Write-Host ""

# [4/7] Vérifier les clients
Write-Host "[4/7] Vérifier les clients..." -ForegroundColor Yellow
$clients = $realmJson.clients | ForEach-Object { $_.clientId }
Write-Host "Clients trouvés:"
$clients | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

# [5/7] Vérifier la configuration frontend
Write-Host "[5/7] Vérifier la configuration frontend..." -ForegroundColor Yellow
$feClient = $realmJson.clients | Where-Object { $_.clientId -eq "supportflow-frontend" }
if (-not $feClient) {
    Write-Host "❌ Client 'supportflow-frontend' non trouvé" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Client supportflow-frontend trouvé" -ForegroundColor Green

Write-Host "Redirect URIs:"
$feClient.redirectUris | ForEach-Object { Write-Host "  - $_" }

Write-Host "Web Origins:"
$feClient.webOrigins | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

# [6/7] Vérifier les users
Write-Host "[6/7] Vérifier les users..." -ForegroundColor Yellow
$users = $realmJson.users | ForEach-Object { $_.username }
Write-Host "Users trouvés:"
$users | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

# [7/7] Vérifier le token endpoint
Write-Host "[7/7] Vérifier le token endpoint..." -ForegroundColor Yellow
$tokenEndpoint = "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token"
try {
    $response = Invoke-WebRequest -Uri $tokenEndpoint -Method Options -TimeoutSec 5
    Write-Host "✅ Token endpoint accessible: $tokenEndpoint" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Token endpoint non testable en OPTIONS, sera testé à l'étape D3" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ DIAGNOSTIC KEYCLOAK COMPLET" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaine étape: D3 — Authentification avec curl" -ForegroundColor Cyan
