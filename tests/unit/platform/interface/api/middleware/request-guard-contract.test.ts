import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestGuardPlan,
  planIncludesGuard,
  type RequestGuardPlanInput,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/request-guard-contract.js";

test("buildRequestGuardPlan includes rate-limit for GET beforeRouting", () => {
  const input: RequestGuardPlanInput = {
    method: "GET",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.deepEqual(plan.beforeRouting, ["rate-limit"]);
  assert.deepEqual(plan.beforeDispatch, []);
});

test("buildRequestGuardPlan includes rate-limit for POST beforeRouting", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.deepEqual(plan.beforeRouting, ["rate-limit"]);
});

test("buildRequestGuardPlan does not include rate-limit for OPTIONS", () => {
  const input: RequestGuardPlanInput = {
    method: "OPTIONS",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.deepEqual(plan.beforeRouting, []);
});

test("buildRequestGuardPlan adds idempotency-key beforeDispatch for non-OPTIONS methods", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/api/tasks",
    idempotencyKey: "key-123",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(plan.beforeDispatch.includes("idempotency-key"));
});

test("buildRequestGuardPlan does not add idempotency-key for OPTIONS", () => {
  const input: RequestGuardPlanInput = {
    method: "OPTIONS",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(!plan.beforeDispatch.includes("idempotency-key"));
});

test("buildRequestGuardPlan adds request-deduplication for write methods without idempotencyKey", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(plan.beforeDispatch.includes("request-deduplication"));
});

test("buildRequestGuardPlan does not add request-deduplication when idempotencyKey is provided", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/api/tasks",
    idempotencyKey: "key-123",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(!plan.beforeDispatch.includes("request-deduplication"));
});

test("buildRequestGuardPlan does not add request-deduplication for webhook receive paths", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/v1/webhooks/github",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(!plan.beforeDispatch.includes("request-deduplication"));
});

test("buildRequestGuardPlan does not add request-deduplication for /v1/webhooks exactly", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/v1/webhooks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(!plan.beforeDispatch.includes("request-deduplication"));
});

test("buildRequestGuardPlan normalizes method to uppercase", () => {
  const input: RequestGuardPlanInput = {
    method: "get",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  assert.equal(plan.method, "GET");
});

test("buildRequestGuardPlan handles PUT method", () => {
  const input: RequestGuardPlanInput = {
    method: "PUT",
    path: "/api/tasks/123",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(plan.beforeDispatch.includes("request-deduplication"));
  assert.ok(plan.beforeDispatch.includes("idempotency-key"));
});

test("buildRequestGuardPlan handles PATCH method", () => {
  const input: RequestGuardPlanInput = {
    method: "PATCH",
    path: "/api/tasks/123",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(plan.beforeDispatch.includes("request-deduplication"));
  assert.ok(plan.beforeDispatch.includes("idempotency-key"));
});

test("buildRequestGuardPlan handles DELETE method", () => {
  const input: RequestGuardPlanInput = {
    method: "DELETE",
    path: "/api/tasks/123",
  };

  const plan = buildRequestGuardPlan(input);

  assert.ok(plan.beforeDispatch.includes("request-deduplication"));
  assert.ok(plan.beforeDispatch.includes("idempotency-key"));
});

test("buildRequestGuardPlan handles null path", () => {
  const input: RequestGuardPlanInput = {
    method: "GET",
    path: null,
  };

  const plan = buildRequestGuardPlan(input);

  assert.equal(plan.path, null);
  assert.deepEqual(plan.beforeRouting, ["rate-limit"]);
});

test("buildRequestGuardPlan handles whitespace-only idempotencyKey as null", () => {
  const input: RequestGuardPlanInput = {
    method: "POST",
    path: "/api/tasks",
    idempotencyKey: "   ",
  };

  const plan = buildRequestGuardPlan(input);

  // Whitespace-only is treated as null, so request-deduplication should be added
  assert.ok(plan.beforeDispatch.includes("request-deduplication"));
});

test("planIncludesGuard returns true when guard is in list", () => {
  const guards: readonly ("rate-limit" | "request-deduplication" | "idempotency-key")[] = [
    "rate-limit",
    "idempotency-key",
  ];

  assert.ok(planIncludesGuard(guards, "rate-limit"));
  assert.ok(planIncludesGuard(guards, "idempotency-key"));
});

test("planIncludesGuard returns false when guard is not in list", () => {
  const guards: readonly ("rate-limit" | "request-deduplication" | "idempotency-key")[] = [
    "rate-limit",
  ];

  assert.ok(!planIncludesGuard(guards, "request-deduplication"));
  assert.ok(!planIncludesGuard(guards, "idempotency-key"));
});

test("planIncludesGuard works with empty guard list", () => {
  const guards: readonly ("rate-limit" | "request-deduplication" | "idempotency-key")[] = [];

  assert.ok(!planIncludesGuard(guards, "rate-limit"));
});

test("buildRequestGuardPlan preserves original method casing in output", () => {
  const input: RequestGuardPlanInput = {
    method: "GeT",
    path: "/api/tasks",
  };

  const plan = buildRequestGuardPlan(input);

  // Method is uppercased
  assert.equal(plan.method, "GET");
});
