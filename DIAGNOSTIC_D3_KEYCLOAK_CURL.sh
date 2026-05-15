#!/bin/bash
# D3_TEST_CURL_KEYCLOAK.sh
# Test end-to-end Keycloak: obtenir token et appeler API

echo "========================================"
echo "D3 — TEST KEYCLOAK END-TO-END"
echo "========================================"
echo ""

KEYCLOAK_URL="http://localhost:8080"
REALM="supportflow"
BACKEND_URL="http://localhost:8081"
CLIENT_ID="supportflow-frontend"
CLIENT_SECRET="supportflow-frontend-secret"

# Credentials de test (depuis realm JSON)
USERNAME="client1"
PASSWORD="password"

echo "[1/4] Récupérer token JWT..."
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "username=$USERNAME" \
  -d "password=$PASSWORD" \
  -d "scope=openid profile email roles")

if echo "$TOKEN_RESPONSE" | jq . > /dev/null 2>&1; then
    echo "✅ Token response valide (JSON)"
else
    echo "❌ Token response invalide"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ]; then
    echo "❌ Impossible d'extraire access_token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi
echo "✅ Token obtenu (length: ${#TOKEN})"
echo ""

# Décoder et afficher le token
echo "[2/4] Décoder le token JWT..."
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
# Padding base64
PADDING=$((${#PAYLOAD} % 4))
if [ $PADDING -ne 0 ]; then
    PADDING=$((4 - PADDING))
    PAYLOAD="${PAYLOAD}$(printf '%*s' $PADDING | tr ' ' '=')"
fi

DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null | jq .)
if [ $? -eq 0 ]; then
    echo "✅ JWT Payload décodé:"
    echo "$DECODED" | jq .
    
    # Extraire rôles
    ROLES=$(echo "$DECODED" | jq -r '.realm_access.roles[]? // empty')
    echo ""
    echo "Rôles dans le token:"
    if [ -z "$ROLES" ]; then
        echo "  ⚠️  Aucun rôle trouvé dans realm_access"
    else
        echo "$ROLES" | sed 's/^/  - /'
    fi
else
    echo "⚠️  Impossible de décoder le JWT payload (peut être encodé différemment)"
fi
echo ""

# Tester endpoint backend
echo "[3/4] Tester endpoint backend avec token..."
TICKETS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BACKEND_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN")

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Endpoint /api/tickets accessible (200 OK)"
    echo "Response preview:"
    echo "$TICKETS_RESPONSE" | jq . | head -20
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ Unauthorized (401) — Token invalide ou expiré"
    echo "Response: $TICKETS_RESPONSE"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "⚠️  Forbidden (403) — Token valide mais utilisateur non autorisé"
    echo "Response: $TICKETS_RESPONSE"
else
    echo "⚠️  HTTP $HTTP_CODE — Endpoint peut être indisponible"
    echo "Response: $TICKETS_RESPONSE"
fi
echo ""

# Résumé
echo "[4/4] Résumé..."
echo ""
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ KEYCLOAK CONFIGURATION OK"
    echo "   - Token obtenu avec succès"
    echo "   - Endpoint backend accessible"
    echo "   - Authentification fonctionnelle"
    echo ""
    echo "Prochaine étape: D4 — Test Camunda"
else
    echo "⚠️  KEYCLOAK PARTIELLEMENT FONCTIONNEL"
    echo "   - Token obtenu"
    echo "   - Endpoint backend: HTTP $HTTP_CODE"
    echo ""
    echo "Diagnostic:"
    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ]; then
        echo "   → Backend peut être arrêté ou mal configuré"
        echo "   → Vérifier que Spring Boot démarre: 'mvn spring-boot:run' ou jar"
    fi
fi

echo ""
echo "Token complet (à usage pour debug):"
echo "$TOKEN"
