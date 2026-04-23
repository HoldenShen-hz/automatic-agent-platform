import assert from "node:assert/strict";
import test from "node:test";
import { evaluateQuota, isQuotaExceeded, QuotaPolicySchema, type QuotaPolicy } from "../../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

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