/**
 * Comprehensive unit tests for tier-resolver/index.ts
 *
 * Tests resolveHighestPriorityTier with tenant filtering and SlaTierSchema validation.
 *
 * @see src/scale-ecosystem/sla-engine/tier-resolver/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveHighestPriorityTier,
  SlaTierSchema,
  type SlaTier,
} from "../../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function createTier(overrides: Partial<SlaTier> & { tierId: string; displayName: string; priority: number } = {} as any): SlaTier {
  return {
    tierId: overrides.tierId ?? "default",
    displayName: overrides.displayName ?? "Default",
    priority: overrides.priority ?? 0,
    tenantId: overrides.tenantId,
    availability: overrides.availability,
    externalP95: overrides.externalP95,
    internalP99: overrides.internalP99,
    approvalLatencySlo: overrides.approvalLatencySlo,
    incidentResponseSlo: overrides.incidentResponseSlo,
    costMultiplier: overrides.costMultiplier,
    supportLevel: overrides.supportLevel,
    targetLatencyMs: overrides.targetLatencyMs,
    targetSuccessRate: overrides.targetSuccessRate,
    maxQueueWaitMs: overrides.maxQueueWaitMs,
    preemptionPriority: overrides.preemptionPriority,
    reservedCapacityPercent: overrides.reservedCapacityPercent,
    executionTimeoutMs: overrides.executionTimeoutMs,
    degradationTolerancePercent: overrides.degradationTolerancePercent,
    recoveryAction: overrides.recoveryAction,
    budgetAllocationPercent: overrides.budgetAllocationPercent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveHighestPriorityTier - tenant filtering tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveHighestPriorityTier with no tenantId returns global tier (highest priority) [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-gold", tenantId: "tenant-1", priority: 3 }),
    createTier({ tierId: "global-high", priority: 2 }), // no tenantId = global
    createTier({ tierId: "global-low", priority: 1 }),  // no tenantId = global
  ];

  const result = resolveHighestPriorityTier(tiers);

  // Should return highest priority among global tiers (no tenantId)
  assert.equal(result?.tierId, "global-high");
});

test("resolveHighestPriorityTier with tenantId matches tenant-specific tiers [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-gold", tenantId: "tenant-1", priority: 3 }),
    createTier({ tierId: "global-high", priority: 2 }),
    createTier({ tierId: "global-low", priority: 1 }),
  ];

  const result = resolveHighestPriorityTier(tiers, "tenant-1");

  // Should return tenant-specific tier
  assert.equal(result?.tierId, "tenant-gold");
});

test("resolveHighestPriorityTier with tenantId falls back to global tiers when no tenant-specific match [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "global-high", priority: 2 }),
    createTier({ tierId: "other-tenant", tenantId: "other-tenant", priority: 3 }),
    createTier({ tierId: "global-low", priority: 1 }),
  ];

  const result = resolveHighestPriorityTier(tiers, "non-existent-tenant");

  // Should return highest priority global tier
  assert.equal(result?.tierId, "global-high");
});

test("resolveHighestPriorityTier with tenantId considers both tenant and global tiers [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-medium", tenantId: "tenant-1", priority: 2 }),
    createTier({ tierId: "global-high", priority: 3 }), // higher priority but global
    createTier({ tierId: "global-low", priority: 1 }),
  ];

  const result = resolveHighestPriorityTier(tiers, "tenant-1");

  // Function includes both tenant-specific and global tiers, returns highest priority
  assert.equal(result?.tierId, "global-high");
});

test("resolveHighestPriorityTier with tenantId returns null when only non-matching tenant tiers exist [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "other-tenant", tenantId: "other-tenant", priority: 3 }),
  ];

  const result = resolveHighestPriorityTier(tiers, "tenant-1");

  // No global tiers, no matching tenant tier
  assert.equal(result, null);
});

test("resolveHighestPriorityTier with explicit null tenantId returns only global tiers [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-gold", tenantId: "tenant-1", priority: 3 }),
    createTier({ tierId: "global-medium", priority: 2 }),
    createTier({ tierId: "global-low", priority: 1 }),
  ];

  const result = resolveHighestPriorityTier(tiers, null);

  // null tenantId should only consider global tiers
  assert.equal(result?.tierId, "global-medium");
});

test("resolveHighestPriorityTier with undefined tenantId returns only global tiers [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-gold", tenantId: "tenant-1", priority: 3 }),
    createTier({ tierId: "global-medium", priority: 2 }),
  ];

  const result = resolveHighestPriorityTier(tiers, undefined);

  // undefined tenantId should only consider global tiers
  assert.equal(result?.tierId, "global-medium");
});

test("resolveHighestPriorityTier with tenantId returns highest priority among all matching tiers [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-high", tenantId: "tenant-1", priority: 3 }),
    createTier({ tierId: "tenant-medium", tenantId: "tenant-1", priority: 2 }),
    createTier({ tierId: "tenant-low", tenantId: "tenant-1", priority: 1 }),
    createTier({ tierId: "global-high", priority: 5 }),
    createTier({ tierId: "global-low", priority: 4 }),
  ];

  const result = resolveHighestPriorityTier(tiers, "tenant-1");

  // Global tiers are included in the filter, so global-high wins with priority 5
  assert.equal(result?.tierId, "global-high");
});

test("resolveHighestPriorityTier with tenantId returns highest priority across all eligible tiers [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "tenant-low", tenantId: "tenant-1", priority: 1 }),
    createTier({ tierId: "global-high", priority: 5 }),
  ];

  const result = resolveHighestPriorityTier(tiers, "tenant-1");

  // Both tenant-low and global-high are included, global-high has higher priority
  assert.equal(result?.tierId, "global-high");
});

test("resolveHighestPriorityTier tenant filtering does not mutate input array [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "t1", tenantId: "tenant-1", priority: 1 }),
    createTier({ tierId: "t2", priority: 2 }),
  ];

  resolveHighestPriorityTier(tiers, "tenant-1");

  // Original array should be unchanged
  assert.equal(tiers[0]?.tierId, "t1");
  assert.equal(tiers[0]?.tenantId, "tenant-1");
});

test("resolveHighestPriorityTier tenant filtering does not mutate tier objects [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "t1", tenantId: "tenant-1", priority: 1 }),
    createTier({ tierId: "t2", priority: 2 }),
  ];

  resolveHighestPriorityTier(tiers, "tenant-1");

  // Original objects should be unchanged
  assert.equal(tiers[0]?.priority, 1);
  assert.equal(tiers[1]?.priority, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// SlaTierSchema - comprehensive field validation tests
// ─────────────────────────────────────────────────────────────────────────────

test("SlaTierSchema parses complete valid tier [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "gold",
    displayName: "Gold Tier",
    priority: 3,
    tenantId: "tenant-1",
    availability: 0.9999,
    externalP95: 150,
    internalP99: 80,
    approvalLatencySlo: 3600,
    incidentResponseSlo: 1800,
    costMultiplier: 2.5,
    supportLevel: "premium",
    targetLatencyMs: 500,
    targetSuccessRate: 0.999,
    maxQueueWaitMs: 1000,
    preemptionPriority: 10,
    reservedCapacityPercent: 20,
    executionTimeoutMs: 60000,
    degradationTolerancePercent: 10,
    recoveryAction: "retry",
    budgetAllocationPercent: 15,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.tierId, "gold");
    assert.equal(result.data.tenantId, "tenant-1");
    assert.equal(result.data.availability, 0.9999);
    assert.equal(result.data.externalP95, 150);
    assert.equal(result.data.internalP99, 80);
    assert.equal(result.data.supportLevel, "premium");
  }
});

test("SlaTierSchema validates supportLevel enum [tier-resolver-tenant-filtering]", () => {
  const validLevels = ["basic", "standard", "premium", "enterprise"];

  for (const level of validLevels) {
    const result = SlaTierSchema.safeParse({
      tierId: "test",
      displayName: "Test",
      priority: 1,
      supportLevel: level,
    });
    assert.equal(result.success, true, `supportLevel "${level}" should be valid`);
  }
});

test("SlaTierSchema rejects invalid supportLevel [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    supportLevel: "invalid",
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates recoveryAction enum [tier-resolver-tenant-filtering]", () => {
  const validActions = ["skip", "retry", "escalate", "freeze"];

  for (const action of validActions) {
    const result = SlaTierSchema.safeParse({
      tierId: "test",
      displayName: "Test",
      priority: 1,
      recoveryAction: action,
    });
    assert.equal(result.success, true, `recoveryAction "${action}" should be valid`);
  }
});

test("SlaTierSchema rejects invalid recoveryAction [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    recoveryAction: "invalid",
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates availability range 0-1 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    availability: 1.5,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates availability at boundary 0 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    availability: 0,
  });

  assert.equal(result.success, true);
});

test("SlaTierSchema validates availability at boundary 1 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    availability: 1,
  });

  assert.equal(result.success, true);
});

test("SlaTierSchema validates costMultiplier non-negative [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    costMultiplier: -0.5,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates externalP95 non-negative integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    externalP95: -100,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates internalP99 non-negative integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    internalP99: -100,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates approvalLatencySlo non-negative integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    approvalLatencySlo: -3600,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates incidentResponseSlo non-negative integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    incidentResponseSlo: -1800,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates targetLatencyMs positive integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    targetLatencyMs: 0,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates targetSuccessRate range 0-1 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    targetSuccessRate: 1.5,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates maxQueueWaitMs non-negative integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    maxQueueWaitMs: -100,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates preemptionPriority non-negative integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    preemptionPriority: -5,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates reservedCapacityPercent range 0-100 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    reservedCapacityPercent: 150,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates executionTimeoutMs positive integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    executionTimeoutMs: 0,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates degradationTolerancePercent range 0-100 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    degradationTolerancePercent: 150,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema validates budgetAllocationPercent range 0-100 [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    budgetAllocationPercent: 150,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema applies default availability when not provided [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.availability, 0.999);
  }
});

test("SlaTierSchema applies default supportLevel when not provided [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.supportLevel, "standard");
  }
});

test("SlaTierSchema applies default recoveryAction when not provided [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.recoveryAction, "retry");
  }
});

test("SlaTierSchema applies default costMultiplier when not provided [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.costMultiplier, 1.0);
  }
});

test("SlaTierSchema applies default budgetAllocationPercent when not provided [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.budgetAllocationPercent, 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("resolveHighestPriorityTier handles empty array with tenantId [tier-resolver-tenant-filtering]", () => {
  const result = resolveHighestPriorityTier([], "tenant-1");

  assert.equal(result, null);
});

test("resolveHighestPriorityTier handles tier with all optional fields [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({
      tierId: "full",
      displayName: "Full",
      priority: 1,
      tenantId: "t1",
      availability: 0.9999,
      externalP95: 200,
      internalP99: 100,
      costMultiplier: 1.5,
      supportLevel: "enterprise",
      targetLatencyMs: 500,
      targetSuccessRate: 0.999,
      maxQueueWaitMs: 2000,
      preemptionPriority: 10,
      reservedCapacityPercent: 30,
      executionTimeoutMs: 30000,
      budgetAllocationPercent: 25,
    }),
  ];

  const result = resolveHighestPriorityTier(tiers, "t1");

  assert.equal(result?.tierId, "full");
});

test("resolveHighestPriorityTier returns first tier when all priorities are equal [tier-resolver-tenant-filtering]", () => {
  const tiers: SlaTier[] = [
    createTier({ tierId: "first", displayName: "First", priority: 5, tenantId: "t1" }),
    createTier({ tierId: "second", displayName: "Second", priority: 5, tenantId: "t1" }),
  ];

  const result = resolveHighestPriorityTier(tiers, "t1");

  assert.equal(result?.tierId, "first");
});

test("SlaTierSchema accepts tierId with whitespace (standard Zod min(1) behavior) [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "   ",
    displayName: "Test",
    priority: 1,
  });

  // Zod z.string().min(1) only checks length >= 1, so whitespace-only passes
  assert.equal(result.success, true);
});

test("SlaTierSchema rejects empty displayName [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "",
    priority: 1,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects priority that is not an integer [tier-resolver-tenant-filtering]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1.5,
  });

  assert.equal(result.success, false);
});
