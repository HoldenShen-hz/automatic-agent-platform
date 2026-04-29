import assert from "node:assert/strict";
import test from "node:test";

import { PackMigrationService } from "../../../../src/domains/business-pack/pack-migration-service.js";

test("PackMigrationService records canonical nodeId in execution trace and rollback ordering", async () => {
  const service = new PackMigrationService();
  service.seedPackState("pack-src", { prompts: 2 });

  const plan = service.createMigrationPlan("pack-src", "pack-dst");
  await service.executeMigration(plan.planId);
  await service.rollbackMigration(plan.planId);

  const trace = service.listExecutionTrace(plan.planId);
  assert.ok(trace.every((record) => record.nodeId.length > 0));
  assert.equal(trace[0]?.nodeId, "pack-src_export_state");
  assert.equal(trace[0]?.stepId, "pack-src_export_state");
  assert.equal(trace.at(-1)?.phase, "rollback");
});
