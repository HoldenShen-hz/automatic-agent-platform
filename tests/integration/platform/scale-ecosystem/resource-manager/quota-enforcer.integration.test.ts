import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  isQuotaExceeded,
  type QuotaPolicy,
  type MultiResourceQuotaVector,
  MultiResourceQuotaVectorSchema,
  QuotaPolicySchema,
} from "../../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

function makePolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    burstLimit: 120,
    resetWindow: "1h",
    currentUsage: 0,
    ...overrides,
  };
}

test("evaluateQuota allows request within burst limit", () => {
  const policy = makePolicy({ currentUsage: 60 });
  const decision = evaluateQuota(policy, 20);

  // projected=80, soft=80, burst=120
  // warning: 80 > 80 = false (at soft limit, not over)
  // exceeded: 80 > 120 = false
  assert.strictEqual(decision.exceeded, false, "Should not exceed with 80 total vs burst 120");
  assert.strictEqual(decision.warning, false, "At exactly soft limit should not warn");
  assert.strictEqual(decision.usesBurst, false, "Below hard limit 100");
  assert.strictEqual(decision.remainingUnits, 40);
});

test("evaluateQuota warns when projected exceeds soft limit", () => {
  const policy = makePolicy({ currentUsage: 70 });
  const decision = evaluateQuota(policy, 20);

  // projected=90, soft=80, burst=120
  assert.strictEqual(decision.exceeded, false, "Should not exceed burst limit");
  assert.strictEqual(decision.warning, true, "Should warn when over soft limit (80)");
  assert.strictEqual(decision.usesBurst, false, "Below hard limit 100");
});

test("evaluateQuota blocks request exceeding burst limit", () => {
  const policy = makePolicy({ currentUsage: 100 });
  const decision = evaluateQuota(policy, 30);

  assert.strictEqual(decision.exceeded, true, "Should exceed with 130 total vs burst 120");
  assert.strictEqual(decision.remainingUnits, 0);
});

test("evaluateQuota handles zero remaining capacity", () => {
  const policy = makePolicy({ currentUsage: 120 });
  const decision = evaluateQuota(policy, 1);

  assert.strictEqual(decision.exceeded, true);
  assert.strictEqual(decision.remainingUnits, 0);
});

test("evaluateMultiDimensionalQuota passes when all dimensions within limits", () => {
  const policy = makePolicy({
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 50,
      model_tpm: 100000,
      model_rpm: 1000,
      budget_amount: 5000,
      approval_capacity: 100,
      storage_io: 1000,
    },
  });

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 500,
    budget_amount: 2500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.strictEqual(decision.passed, true);
  assert.strictEqual(decision.failedDimensions.length, 0);
  assert.strictEqual(decision.warningDimensions.length, 0);
});

test("evaluateMultiDimensionalQuota fails when dimension exceeds hard limit", () => {
  const policy = makePolicy({
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 50,
      model_tpm: 100000,
      model_rpm: 1000,
      budget_amount: 5000,
      approval_capacity: 100,
      storage_io: 1000,
    },
  });

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 60, // exceeds 50 limit
    model_tpm: 50000,
    model_rpm: 500,
    budget_amount: 2500,
    approval_capacity: 50,
    storage_io: 500,
    promotion_budget: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.strictEqual(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("tool_qps"));
  assert.strictEqual(decision.warningDimensions.length, 0);
});

test("evaluateMultiDimensionalQuota warns when dimension exceeds soft (80%) of hard limit", () => {
  const policy = makePolicy({
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 50,
      model_tpm: 100000,
      model_rpm: 1000,
      budget_amount: 5000,
      approval_capacity: 100,
      storage_io: 1000,
    },
  });

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 45, // 90% of 50, over 80% soft threshold
    model_tpm: 50000,
    model_rpm: 500,
    budget_amount: 2500,
    approval_capacity: 50,
    storage_io: 500,
    promotion_budget: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.strictEqual(decision.passed, true, "Should pass since not over hard limit");
  assert.strictEqual(decision.failedDimensions.length, 0);
  assert.ok(decision.warningDimensions.includes("tool_qps"), "Should warn at 90% capacity");
});

test("evaluateMultiDimensionalQuota falls back to single-dimension when no multiResourceHardLimits", () => {
  const policy = makePolicy({ currentUsage: 90 });
  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 20,
    tool_qps: 0,
    model_tpm: 0,
    model_rpm: 0,
    budget_amount: 0,
    approval_capacity: 0,
    storage_io: 0,
    promotion_budget: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  // currentUsage=90, requested=20, total=110, burst=120, hard=100
  // single dimension: projected=110 > burst=120? No. So passed=false? Wait
  // Actually evaluateQuota returns exceeded = projected > burstLimit (120)
  // So 110 > 120 = false, so exceeded=false, so passed=true
  assert.strictEqual(decision.passed, true);
});

test("isQuotaExceeded delegates to evaluateQuota", () => {
  const policy = makePolicy({ currentUsage: 110 });
  assert.strictEqual(isQuotaExceeded(policy, 20), true);
  assert.strictEqual(isQuotaExceeded(policy, 5), false);
});

test("MultiResourceQuotaVectorSchema parses valid vector", () => {
  const result = MultiResourceQuotaVectorSchema.parse({
    worker_concurrency: 5,
    tool_qps: 10,
  });
  assert.strictEqual(result.worker_concurrency, 5);
  assert.strictEqual(result.tool_qps, 10);
  // Defaults applied
  assert.strictEqual(result.model_tpm, 0);
});

test("QuotaPolicySchema accepts valid policy", () => {
  const result = QuotaPolicySchema.parse({
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 0,
  });
  assert.strictEqual(result.scope, "tenant");
  assert.strictEqual(result.hardLimit, 100);
  assert.strictEqual(result.resetWindow, "1h"); // default
  assert.strictEqual(result.currentUsage, 0);
});

test("evaluateMultiDimensionalQuota across all dimensions simultaneously", () => {
  const policy = makePolicy({
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 50,
      model_tpm: 100000,
      model_rpm: 1000,
      budget_amount: 5000,
      approval_capacity: 100,
      storage_io: 1000,
    },
  });

  // All dimensions at exactly at 50% - no warnings, no failures
  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 500,
    budget_amount: 2500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.strictEqual(decision.passed, true);
  assert.strictEqual(decision.failedDimensions.length, 0);
  assert.strictEqual(decision.warningDimensions.length, 0);
});