import assert from "node:assert/strict";
import test from "node:test";

import { RecoveryOrchestratorService } from "../../../../../src/platform/five-plane-execution/ha/recovery-orchestrator-service.js";
import type { RecoveryReport, RecoveryWorker } from "../../../../../src/platform/contracts/types/recovery-cadence.js";

function createMockRecoveryWorker(workerId: string, priority: "critical" | "high" | "normal" | "low" = "normal", intervalMs = 60000): RecoveryWorker {
  return {
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ priority, intervalMs }),
    runRecoveryCycle: async (): Promise<RecoveryReport> => ({
      workerId,
      workerType: "recovery_worker",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 10,
      itemsProcessed: 5,
      itemsRecovered: 3,
      errors: [],
    }),
  };
}

test("RecoveryOrchestratorService lists workers", () => {
  const workers = [createMockRecoveryWorker("worker-1"), createMockRecoveryWorker("worker-2")];
  const service = new RecoveryOrchestratorService(workers);

  const result = service.listWorkers();

  assert.equal(result.length, 2);
  assert.equal(result[0]?.getWorkerId(), "worker-1");
  assert.equal(result[1]?.getWorkerId(), "worker-2");
});

test("RecoveryOrchestratorService runs cycle and returns report", async () => {
  const workers = [createMockRecoveryWorker("worker-1")];
  const service = new RecoveryOrchestratorService(workers);

  const report = await service.runCycle();

  assert.equal(report.orchestratorId, "recovery-orchestrator");
  assert.ok(typeof report.startedAt === "string");
  assert.ok(typeof report.completedAt === "string");
  assert.ok(typeof report.durationMs === "number");
  assert.ok(Array.isArray(report.workerReports));
  assert.equal(report.workerReports.length, 1);
});

test("RecoveryOrchestratorService uses custom orchestratorId", async () => {
  const workers = [createMockRecoveryWorker("worker-1")];
  const service = new RecoveryOrchestratorService(workers, "custom-recovery-id");

  const report = await service.runCycle();

  assert.equal(report.orchestratorId, "custom-recovery-id");
});

test("RecoveryOrchestratorService runs all workers in parallel", async () => {
  let worker1Started = false;
  let worker2Started = false;

  const worker1: RecoveryWorker = {
    getWorkerId: () => "parallel-worker-1",
    getRecoveryCadence: () => ({ priority: "normal", intervalMs: 60000 }),
    runRecoveryCycle: async (): Promise<RecoveryReport> => {
      worker1Started = true;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        workerId: "parallel-worker-1",
        workerType: "recovery_worker",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 50,
        itemsProcessed: 1,
        itemsRecovered: 1,
        errors: [],
      };
    },
  };

  const worker2: RecoveryWorker = {
    getWorkerId: () => "parallel-worker-2",
    getRecoveryCadence: () => ({ priority: "normal", intervalMs: 60000 }),
    runRecoveryCycle: async (): Promise<RecoveryReport> => {
      worker2Started = true;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        workerId: "parallel-worker-2",
        workerType: "recovery_worker",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 50,
        itemsProcessed: 2,
        itemsRecovered: 2,
        errors: [],
      };
    },
  };

  const service = new RecoveryOrchestratorService([worker1, worker2]);
  const startTime = Date.now();
  await service.runCycle();
  const elapsed = Date.now() - startTime;

  // Both should have started within a short time (proving parallel execution)
  assert.ok(worker1Started && worker2Started);
  // Total time should be close to single worker time (~50ms), not double (~100ms)
  assert.ok(elapsed < 90, `Expected parallel execution < 90ms, got ${elapsed}ms`);
});

test("RecoveryOrchestratorService handles worker errors gracefully", async () => {
  const errorWorker: RecoveryWorker = {
    getWorkerId: () => "error-worker",
    getRecoveryCadence: () => ({ priority: "normal", intervalMs: 60000 }),
    runRecoveryCycle: async (): Promise<RecoveryReport> => {
      throw new Error("Worker failed");
    },
  };

  const service = new RecoveryOrchestratorService([errorWorker]);
  const report = await service.runCycle();

  assert.equal(report.workerReports.length, 1);
  assert.equal(report.workerReports[0]?.workerId, "error-worker");
  assert.ok(report.workerReports[0]?.errors.length > 0);
  assert.ok(report.workerReports[0]?.errors[0]?.message.includes("Worker failed"));
});

test("RecoveryOrchestratorService sorts workers by priority order", async () => {
  const lowWorker = createMockRecoveryWorker("low-worker", "low");
  const criticalWorker = createMockRecoveryWorker("critical-worker", "critical");
  const highWorker = createMockRecoveryWorker("high-worker", "high");
  const normalWorker = createMockRecoveryWorker("normal-worker", "normal");

  const workers = [normalWorker, lowWorker, criticalWorker, highWorker];
  const service = new RecoveryOrchestratorService(workers);

  const report = await service.runCycle();

  // Workers should be sorted: critical, high, normal, low
  assert.equal(report.workerReports[0]?.workerId, "critical-worker");
  assert.equal(report.workerReports[1]?.workerId, "high-worker");
  assert.equal(report.workerReports[2]?.workerId, "normal-worker");
  assert.equal(report.workerReports[3]?.workerId, "low-worker");
});

test("RecoveryOrchestratorService sorts workers by intervalMs as secondary criteria", async () => {
  const worker1 = createMockRecoveryWorker("interval-100", "normal", 100);
  const worker2 = createMockRecoveryWorker("interval-50", "normal", 50);
  const worker3 = createMockRecoveryWorker("interval-200", "normal", 200);

  const workers = [worker3, worker1, worker2];
  const service = new RecoveryOrchestratorService(workers);

  const report = await service.runCycle();

  // Same priority, sorted by intervalMs ascending
  assert.equal(report.workerReports[0]?.workerId, "interval-50");
  assert.equal(report.workerReports[1]?.workerId, "interval-100");
  assert.equal(report.workerReports[2]?.workerId, "interval-200");
});

test("RecoveryOrchestratorService handles empty workers array", async () => {
  const service = new RecoveryOrchestratorService([]);

  const report = await service.runCycle();

  assert.equal(report.workerReports.length, 0);
  assert.equal(report.durationMs, 0);
});

test("RecoveryOrchestratorService computes durationMs correctly", async () => {
  const slowWorker: RecoveryWorker = {
    getWorkerId: () => "slow-worker",
    getRecoveryCadence: () => ({ priority: "normal", intervalMs: 60000 }),
    runRecoveryCycle: async (): Promise<RecoveryReport> => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        workerId: "slow-worker",
        workerType: "recovery_worker",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        itemsProcessed: 1,
        itemsRecovered: 1,
        errors: [],
      };
    },
  };

  const service = new RecoveryOrchestratorService([slowWorker]);
  const report = await service.runCycle();

  assert.ok(report.durationMs >= 100, `Expected duration >= 100ms, got ${report.durationMs}ms`);
});

test("RecoveryOrchestratorService handles single worker", async () => {
  const workers = [createMockRecoveryWorker("solo-worker", "high", 30000)];
  const service = new RecoveryOrchestratorService(workers);

  const report = await service.runCycle();

  assert.equal(report.workerReports.length, 1);
  assert.equal(report.workerReports[0]?.workerId, "solo-worker");
  assert.ok(report.durationMs >= 0);
});
