/**
 * Unit tests for QuotaEnforcerService - Multi-resource quota enforcement
 *
 * Per §53.2: Enforces MultiResourceQuotaVector limits across all resource dimensions.
 * Tests evaluateQuota, evaluateMultiDimensionalQuota, isQuotaExceeded, and QuotaEnforcerService.
 *
 * @see src/scale-ecosystem/resource-manager/quota-enforcer/index.js
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  isQuotaExceeded,
  QuotaPolicySchema,
  QuotaEnforcerService,
  type QuotaPolicy,
  type MultiResourceQuotaVector,
} from "../../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Factory Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeQuotaPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: overrides.scope ?? "tenant",
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit ?? 80,
    burstLimit: overrides.burstLimit ?? 120,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 0,
    multiResourceQuota: overrides.multiResourceQuota,
    multiResourceHardLimits: overrides.multiResourceHardLimits,
  };
}

function makeMultiResourceQuota(overrides: Partial<MultiResourceQuotaVector> = {}): MultiResourceQuotaVector {
  return {
    worker_concurrency: overrides.worker_concurrency ?? 0,
    tool_qps: overrides.tool_qps ?? 0,
    model_tpm: overrides.model_tpm ?? 0,
    model_rpm: overrides.model_rpm ?? 0,
    budget_amount: overrides.budget_amount ?? 0,
    approval_capacity: overrides.approval_capacity ?? 0,
    storage_io: overrides.storage_io ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateQuota Tests
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateQuota returns not exceeded when projected is under hard limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, currentUsage: 30 });
  const result = evaluateQuota(policy, 20);

  assert.equal(result.exceeded, false);
  assert.equal(result.warning, false);
  assert.equal(result.usesBurst, false);
  assert.equal(result.remainingUnits, 70); // burstLimit - projected = 120 - 50
});

test("evaluateQuota returns warning when projected exceeds soft limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, softLimit: 50, currentUsage: 30 });
  const result = evaluateQuota(policy, 30);

  // projected = 30 + 30 = 60 > softLimit(50)
  assert.equal(result.exceeded, false);
  assert.equal(result.warning, true);
  assert.equal(result.usesBurst, false);
});

test("evaluateQuota returns exceeded when projected exceeds burst limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 100 });
  const result = evaluateQuota(policy, 30);

  // projected = 100 + 30 = 130 > burstLimit(120)
  assert.equal(result.exceeded, true);
  assert.equal(result.warning, true);
  assert.equal(result.usesBurst, false); // Already exceeded
  assert.equal(result.remainingUnits, 0);
});

test("evaluateQuota returns usesBurst when between hard and burst limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 80 });
  const result = evaluateQuota(policy, 30);

  // projected = 80 + 30 = 110 > hardLimit(100) && <= burstLimit(120)
  assert.equal(result.exceeded, false);
  assert.equal(result.warning, true);
  assert.equal(result.usesBurst, true);
  assert.equal(result.remainingUnits, 10); // 120 - 110 = 10
});

test("evaluateQuota handles zero requested units", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, currentUsage: 50 });
  const result = evaluateQuota(policy, 0);

  assert.equal(result.exceeded, false);
  assert.equal(result.warning, false);
  assert.equal(result.remainingUnits, 70); // burstLimit - currentUsage = 120 - 50
});

test("evaluateQuota handles currentUsage equal to hardLimit with zero request", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, currentUsage: 100 });
  const result = evaluateQuota(policy, 0);

  assert.equal(result.exceeded, false);
  assert.equal(result.warning, true); // At hard limit
  assert.equal(result.remainingUnits, 20); // burstLimit - currentUsage
});

test("evaluateQuota handles edge case at exactly hard limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 100, currentUsage: 70 });
  const result = evaluateQuota(policy, 30);

  // projected = 70 + 30 = 100 = hardLimit = burstLimit
  assert.equal(result.exceeded, false);
  assert.equal(result.usesBurst, false);
});

test("evaluateQuota calculates remainingUnits correctly", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 150, currentUsage: 20 });
  const result = evaluateQuota(policy, 50);

  // projected = 20 + 50 = 70
  // remaining = 150 - 70 = 80
  assert.equal(result.remainingUnits, 80);
});

// ─────────────────────────────────────────────────────────────────────────────
// isQuotaExceeded Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isQuotaExceeded returns false when under burst limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 50 });
  const result = isQuotaExceeded(policy, 50);

  assert.equal(result, false);
});

test("isQuotaExceeded returns true when over burst limit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 100 });
  const result = isQuotaExceeded(policy, 30);

  assert.equal(result, true);
});

test("isQuotaExceeded uses burstLimit not hardLimit", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, burstLimit: 100, currentUsage: 90 });
  const result = isQuotaExceeded(policy, 20);

  // projected = 90 + 20 = 110 > burstLimit(100)
  assert.equal(result, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// QuotaPolicySchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("QuotaPolicySchema parses valid policy", () => {
  const policy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const result = QuotaPolicySchema.safeParse(policy);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.scope, "tenant");
    assert.equal(result.data.scopeId, "tenant-1");
    assert.equal(result.data.hardLimit, 100);
  }
});

test("QuotaPolicySchema rejects tenant scope without scopeId", () => {
  const policy = {
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const result = QuotaPolicySchema.safeParse(policy);

  assert.equal(result.success, false);
});

test("QuotaPolicySchema applies defaults", () => {
  const policy = {
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 0,
  };

  const result = QuotaPolicySchema.safeParse(policy);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.scope, "tenant");
    assert.equal(result.data.resourceType, "runtime_units");
    assert.equal(result.data.resetWindow, "1h");
  }
});

test("QuotaPolicySchema accepts multiResourceQuota", () => {
  const policy = {
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 0,
    multiResourceQuota: {
      worker_concurrency: 10,
      tool_qps: 100,
    },
  };

  const result = QuotaPolicySchema.safeParse(policy);

  assert.equal(result.success, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// QuotaEnforcerService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("QuotaEnforcerService.registerQuota stores policy", () => {
  const service = new QuotaEnforcerService();
  const policy = makeQuotaPolicy({ scopeId: "tenant-1" });

  service.registerQuota("tenant", "tenant-1", policy);

  const result = service.checkSingleResourceQuota("tenant", "tenant-1", "runtime_units", 50);
  assert.equal(result.exceeded, false);
});

test("QuotaEnforcerService.checkQuota returns passed for unregistered policy", () => {
  const service = new QuotaEnforcerService();
  const request = makeMultiResourceQuota({ worker_concurrency: 10 });

  const result = service.checkQuota("tenant", "unknown-tenant", request);

  assert.equal(result.passed, true);
  assert.deepEqual(result.failedDimensions, []);
});

test("QuotaEnforcerService.checkQuota enforces registered policy", () => {
  const service = new QuotaEnforcerService();
  service.registerQuota("tenant", "tenant-1", makeQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 5,
      tool_qps: 100,
    },
  }));

  const request = makeMultiResourceQuota({ worker_concurrency: 10 }); // exceeds 5
  const result = service.checkQuota("tenant", "tenant-1", request);

  assert.equal(result.passed, false);
  assert.ok(result.failedDimensions.includes("worker_concurrency"));
});

test("QuotaEnforcerService.checkSingleResourceQuota evaluates single resource", () => {
  const service = new QuotaEnforcerService();
  service.registerQuota("tenant", "tenant-1", makeQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    burstLimit: 100,
    currentUsage: 50,
  }));

  const result = service.checkSingleResourceQuota("tenant", "tenant-1", "runtime_units", 60);

  assert.equal(result.exceeded, true); // 50 + 60 = 110 > 100
});

test("QuotaEnforcerService.checkSingleResourceQuota returns not-exceeded for unregistered", () => {
  const service = new QuotaEnforcerService();

  const result = service.checkSingleResourceQuota("tenant", "unknown", "runtime_units", 1000);

  assert.equal(result.exceeded, false);
  assert.equal(result.remainingUnits, Infinity);
});

test("QuotaEnforcerService.updateUsage updates current usage", () => {
  const service = new QuotaEnforcerService();
  service.registerQuota("tenant", "tenant-1", makeQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    burstLimit: 100,
    currentUsage: 50,
  }));

  service.updateUsage("tenant", "tenant-1", { worker_concurrency: 30 });

  // After update, currentUsage becomes 50 + 30 = 80
  const result = service.checkSingleResourceQuota("tenant", "tenant-1", "runtime_units", 30);
  // projected = 80 + 30 = 110 > 100
  assert.equal(result.exceeded, true);
});

test("QuotaEnforcerService.checkQuota handles multi-dimensional warnings", () => {
  const service = new QuotaEnforcerService();
  service.registerQuota("tenant", "tenant-1", makeQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
    },
  }));

  // Request at soft limit (80% of hard) but under hard limit
  const request = makeMultiResourceQuota({ worker_concurrency: 8 }); // 8 < 10 hard, 8 > 8 soft
  const result = service.checkQuota("tenant", "tenant-1", request);

  assert.equal(result.passed, true);
  assert.ok(result.warningDimensions.includes("worker_concurrency"));
});

test("QuotaEnforcerService.checkQuota multiple dimension failures", () => {
  const service = new QuotaEnforcerService();
  service.registerQuota("tenant", "tenant-1", makeQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 5,
      tool_qps: 50,
      model_tpm: 1000,
    },
  }));

  const request = makeMultiResourceQuota({
    worker_concurrency: 10, // > 5
    tool_qps: 100,          // > 50
  });

  const result = service.checkQuota("tenant", "tenant-1", request);

  assert.equal(result.passed, false);
  assert.ok(result.failedDimensions.includes("worker_concurrency"));
  assert.ok(result.failedDimensions.includes("tool_qps"));
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateMultiDimensionalQuota Tests
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateMultiDimensionalQuota uses single resource when no multiResourceHardLimits", () => {
  const policy = makeQuotaPolicy({ hardLimit: 100, currentUsage: 0 });
  const request = makeMultiResourceQuota({ worker_concurrency: 50 });

  const result = evaluateMultiDimensionalQuota(policy, request);

  // No multiResourceHardLimits, so uses worker_concurrency as single resource check
  // 50 < 100, should pass
  assert.equal(result.passed, true);
  assert.equal(result.overallDecision.exceeded, false);
});

test("evaluateMultiDimensionalQuota with multiResourceHardLimits checks each dimension", () => {
  const policy = makeQuotaPolicy({
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
    },
  });

  const request = makeMultiResourceQuota({ worker_concurrency: 5, tool_qps: 50 });

  const result = evaluateMultiDimensionalQuota(policy, request);

  assert.equal(result.passed, true);
  assert.deepEqual(result.failedDimensions, []);
});

test("evaluateMultiDimensionalQuota detects failed dimension", () => {
  const policy = makeQuotaPolicy({
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 10,
    },
  });

  const request = makeMultiResourceQuota({ worker_concurrency: 15 });

  const result = evaluateMultiDimensionalQuota(policy, request);

  assert.equal(result.passed, false);
  assert.ok(result.failedDimensions.includes("worker_concurrency"));
});

test("evaluateMultiDimensionalQuota uses 80% of hardLimit as soft limit", () => {
  const policy = makeQuotaPolicy({
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 10, // soft = 8
    },
  });

  // Request at exactly hard limit should fail
  const atHard = makeMultiResourceQuota({ worker_concurrency: 10 });
  const hardResult = evaluateMultiDimensionalQuota(policy, atHard);
  assert.equal(hardResult.passed, false);

  // Request at soft limit should warn but not fail
  const atSoft = makeMultiResourceQuota({ worker_concurrency: 8 });
  const softResult = evaluateMultiDimensionalQuota(policy, atSoft);
  assert.equal(softResult.passed, true);
  assert.ok(softResult.warningDimensions.includes("worker_concurrency"));
});
