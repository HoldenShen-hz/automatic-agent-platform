/**
 * Unit tests for QuotaEnforcer - multi-dimensional quota checking
 *
 * @see src/scale-ecosystem/resource-manager/quota-enforcer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  isQuotaExceeded,
  QuotaPolicySchema,
  MultiResourceQuotaVectorSchema,
  type QuotaPolicy,
  type MultiResourceQuotaVector,
} from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

function createMultiDimensionalPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: overrides.scope ?? "tenant",
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 1000,
    softLimit: overrides.softLimit,
    burstLimit: overrides.burstLimit,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 0,
    multiResourceQuota: overrides.multiResourceQuota,
    multiResourceHardLimits:
      overrides.multiResourceHardLimits ?? {
        worker_concurrency: 10,
        tool_qps: 50,
        model_tpm: 100000,
        model_rpm: 10000,
        budget_amount: 1000,
        approval_capacity: 100,
        storage_io: 1000,
      },
  };
}

function createSingleDimensionalPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: overrides.scope ?? "tenant",
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit,
    burstLimit: overrides.burstLimit,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota - All 7 Dimensions Validation
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota validates all 7 dimensions and passes when all under limits", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.equal(decision.warningDimensions.length, 0);
  assert.equal(decision.overallDecision.exceeded, false);
  assert.equal(decision.overallDecision.warning, false);
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - worker_concurrency overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 15,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("worker_concurrency"));
  assert.equal(decision.failedDimensions.length, 1);
  assert.equal(decision.overallDecision.exceeded, true);
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - tool_qps overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 60,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("tool_qps"));
  assert.equal(decision.failedDimensions.length, 1);
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - model_tpm overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 150000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("model_tpm"));
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - model_rpm overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 15000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("model_rpm"));
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - budget_amount overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 1500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("budget_amount"));
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - approval_capacity overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 150,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("approval_capacity"));
});

test("evaluateMultiDimensionalQuota validates all 7 dimensions - storage_io overage", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 1500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("storage_io"));
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota - Multiple Dimension Failures
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota fails on multiple dimension overage simultaneously", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 15,
    tool_qps: 60,
    model_tpm: 150000,
    model_rpm: 15000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.equal(decision.failedDimensions.length, 4);
  assert.ok(decision.failedDimensions.includes("worker_concurrency"));
  assert.ok(decision.failedDimensions.includes("tool_qps"));
  assert.ok(decision.failedDimensions.includes("model_tpm"));
  assert.ok(decision.failedDimensions.includes("model_rpm"));
  assert.equal(decision.overallDecision.exceeded, true);
});

test("evaluateMultiDimensionalQuota fails when all 7 dimensions exceed limits", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 15,
    tool_qps: 60,
    model_tpm: 150000,
    model_rpm: 15000,
    budget_amount: 1500,
    approval_capacity: 150,
    storage_io: 1500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.equal(decision.failedDimensions.length, 7);
  assert.equal(decision.overallDecision.exceeded, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota - Warning Dimensions
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota warns when dimension exceeds soft limit (80% of hard limit)", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 9,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.ok(decision.warningDimensions.includes("worker_concurrency"));
  assert.equal(decision.warningDimensions.length, 1);
  assert.equal(decision.overallDecision.exceeded, false);
  assert.equal(decision.overallDecision.warning, true);
});

test("evaluateMultiDimensionalQuota warns on multiple dimensions simultaneously", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 9,
    tool_qps: 45,
    model_tpm: 90000,
    model_rpm: 9000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.equal(decision.warningDimensions.length, 4);
  assert.ok(decision.warningDimensions.includes("worker_concurrency"));
  assert.ok(decision.warningDimensions.includes("tool_qps"));
  assert.ok(decision.warningDimensions.includes("model_tpm"));
  assert.ok(decision.warningDimensions.includes("model_rpm"));
  assert.equal(decision.overallDecision.warning, true);
});

test("evaluateMultiDimensionalQuota all 7 dimensions can warn simultaneously", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 9,
    tool_qps: 45,
    model_tpm: 90000,
    model_rpm: 9000,
    budget_amount: 900,
    approval_capacity: 90,
    storage_io: 900,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.equal(decision.warningDimensions.length, 7);
  assert.equal(decision.overallDecision.warning, true);
});

test("evaluateMultiDimensionalQuota failed dimensions take precedence over warnings", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 15,
    tool_qps: 45,
    model_tpm: 90000,
    model_rpm: 9000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.equal(decision.failedDimensions.length, 1);
  assert.equal(decision.warningDimensions.length, 3);
  assert.ok(decision.warningDimensions.includes("tool_qps"));
  assert.ok(decision.warningDimensions.includes("model_tpm"));
  assert.ok(decision.warningDimensions.includes("model_rpm"));
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota - Quota Tracking Per Tenant/Dimension
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota tracks quota independently per dimension", () => {
  const policy1 = createMultiDimensionalPolicy({ scopeId: "tenant-1" });
  const policy2 = createMultiDimensionalPolicy({ scopeId: "tenant-2" });

  const request1: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const request2: MultiResourceQuotaVector = {
    worker_concurrency: 9,
    tool_qps: 45,
    model_tpm: 90000,
    model_rpm: 9000,
    budget_amount: 900,
    approval_capacity: 90,
    storage_io: 900,
  };

  const decision1 = evaluateMultiDimensionalQuota(policy1, request1);
  const decision2 = evaluateMultiDimensionalQuota(policy2, request2);

  assert.equal(decision1.passed, true);
  assert.equal(decision1.warningDimensions.length, 0);
  assert.equal(decision2.passed, true);
  assert.equal(decision2.warningDimensions.length, 7);
});

test("evaluateMultiDimensionalQuota same request fails for one tenant but passes for another with higher limits", () => {
  const lowLimitPolicy = createMultiDimensionalPolicy({
    scopeId: "tenant-low",
    multiResourceHardLimits: {
      worker_concurrency: 5,
      tool_qps: 25,
      model_tpm: 50000,
      model_rpm: 5000,
      budget_amount: 500,
      approval_capacity: 50,
      storage_io: 500,
    },
  });

  const highLimitPolicy = createMultiDimensionalPolicy({
    scopeId: "tenant-high",
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 50,
      model_tpm: 100000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 100,
      storage_io: 1000,
    },
  });

  const request: MultiResourceQuotaVector = {
    worker_concurrency: 6,
    tool_qps: 30,
    model_tpm: 60000,
    model_rpm: 6000,
    budget_amount: 600,
    approval_capacity: 60,
    storage_io: 600,
  };

  const lowDecision = evaluateMultiDimensionalQuota(lowLimitPolicy, request);
  const highDecision = evaluateMultiDimensionalQuota(highLimitPolicy, request);

  assert.equal(lowDecision.passed, false);
  assert.equal(highDecision.passed, true);
});

test("evaluateMultiDimensionalQuota dimension failures are isolated per dimension", () => {
  const policy = createMultiDimensionalPolicy();

  const requestAllFail: MultiResourceQuotaVector = {
    worker_concurrency: 15,
    tool_qps: 60,
    model_tpm: 150000,
    model_rpm: 15000,
    budget_amount: 1500,
    approval_capacity: 150,
    storage_io: 1500,
  };

  const requestOnlyOneFail: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 1500,
  };

  const decisionAllFail = evaluateMultiDimensionalQuota(policy, requestAllFail);
  const decisionOnlyOneFail = evaluateMultiDimensionalQuota(policy, requestOnlyOneFail);

  assert.equal(decisionAllFail.failedDimensions.length, 7);
  assert.equal(decisionOnlyOneFail.failedDimensions.length, 1);
  assert.ok(decisionOnlyOneFail.failedDimensions.includes("storage_io"));
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota - Overage Rejection
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota rejects overage when single dimension exceeds hard limit", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 25,
    model_tpm: 50000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 50,
    storage_io: 500,
  };

  const overLimitRequest: MultiResourceQuotaVector = {
    ...requested,
    budget_amount: 1001,
  };

  const decision = evaluateMultiDimensionalQuota(policy, overLimitRequest);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("budget_amount"));
  assert.equal(decision.overallDecision.exceeded, true);
});

test("evaluateMultiDimensionalQuota rejects when at exactly hard limit", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 11,
    tool_qps: 51,
    model_tpm: 100001,
    model_rpm: 10001,
    budget_amount: 1001,
    approval_capacity: 101,
    storage_io: 1001,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.equal(decision.failedDimensions.length, 7);
});

test("evaluateMultiDimensionalQuota accepts when all dimensions at zero", () => {
  const policy = createMultiDimensionalPolicy();

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 0,
    tool_qps: 0,
    model_tpm: 0,
    model_rpm: 0,
    budget_amount: 0,
    approval_capacity: 0,
    storage_io: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.failedDimensions.length, 0);
  assert.equal(decision.warningDimensions.length, 0);
});

test("evaluateMultiDimensionalQuota rejects when zero limit dimension is exceeded", () => {
  const policy = createMultiDimensionalPolicy({
    multiResourceHardLimits: {
      worker_concurrency: 0,
      tool_qps: 50,
      model_tpm: 100000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 100,
      storage_io: 1000,
    },
  });

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 1,
    tool_qps: 0,
    model_tpm: 0,
    model_rpm: 0,
    budget_amount: 0,
    approval_capacity: 0,
    storage_io: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("worker_concurrency"));
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota - Fallback to Single Dimension
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota falls back to single dimension when no multiResourceHardLimits", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, currentUsage: 50 });

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 60,
    tool_qps: 0,
    model_tpm: 0,
    model_rpm: 0,
    budget_amount: 0,
    approval_capacity: 0,
    storage_io: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false);
  assert.ok(decision.failedDimensions.includes("worker_concurrency"));
  assert.equal(decision.overallDecision.exceeded, true);
});

test("evaluateMultiDimensionalQuota falls back correctly when multiResourceHardLimits is undefined", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, currentUsage: 0 });

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 50,
    tool_qps: 0,
    model_tpm: 0,
    model_rpm: 0,
    budget_amount: 0,
    approval_capacity: 0,
    storage_io: 0,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true);
  assert.equal(decision.warningDimensions.includes("worker_concurrency"), false);
  assert.equal(decision.overallDecision.exceeded, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateQuota - Quota Reservation
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateQuota correctly calculates remaining units for reservation", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, burstLimit: 150, currentUsage: 30 });

  const decision = evaluateQuota(policy, 50);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.remainingUnits, 70);
});

test("evaluateQuota remaining units is zero when projected equals burstLimit", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 50 });

  const decision = evaluateQuota(policy, 70);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota remaining units is zero when currentUsage already exceeds burstLimit", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 130 });

  const decision = evaluateQuota(policy, 10);

  assert.equal(decision.exceeded, true);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota reservation works with zero soft and burst limits", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 0, softLimit: 0, burstLimit: 0, currentUsage: 0 });

  const decision = evaluateQuota(policy, 0);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota warning flag does not block reservation when under soft limit", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, softLimit: 70, currentUsage: 50 });

  const decision = evaluateQuota(policy, 25);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, true);
  assert.equal(decision.remainingUnits, 25);
});

// ─────────────────────────────────────────────────────────────────────────────
// isQuotaExceeded - Overage Detection
// ─────────────────────────────────────────────────────────────────────────────

test("isQuotaExceeded returns true when quota exceeded", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, currentUsage: 90 });

  const result = isQuotaExceeded(policy, 20);

  assert.equal(result, true);
});

test("isQuotaExceeded returns false when quota not exceeded", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, currentUsage: 50 });

  const result = isQuotaExceeded(policy, 30);

  assert.equal(result, false);
});

test("isQuotaExceeded returns false when projected equals exactly burstLimit", () => {
  const policy = createSingleDimensionalPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 100 });

  const result = isQuotaExceeded(policy, 20);

  assert.equal(result, false);
});
