import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRequestGuardPlan,
  planIncludesGuard,
} from "../../../../../src/platform/five-plane-interface/api/middleware/request-guard-contract.js";

test("request guard contract keeps rate limiting before routing and deduplication before idempotency for mutating requests without keys", () => {
  const plan = buildRequestGuardPlan({
    method: "POST",
    path: "/v1/tasks",
    idempotencyKey: null,
  });

  assert.deepEqual(plan.beforeRouting, ["rate-limit"]);
  assert.deepEqual(plan.beforeDispatch, ["request-deduplication", "idempotency-key"]);
});

test("request guard contract skips request deduplication when an idempotency key is present", () => {
  const plan = buildRequestGuardPlan({
    method: "POST",
    path: "/v1/tasks",
    idempotencyKey: "idem_123",
  });

  assert.equal(planIncludesGuard(plan.beforeDispatch, "request-deduplication"), false);
  assert.deepEqual(plan.beforeDispatch, ["idempotency-key"]);
});

test("request guard contract exempts webhook ingestion paths from request deduplication", () => {
  const plan = buildRequestGuardPlan({
    method: "POST",
    path: "/v1/webhooks/provider-x",
    idempotencyKey: null,
  });

  assert.deepEqual(plan.beforeDispatch, ["idempotency-key"]);
});
