#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${1:-http://127.0.0.1:3000}}"
BASELINE_LATENCY_MS="${BASELINE_LATENCY_MS:-1000}"

# Dry run
if [[ "${DRY_RUN:-false}" == "true" ]] || [[ "${1:-}" == "--dry-run" ]]; then
  echo "[DRY RUN] Would check health at ${BASE_URL}"
  exit 0
fi

# Required env vars
for var in BASE_URL; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is required"
    exit 1
  fi
done

echo "[info] checking hot-upgrade health at ${BASE_URL}"

if ! curl -fsS "${BASE_URL}/healthz" >/dev/null; then
  echo "[error] health check failed before validation"
  exit 1
fi

METRICS="$(curl -fsS "${BASE_URL}/prometheus" || true)"
if [[ -n "${METRICS}" ]]; then
  echo "[info] prometheus endpoint reachable"
fi

echo "[info] baseline latency threshold(ms): ${BASELINE_LATENCY_MS}"
echo "[info] hot-upgrade verification script completed"
