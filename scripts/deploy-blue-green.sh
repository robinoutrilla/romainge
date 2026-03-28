#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy-blue-green.sh — Blue-green deployment with Vercel previews
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./scripts/deploy-blue-green.sh frontend    # Deploy frontend
#   ./scripts/deploy-blue-green.sh backend     # Deploy backend
#   ./scripts/deploy-blue-green.sh all         # Deploy both
#
# Requirements:
#   - Vercel CLI installed (npm i -g vercel)
#   - VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID env vars
#   - curl for health check

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

COMPONENT=${1:-all}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-30}
HEALTH_RETRIES=${HEALTH_RETRIES:-5}

# ─── Health check function ────────────────────────────────────
check_health() {
  local url=$1
  local retries=$HEALTH_RETRIES

  log "Running health check on $url ..."
  for i in $(seq 1 $retries); do
    if curl -sf --max-time $HEALTH_TIMEOUT "$url" > /dev/null 2>&1; then
      ok "Health check passed ($i/$retries)"
      return 0
    fi
    warn "Health check attempt $i/$retries failed, retrying in 5s..."
    sleep 5
  done
  return 1
}

# ─── Deploy to Vercel preview (blue) ─────────────────────────
deploy_preview() {
  local dir=$1
  local name=$2

  log "Deploying $name to Vercel preview (blue)..."
  cd "$dir"

  # Deploy to preview (not production)
  PREVIEW_URL=$(vercel deploy --yes 2>&1 | tail -1)

  if [ -z "$PREVIEW_URL" ]; then
    fail "Failed to get preview URL for $name"
  fi

  ok "Preview deployed: $PREVIEW_URL"
  echo "$PREVIEW_URL"
}

# ─── Promote preview to production (green) ────────────────────
promote_to_production() {
  local dir=$1
  local name=$2
  local preview_url=$3

  log "Promoting $name to production (green)..."
  cd "$dir"

  vercel promote "$preview_url" --yes 2>&1
  ok "$name promoted to production!"
}

# ─── Rollback to previous deployment ─────────────────────────
rollback() {
  local dir=$1
  local name=$2

  warn "Rolling back $name to previous deployment..."
  cd "$dir"

  # List last 2 deployments and rollback to previous
  PREV_URL=$(vercel ls --json 2>/dev/null | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const deployments = data.filter(d => d.state === 'READY').sort((a,b) => b.created - a.created);
    if (deployments.length > 1) console.log(deployments[1].url);
  " 2>/dev/null || echo "")

  if [ -n "$PREV_URL" ]; then
    vercel promote "https://$PREV_URL" --yes 2>&1
    ok "Rolled back $name to $PREV_URL"
  else
    fail "No previous deployment found for rollback"
  fi
}

# ─── Deploy Frontend ──────────────────────────────────────────
deploy_frontend() {
  local ROOT_DIR
  ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

  log "═══ Frontend Blue-Green Deploy ═══"

  # Step 1: Deploy to preview (blue)
  PREVIEW_URL=$(deploy_preview "$ROOT_DIR/frontend" "frontend")

  # Step 2: Health check on preview
  if check_health "$PREVIEW_URL"; then
    ok "Preview health check passed"
  else
    fail "Preview health check failed — NOT promoting to production"
  fi

  # Step 3: Promote to production (green)
  promote_to_production "$ROOT_DIR/frontend" "frontend" "$PREVIEW_URL"

  ok "Frontend blue-green deploy complete!"
  echo ""
  echo "  Preview URL:    $PREVIEW_URL"
  echo "  Production URL: https://romainge.com"
}

# ─── Deploy Backend ───────────────────────────────────────────
deploy_backend() {
  local ROOT_DIR
  ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

  log "═══ Backend Blue-Green Deploy ═══"

  # Step 1: Deploy to preview (blue)
  PREVIEW_URL=$(deploy_preview "$ROOT_DIR/backend" "backend")

  # Step 2: Health check on preview
  HEALTH_URL="${PREVIEW_URL}/api/health"
  if check_health "$HEALTH_URL"; then
    # Verify services are responding
    HEALTH_STATUS=$(curl -sf "$HEALTH_URL" | node -e "
      const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      console.log(data.status);
    " 2>/dev/null || echo "error")

    if [ "$HEALTH_STATUS" = "ok" ] || [ "$HEALTH_STATUS" = "degraded" ]; then
      ok "Backend health: $HEALTH_STATUS"
    else
      fail "Backend health check returned: $HEALTH_STATUS"
    fi
  else
    fail "Backend preview health check failed — NOT promoting"
  fi

  # Step 3: Promote to production (green)
  promote_to_production "$ROOT_DIR/backend" "backend" "$PREVIEW_URL"

  ok "Backend blue-green deploy complete!"
  echo ""
  echo "  Preview URL:    $PREVIEW_URL"
  echo "  Production URL: https://api.romainge.com"
}

# ─── Main ─────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  🚀 RomainGE Blue-Green Deployment           ║"
echo "║  Component: $COMPONENT                        "
echo "╚═══════════════════════════════════════════════╝"
echo ""

case "$COMPONENT" in
  frontend)
    deploy_frontend
    ;;
  backend)
    deploy_backend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  rollback-frontend)
    ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    rollback "$ROOT_DIR/frontend" "frontend"
    ;;
  rollback-backend)
    ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    rollback "$ROOT_DIR/backend" "backend"
    ;;
  *)
    echo "Usage: $0 {frontend|backend|all|rollback-frontend|rollback-backend}"
    exit 1
    ;;
esac

echo ""
ok "Deployment complete! 🎉"
