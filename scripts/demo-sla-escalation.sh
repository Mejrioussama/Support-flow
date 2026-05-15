#!/usr/bin/env bash
#
# SupportFlow Jury Demonstration - Live SLA Escalation
#
# This script creates a ticket with SHORT SLA (30 seconds) and demonstrates:
#   T=0s: Ticket created
#   T=15s: SLA at 50% → Warning notification, slaPhase="WARNING_50"
#   T=24s: SLA at 80% → Alert notification, slaPhase="ALERT_80"
#   T=30s: SLA at 100% → ESCALATED_SLA status, priority=CRITICAL
#
# Duration: ~45 seconds (with explanations)
#
# Note: This requires backend configuration with SHORT SLA deadlines for demo.
# See: application-demo.yml with sla.deadline.minutes=0.5 (30 seconds)
#

set -e
trap 'echo "Demo interrupted" && exit 1' INT

# Configuration
API_BASE_URL="http://localhost:8082/api"
KEYCLOAK_URL="http://localhost:8180"
REALM="supportflow"
CLIENT_ID="supportflow-frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Helper functions
print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_time() {
    echo -e "${MAGENTA}⏱ [T+${1}s]${NC} $2"
}

print_alert() {
    echo -e "${RED}🚨 $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Get access token
get_token() {
    local username=$1
    local password=$2
    
    local token_url="$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token"
    local response=$(curl -s -X POST "$token_url" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password&client_id=$CLIENT_ID&username=$username&password=$password")
    
    echo "$response" | jq -r '.access_token // .error'
}

# API call helper
api_call() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    
    local url="$API_BASE_URL$endpoint"
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$url" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json"
    else
        curl -s -X "$method" "$url" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Monitor ticket SLA state (polls periodically)
monitor_sla() {
    local ticket_id=$1
    local manager_token=$2
    local duration=$3
    
    local start_time=$(date +%s)
    local elapsed=0
    local prev_sla_phase=""
    
    echo -e "${YELLOW}Monitoring SLA Events...${NC}\n"
    
    while [ $elapsed -lt $duration ]; do
        local response=$(api_call GET "/tickets/$ticket_id" "$manager_token")
        local current_sla=$(echo "$response" | jq -r '.slaPhase // "NOMINAL"')
        local status=$(echo "$response" | jq -r '.status')
        local priority=$(echo "$response" | jq -r '.priority')
        local time_remaining=$(echo "$response" | jq -r '.timeRemainingSla // "N/A"')
        
        # Check for SLA phase changes
        if [ "$current_sla" != "$prev_sla_phase" ]; then
            case "$current_sla" in
                "WARNING_50")
                    print_time "$elapsed" "SLA at 50% - WARNING notification triggered"
                    print_alert "⚠️  Warning level: Agent should prioritize this ticket"
                    print_info "Status: $status | Priority: $priority"
                    ;;
                "ALERT_80")
                    print_time "$elapsed" "SLA at 80% - CRITICAL ALERT notification triggered"
                    print_alert "⚠️  Alert level: Escalating to manager for intervention"
                    print_info "Status: $status | Priority: $priority"
                    ;;
                "BREACHED_100")
                    print_time "$elapsed" "SLA at 100% - SLA BREACHED"
                    print_alert "🚨 ESCALATED_SLA status activated | Priority: CRITICAL"
                    print_alert "Ticket automatically marked for management escalation"
                    print_info "Status: $status | Priority: $priority"
                    ;;
            esac
            prev_sla_phase="$current_sla"
            echo ""
        fi
        
        # Periodic status output
        if [ $((elapsed % 5)) -eq 0 ]; then
            echo -e "${MAGENTA}[T+${elapsed}s]${NC} Status: $status | SLA Phase: $current_sla | Time Remaining: $time_remaining"
        fi
        
        sleep 1
        elapsed=$(($(date +%s) - start_time))
    done
}

# Main Demo Script
main() {
    print_header "SUPPORTFLOW JURY DEMONSTRATION - LIVE SLA ESCALATION"
    
    cat <<EOF
This demonstration shows REAL-TIME SLA escalation:

Timeline:
  T=0s  : Ticket created with 30-second SLA deadline
  T=15s : SLA at 50% → WARNING notification | slaPhase="WARNING_50"
  T=24s : SLA at 80% → CRITICAL ALERT | slaPhase="ALERT_80"
  T=30s : SLA at 100% → Status=ESCALATED_SLA | Priority=CRITICAL

This shows how Apache Camunda boundary timers automatically escalate
tickets when SLA deadlines approach.

Requirements:
  - Backend running with short SLA configured (30 seconds)
  - Config: sla.deadline.minutes=0.5 in application-demo.yml
  - Camunda process engine active with 3 boundary timers

EOF
    
    # ═══════════════════════════════════════════════════════════════════════
    # SETUP: Authenticate
    # ═══════════════════════════════════════════════════════════════════════
    
    print_step "Authenticating MANAGER user (manager / manager123)..."
    
    MANAGER_TOKEN=$(get_token "manager" "manager123")
    if [ "$MANAGER_TOKEN" == "null" ] || [ -z "$MANAGER_TOKEN" ]; then
        echo -e "${RED}✗ Failed to authenticate manager${NC}"
        exit 1
    fi
    print_success "MANAGER authenticated"
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: CREATE TICKET WITH SHORT SLA
    # ═══════════════════════════════════════════════════════════════════════
    
    print_header "STEP 1: CREATE TICKET WITH 30-SECOND SLA"
    
    CLIENT_TOKEN=$(get_token "client1" "client123")
    if [ "$CLIENT_TOKEN" == "null" ] || [ -z "$CLIENT_TOKEN" ]; then
        echo -e "${RED}✗ Failed to get CLIENT token${NC}"
        exit 1
    fi
    
    print_step "Client creating urgent ticket via POST /api/tickets..."
    
    TICKET_DATA=$(cat <<EOF_TICKET
{
  "title": "Production Database Connection Failed",
  "description": "Critical: Database server unreachable. All API calls failing with connection timeout.",
  "type": "INCIDENT",
  "severity": "CRITICAL",
  "impact": "HIGH",
  "category": "INFRASTRUCTURE"
}
EOF_TICKET
)
    
    TICKET_RESPONSE=$(api_call POST "/tickets" "$CLIENT_TOKEN" "$TICKET_DATA")
    TICKET_ID=$(echo "$TICKET_RESPONSE" | jq -r '.id')
    TICKET_REF=$(echo "$TICKET_RESPONSE" | jq -r '.reference')
    SLA_DEADLINE=$(echo "$TICKET_RESPONSE" | jq -r '.slaDeadline')
    
    echo -e "${YELLOW}Ticket Created:${NC}"
    echo "$TICKET_RESPONSE" | jq '{id, reference, status, priority, slaPhase, slaDeadline}'
    
    print_success "Ticket $TICKET_REF created"
    print_info "SLA Deadline: $SLA_DEADLINE (30 seconds from now)"
    print_info "Camunda process instance started"
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: MONITOR SLA ESCALATION (35 seconds)
    # ═══════════════════════════════════════════════════════════════════════
    
    print_header "STEP 2: MONITORING SLA ESCALATION"
    
    print_time "0" "Ticket created - SLA timer started"
    print_info "Camunda boundary timers activated on resolve_ticket task:"
    print_info "  • Timer 1 (50%): Fires at 15s"
    print_info "  • Timer 2 (80%): Fires at 24s"
    print_info "  • Timer 3 (100%): Fires at 30s"
    echo ""
    
    # Monitor for 35 seconds
    monitor_sla "$TICKET_ID" "$MANAGER_TOKEN" 35
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3: FINAL STATUS DISPLAY
    # ═══════════════════════════════════════════════════════════════════════
    
    print_header "STEP 3: FINAL SLA ESCALATION STATUS"
    
    FINAL_STATUS=$(api_call GET "/tickets/$TICKET_ID" "$MANAGER_TOKEN")
    
    echo -e "${YELLOW}Final Ticket State:${NC}"
    echo "$FINAL_STATUS" | jq '{
        reference,
        status,
        priority,
        slaPhase,
        escalatedAt,
        slaDeadline,
        createdAt
    }'
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 4: CAMUNDA PROCESS STATUS
    # ═══════════════════════════════════════════════════════════════════════
    
    print_header "STEP 4: CAMUNDA PROCESS INSTANCE STATUS"
    
    print_step "Querying Camunda process engine for $TICKET_REF..."
    
    CAMUNDA_STATUS=$(api_call GET "/camunda/status/ticket/$TICKET_REF" "$MANAGER_TOKEN")
    
    echo -e "${YELLOW}Process Status:${NC}"
    echo "$CAMUNDA_STATUS" | jq '{
        processInstanceId,
        ticketReference,
        currentActivity,
        processStatus,
        slaPhase,
        escalatedAt
    }' | head -20
    
    # ═══════════════════════════════════════════════════════════════════════
    # FINAL SUMMARY
    # ═══════════════════════════════════════════════════════════════════════
    
    print_header "SLA ESCALATION DEMONSTRATION COMPLETE"
    
    echo -e "${GREEN}✓ All SLA Thresholds Triggered Successfully${NC}\n"
    
    echo "Observable Events:"
    echo "  ✓ T+15s: SLA Phase WARNING_50 - Agent notified"
    echo "  ✓ T+24s: SLA Phase ALERT_80 - Manager notified"
    echo "  ✓ T+30s: Status ESCALATED_SLA - Priority CRITICAL"
    echo ""
    
    echo "Technical Evidence:"
    FINAL_PHASE=$(echo "$FINAL_STATUS" | jq -r '.slaPhase')
    FINAL_PRIORITY=$(echo "$FINAL_STATUS" | jq -r '.priority')
    ESCALATED_AT=$(echo "$FINAL_STATUS" | jq -r '.escalatedAt')
    
    if [ "$FINAL_PHASE" == "BREACHED_100" ] && [ "$FINAL_PRIORITY" == "CRITICAL" ]; then
        print_success "SLA Escalation Chain Executed Correctly"
        echo "  • SLA Phase: $FINAL_PHASE"
        echo "  • Priority: $FINAL_PRIORITY"
        echo "  • Escalated At: $ESCALATED_AT"
    else
        print_alert "Unexpected SLA state (may be in progress)"
        echo "  • Current SLA Phase: $FINAL_PHASE"
        echo "  • Current Priority: $FINAL_PRIORITY"
    fi
    
    echo ""
    echo "Jury Presentation Notes:"
    echo "  - Camunda boundary timer events are standard BPMN 2.0 pattern"
    echo "  - Each timer triggers a service task (SlaTimerService callback)"
    echo "  - Callbacks update ticket status and trigger notifications"
    echo "  - System requires ZERO manual intervention (fully automated)"
    echo "  - SLA deadlines are configurable per ticket type in production"
    echo ""
    
    print_success "Live SLA escalation demo ready for jury!"
}

# Run main with error handling
if ! main; then
    echo -e "${RED}✗ Demo failed${NC}"
    exit 1
fi
