#!/usr/bin/env bash
set -euo pipefail

# Rollback Automatic Agent Platform to previous revision
#
# Usage: ./rollback.sh <environment> [revision]
#
# Examples:
#   ./rollback.sh staging
#   ./rollback.sh prod 3

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HELM_DIR="${PROJECT_ROOT}/deploy/helm/automatic-agent"

# Dry run
if [[ "${DRY_RUN:-false}" == "true" ]] || [[ "${1:-}" == "--dry-run" ]]; then
  echo "[DRY RUN] Would rollback automatic-agent with args: $@"
  exit 0
fi

ENVIRONMENT="${1:-}"
REVISION="${2:-0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage: $0 <environment> [revision]"
  echo ""
  echo "Arguments:"
  echo "  environment  Environment to rollback (dev, staging, prod)"
  echo "  revision     Helm revision to rollback to (default: 0 = previous)"
  exit 1
}

info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

if [[ -z "${ENVIRONMENT}" ]]; then
  error "Environment is required"
  usage
fi

if [[ ! "${ENVIRONMENT}" =~ ^(dev|staging|prod)$ ]]; then
  error "Environment must be one of: dev, staging, prod"
  usage
fi

NAMESPACE="automatic-agent-${ENVIRONMENT}"

info "Rolling back automatic-agent in ${ENVIRONMENT} to revision ${REVISION}"

if ! command -v helm &> /dev/null; then
  error "Helm is not installed"
  exit 1
fi

# Get current revision before rollback
CURRENT_REVISION=$(helm history automatic-agent \
  --namespace "${NAMESPACE}" \
  --output json 2>/dev/null | \
  jq -r '.[] | select(.status=="deployed") | .revision' 2>/dev/null || echo "unknown")

info "Current deployed revision: ${CURRENT_REVISION}"

# Execute rollback
helm_args=(
  "rollback"
  "automatic-agent"
  "${REVISION}"
  "--namespace"
  "${NAMESPACE}"
  "--wait"
  "--timeout"
  "5m"
)

set -x
helm "${helm_args[@]}"
set +x

# Wait for rollback to complete
kubectl rollout status deployment/automatic-agent \
  --namespace "${NAMESPACE}" \
  --timeout=300s

info "Rollback complete!"
info "Previous revision: ${CURRENT_REVISION}"
