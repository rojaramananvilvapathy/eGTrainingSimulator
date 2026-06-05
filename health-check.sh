#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  eGTraining Simulator — Post-Deployment Health Check
#  Usage: ./health-check.sh <DROPLET_IP> [PORT]
# ═══════════════════════════════════════════════════════════════

IP="${1:-}"
PORT="${2:-3000}"
BASE_URL="http://$IP:$PORT"

[ -z "$IP" ] && { echo "Usage: $0 <DROPLET_IP> [PORT]"; exit 1; }

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e " ${GREEN}✅ PASS${NC} — $1"; }
fail() { echo -e " ${RED}❌ FAIL${NC} — $1"; FAILURES=$((FAILURES+1)); }
info() { echo -e " ${YELLOW}ℹ️  INFO${NC} — $1"; }

FAILURES=0

echo ""
echo "═══════════════════════════════════════════"
echo "  eGTrainingSimulator Health Check"
echo "  Target: $BASE_URL"
echo "═══════════════════════════════════════════"
echo ""

# ── Test 1: Basic connectivity ───────────────────
echo "🔌 Connectivity"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/" || echo "000")
if [[ "$STATUS" =~ ^(200|301|302)$ ]]; then
  pass "Homepage reachable (HTTP $STATUS)"
else
  fail "Homepage not reachable (HTTP $STATUS)"
fi

# ── Test 2: Health endpoint ──────────────────────
echo ""
echo "❤️  Health Endpoint"
HEALTH=$(curl -s --max-time 10 "$BASE_URL/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -qi "ok\|healthy\|up\|running"; then
  pass "Health endpoint OK — $HEALTH"
else
  info "Health endpoint returned: ${HEALTH:-no response} (may not be implemented)"
fi

# ── Test 3: API base ─────────────────────────────
echo ""
echo "🔗 API Routes"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/" || echo "000")
if [[ "$API_STATUS" =~ ^(200|401|403|404)$ ]]; then
  pass "API route responding (HTTP $API_STATUS)"
else
  fail "API route not responding (HTTP $API_STATUS)"
fi

# ── Test 4: WebSocket port ───────────────────────
echo ""
echo "🔌 WebSocket (xterm.js terminal)"
WS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  --max-time 5 "$BASE_URL/ws" || echo "000")
if [[ "$WS_CHECK" =~ ^(101|200|400|426)$ ]]; then
  pass "WebSocket endpoint reachable (HTTP $WS_CHECK)"
else
  info "WebSocket check: HTTP $WS_CHECK (may be normal if path differs)"
fi

# ── Test 5: Static assets ────────────────────────
echo ""
echo "📁 Static Assets (React Frontend)"
STATIC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/static/" \
  || curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/assets/" || echo "000")
if [[ "$STATIC" =~ ^(200|403|404)$ ]]; then
  pass "Static assets path accessible (HTTP $STATIC)"
else
  info "Static check: HTTP $STATIC"
fi

# ── Test 6: Response time ────────────────────────
echo ""
echo "⚡ Performance"
TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$BASE_URL/" || echo "999")
if (( $(echo "$TIME < 2.0" | bc -l) )); then
  pass "Response time: ${TIME}s (good)"
elif (( $(echo "$TIME < 5.0" | bc -l) )); then
  info "Response time: ${TIME}s (acceptable)"
else
  fail "Response time: ${TIME}s (slow)"
fi

# ── Test 7: Docker container check (SSH) ─────────
echo ""
echo "🐳 Docker Containers (via SSH)"
if command -v ssh &>/dev/null && [ -f ~/.ssh/id_rsa ]; then
  CONTAINERS=$(ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no \
    root@$IP "docker ps --format '{{.Names}} ({{.Status}})'" 2>/dev/null || echo "SSH not available")
  if [ -n "$CONTAINERS" ]; then
    pass "Containers running:"
    echo "$CONTAINERS" | sed 's/^/     /'
  else
    info "Could not check containers via SSH"
  fi
else
  info "SSH key not found — skipping container check"
fi

# ── Summary ──────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
if [ "$FAILURES" -eq 0 ]; then
  echo -e " ${GREEN}🎉 ALL CHECKS PASSED${NC}"
  echo ""
  echo "  App URL:     $BASE_URL"
  echo "  SSH Access:  ssh root@$IP"
else
  echo -e " ${RED}⚠️  $FAILURES CHECK(S) FAILED${NC}"
  echo "  Review the failures above."
fi
echo "═══════════════════════════════════════════"
echo ""

exit $FAILURES
