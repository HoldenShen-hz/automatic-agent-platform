#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

"${REPO_ROOT}/node_modules/.bin/tsx" --test \
  tests/unit/api/http-server/auth-routes.test.ts \
  tests/unit/api/http-server/billing-routes.test.ts \
  tests/unit/api/http-server/approval-routes.test.ts \
  tests/unit/api/http-server/gateway-routes.test.ts \
  tests/unit/core/agent-loop/oapeflir-loop-service.test.ts \
  tests/unit/runtime/redis-client-options.test.ts
