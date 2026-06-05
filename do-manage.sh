#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  eGTraining Simulator — DigitalOcean Droplet Manager
#  Usage: ./do-manage.sh [create|destroy|recreate|status|ip]
#  Requires: doctl authenticated with your DO API token
# ═══════════════════════════════════════════════════════════════

set -e

# ── Config ───────────────────────────────────────────────────
DROPLET_NAME="egtraining-sim001-2vcpu-4gb-amd-blr1"
REGION="blr1"
SIZE="s-2vcpu-4gb-amd"
IMAGE="docker-20-04"          # Docker on Ubuntu 22.04
TAG="egtraining"
# SSH key fingerprint from: doctl compute ssh-key list
SSH_KEY_FINGERPRINT="${DO_SSH_KEY_FINGERPRINT:-}"
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

check_doctl() {
  command -v doctl &>/dev/null || err "doctl not installed. Run: brew install doctl OR snap install doctl"
  doctl account get &>/dev/null || err "doctl not authenticated. Run: doctl auth init"
}

get_droplet_id() {
  doctl compute droplet list --format ID,Name --no-header \
    | grep "$DROPLET_NAME" | awk '{print $1}'
}

get_droplet_ip() {
  doctl compute droplet list --format Name,PublicIPv4 --no-header \
    | grep "$DROPLET_NAME" | awk '{print $2}'
}

create_droplet() {
  log "Checking if droplet already exists..."
  EXISTING_ID=$(get_droplet_id)

  if [ -n "$EXISTING_ID" ]; then
    warn "Droplet already exists (ID: $EXISTING_ID)"
    IP=$(get_droplet_ip)
    ok "Current IP: $IP"
    return 0
  fi

  if [ -z "$SSH_KEY_FINGERPRINT" ]; then
    log "Available SSH keys:"
    doctl compute ssh-key list
    err "Set DO_SSH_KEY_FINGERPRINT env var with the fingerprint above"
  fi

  log "Creating droplet: $DROPLET_NAME..."
  log "Region: $REGION | Size: $SIZE | Image: $IMAGE"

  doctl compute droplet create "$DROPLET_NAME" \
    --region "$REGION" \
    --size "$SIZE" \
    --image "$IMAGE" \
    --ssh-keys "$SSH_KEY_FINGERPRINT" \
    --tag-names "$TAG,ci-managed" \
    --wait

  log "Waiting 30s for droplet to initialize..."
  sleep 30

  IP=$(get_droplet_ip)
  ok "Droplet created! IP: $IP"
  echo ""
  log "📋 Next steps:"
  echo "  1. Add this IP to your GitHub secret: DO_DROPLET_IP=$IP"
  echo "  2. Run: ssh root@$IP"
  echo "  3. OR push to main branch to trigger auto-deploy"
}

destroy_droplet() {
  DROPLET_ID=$(get_droplet_id)

  if [ -z "$DROPLET_ID" ]; then
    warn "No droplet found named: $DROPLET_NAME"
    return 0
  fi

  IP=$(get_droplet_ip)
  warn "About to DESTROY droplet: $DROPLET_NAME (ID: $DROPLET_ID, IP: $IP)"
  echo -n "Are you sure? (yes/no): "
  read -r CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    log "Cancelled."
    return 0
  fi

  log "Destroying droplet..."
  doctl compute droplet delete "$DROPLET_ID" --force
  ok "Droplet destroyed. DigitalOcean billing stopped. 💰"
}

recreate_droplet() {
  log "Recreating droplet (destroy + create)..."
  destroy_droplet
  sleep 5
  create_droplet
}

status_droplet() {
  log "Droplet status:"
  doctl compute droplet list --format ID,Name,Status,PublicIPv4,Region,Size \
    | grep -E "^ID|$DROPLET_NAME" || warn "Droplet not found: $DROPLET_NAME"
}

# ── Main ─────────────────────────────────────────────────────
check_doctl

case "${1:-help}" in
  create)   create_droplet ;;
  destroy)  destroy_droplet ;;
  recreate) recreate_droplet ;;
  status)   status_droplet ;;
  ip)
    IP=$(get_droplet_ip)
    [ -n "$IP" ] && echo "$IP" || echo "Droplet not running"
    ;;
  help|*)
    echo ""
    echo "  eGTraining Droplet Manager"
    echo ""
    echo "  Commands:"
    echo "    create    — Create the droplet"
    echo "    destroy   — Destroy the droplet (stops billing)"
    echo "    recreate  — Destroy + re-create fresh"
    echo "    status    — Show droplet status"
    echo "    ip        — Print droplet IP only"
    echo ""
    echo "  Setup:"
    echo "    export DO_SSH_KEY_FINGERPRINT=<your-fingerprint>"
    echo "    doctl auth init  # authenticate first"
    echo ""
    ;;
esac
