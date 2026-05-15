# D3_TEST_CURL_KEYCLOAK.ps1
# Test end-to-end Keycloak: obtenir token et appeler API

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "D3 — TEST KEYCLOAK END-TO-END" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$KEYCLOAK_URL = "http://localhost:8080"
$REALM = "supportflow"
$BACKEND_URL = "http://localhost:8081"
$CLIENT_ID = "supportflow-frontend"
$USERNAME = "client1"
$PASSWORD = "password"

# [1/4] Récupérer token JWT
Write-Host "[1/4] Récupérer token JWT..." -ForegroundColor Yellow

$tokenEndpoint = "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token"
$body = @{
    grant_type = "password"
    client_id = $CLIENT_ID
    username = $USERNAME
    password = $PASSWORD
    scope = "openid profile email roles"
} | ConvertTo-Json

try {
    $tokenResponse = Invoke-WebRequest -Uri $tokenEndpoint -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body ([System.Web.HttpUtility]::UrlEncode((ConvertTo-Json $(@{
            grant_type = "password"
            client_id = $CLIENT_ID
            username = $USERNAME
            password = $PASSWORD
            scope = "openid profile email roles"
        })))) `
        -TimeoutSec 10
    
    $tokenData = $tokenResponse.Content | ConvertFrom-Json
    $TOKEN = $tokenData.access_token
    
    if ([string]::IsNullOrEmpty($TOKEN)) {
        Write-Host "❌ Impossible d'extraire access_token" -ForegroundColor Red
        Write-Host "Response: $($tokenResponse.Content)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Token obtenu (length: $($TOKEN.Length))" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la requête Keycloak" -ForegroundColor Red
    Write-Host "Détails: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# [2/4] Décoder le token JWT
Write-Host "[2/4] Décoder le token JWT..." -ForegroundColor Yellow
try {
    $parts = $TOKEN -split '\.'
    $payload = $parts[1]
    
    # Ajouter le padding base64 si nécessaire
    while ($payload.Length % 4 -ne 0) {
        $payload += "="
    }
    
    $bytes = [System.Convert]::FromBase64String($payload)
    $decodedString = [System.Text.Encoding]::UTF8.GetString($bytes)
    $decoded = $decodedString | ConvertFrom-Json
    
    Write-Host "✅ JWT Payload décodé:" -ForegroundColor Green
    Write-Host ($decoded | ConvertTo-Json -Depth 10)
    
    # Extraire rôles
    $roles = $decoded."realm_access"."roles"
    if ($roles) {
        Write-Host ""
        Write-Host "Rôles dans le token:"
        $roles | ForEach-Object { Write-Host "  - $_" }
    } else {
        Write-Host "⚠️  Aucun rôle trouvé dans realm_access" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Impossible de décoder le JWT payload" -ForegroundColor Yellow
    Write-Host "Détails: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# [3/4] Tester endpoint backend avec token
Write-Host "[3/4] Tester endpoint backend avec token..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/tickets" -Headers $headers -Method Get -TimeoutSec 10
    $HTTP_CODE = $response.StatusCode
    Write-Host "HTTP Status: $HTTP_CODE" -ForegroundColor Green
    Write-Host "✅ Endpoint /api/tickets accessible (200 OK)" -ForegroundColor Green
    Write-Host "Response preview:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Select-Object -First 20
} catch {
    $HTTP_CODE = $_.Exception.Response.StatusCode.Value__
    Write-Host "HTTP Status: $HTTP_CODE"
    
    if ($HTTP_CODE -eq 401) {
        Write-Host "❌ Unauthorized (401) — Token invalide ou expiré" -ForegroundColor Red
    } elseif ($HTTP_CODE -eq 403) {
        Write-Host "⚠️  Forbidden (403) — Token valide mais utilisateur non autorisé" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  HTTP $HTTP_CODE — Endpoint peut être indisponible" -ForegroundColor Yellow
    }
    
    try {
        Write-Host "Response: $($_.Exception.Response | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    } catch {}
}
Write-Host ""

# [4/4] Résumé
Write-Host "[4/4] Résumé..." -ForegroundColor Yellow
Write-Host ""

if ($HTTP_CODE -eq 200) {
    Write-Host "✅ KEYCLOAK CONFIGURATION OK" -ForegroundColor Green
    Write-Host "   - Token obtenu avec succès"
    Write-Host "   - Endpoint backend accessible"
    Write-Host "   - Authentification fonctionnelle"
    Write-Host ""
    Write-Host "Prochaine étape: D4 — Test Camunda" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  KEYCLOAK PARTIELLEMENT FONCTIONNEL" -ForegroundColor Yellow
    Write-Host "   - Token obtenu"
    Write-Host "   - Endpoint backend: HTTP $HTTP_CODE"
    Write-Host ""
    Write-Host "Diagnostic:" -ForegroundColor Yellow
    if ($HTTP_CODE -eq 400 -or $HTTP_CODE -eq 404) {
        Write-Host "   → Backend peut être arrêté ou mal configuré"
        Write-Host "   → Vérifier que Spring Boot démarre: 'mvn spring-boot:run' ou jar" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Token (usage debug):" -ForegroundColor DarkGray
Write-Host $TOKEN -ForegroundColor DarkGray
