#!/bin/bash
# D4_TEST_SMOKE_CAMUNDA.sh
# Test Camunda: Create process instance et vérifier dans Cockpit

echo "========================================"
echo "D4 — TEST SMOKE CAMUNDA"
echo "========================================"
echo ""

BACKEND_URL="http://localhost:8081"
CAMUNDA_COCKPIT="http://localhost:8080/camunda/app/cockpit"
TICKET_ID="TKT-TEST-$(date +%s)"

echo "[1/5] Vérifier que le backend est accessible..."
HEALTH=$(curl -s -X GET "$BACKEND_URL/actuator/health" | jq .)
if echo "$HEALTH" | jq . > /dev/null 2>&1; then
    STATUS=$(echo "$HEALTH" | jq -r '.status // empty')
    if [ "$STATUS" = "UP" ]; then
        echo "✅ Backend est UP"
        echo "   $HEALTH" | jq .
    else
        echo "⚠️  Backend répond mais status: $STATUS"
        echo "   Vérifier les logs"
    fi
else
    echo "❌ Backend n'est pas accessible"
    echo "   Vérifier: 'mvn spring-boot:run' ou jar démarré sur port 8081"
    exit 1
fi
echo ""

echo "[2/5] Récupérer liste des processus déployés..."
PROCESSES=$(curl -s -X GET "$BACKEND_URL/api/camunda/processes")
if echo "$PROCESSES" | jq . > /dev/null 2>&1; then
    echo "✅ Endpoint /api/camunda/processes responsive"
    PROCESS_KEYS=$(echo "$PROCESSES" | jq -r '.[].key // empty')
    if [ -z "$PROCESS_KEYS" ]; then
        echo "⚠️  Aucun processus déployé"
        echo "   Vérifier: BPMN fichier uploadé et Spring Boot Camunda integration"
    else
        echo "Processus trouvés:"
        echo "$PROCESS_KEYS" | sed 's/^/  - /'
    fi
else
    echo "❌ Endpoint /api/camunda/processes indisponible (peut être pas d'endpoint?)"
    echo "   Sera testé avec curl manuel en D4"
fi
echo ""

echo "[3/5] Créer instance de processus..."
echo "   Ticket ID: $TICKET_ID"
POST_DATA='{
  "ticketId": "'$TICKET_ID'",
  "priority": "MEDIUM",
  "slaDeadline": "'$(date -d '+1 hour' -Iseconds 2>/dev/null || date -v+1H -Iseconds)'",
  "clientId": "user-test-123",
  "description": "Test ticket pour diagnostic Camunda"
}'

echo "   Payload:"
echo "$POST_DATA" | jq . | sed 's/^/     /'

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/camunda/start" \
  -H "Content-Type: application/json" \
  -d "$POST_DATA")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/camunda/start" \
  -H "Content-Type: application/json" \
  -d "$POST_DATA")

echo ""
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Instance créée (HTTP $HTTP_CODE)"
    INSTANCE_ID=$(echo "$RESPONSE" | jq -r '.processInstanceId // .id // empty')
    if [ -n "$INSTANCE_ID" ]; then
        echo "   ID instance: $INSTANCE_ID"
    fi
    echo "   Response:"
    echo "$RESPONSE" | jq . | sed 's/^/     /'
else
    echo "❌ Erreur création instance (HTTP $HTTP_CODE)"
    echo "   Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE" | sed 's/^/     /'
    exit 1
fi
echo ""

echo "[4/5] Vérifier dans Cockpit..."
echo "   URL: $CAMUNDA_COCKPIT"
echo ""
echo "   Instructions manuelles:"
echo "   1. Ouvrir: $CAMUNDA_COCKPIT"
echo "   2. Cliquer: 'Processes' → 'ticket-workflow'"
echo "   3. Chercher instance avec businessKey = $TICKET_ID"
echo "   4. Vérifier variables: ticketId, priority, slaDeadline"
echo ""

# Vérifier Cockpit accessible
if curl -s "$CAMUNDA_COCKPIT" | grep -q "Cockpit"; then
    echo "✅ Cockpit est accessible"
else
    echo "⚠️  Cockpit n'est pas accessible"
    echo "   Peut signifier: Backend pas encore compilé ou Camunda pas intégré"
fi
echo ""

echo "[5/5] Résumé..."
echo ""
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ CAMUNDA OK"
    echo "   - Backend accessible"
    echo "   - Instance créée avec succès"
    echo "   - Vérifier manuellement dans Cockpit"
else
    echo "❌ CAMUNDA KO"
    echo "   - Erreur création instance"
    echo "   - Diagnostic nécessaire sur Spring Boot"
fi

echo ""
echo "========================================"
echo "Ticket ID généré: $TICKET_ID"
echo "========================================"
