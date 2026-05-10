import assert from "node:assert/strict";
import test from "node:test";

import { PackMigrationService } from "../../../../src/domains/business-pack/pack-migration-service.js";

test("PackMigrationService records canonical nodeId in execution trace and rollback ordering", async () => {
  const service = new PackMigrationService();
  service.seedPackState("pack-src", { prompts: 2 });

  const plan = service.createMigrationPlan("pack-src", "pack-dst");
  (plan.steps as Array<{ nodeId?: string; stepId: string }>)[0] = {
    ...plan.steps[0]!,
    nodeId: "canonical_export_state",
    stepId: "legacy_export_state",
  };
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);
  assert.ok(trace.every((record) => record.nodeId.length > 0));
  assert.equal(trace[0]?.nodeId, "canonical_export_state");
  assert.equal(trace[0]?.stepId, "legacy_export_state");
  assert.equal(trace.at(-1)?.nodeId, "canonical_export_state");
  assert.equal(trace.at(-1)?.stepId, "legacy_export_state");
  assert.equal(trace.at(-1)?.phase, "rollback");
});
