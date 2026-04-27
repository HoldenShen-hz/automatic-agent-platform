import assert from "node:assert/strict";
import test from "node:test";

import { evaluateQuota, isQuotaExceeded, QuotaPolicySchema, type QuotaPolicy } from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

function makePolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scopeId: "test-scope",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    burstLimit: 120,
    resetWindow: "1h",
    currentUsage: 0,
    ...overrides,
  };
}

test("evaluateQuota allows request within hard limit", () => {
  const policy = makePolicy({ hardLimit: 100, currentUsage: 50 });
  const result = evaluateQuota(policy, 30);
  assert.equal(result.exceeded, false);
  assert.equal(result.warning, false);
  assert.equal(result.usesBurst, false);
  assert.equal(result.remainingUnits, 40);
});

test("evaluateQuota warns when exceeding soft limit", () => {
  const policy = makePolicy({ softLimit: 80, currentUsage: 70 });
  const result = evaluateQuota(policy, 20);
  assert.equal(result.exceeded, false);
  assert.equal(result.warning, true);
});

test("evaluateQuota marks as exceeded when exceeding burst limit", () => {
  const policy = makePolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 100 });
  const result = evaluateQuota(policy, 30);
  assert.equal(result.exceeded, true);
  assert.equal(result.remainingUnits, 0);
});

test("evaluateQuota uses burst when above hard but below burst", () => {
  const policy = makePolicy({ hardLimit: 100, burstLimit: 120, currentUsage: 90 });
  const result = evaluateQuota(policy, 20);
  assert.equal(result.exceeded, false);
  assert.equal(result.usesBurst, true);
  assert.equal(result.remainingUnits, 10);
});

test("isQuotaExceeded returns true when exceeded", () => {
  const policy = makePolicy({ hardLimit: 100, currentUsage: 100 });
  assert.equal(isQuotaExceeded(policy, 21), true);
});

test("isQuotaExceeded returns false when within limit", () => {
  const policy = makePolicy({ hardLimit: 100, currentUsage: 50 });
  assert.equal(isQuotaExceeded(policy, 30), false);
});

test("evaluateQuota handles zero requested units", () => {
  const policy = makePolicy({ hardLimit: 100, currentUsage: 50 });
  const result = evaluateQuota(policy, 0);
  assert.equal(result.exceeded, false);
  assert.equal(result.remainingUnits, 70);
});

test("evaluateQuota handles zero current usage", () => {
  const policy = makePolicy({ hardLimit: 100, currentUsage: 0 });
  const result = evaluateQuota(policy, 100);
  assert.equal(result.exceeded, false);
  assert.equal(result.remainingUnits, 20);
});

test("QuotaPolicySchema parses valid policy", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "scope-1",
    resourceType: "tokens",
    hardLimit: 100,
    currentUsage: 50,
  });
  assert.equal(result.success, true);
});

test("QuotaPolicySchema applies defaults", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "scope-1",
    hardLimit: 100,
    currentUsage: 50,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.resourceType, "runtime_units");
    assert.equal(result.data.resetWindow, "1h");
  }
});

test("QuotaPolicySchema rejects empty scopeId", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "",
    hardLimit: 100,
    currentUsage: 50,
  });
  assert.equal(result.success, false);
});

test("evaluateQuota handles missing soft limit (defaults to hard limit)", () => {
  const policy = makePolicy({ softLimit: undefined, hardLimit: 100, currentUsage: 90 });
  const result = evaluateQuota(policy, 20);
  // Soft limit defaults to hard limit (100), so 110 > 100, should warn
  assert.equal(result.warning, true);
});

test("evaluateQuota calculates remaining units correctly", () => {
  const policy = makePolicy({ hardLimit: 100, burstLimit: 150, currentUsage: 30 });
  const result = evaluateQuota(policy, 50);
  // Projected = 80, remaining from burst = 150 - 80 = 70
  assert.equal(result.remainingUnits, 70);
});
