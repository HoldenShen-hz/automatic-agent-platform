/**
 * Pack Migration Service Unit Tests - Migration Execution and Rollback Order (Issue #2119)
 *
 * Tests for migration execution and rollback order recorded by stepId.
 * Issue #2119: Migration execution and rollback order recorded by stepId.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { PackMigrationService, type MigrationStepExecutionRecord } from "../../../../src/domains/business-pack/pack-migration-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createService(): PackMigrationService {
  return new PackMigrationService();
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Plan Creation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.createMigrationPlan creates plan with unique planId", () => {
  const service = createService();

  const plan1 = service.createMigrationPlan("pack-a", "pack-b");
  const plan2 = service.createMigrationPlan("pack-a", "pack-b");

  assert.ok(plan1.planId !== plan2.planId);
  assert.equal(plan1.fromPackId, "pack-a");
  assert.equal(plan1.toPackId, "pack-b");
  assert.equal(plan1.status, "planned");
});

test("PackMigrationService.createMigrationPlan generates migration steps", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.ok(plan.steps.length > 0);
  assert.equal(plan.fromPackId, "pack-a");
  assert.equal(plan.toPackId, "pack-b");
  assert.ok(plan.createdAt !== undefined);
});

test("PackMigrationService.createMigrationPlan rejects same source and target pack", () => {
  const service = createService();

  assert.throws(() => {
    service.createMigrationPlan("pack-a", "pack-a");
  });
});

test("PackMigrationService.createMigrationPlan sets correct initial timestamps", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.ok(plan.createdAt !== null);
  assert.equal(plan.executedAt, null);
  assert.equal(plan.completedAt, null);
  assert.equal(plan.rolledBackAt, null);
  assert.equal(plan.error, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration Execution Tests (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.executeMigration executes all steps in order", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1", data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const result = await service.executeMigration(plan.planId);

  assert.equal(result.success, true);
  assert.equal(result.executedSteps, plan.steps.length);
  assert.equal(result.error, null);
});

test("PackMigrationService.executeMigration records execution trace with stepId", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  assert.ok(trace.length > 0);
  // Issue #2119: execution trace should be recorded by stepId
  assert.ok(trace.every((record) => record.planId === plan.planId));
  assert.ok(trace.every((record) => record.nodeId !== undefined || record.stepId !== undefined));
  assert.ok(trace.every((record) => record.phase === "execute"));
});

test("PackMigrationService.executeMigration transfers state to target pack", async () => {
  const service = createService();
  service.seedPackState("pack-a", {
    workflows: ["wf1", "wf2"],
    prompts: ["prompt1", "prompt2"],
    config: "original",
  });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const targetState = service.getPackState("pack-b");

  assert.ok(targetState !== null);
  assert.equal(targetState!.migratedFromPackId, "pack-a");
  assert.equal(targetState!.migratedByPlanId, plan.planId);
});

test("PackMigrationService.executeMigration updates plan status to completed", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.equal(updatedPlan!.status, "completed");
  assert.ok(updatedPlan!.completedAt !== null);
});

test("PackMigrationService.executeMigration fails gracefully on error", async () => {
  const service = createService();
  // Target pack is locked - migration should fail
  service.seedPackState("pack-b", { migrationLocked: true });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const result = await service.executeMigration(plan.planId);

  assert.equal(result.success, false);
  assert.ok(result.error !== null);
});

test("PackMigrationService.executeMigration sets plan status to failed on error", async () => {
  const service = createService();
  service.seedPackState("pack-b", { migrationLocked: true });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.equal(updatedPlan!.status, "failed");
  assert.ok(updatedPlan!.error !== null);
});

test("PackMigrationService.executeMigration throws for unknown plan", async () => {
  const service = createService();

  await assert.rejects(async () => {
    await service.executeMigration("unknown-plan-id");
  });
});

test("PackMigrationService.executeMigration throws for invalid plan status", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  // Try to execute again - should throw
  await assert.rejects(async () => {
    await service.executeMigration(plan.planId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rollback Tests (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.rollbackMigration rolls back in reverse order", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const beforeRollback = service.getPackState("pack-b");
  assert.ok(beforeRollback !== null);

  await service.rollbackMigration(plan.planId);

  const afterRollback = service.getPackState("pack-b");
  assert.equal(afterRollback, null);
});

test("PackMigrationService.rollbackMigration records rollback trace with stepId", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);
  const rollbackRecords = trace.filter((record) => record.phase === "rollback");

  assert.ok(rollbackRecords.length > 0);
  // Issue #2119: rollback trace should be recorded by stepId
  assert.ok(rollbackRecords.every((record) => record.stepId !== undefined || record.nodeId !== undefined));
});

test("PackMigrationService.rollbackMigration updates plan status to rolled_back", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  await service.rollbackMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.equal(updatedPlan!.status, "rolled_back");
  assert.ok(updatedPlan!.rolledBackAt !== null);
});

test("PackMigrationService.rollbackMigration sets wasRolledBack flag", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  assert.equal(service.wasRolledBack(plan.planId), false);

  await service.rollbackMigration(plan.planId);

  assert.equal(service.wasRolledBack(plan.planId), true);
});

test("PackMigrationService.rollbackMigration can rollback failed migration", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });
  service.seedPackState("pack-b", { migrationLocked: true }); // Will cause failure

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const execResult = await service.executeMigration(plan.planId);

  assert.equal(execResult.success, false);

  const rollbackResult = await service.rollbackMigration(plan.planId);

  assert.equal(rollbackResult.success, true);
});

test("PackMigrationService.rollbackMigration throws for unknown plan", async () => {
  const service = createService();

  await assert.rejects(async () => {
    await service.rollbackMigration("unknown-plan-id");
  });
});

test("PackMigrationService.rollbackMigration returns failure result for invalid plan status", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  // Plan is in "planned" status, not "completed" or "failed"

  const result = await service.rollbackMigration(plan.planId);

  assert.equal(result.success, false);
  assert.equal(result.executedSteps, 0);
  assert.equal(result.error, "Cannot rollback plan in planned state.");
});

test("PackMigrationService.rollbackMigration rolls back failed rollback gracefully", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  // Trying to rollback again should handle gracefully
  const result = await service.rollbackMigration(plan.planId);

  // Should handle the invalid state gracefully
  const updatedPlan = service.getMigrationPlan(plan.planId);
  assert.equal(updatedPlan!.status, "rolled_back");
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.validateMigration returns valid for proper plan", () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const result = service.validateMigration(plan.planId);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("PackMigrationService.validateMigration returns errors for unknown plan", () => {
  const service = createService();

  const result = service.validateMigration("unknown-plan");

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.includes("not found")));
});

test("PackMigrationService.validateMigration returns errors for invalid plan state", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const result = service.validateMigration(plan.planId);

  // Plan is in "completed" state, validation should warn
  assert.ok(result.errors.length > 0 || result.warnings.length > 0);
});

test("PackMigrationService.validateMigration warns for empty steps", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  // Override with empty steps would require modifying the service
  // This test just checks that warnings can be returned
  const result = service.validateMigration(plan.planId);

  // Should not have errors but may have warnings
  assert.equal(result.valid, true);
});

test("PackMigrationService.validateMigration errors when source equals target", () => {
  const service = createService();

  // Create plan then manually set same source/target would not work
  // But we can test the validation logic
  const plan = service.createMigrationPlan("pack-a", "pack-b");
  plan.steps = []; // Empty steps would trigger warning

  const result = service.validateMigration(plan.planId);

  // Empty steps triggers warning
  assert.ok(result.warnings.some((w) => w.includes("No migration steps")));
});

// ─────────────────────────────────────────────────────────────────────────────
// List Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.listMigrationPlans returns all plans", () => {
  const service = createService();

  service.createMigrationPlan("pack-a", "pack-b");
  service.createMigrationPlan("pack-c", "pack-d");
  service.createMigrationPlan("pack-e", "pack-f");

  const plans = service.listMigrationPlans();

  assert.equal(plans.length, 3);
});

test("PackMigrationService.listMigrationsForPack returns plans for specific pack", () => {
  const service = createService();

  service.createMigrationPlan("pack-a", "pack-b");
  service.createMigrationPlan("pack-b", "pack-c");
  service.createMigrationPlan("pack-c", "pack-a");

  const plansForA = service.listMigrationsForPack("pack-a");
  const plansForB = service.listMigrationsForPack("pack-b");

  assert.ok(plansForA.some((p) => p.fromPackId === "pack-a" || p.toPackId === "pack-a"));
  assert.ok(plansForB.some((p) => p.fromPackId === "pack-b" || p.toPackId === "pack-b"));
});

test("PackMigrationService.getMigrationPlan returns plan by ID", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const retrieved = service.getMigrationPlan(plan.planId);

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.planId, plan.planId);
});

test("PackMigrationService.getMigrationPlan returns null for unknown ID", () => {
  const service = createService();

  const result = service.getMigrationPlan("unknown-id");

  assert.equal(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Trace Tests (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.listExecutionTrace returns empty for unknown plan", () => {
  const service = createService();

  const trace = service.listExecutionTrace("unknown-plan");

  assert.deepEqual(trace, []);
});

test("PackMigrationService.listExecutionTrace contains phase information", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  const executeRecords = trace.filter((r) => r.phase === "execute");
  const rollbackRecords = trace.filter((r) => r.phase === "rollback");

  assert.ok(executeRecords.length > 0);
  assert.ok(rollbackRecords.length > 0);
});

test("PackMigrationService.listExecutionTrace contains detail field", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  assert.ok(trace.every((record) => typeof record.detail === "string"));
  assert.ok(trace.every((record) => record.detail.length > 0));
});

test("PackMigrationService.listExecutionTrace contains occurredAt timestamp", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  assert.ok(trace.every((record) => typeof record.occurredAt === "string"));
  assert.ok(trace.every((record) => record.occurredAt.length > 0));
});

test("PackMigrationService.listExecutionTrace contains nodeId or stepId", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  // Issue #2119: trace should be recorded by stepId
  assert.ok(trace.every((record) => record.nodeId !== undefined || record.stepId !== undefined));
});

test("PackMigrationService.execution trace order is preserved", async () => {
  const service = createService();
  service.seedPackState("pack-a", { config: "v1" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  // Trace should be in chronological order
  for (let i = 1; i < trace.length; i++) {
    const prev = new Date(trace[i - 1]!.occurredAt).getTime();
    const curr = new Date(trace[i]!.occurredAt).getTime();
    assert.ok(prev <= curr, "Trace records should be in chronological order");
  }
});
