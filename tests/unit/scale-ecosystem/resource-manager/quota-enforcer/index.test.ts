import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  isQuotaExceeded,
  MultiResourceQuotaVectorSchema,
  QuotaPolicySchema,
  type QuotaPolicy,
  type MultiResourceQuotaVector,
} from "../../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

test("evaluateQuota returns not exceeded when under hard limit", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const decision = evaluateQuota(policy, 30);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.usesBurst, false);
  assert.equal(decision.remainingUnits, 20); // 100 - 80 = 20
});

test("evaluateQuota triggers warning when over soft limit", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 60,
    currentUsage: 50,
  };

  const decision = evaluateQuota(policy, 20);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, true); // 70 > 60
});

test("evaluateQuota marks burst usage when over hard but under burst limit", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    burstLimit: 150,
    currentUsage: 80,
  };

  const decision = evaluateQuota(policy, 30);

  // 110 total - not exceeded (under 150), not warning (under soft 100), uses burst (over 100 but under 150)
  assert.equal(decision.exceeded, false);
  assert.equal(decision.usesBurst, true);
});

test("evaluateQuota marks exceeded when over burst limit", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    burstLimit: 150,
    currentUsage: 100,
  };

  const decision = evaluateQuota(policy, 60);

  assert.equal(decision.exceeded, true); // 160 > 150
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota uses hardLimit as softLimit when softLimit not provided", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 90,
  };

  const decision = evaluateQuota(policy, 20);

  assert.equal(decision.warning, true); // 110 > 100
});

test("isQuotaExceeded returns true when exceeded", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    burstLimit: 100,
    currentUsage: 95,
  };

  const result = isQuotaExceeded(policy, 10);

  assert.equal(result, true);
});

test("isQuotaExceeded returns false when not exceeded", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const result = isQuotaExceeded(policy, 30);

  assert.equal(result, false);
});

test("QuotaPolicySchema applies defaults", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 50,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.resourceType, "runtime_units");
    assert.equal(result.data.resetWindow, "1h");
  }
});

test("QuotaPolicySchema rejects invalid input", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "",
    hardLimit: -1,
    currentUsage: 50,
  });

  assert.equal(result.success, false);
});

// Multi-dimensional quota tests (R3-26: 7-dimensional QuotaPolicy)

test("evaluateMultiDimensionalQuota passes when all dimensions under hard limits", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.equal(decision.overallDecision.exceeded, false);
});

test("evaluateMultiDimensionalQuota fails dimension that exceeds hard limit", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };
  // Modify to exceed worker_concurrency limit
  requested.worker_concurrency = 15;

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("worker_concurrency"));
});

test("evaluateMultiDimensionalQuota warns on dimension exceeding soft limit (80% of hard)", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 9, // 9 > 8 (80% of 10), but <= 10
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.ok(decision.warningDimensions.includes("worker_concurrency"));
});

test("evaluateMultiDimensionalQuota handles all 7 dimensions correctly", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  // All within limits
  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.equal(decision.warningDimensions.length, 0);
  assert.deepEqual(decision.failedDimensions, []);
  assert.deepEqual(decision.warningDimensions, []);
});

test("evaluateMultiDimensionalQuota with no multiResourceHardLimits falls back to single dimension", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 60, // 50 + 60 = 110 > 100, exceeds hardLimit
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  // Falls back to worker_concurrency check against hardLimit
  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("worker_concurrency"));
});

test("evaluateMultiDimensionalQuota marks overallDecision.exceeded when any dimension fails", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 150, // exceeds limit
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.equal(decision.overallDecision.exceeded, true);
});

test("evaluateMultiDimensionalQuota warns when multiple dimensions exceed soft limit", () => {
  const policy: QuotaPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 9, // > 8, <= 10
    tool_qps: 85, // > 80, <= 100
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.ok(decision.warningDimensions.includes("worker_concurrency"));
  assert.ok(decision.warningDimensions.includes("tool_qps"));
  assert.equal(decision.overallDecision.warning, true);
});

test("MultiResourceQuotaVectorSchema applies defaults", () => {
  const result = MultiResourceQuotaVectorSchema.safeParse({});

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.worker_concurrency, 0);
    assert.equal(result.data.tool_qps, 0);
    assert.equal(result.data.model_tpm, 0);
    assert.equal(result.data.model_rpm, 0);
    assert.equal(result.data.budget_amount, 0);
    assert.equal(result.data.approval_capacity, 0);
    assert.equal(result.data.storage_io, 0);
  }
});

test("MultiResourceQuotaVectorSchema rejects negative values", () => {
  const result = MultiResourceQuotaVectorSchema.safeParse({
    worker_concurrency: -1,
  });

  assert.equal(result.success, false);
});