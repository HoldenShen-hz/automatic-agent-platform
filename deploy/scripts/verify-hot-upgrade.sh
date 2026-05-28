#!/usr/bin/env bash
set -euo pipefail

BASELINE_LATENCY_MS="${BASELINE_LATENCY_MS:-1000}"
EXPECTED_APP_VERSION="${EXPECTED_APP_VERSION:-${AA_BUILD_VERSION:-}}"
EXPECTED_BUILD_COMMIT="${EXPECTED_BUILD_COMMIT:-${AA_BUILD_COMMIT:-}}"
EXIT_USAGE=64
EXIT_VALIDATION=65

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
BASE_URL="${BASE_URL:-${1:-http://127.0.0.1:3000}}"

# Required env vars
for var in BASE_URL; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is required"
    exit "${EXIT_USAGE}"
  fi
done

if [[ "${DRY_RUN:-false}" == "true" ]] || [[ "${DRY_RUN_FLAG}" -eq 1 ]]; then
  echo "[DRY RUN] Would check health at ${BASE_URL}"
  echo "  expected_app_version=${EXPECTED_APP_VERSION:-<none>}"
  echo "  expected_build_commit=${EXPECTED_BUILD_COMMIT:-<none>}"
  exit 0
fi

echo "[info] checking hot-upgrade health at ${BASE_URL}"

if ! curl -fsS "${BASE_URL}/healthz" >/dev/null; then
  echo "[error] health check failed before validation"
  exit "${EXIT_VALIDATION}"
fi

HEADER_FILE="$(mktemp "${TMPDIR:-/tmp}/aa-hot-upgrade.XXXXXX.headers")"
trap 'rm -f "$HEADER_FILE"' EXIT
curl -fsS -D "$HEADER_FILE" -o /dev/null "${BASE_URL}/healthz" >/dev/null

if [[ -n "${EXPECTED_APP_VERSION}" ]]; then
  OBSERVED_APP_VERSION="$(awk 'BEGIN{IGNORECASE=1} /^x-app-version:/ {gsub(/\r/,"",$2); print $2}' "$HEADER_FILE" | tail -1)"
  if [[ "${OBSERVED_APP_VERSION}" != "${EXPECTED_APP_VERSION}" ]]; then
    echo "[error] x-app-version mismatch: expected=${EXPECTED_APP_VERSION} observed=${OBSERVED_APP_VERSION:-<missing>}"
    exit "${EXIT_VALIDATION}"
  fi
fi

if [[ -n "${EXPECTED_BUILD_COMMIT}" ]]; then
  OBSERVED_BUILD_COMMIT="$(awk 'BEGIN{IGNORECASE=1} /^x-build-commit:/ {gsub(/\r/,"",$2); print $2}' "$HEADER_FILE" | tail -1)"
  if [[ "${OBSERVED_BUILD_COMMIT}" != "${EXPECTED_BUILD_COMMIT}" ]]; then
    echo "[error] x-build-commit mismatch: expected=${EXPECTED_BUILD_COMMIT} observed=${OBSERVED_BUILD_COMMIT:-<missing>}"
    exit "${EXIT_VALIDATION}"
  fi
fi

METRICS="$(curl -fsS "${BASE_URL}/prometheus" || true)"
if [[ -n "${METRICS}" ]]; then
  echo "[info] prometheus endpoint reachable"
fi

echo "[info] baseline latency threshold(ms): ${BASELINE_LATENCY_MS}"
echo "[info] hot-upgrade verification script completed"
