#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HELM_DIR="${PROJECT_ROOT}/deploy/helm/automatic-agent"

# Dry run
if [[ "${DRY_RUN:-false}" == "true" ]] || [[ "${1:-}" == "--dry-run" ]]; then
  echo "[DRY RUN] Would deploy with args: $@"
  exit 0
fi

# Deploy Automatic Agent Platform to Kubernetes using Helm
#
# Usage: ./deploy.sh <environment> <image_tag> [rollout_strategy]
#
# Examples:
#   ./deploy.sh dev abc1234 rolling
#   ./deploy.sh staging v1.2.3 canary
#   ./deploy.sh prod v1.2.3 blue_green

# Default values
ENVIRONMENT="${1:-}"
IMAGE_TAG="${2:-}"
ROLLOUT_STRATEGY="${3:-rolling}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
  echo "Usage: $0 <environment> <image_tag> [rollout_strategy]"
  echo ""
  echo "Arguments:"
  echo "  environment      Environment to deploy to (dev, test, staging, pre-prod, prod)"
  echo "  image_tag        Docker image tag to deploy"
  echo "  rollout_strategy Rollout strategy (rolling, canary, blue_green) - default: rolling"
  echo ""
  echo "Environment variables:"
  echo "  AA_DEPLOY_DOMAIN Required for prod; optional override for other ingress-enabled environments"
  echo ""
  echo "Examples:"
  echo "  $0 dev abc1234 rolling"
  echo "  $0 staging v1.2.3 canary"
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

# Validate inputs
if [[ -z "${ENVIRONMENT}" ]] || [[ -z "${IMAGE_TAG}" ]]; then
  error "Environment and image tag are required"
  usage
fi

if [[ ! "${ENVIRONMENT}" =~ ^(dev|test|staging|pre-prod|prod)$ ]]; then
  error "Environment must be one of: dev, test, staging, pre-prod, prod"
  usage
fi

if [[ ! "${ROLLOUT_STRATEGY}" =~ ^(rolling|canary|blue_green)$ ]]; then
  error "Rollout strategy must be one of: rolling, canary, blue_green"
  usage
fi

# Determine namespace
NAMESPACE="automatic-agent-${ENVIRONMENT}"
DEPLOY_DOMAIN="${AA_DEPLOY_DOMAIN:-}"

# Production deployment guard
if [[ "${ENVIRONMENT}" == "prod" ]]; then
  if [[ -z "${DEPLOY_DOMAIN}" ]]; then
    error "AA_DEPLOY_DOMAIN must be set for production deployments"
    exit 1
  fi
  echo ""
  echo -e "${RED}WARNING: You are about to deploy to PRODUCTION${NC}"
  echo -e "  Image tag: ${IMAGE_TAG}"
  echo -e "  Namespace: ${NAMESPACE}"
  echo ""
  read -p "Are you sure you want to proceed? (type 'yes' to confirm): " CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    info "Deployment cancelled"
    exit 0
  fi

  # Canary health check validation
  if [[ "${ROLLOUT_STRATEGY}" == "canary" ]]; then
    info "Performing canary health checks..."
    read -p "Enter the canary health check endpoint (or press Enter to skip): " CANARY_ENDPOINT
    if [[ -n "${CANARY_ENDPOINT}" ]]; then
      info "Checking canary health at ${CANARY_ENDPOINT}..."
      for i in $(seq 1 10); do
        if curl -sf "${CANARY_ENDPOINT}" > /dev/null 2>&1; then
          info "Canary health check passed"
          break
        fi
        if [[ $i -eq 10 ]]; then
          error "Canary health check failed after 10 attempts"
          exit 1
        fi
        sleep 5
      done
    fi
  fi
fi

# Determine values file
VALUES_FILE="${HELM_DIR}/values-${ENVIRONMENT}.yaml"
if [[ ! -f "${VALUES_FILE}" ]]; then
  error "Values file not found: ${VALUES_FILE}"
  exit 1
fi

info "Deploying automatic-agent to ${ENVIRONMENT}"
info "  Image tag: ${IMAGE_TAG}"
info "  Namespace: ${NAMESPACE}"
info "  Rollout strategy: ${ROLLOUT_STRATEGY}"

# Check if helm is installed
if ! command -v helm &> /dev/null; then
  error "Helm is not installed. Install from: https://helm.sh/docs/intro/install/"
  exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
  error "kubectl is not configured or not connected to a cluster"
  exit 1
fi

# Create namespace if it doesn't exist
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
  info "Creating namespace ${NAMESPACE}"
  kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
fi

# Build helm upgrade command
HELM_ARGS=(
  "upgrade"
  "--install"
  "automatic-agent"
  "${HELM_DIR}"
  "--namespace"
  "${NAMESPACE}"
  "--create-namespace"
  "-f"
  "${VALUES_FILE}"
  "--set"
  "image.tag=${IMAGE_TAG}"
  "--set"
  "rolloutStrategy=${ROLLOUT_STRATEGY}"
  "--set"
  "env.AA_BUILD_COMMIT=${GITHUB_SHA:-unknown}"
  "--set"
  "env.AA_BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  "--wait"
  "--timeout"
  "10m"
)

if [[ -n "${DEPLOY_DOMAIN}" ]]; then
  HELM_ARGS+=("--set" "ingress.domain=${DEPLOY_DOMAIN}")
fi

# Apply rollout strategy specific settings
if [[ "${ROLLOUT_STRATEGY}" == "canary" ]]; then
  info "Applying canary rollout strategy"
  HELM_ARGS[2]="automatic-agent-canary"
  HELM_ARGS+=("--set" "fullnameOverride=automatic-agent-canary")
  HELM_ARGS+=("--set" "autoscaling.enabled=true")
  HELM_ARGS+=("--set" "replicaCount=1")
elif [[ "${ROLLOUT_STRATEGY}" == "blue_green" ]]; then
  info "Applying blue/green rollout strategy"
  CURRENT_SELECTOR=$(kubectl get svc automatic-agent -n "${NAMESPACE}" -o jsonpath='{.spec.selector.app\.kubernetes\.io/instance}' 2>/dev/null || echo "")
  COLOR="green"
  if [[ "${CURRENT_SELECTOR}" == "automatic-agent-green" ]]; then
    COLOR="blue"
  fi
  HELM_ARGS[2]="automatic-agent-${COLOR}"
  HELM_ARGS+=("--set" "fullnameOverride=automatic-agent-${COLOR}")
fi

# Execute helm upgrade
info "Executing helm upgrade..."
set -x
helm "${HELM_ARGS[@]}"
set +x

# Wait for rollout to complete
DEPLOYMENT_NAME="automatic-agent"
if [[ "${ROLLOUT_STRATEGY}" == "canary" ]]; then
  DEPLOYMENT_NAME="automatic-agent-canary"
elif [[ "${ROLLOUT_STRATEGY}" == "blue_green" ]]; then
  DEPLOYMENT_NAME="${HELM_ARGS[2]}"
fi

info "Waiting for deployment to be ready..."
if ! kubectl rollout status deployment/${DEPLOYMENT_NAME} \
  --namespace "${NAMESPACE}" \
  --timeout=300s; then
  error "Deployment rollout failed"
  exit 1
fi

# Verify deployment
SERVICE_NAME="${DEPLOYMENT_NAME}"
SVC_URL=$(kubectl get svc ${SERVICE_NAME} \
  --namespace "${NAMESPACE}" \
  --output jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || \
  kubectl get svc ${SERVICE_NAME} \
  --namespace "${NAMESPACE}" \
  --output jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || \
  echo "localhost")

info "Deployment successful!"
info "  Service: ${SVC_URL}"
info "Verifying service endpoints..."
for i in $(seq 1 30); do
  ENDPOINT_COUNT=$(kubectl get endpoints "${SERVICE_NAME}" \
    --namespace "${NAMESPACE}" \
    --output jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | awk '{print NF}')
  if [[ "${ENDPOINT_COUNT:-0}" -gt 0 ]]; then
    info "Service endpoint check passed"
    break
  fi
  sleep 10
done
if [[ "${ENDPOINT_COUNT:-0}" -eq 0 ]]; then
  warn "Service has no ready endpoints yet - please verify manually"
fi

if [[ "${ROLLOUT_STRATEGY}" == "canary" ]]; then
  info "Promoting healthy canary to stable release"
  helm upgrade --install automatic-agent "${HELM_DIR}" \
    --namespace "${NAMESPACE}" \
    -f "${VALUES_FILE}" \
    --set "image.tag=${IMAGE_TAG}" \
    --set "rolloutStrategy=rolling" \
    --wait --timeout 10m
  helm uninstall automatic-agent-canary --namespace "${NAMESPACE}" >/dev/null 2>&1 || true
elif [[ "${ROLLOUT_STRATEGY}" == "blue_green" ]]; then
  info "Switching stable service selector to ${DEPLOYMENT_NAME}"
  kubectl patch svc automatic-agent --namespace "${NAMESPACE}" --type merge \
    -p "{\"spec\":{\"selector\":{\"app.kubernetes.io/name\":\"automatic-agent\",\"app.kubernetes.io/instance\":\"${DEPLOYMENT_NAME}\"}}}"
fi

info "Deployment complete!"
