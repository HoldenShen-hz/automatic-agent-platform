#!/bin/sh
set -eu

./node_modules/.bin/tsx --test \
  tests/unit/api/http-server/auth-routes.test.ts \
  tests/unit/api/http-server/billing-routes.test.ts \
  tests/unit/api/http-server/approval-routes.test.ts \
  tests/unit/api/http-server/gateway-routes.test.ts \
  tests/unit/core/agent-loop/oapeflir-loop-service.test.ts \
  tests/unit/runtime/redis-client-options.test.ts
