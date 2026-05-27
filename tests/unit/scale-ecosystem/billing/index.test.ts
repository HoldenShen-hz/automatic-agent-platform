import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for billing module
import {
  assertIdentifier,
  assertPositiveNumber,
  roundCurrency,
  monthWindow,
  buildBillingMarkdown,
  type CostEstimate,
  type CreateBillingAccountInput,
  type EvaluateEntitlementInput,
  type RecordUsageInput,
} from "../../../../src/scale-ecosystem/billing/index.js";

test("assertIdentifier returns value when valid [index]", () => {
  const result = assertIdentifier("valid_id", "test.code");
  assert.equal(result, "valid_id");
});

test("assertIdentifier throws on empty string [index]", () => {
  assert.throws(
    () => assertIdentifier("", "test.code"),
    /test.code/,
  );
});

test("assertPositiveNumber returns value when positive [index]", () => {
  const result = assertPositiveNumber(42.5, "test.code");
  assert.equal(result, 42.5);
});

test("assertPositiveNumber throws on zero [index]", () => {
  assert.throws(
    () => assertPositiveNumber(0, "test.code"),
    /test.code/,
  );
});

test("assertPositiveNumber throws on negative [index]", () => {
  assert.throws(
    () => assertPositiveNumber(-1, "test.code"),
    /test.code/,
  );
});

test("roundCurrency rounds to 4 decimal places [index]", () => {
  assert.equal(roundCurrency(10.45678), 10.4568);
  assert.equal(roundCurrency(10.45674), 10.4567);
});

test("monthWindow returns correct structure [index]", () => {
  const window = monthWindow("2026-04-14T00:00:00.000Z");
  assert.ok(window.start);
  assert.ok(window.end);
  assert.ok(window.periodId);
  assert.ok(window.start < window.end);
});

test("monthWindow periodId contains year and month [index]", () => {
  const window = monthWindow("2026-04-14T00:00:00.000Z");
  assert.ok(window.periodId.includes("2026"));
  assert.ok(window.periodId.includes("04"));
});

test("CreateBillingAccountInput structure is correct [index]", () => {
  const input: CreateBillingAccountInput = {
    accountId: "acct_123",
    ownerId: "owner_456",
    workspaceId: "ws_789",
    planId: "plan_pro",
    status: "active",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(input.accountId, "acct_123");
  assert.equal(input.ownerId, "owner_456");
  assert.equal(input.planId, "plan_pro");
});

test("CreateBillingAccountInput with minimal fields [index]", () => {
  const input: CreateBillingAccountInput = {
    ownerId: "owner_minimal",
    planId: "plan_basic",
  };
  assert.equal(input.ownerId, "owner_minimal");
  assert.equal(input.accountId, undefined);
});

test("EvaluateEntitlementInput structure is correct [index]", () => {
  const input: EvaluateEntitlementInput = {
    accountId: "acct_eval",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 100,
    evaluatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(input.accountId, "acct_eval");
  assert.equal(input.featureKey, "feature_ai");
  assert.equal(input.requestedQuantity, 100);
});

test("RecordUsageInput structure is correct [index]", () => {
  const input: RecordUsageInput = {
    accountId: "acct_usage",
    workspaceId: "ws_usage",
    tenantId: "tenant_123",
    taskId: "task_abc",
    metricType: "task_execution",
    quantity: 1,
    source: "runtime",
    capturedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(input.accountId, "acct_usage");
  assert.equal(input.metricType, "task_execution");
  assert.equal(input.quantity, 1);
  assert.equal(input.source, "runtime");
});

test("RecordUsageInput with api source [index]", () => {
  const input: RecordUsageInput = {
    accountId: "acct_api",
    metricType: "token_usage",
    quantity: 5000,
    source: "api",
  };
  assert.equal(input.source, "api");
  assert.equal(input.metricType, "token_usage");
});

test("CostEstimate type is exported from billing barrel [index]", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.25,
    confidence: "medium",
    sampleCount: 12,
    divisionId: "engineering_ops",
    basedOn: "division_avg",
  };
  assert.equal(estimate.basedOn, "division_avg");
});
