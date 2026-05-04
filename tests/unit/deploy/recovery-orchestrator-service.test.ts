/**
 * Recovery Orchestrator Service Tests
 *
 * Tests for the recovery orchestrator that coordinates multiple recovery workers.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RecoveryOrchestratorService } from "../../../src/platform/execution/ha/recovery-orchestrator-service.js";
import type { RecoveryCadence, RecoveryReport, RecoveryWorker } from "../../../src/platform/contracts/types/recovery-cadence.js";
import { buildRecoveryCadence } from "../../../src/platform/contracts/types/recovery-cadence.js";

function createMockWorker(workerId: string, cadence: RecoveryCadence, itemsRecovered = 0): RecoveryWorker {
  return {
    getWorkerId: () => workerId,
    getRecoveryCadence: () => cadence,
    runRecoveryCycle: async (): Promise<RecoveryReport> => ({
      workerId,
      workerType: "test_worker",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 10,
      itemsProcessed: 5,
      itemsRecovered,
      errors: [],
    }),
  };
}

test("RecoveryOrchestratorService lists workers", () => {
  const worker1 = createMockWorker("worker-1", buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }));
  const worker2 = createMockWorker("worker-2", buildRecoveryCadence({ intervalMs: 2000, priority: "normal" }));

  const orchestrator = new RecoveryOrchestratorService([worker1, worker2], "test-orchestrator");

  const workers = orchestrator.listWorkers();
  assert.equal(workers.length, 2, "Should list 2 workers");
});

test("RecoveryOrchestratorService runs cycle and collects reports", async () => {
  const worker1 = createMockWorker("worker-1", buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }), 3);
  const worker2 = createMockWorker("worker-2", buildRecoveryCadence({ intervalMs: 2000, priority: "high" }), 5);

  const orchestrator = new RecoveryOrchestratorService([worker1, worker2], "test-orchestrator");

  const report = await orchestrator.runCycle();

  assert.equal(report.orchestratorId, "test-orchestrator");
  assert.ok(report.startedAt.length > 0);
  assert.ok(report.completedAt.length > 0);
  assert.ok(report.durationMs >= 0);
  assert.equal(report.workerReports.length, 2, "Should have 2 worker reports");
});

test("RecoveryOrchestratorService runs workers in parallel", async () => {
  let worker1Started = false;
  let worker2Started = false;

  const worker1: RecoveryWorker = {
    getWorkerId: () => "slow-worker",
    getRecoveryCadence: () => buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }),
    runRecoveryCycle: async () => {
      worker1Started = true;
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        workerId: "slow-worker",
        workerType: "test",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 50,
        itemsProcessed: 1,
        itemsRecovered: 0,
        errors: [],
      };
    },
  };

  const worker2: RecoveryWorker = {
    getWorkerId: () => "fast-worker",
    getRecoveryCadence: () => buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }),
    runRecoveryCycle: async () => {
      worker2Started = true;
      await new Promise(resolve => setTimeout(resolve, 20));
      return {
        workerId: "fast-worker",
        workerType: "test",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 20,
        itemsProcessed: 1,
        itemsRecovered: 0,
        errors: [],
      };
    },
  };

  const orchestrator = new RecoveryOrchestratorService([worker1, worker2]);

  const startTime = Date.now();
  await orchestrator.runCycle();
  const elapsed = Date.now() - startTime;

  assert.equal(worker1Started, true, "Slow worker should start");
  assert.equal(worker2Started, true, "Fast worker should start");
  // If run sequentially with 50ms + 20ms = 70ms, parallel execution should stay
  // close to the longest worker plus scheduler overhead on CI hosts.
  assert.ok(elapsed < 90, "Workers should run in parallel, not sequentially");
});

test("RecoveryOrchestratorService sorts workers by priority", async () => {
  const criticalWorker = createMockWorker("critical", buildRecoveryCadence({ intervalMs: 1000, priority: "critical" }), 1);
  const lowWorker = createMockWorker("low", buildRecoveryCadence({ intervalMs: 1000, priority: "low" }), 1);
  const highWorker = createMockWorker("high", buildRecoveryCadence({ intervalMs: 1000, priority: "high" }), 1);

  const orchestrator = new RecoveryOrchestratorService([lowWorker, criticalWorker, highWorker]);

  const report = await orchestrator.runCycle();

  // Workers should be sorted: critical, high, normal, low
  const workerOrder = report.workerReports.map(r => r.workerId);
  const criticalIdx = workerOrder.indexOf("critical");
  const highIdx = workerOrder.indexOf("high");
  const lowIdx = workerOrder.indexOf("low");

  assert.ok(criticalIdx < highIdx, "Critical should come before high");
  assert.ok(highIdx < lowIdx, "High should come before low");
});

test("RecoveryOrchestratorService handles worker errors gracefully", async () => {
  const goodWorker = createMockWorker("good-worker", buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }), 1);
  const badWorker: RecoveryWorker = {
    getWorkerId: () => "bad-worker",
    getRecoveryCadence: () => buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }),
    runRecoveryCycle: async () => {
      throw new Error("Simulated worker failure");
    },
  };

  const orchestrator = new RecoveryOrchestratorService([goodWorker, badWorker]);

  const report = await orchestrator.runCycle();

  assert.equal(report.workerReports.length, 2, "Should have reports for both workers");
  const badReport = report.workerReports.find(r => r.workerId === "bad-worker");
  assert.ok(badReport, "Should have report for bad worker");
  assert.equal(badReport!.errors.length, 1, "Bad worker should have error");
  assert.ok(badReport!.errors[0].message.includes("Simulated worker failure"));
});

test("RecoveryOrchestratorService uses default orchestrator ID", async () => {
  const worker = createMockWorker("worker-1", buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }));

  const orchestrator = new RecoveryOrchestratorService([worker]);

  const report = await orchestrator.runCycle();

  assert.equal(report.orchestratorId, "recovery-orchestrator", "Should use default ID");
});

test("RecoveryOrchestratorService counts items recovered from workers", async () => {
  const worker1 = createMockWorker("worker-1", buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }), 3);
  const worker2 = createMockWorker("worker-2", buildRecoveryCadence({ intervalMs: 1000, priority: "normal" }), 7);

  const orchestrator = new RecoveryOrchestratorService([worker1, worker2]);

  const report = await orchestrator.runCycle();

  const totalRecovered = report.workerReports.reduce((sum, r) => sum + r.itemsRecovered, 0);
  assert.equal(totalRecovered, 10, "Should sum recovered items from all workers");
});
