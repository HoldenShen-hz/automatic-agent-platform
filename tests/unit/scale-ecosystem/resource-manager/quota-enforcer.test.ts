/**
 * Unit tests for QuotaEnforcer - resource quota enforcement and evaluation
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

function createQuotaPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: overrides.scope ?? "tenant",
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit,
    burstLimit: overrides.burstLimit,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 0,
    multiResourceQuota: overrides.multiResourceQuota,
    multiResourceHardLimits: overrides.multiResourceHardLimits,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateQuota Tests
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateQuota returns correct decision when under all limits", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, currentUsage: 30 });

  const decision = evaluateQuota(policy, 20);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.usesBurst, false);
  assert.equal(decision.remainingUnits, 50);
});

test("evaluateQuota triggers warning when projected exceeds softLimit", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, softLimit: 60, currentUsage: 30 });

  const decision = evaluateQuota(policy, 35);

  // projected = 65 > 60 = warning
  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, true);
  assert.equal(decision.remainingUnits, 35);
});

test("evaluateQuota uses burst when over hardLimit but under burstLimit", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: 150, currentUsage: 80 });

  const decision = evaluateQuota(policy, 30);

  // projected = 110, over hardLimit (100) but under burstLimit (150)
  assert.equal(decision.exceeded, false);
  assert.equal(decision.usesBurst, true);
  assert.equal(decision.remainingUnits, 40);
});

test("evaluateQuota marks exceeded when over burstLimit", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: 150, currentUsage: 100 });

  const decision = evaluateQuota(policy, 60);

  // projected = 160 > 150 = exceeded
  assert.equal(decision.exceeded, true);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota defaults softLimit to hardLimit when not provided", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, softLimit: undefined, currentUsage: 90 });

  const decision = evaluateQuota(policy, 15);

  // projected = 105 > 100 (softLimit defaults to hardLimit) = warning
  assert.equal(decision.warning, true);
});

test("evaluateQuota defaults burstLimit to hardLimit when not provided", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: undefined, currentUsage: 95 });

  const decision = evaluateQuota(policy, 10);

  // projected = 105 > 100 (burstLimit defaults to hardLimit) = exceeded
  assert.equal(decision.exceeded, true);
});

test("evaluateQuota with zero currentUsage and zero requested", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, currentUsage: 0 });

  const decision = evaluateQuota(policy, 0);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.remainingUnits, 100);
});

test("evaluateQuota remainingUnits is max of 0 and difference", () => {
  const policy = createQuotaPolicy({ hardLimit: 50, burstLimit: 50, currentUsage: 60 });

  const decision = evaluateQuota(policy, 10);

  // currentUsage already exceeds burstLimit
  assert.equal(decision.remainingUnits, 0);
  assert.equal(decision.exceeded, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// isQuotaExceeded Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isQuotaExceeded returns true when projected exceeds burstLimit", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 100 });

  const result = isQuotaExceeded(policy, 25);

  assert.equal(result, true);
});

test("isQuotaExceeded returns false when projected equals burstLimit", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 100 });

  const result = isQuotaExceeded(policy, 20);

  assert.equal(result, false);
});

test("isQuotaExceeded returns false when projected is under burstLimit", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 50 });

  const result = isQuotaExceeded(policy, 30);

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// QuotaPolicySchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("QuotaPolicySchema parses valid complete input", () => {
  const input = {
    scope: "org",
    scopeId: "org-1",
    resourceType: "execution_units",
    hardLimit: 200,
    softLimit: 150,
    burstLimit: 250,
    resetWindow: "30m",
    currentUsage: 100,
  };

  const result = QuotaPolicySchema.safeParse(input);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.scope, "org");
    assert.equal(result.data.hardLimit, 200);
    assert.equal(result.data.softLimit, 150);
    assert.equal(result.data.burstLimit, 250);
  }
});

test("QuotaPolicySchema applies defaults for optional fields", () => {
  const input = {
    scopeId: "tenant-2",
    hardLimit: 100,
    currentUsage: 50,
  };

  const result = QuotaPolicySchema.safeParse(input);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.scope, "tenant");
    assert.equal(result.data.resourceType, "runtime_units");
    assert.equal(result.data.resetWindow, "1h");
    assert.equal(result.data.softLimit, undefined);
    assert.equal(result.data.burstLimit, undefined);
  }
});

test("QuotaPolicySchema rejects negative hardLimit", () => {
  const input = {
    scopeId: "tenant-1",
    hardLimit: -10,
    currentUsage: 50,
  };

  const result = QuotaPolicySchema.safeParse(input);

  assert.equal(result.success, false);
});

test("QuotaPolicySchema rejects negative currentUsage", () => {
  const input = {
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: -5,
  };

  const result = QuotaPolicySchema.safeParse(input);

  assert.equal(result.success, false);
});

test("QuotaPolicySchema rejects empty scopeId", () => {
  const input = {
    scopeId: "",
    hardLimit: 100,
    currentUsage: 50,
  };

  const result = QuotaPolicySchema.safeParse(input);

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// MultiResourceQuotaVectorSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MultiResourceQuotaVectorSchema parses valid vector", () => {
  const input = {
    worker_concurrency: 5,
    tool_qps: 100,
    model_tpm: 50000,
    model_rpm: 10000,
    budget_amount: 1000,
    approval_capacity: 50,
    storage_io: 1000,
  };

  const result = MultiResourceQuotaVectorSchema.safeParse(input);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.worker_concurrency, 5);
    assert.equal(result.data.model_tpm, 50000);
  }
});

test("MultiResourceQuotaVectorSchema defaults all fields to 0", () => {
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

test("MultiResourceQuotaVectorSchema rejects negative worker_concurrency", () => {
  const result = MultiResourceQuotaVectorSchema.safeParse({ worker_concurrency: -1 });

  assert.equal(result.success, false);
});

test("MultiResourceQuotaVectorSchema rejects negative tool_qps", () => {
  const result = MultiResourceQuotaVectorSchema.safeParse({ tool_qps: -50 });

  assert.equal(result.success, false);
});

test("MultiResourceQuotaVectorSchema accepts non-integer numbers for budget_amount", () => {
  const result = MultiResourceQuotaVectorSchema.safeParse({ budget_amount: 100.50 });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.budget_amount, 100.50);
  }
});
