#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

TEST_FILES=(
  tests/unit/platform/interface/api/http-server/auth-routes.test.ts
  tests/unit/platform/interface/api/http-server/billing-routes.test.ts
  tests/unit/platform/interface/api/http-server/approval-routes.test.ts
  tests/unit/platform/interface/api/http-server/gateway-routes.test.ts
  tests/unit/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.test.ts
  tests/unit/platform/shared/utils/redis-client-options.test.ts
)

for file in "${TEST_FILES[@]}"; do
  if [ ! -f "${file}" ]; then
    echo "Missing mutation-critical test file: ${file}" >&2
    exit 1
  fi
done

node scripts/run-node-tests.mjs "${TEST_FILES[@]}"
