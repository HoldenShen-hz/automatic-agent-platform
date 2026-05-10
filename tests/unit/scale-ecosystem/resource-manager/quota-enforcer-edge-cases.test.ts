/**
 * Unit tests for QuotaEnforcer edge cases
 *
 * @see src/scale-ecosystem/resource-manager/quota-enforcer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateQuota, isQuotaExceeded, type QuotaPolicy } from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

function createQuotaPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: overrides.scope ?? "tenant",
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit ?? 80,
    burstLimit: overrides.burstLimit ?? 120,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 50,
  };
}

test("evaluateQuota with zero requestedUnits returns full remaining", () => {
  const policy = createQuotaPolicy({ currentUsage: 70, burstLimit: 100 });

  const decision = evaluateQuota(policy, 0);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.usesBurst, false);
  assert.equal(decision.remainingUnits, 30);
});

test("evaluateQuota with requestedUnits that brings exactly to burstLimit", () => {
  const policy = createQuotaPolicy({ currentUsage: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 20);

  // projected = 100, burstLimit = 100, not exceeded
  assert.equal(decision.exceeded, false);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota with requestedUnits that exceeds burstLimit by 1", () => {
  const policy = createQuotaPolicy({ currentUsage: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 21);

  // projected = 101, burstLimit = 100, exceeded
  assert.equal(decision.exceeded, true);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota uses hardLimit as burstLimit when burstLimit not provided", () => {
  const policy = createQuotaPolicy({ hardLimit: 100, burstLimit: undefined });

  const decision = evaluateQuota(policy, 101);

  // burstLimit defaults to hardLimit = 100, so 101 > 100 = exceeded
  assert.equal(decision.exceeded, true);
});

test("evaluateQuota remainingUnits never goes negative", () => {
  const policy = createQuotaPolicy({ currentUsage: 150, burstLimit: 100 });

  const decision = evaluateQuota(policy, 10);

  assert.equal(decision.remainingUnits, 0);
});

test("isQuotaExceeded delegates to evaluateQuota.exceeded", () => {
  const policy = createQuotaPolicy({ currentUsage: 90, burstLimit: 100 });

  const result = isQuotaExceeded(policy, 20);

  // projected = 110 > 100 = true
  assert.equal(result, true);
});

test("isQuotaExceeded returns false when exactly at limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, burstLimit: 100 });

  const result = isQuotaExceeded(policy, 0);

  assert.equal(result, false);
});

test("evaluateQuota warning triggers when projected equals softLimit", () => {
  const policy = createQuotaPolicy({ currentUsage: 60, softLimit: 80 });

  const decision = evaluateQuota(policy, 20);

  // projected = 80, softLimit = 80, warning = 80 > 80 = false
  assert.equal(decision.warning, false);
});

test("evaluateQuota warning triggers when projected exceeds softLimit", () => {
  const policy = createQuotaPolicy({ currentUsage: 61, softLimit: 80 });

  const decision = evaluateQuota(policy, 20);

  // projected = 81 > 80 = true
  assert.equal(decision.warning, true);
});
