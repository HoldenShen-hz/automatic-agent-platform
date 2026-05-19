import assert from "node:assert/strict";
import test from "node:test";
import { PackMigrationService } from "../../../../src/domains/business-pack/pack-migration-service.js";
test("PackMigrationService executes migration steps and transfers state to target pack", async () => {
    const service = new PackMigrationService();
    service.seedPackState("pack-a", {
        workflows: 3,
        prompts: ["a", "b"],
    });
    const plan = service.createMigrationPlan("pack-a", "pack-b");
    const result = await service.executeMigration(plan.planId);
    assert.equal(result.success, true);
    assert.equal(result.executedSteps, 4);
    assert.equal(service.getPackState("pack-b")?.["migratedFromPackId"], "pack-a");
    assert.equal(service.listExecutionTrace(plan.planId).length, 4);
});
test("PackMigrationService rolls back transferred state in reverse order", async () => {
    const service = new PackMigrationService();
    service.seedPackState("pack-a", { config: "v1" });
    const plan = service.createMigrationPlan("pack-a", "pack-b");
    await service.executeMigration(plan.planId);
    const rollback = await service.rollbackMigration(plan.planId);
    assert.equal(rollback.success, true);
    assert.equal(service.getPackState("pack-b"), null);
    assert.equal(service.wasRolledBack(plan.planId), true);
    assert.ok(service.listExecutionTrace(plan.planId).some((item) => item.phase === "rollback"));
});
//# sourceMappingURL=pack-migration-service.test.js.map