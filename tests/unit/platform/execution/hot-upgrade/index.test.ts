import assert from "node:assert/strict";
import test from "node:test";

import {
  createHotUpgradeService,
  HotUpgradeService,
  type HotUpgradeServiceOptions,
  type UpgradeStatus,
  type HealthCheckResult,
  type HealthGateConfig,
  type HotUpgradeRepository,
  type RollbackTrigger,
  type UpgradeBatch,
  type UpgradePlan,
  type UpgradeProgress,
  type VersionCompatibility,
} from "../../../../../src/platform/five-plane-execution/hot-upgrade/index.js";

test("createHotUpgradeService is exported as function [index]", () => {
  assert.equal(typeof createHotUpgradeService, "function");
});

test("HotUpgradeService is exported as function [index]", () => {
  assert.equal(typeof HotUpgradeService, "function");
});

test("HotUpgradeServiceOptions is exported as type [index]", () => {
  const options: HotUpgradeServiceOptions = {
    checkIntervalMs: 5000,
    healthGateConfig: {
      maxErrorRate: 0.1,
      minSuccessRate: 0.9,
    },
  };
  assert.equal(options.checkIntervalMs, 5000);
  assert.equal(options.healthGateConfig.maxErrorRate, 0.1);
});

test("UpgradeStatus is exported as type [index]", () => {
  const status: UpgradeStatus = "idle";
  assert.equal(status, "idle");
});

test("HealthCheckResult is exported as type [index]", () => {
  const result: HealthCheckResult = {
    healthy: true,
    timestamp: "2024-01-15T10:00:00Z",
    details: {},
  };
  assert.equal(result.healthy, true);
  assert.ok(result.timestamp !== undefined);
});

test("HealthGateConfig is exported as type [index]", () => {
  const config: HealthGateConfig = {
    maxErrorRate: 0.05,
    minSuccessRate: 0.95,
    sampleWindowSize: 100,
  };
  assert.equal(config.maxErrorRate, 0.05);
  assert.equal(config.minSuccessRate, 0.95);
});

test("HotUpgradeRepository is exported as type [index]", () => {
  const repo: Partial<HotUpgradeRepository> = {
    getUpgradePlan: async () => null,
    listUpgradePlansByStatus: async () => [],
  };
  assert.ok(repo);
});

test("RollbackTrigger is exported as type [index]", () => {
  const trigger: RollbackTrigger = {
    reason: "health_check_failed",
    triggeredAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(trigger.reason, "health_check_failed");
});

test("UpgradeBatch is exported as type [index]", () => {
  const batch: UpgradeBatch = {
    batchId: "batch-001",
    instances: ["instance-1", "instance-2"],
    status: "pending",
  };
  assert.equal(batch.batchId, "batch-001");
  assert.equal(batch.instances.length, 2);
  assert.equal(batch.status, "pending");
});

test("UpgradePlan is exported as type [index]", () => {
  const plan: UpgradePlan = {
    planId: "plan-001",
    targetVersion: "v2.0.0",
    batches: [],
    strategy: "rolling",
  };
  assert.equal(plan.planId, "plan-001");
  assert.equal(plan.targetVersion, "v2.0.0");
});

test("UpgradeProgress is exported as type [index]", () => {
  const progress: UpgradeProgress = {
    planId: "plan-001",
    currentBatch: 1,
    totalBatches: 3,
    percentComplete: 33.33,
  };
  assert.equal(progress.currentBatch, 1);
  assert.equal(progress.totalBatches, 3);
  assert.ok(progress.percentComplete > 0);
});

test("VersionCompatibility is exported as type [index]", () => {
  const compat: VersionCompatibility = {
    from: "v1.0.0",
    to: "v2.0.0",
    compatible: true,
  };
  assert.equal(compat.from, "v1.0.0");
  assert.equal(compat.to, "v2.0.0");
  assert.equal(compat.compatible, true);
});

test("HotUpgradeService can be instantiated with minimal config [index]", () => {
  const mockRepo: Partial<HotUpgradeRepository> = {
    findPlan: async () => null,
    createPlan: async () => ({} as any),
  };
  const service = new HotUpgradeService(mockRepo as HotUpgradeRepository);
  assert.ok(service !== undefined);
});

test("createHotUpgradeService returns service with required methods [index]", () => {
  const service = createHotUpgradeService({
    driver: "sqlite",
    runtimeProfile: {} as any,
    sql: {} as any,
    asyncSql: {} as any,
    asyncRepos: {} as any,
    sqlite: {} as any,
    migrate: () => undefined,
    close: () => undefined,
  });
  assert.ok(service !== undefined);
  assert.ok(typeof service.createUpgradePlan === "function");
  assert.ok(typeof service.startUpgrade === "function");
  assert.ok(typeof service.triggerRollback === "function");
  assert.ok(typeof service.getUpgradeProgress === "function");
});

test("VersionCompatibility works with incompatible version [index]", () => {
  const compat: VersionCompatibility = {
    from: "v1.0.0",
    to: "v3.0.0",
    compatible: false,
    breakingChanges: ["api-changed"],
  };
  assert.equal(compat.compatible, false);
  assert.ok(compat.breakingChanges !== undefined);
});

test("UpgradeBatch with completed status [index]", () => {
  const batch: UpgradeBatch = {
    batchId: "batch-002",
    instances: ["instance-3"],
    status: "completed",
    completedAt: "2024-01-15T11:00:00Z",
  };
  assert.equal(batch.status, "completed");
  assert.ok(batch.completedAt !== undefined);
});

test("UpgradeProgress with zero percent complete [index]", () => {
  const progress: UpgradeProgress = {
    planId: "plan-002",
    currentBatch: 0,
    totalBatches: 5,
    percentComplete: 0,
  };
  assert.equal(progress.percentComplete, 0);
});

test("RollbackTrigger with error reason [index]", () => {
  const trigger: RollbackTrigger = {
    reason: "error_threshold_exceeded",
    errorCount: 10,
    triggeredAt: "2024-01-15T12:00:00Z",
  };
  assert.equal(trigger.reason, "error_threshold_exceeded");
  assert.equal(trigger.errorCount, 10);
});
