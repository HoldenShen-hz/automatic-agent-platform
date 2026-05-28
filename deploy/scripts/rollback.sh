#!/usr/bin/env bash
set -euo pipefail

EXIT_USAGE=64
EXIT_DEPENDENCY=69
EXIT_ROLLBACK=70

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

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage: $0 <environment> [revision]"
  echo ""
  echo "Arguments:"
  echo "  environment  Environment to rollback (dev, test, staging, pre-prod, prod)"
  echo "  revision     Helm revision to rollback to (default: 0 = previous)"
  exit "${EXIT_USAGE}"
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

DRY_RUN_FLAG=0
POSITIONAL_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN_FLAG=1
    continue
  fi
  POSITIONAL_ARGS+=("$arg")
done
set -- "${POSITIONAL_ARGS[@]}"

ENVIRONMENT="${1:-}"
REVISION="${2:-0}"

if [[ -z "${ENVIRONMENT}" ]]; then
  error "Environment is required"
  usage
fi

if [[ "${DRY_RUN:-false}" == "true" ]] || [[ "${DRY_RUN_FLAG}" -eq 1 ]]; then
  echo "[DRY RUN] Would rollback automatic-agent"
  echo "  environment=${ENVIRONMENT}"
  echo "  revision=${REVISION}"
  exit 0
fi

if [[ ! "${ENVIRONMENT}" =~ ^(dev|test|staging|pre-prod|prod)$ ]]; then
  error "Environment must be one of: dev, test, staging, pre-prod, prod"
  usage
fi

NAMESPACE="automatic-agent-${ENVIRONMENT}"
if [[ "${ENVIRONMENT}" == "pre-prod" ]]; then
  NAMESPACE="automatic-agent-preprod"
fi

info "Rolling back automatic-agent in ${ENVIRONMENT} to revision ${REVISION}"

if ! command -v helm &> /dev/null; then
  error "Helm is not installed"
  exit "${EXIT_DEPENDENCY}"
fi

# Get current revision before rollback. jq equivalent: select(.status=="deployed")
CURRENT_REVISION=$(helm history automatic-agent \
  --namespace "${NAMESPACE}" \
  --output json 2>/dev/null | \
  node -e 'const rows=JSON.parse(require("fs").readFileSync(0,"utf8")); const deployed=rows.find((row)=>row.status==="deployed"); process.stdout.write(String(deployed?.revision ?? "unknown"));' \
  2>/dev/null || echo "unknown")

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
if ! kubectl rollout status deployment/automatic-agent \
  --namespace "${NAMESPACE}" \
  --timeout=300s; then
  error "Rollback rollout status failed"
  exit "${EXIT_ROLLBACK}"
fi

ENDPOINT_COUNT=$(kubectl get endpoints automatic-agent \
  --namespace "${NAMESPACE}" \
  --output jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | awk '{print NF}')
if [[ "${ENDPOINT_COUNT:-0}" -lt 1 ]]; then
  error "Rollback completed but automatic-agent has no ready endpoints"
  exit "${EXIT_ROLLBACK}"
fi

info "Rollback complete!"
info "Previous revision: ${CURRENT_REVISION}"
