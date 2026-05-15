#!/bin/bash
# D1_DIAGNOSTIC_KEYCLOAK.sh
# Diagnostic complet pour vérifier Keycloak

echo "========================================"
echo "D1 — DIAGNOSTIC KEYCLOAK"
echo "========================================"
echo ""

# Configuration
KEYCLOAK_URL="http://localhost:8080"
REALM="supportflow"
REALM_FILE="keycloak/supportflow-realm.json"

echo "[1/7] Vérifier si Keycloak est accessible..."
if curl -s "$KEYCLOAK_URL/realms/$REALM" > /dev/null 2>&1; then
    echo "✅ Keycloak est accessible"
else
    echo "❌ Keycloak n'est pas accessible sur $KEYCLOAK_URL"
    echo "   Solution: Démarrer Keycloak avec docker ou java directement"
    exit 1
fi
echo ""

echo "[2/7] Vérifier la configuration du realm..."
if [ -f "$REALM_FILE" ]; then
    echo "✅ Fichier realm trouvé"
    if jq . "$REALM_FILE" > /dev/null 2>&1; then
        echo "✅ JSON valide"
    else
        echo "❌ JSON invalide"
        exit 1
    fi
else
    echo "❌ Fichier realm non trouvé: $REALM_FILE"
    exit 1
fi
echo ""

echo "[3/7] Vérifier les rôles définis..."
ROLES=$(jq -r '.roles.realm[] | .name' "$REALM_FILE")
echo "Rôles trouvés:"
echo "$ROLES" | sed 's/^/  - /'
EXPECTED_ROLES="ADMIN SUPPORT_MANAGER SUPPORT_AGENT CLIENT"
for role in $EXPECTED_ROLES; do
    if echo "$ROLES" | grep -q "^$role$"; then
        echo "  ✅ $role"
    else
        echo "  ❌ $role MANQUANT"
    fi
done
echo ""

echo "[4/7] Vérifier les clients..."
CLIENTS=$(jq -r '.clients[] | .clientId' "$REALM_FILE")
echo "Clients trouvés:"
echo "$CLIENTS" | sed 's/^/  - /'
echo ""

echo "[5/7] Vérifier la configuration frontend..."
FE_CLIENT=$(jq '.clients[] | select(.clientId=="supportflow-frontend")' "$REALM_FILE")
if [ -z "$FE_CLIENT" ]; then
    echo "❌ Client 'supportflow-frontend' non trouvé"
    exit 1
fi
echo "✅ Client supportflow-frontend trouvé"

REDIRECT_URIS=$(echo "$FE_CLIENT" | jq -r '.redirectUris[]')
echo "Redirect URIs:"
echo "$REDIRECT_URIS" | sed 's/^/  - /'

WEB_ORIGINS=$(echo "$FE_CLIENT" | jq -r '.webOrigins[]')
echo "Web Origins:"
echo "$WEB_ORIGINS" | sed 's/^/  - /'
echo ""

echo "[6/7] Vérifier les users..."
USERS=$(jq -r '.users[] | .username' "$REALM_FILE")
echo "Users trouvés:"
echo "$USERS" | sed 's/^/  - /'
echo ""

echo "[7/7] Vérifier le token endpoint..."
TOKEN_ENDPOINT="$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token"
if curl -s "$TOKEN_ENDPOINT" -X OPTIONS > /dev/null 2>&1; then
    echo "✅ Token endpoint accessible: $TOKEN_ENDPOINT"
else
    echo "⚠️  Token endpoint non testable en OPTIONS, va être testé à l'étape D3"
fi
echo ""

echo "========================================"
echo "✅ DIAGNOSTIC KEYCLOAK COMPLET"
echo "========================================"
echo ""
echo "Prochaine étape: D3 — Authentification avec curl"
