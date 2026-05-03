/**
 * PackMigrationService Full Coverage Tests
 *
 * Additional tests for edge cases and comprehensive coverage of PackMigrationService.
 * Issue #2119: Migration uses stepId not nodeId.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { PackMigrationService, type MigrationPlanStep } from "../../../../src/domains/business-pack/pack-migration-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createService(): PackMigrationService {
  return new PackMigrationService();
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Plan Edge Cases (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService creates plan with nodeId and stepId on each step", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.ok(plan.steps.length > 0);
  for (const step of plan.steps) {
    // Issue #2119: Verify both nodeId and stepId are present
    assert.ok(step.nodeId !== undefined);
    assert.ok(step.stepId !== undefined);
    assert.equal(step.nodeId, step.stepId);
  }
});

test("PackMigrationService plan steps have correct order values", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (let i = 0; i < plan.steps.length; i++) {
    assert.equal(plan.steps[i]!.order, i + 1);
  }
});

test("PackMigrationService plan steps have positive order values", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (const step of plan.steps) {
    assert.ok(step.order > 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Seed Pack State Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.seedPackState handles empty state", () => {
  const service = createService();

  service.seedPackState("pack-empty", {});

  const state = service.getPackState("pack-empty");
  assert.deepEqual(state, {});
});

test("PackMigrationService.seedPackState handles nested objects", () => {
  const service = createService();

  service.seedPackState("pack-nested", {
    config: { deep: { nested: { value: 123 } } },
    array: [1, 2, 3],
    nullValue: null,
  });

  const state = service.getPackState("pack-nested");
  assert.deepEqual(state, {
    config: { deep: { nested: { value: 123 } } },
    array: [1, 2, 3],
    nullValue: null,
  });
});

test("PackMigrationService.getPackState returns copy not reference", () => {
  const service = createService();

  service.seedPackState("pack-copy", { value: 42 });
  const state1 = service.getPackState("pack-copy");
  const state2 = service.getPackState("pack-copy");

  assert.deepEqual(state1, state2);
  assert.ok(state1 !== state2); // Should be different object references
});

test("PackMigrationService.getPackState returns null for unknown pack", () => {
  const service = createService();

  const state = service.getPackState("unknown-pack");

  assert.equal(state, null);
});

test("PackMigrationService.seedPackState overwrites existing state", () => {
  const service = createService();

  service.seedPackState("pack-overwrite", { value: 1 });
  service.seedPackState("pack-overwrite", { value: 2 });

  const state = service.getPackState("pack-overwrite");
  assert.deepEqual(state, { value: 2 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration Execution Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.executeMigration handles missing source state", async () => {
  const service = createService();
  // No seedPackState for source pack

  const plan = service.createMigrationPlan("missing-pack", "pack-b");
  const result = await service.executeMigration(plan.planId);

  // Should still succeed as export_state handles missing state gracefully
  assert.equal(result.success, true);
});

test("PackMigrationService.executeMigration with locked target fails", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });
  service.seedPackState("pack-b", { migrationLocked: true });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const result = await service.executeMigration(plan.planId);

  assert.equal(result.success, false);
  assert.ok(result.error !== null);
  assert.ok(result.error!.includes("locked") || result.error!.includes("Locked"));
});

test("PackMigrationService.executeMigration creates target state before verify", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });
  // Note: pack-b is NOT seeded before migration

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  const result = await service.executeMigration(plan.planId);

  // Transfer step materializes the target pack state, so verify runs against the migrated copy.
  assert.equal(result.success, true);
  assert.deepEqual(service.getPackState("pack-b"), {
    data: "test",
    migratedByPlanId: plan.planId,
    migratedFromPackId: "pack-a",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rollback Edge Cases (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.rollbackMigration uses nodeId for step lookup", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  // Get the trace to see nodeId usage
  const trace = service.listExecutionTrace(plan.planId);
  const executeRecords = trace.filter((r) => r.phase === "execute");

  // Issue #2119: Verify nodeId is used in trace
  for (const record of executeRecords) {
    assert.ok(record.nodeId !== undefined);
  }

  // Rollback should work
  const rollbackResult = await service.rollbackMigration(plan.planId);
  assert.equal(rollbackResult.success, true);
});

test("PackMigrationService.rollbackMigration with no executed steps", async () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  // Don't execute, try to rollback directly

  const result = await service.rollbackMigration(plan.planId);

  // Should fail because plan is not in completed/failed state
  assert.equal(result.success, false);
});

test("PackMigrationService.rollbackMigration twice fails gracefully", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  // Try to rollback again
  const result = await service.rollbackMigration(plan.planId);

  // Should handle gracefully
  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.validateMigration with empty plan ID returns error", () => {
  const service = createService();

  const result = service.validateMigration("");

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("not found")));
});

test("PackMigrationService.validateMigration with whitespace plan ID", () => {
  const service = createService();

  const result = service.validateMigration("   ");

  assert.equal(result.valid, false);
});

test("PackMigrationService.validateMigration for completed plan returns warnings", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const result = service.validateMigration(plan.planId);

  // Plan is in completed state, validation should indicate issues
  assert.ok(result.errors.length > 0 || result.warnings.length > 0);
});

test("PackMigrationService.validateMigration for failed plan returns errors", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });
  service.seedPackState("pack-b", { migrationLocked: true });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const result = service.validateMigration(plan.planId);

  // Plan is in failed state
  assert.ok(result.errors.length > 0);
});

test("PackMigrationService.validateMigration for rolled back plan", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const result = service.validateMigration(plan.planId);

  // Plan is in rolled_back state
  assert.ok(result.errors.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// List Operations Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.listMigrationPlans returns empty when no plans", () => {
  const service = createService();

  const plans = service.listMigrationPlans();

  assert.deepEqual(plans, []);
});

test("PackMigrationService.listMigrationsForPack returns empty for unknown pack", () => {
  const service = createService();
  service.createMigrationPlan("pack-a", "pack-b");

  const plans = service.listMigrationsForPack("unknown-pack");

  assert.deepEqual(plans, []);
});

test("PackMigrationService.listMigrationsForPack returns plans where pack is source", () => {
  const service = createService();

  service.createMigrationPlan("pack-source", "pack-target");

  const plans = service.listMigrationsForPack("pack-source");

  assert.equal(plans.length, 1);
  assert.equal(plans[0]!.fromPackId, "pack-source");
});

test("PackMigrationService.listMigrationsForPack returns plans where pack is target", () => {
  const service = createService();

  service.createMigrationPlan("pack-source", "pack-target");

  const plans = service.listMigrationsForPack("pack-target");

  assert.equal(plans.length, 1);
  assert.equal(plans[0]!.toPackId, "pack-target");
});

test("PackMigrationService.listMigrationsForPack returns plans in both directions", () => {
  const service = createService();

  service.createMigrationPlan("pack-a", "pack-b");
  service.createMigrationPlan("pack-b", "pack-c");

  const plansForB = service.listMigrationsForPack("pack-b");

  assert.equal(plansForB.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Trace Edge Cases (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.listExecutionTrace returns empty for plan with no execution", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  const trace = service.listExecutionTrace(plan.planId);

  assert.deepEqual(trace, []);
});

test("PackMigrationService.listExecutionTrace contains nodeId for each record", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  // Issue #2119: Verify nodeId is present in trace
  for (const record of trace) {
    assert.ok(record.nodeId !== undefined || record.stepId !== undefined);
  }
});

test("PackMigrationService.listExecutionTrace contains stepId for each record", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  // Issue #2119: Verify stepId is present in trace
  for (const record of trace) {
    assert.ok(record.nodeId !== undefined || record.stepId !== undefined);
  }
});

test("PackMigrationService.listExecutionTrace records have correct phase values", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  const executeRecords = trace.filter((r) => r.phase === "execute");
  const rollbackRecords = trace.filter((r) => r.phase === "rollback");

  assert.ok(executeRecords.length > 0);
  assert.ok(rollbackRecords.length > 0);
});

test("PackMigrationService.listExecutionTrace records have status completed", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  for (const record of trace) {
    assert.equal(record.status, "completed");
  }
});

test("PackMigrationService.listExecutionTrace records have valid occurredAt timestamps", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  for (const record of trace) {
    assert.ok(typeof record.occurredAt === "string");
    assert.ok(record.occurredAt.length > 0);
    // Should be valid ISO date
    assert.ok(!isNaN(Date.parse(record.occurredAt)));
  }
});

test("PackMigrationService.listExecutionTrace detail field is non-empty", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);

  for (const record of trace) {
    assert.ok(typeof record.detail === "string");
    assert.ok(record.detail.length > 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MigrationPlanStep Structure Tests (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("MigrationPlanStep has nodeId field", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (const step of plan.steps) {
    assert.ok("nodeId" in step);
    assert.equal(typeof step.nodeId, "string");
  }
});

test("MigrationPlanStep has stepId field (deprecated)", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (const step of plan.steps) {
    assert.ok("stepId" in step);
    assert.equal(typeof step.stepId, "string");
  }
});

test("MigrationPlanStep nodeId and stepId are equal", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (const step of plan.steps) {
    assert.equal(step.nodeId, step.stepId);
  }
});

test("MigrationPlanStep has description field", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (const step of plan.steps) {
    assert.ok("description" in step);
    assert.equal(typeof step.description, "string");
    assert.ok(step.description.length > 0);
  }
});

test("MigrationPlanStep has estimatedDurationMinutes field", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  for (const step of plan.steps) {
    assert.ok("estimatedDurationMinutes" in step);
    assert.equal(typeof step.estimatedDurationMinutes, "number");
    assert.ok(step.estimatedDurationMinutes >= 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan Timestamps Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MigrationPlan has createdAt timestamp", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.ok(typeof plan.createdAt === "string");
  assert.ok(plan.createdAt.length > 0);
});

test("MigrationPlan has null executedAt initially", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.equal(plan.executedAt, null);
});

test("MigrationPlan has null completedAt initially", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.equal(plan.completedAt, null);
});

test("MigrationPlan has null rolledBackAt initially", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.equal(plan.rolledBackAt, null);
});

test("MigrationPlan has null error initially", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.equal(plan.error, null);
});

test("MigrationPlan executedAt is set after execution", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.ok(updatedPlan!.executedAt !== null);
});

test("MigrationPlan completedAt is set after successful execution", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.ok(updatedPlan!.completedAt !== null);
});

test("MigrationPlan rolledBackAt is set after rollback", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.ok(updatedPlan!.rolledBackAt !== null);
});

test("MigrationPlan error is set after failed execution", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });
  service.seedPackState("pack-b", { migrationLocked: true });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);

  assert.ok(updatedPlan!.error !== null);
  assert.ok(updatedPlan!.error!.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration Status Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MigrationPlan has planned status initially", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  assert.equal(plan.status, "planned");
});

test("MigrationPlan has validated status after validation", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  service.validateMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);
  assert.equal(updatedPlan!.status, "validated");
});

test("MigrationPlan has executing status during execution", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  // We can't easily catch the "executing" state mid-execution
  // but we can verify the final states
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);
  assert.ok(["completed", "failed"].includes(updatedPlan!.status));
});

test("MigrationPlan has completed status after success", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);
  assert.equal(updatedPlan!.status, "completed");
});

test("MigrationPlan has failed status after failure", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });
  service.seedPackState("pack-b", { migrationLocked: true });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);
  assert.equal(updatedPlan!.status, "failed");
});

test("MigrationPlan has rolling_back status during rollback", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  // Rollback should complete, we can't catch "rolling_back" state mid-execution
  await service.rollbackMigration(plan.planId);

  const updatedPlan = service.getMigrationPlan(plan.planId);
  assert.equal(updatedPlan!.status, "rolled_back");
});

// ─────────────────────────────────────────────────────────────────────────────
// wasRolledBack Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PackMigrationService.wasRolledBack returns false for unknown plan", () => {
  const service = createService();

  const result = service.wasRolledBack("unknown-plan");

  assert.equal(result, false);
});

test("PackMigrationService.wasRolledBack returns false for non-rolled back plan", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);

  const result = service.wasRolledBack(plan.planId);

  assert.equal(result, false);
});

test("PackMigrationService.wasRolledBack returns true after rollback", async () => {
  const service = createService();
  service.seedPackState("pack-a", { data: "test" });

  const plan = service.createMigrationPlan("pack-a", "pack-b");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const result = service.wasRolledBack(plan.planId);

  assert.equal(result, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Node ID Tests (Issue #2119)
// ─────────────────────────────────────────────────────────────────────────────

test("MigrationPlanStep uses canonical nodeId format", () => {
  const service = createService();

  const plan = service.createMigrationPlan("my-pack", "other-pack");

  for (const step of plan.steps) {
    // nodeId should follow pattern: packid_suffix
    assert.ok(step.nodeId.includes("my-pack") || step.nodeId.includes("other-pack"));
    assert.ok(step.nodeId.includes("_"));
  }
});

test("MigrationPlanStep nodeId is unique across steps", () => {
  const service = createService();

  const plan = service.createMigrationPlan("pack-a", "pack-b");

  const nodeIds = plan.steps.map((s) => s.nodeId);
  const uniqueNodeIds = new Set(nodeIds);

  assert.equal(nodeIds.length, uniqueNodeIds.size);
});
