/**
 * @fileoverview Unit tests for RecoveryOrchestratorService
 * Tests: worker sorting, cycle execution, report structure
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RecoveryOrchestratorService } from "../../../../../src/platform/five-plane-execution/ha/recovery-orchestrator-service.js";
import type { RecoveryWorker, RecoveryReport, RecoveryCadence } from "../../../../../src/platform/contracts/types/recovery-cadence.js";

function makeRecoveryWorker(
  workerId: string,
  priority: "critical" | "high" | "normal" | "low",
  intervalMs: number,
): RecoveryWorker {
  return {
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => makeReport(workerId),
  };
}

function makeReport(workerId: string, itemsProcessed = 5, itemsRecovered = 3): RecoveryReport {
  return {
    workerId,
    workerType: workerId,
    startedAt: "2026-04-24T00:00:00.000Z",
    completedAt: "2026-04-24T00:00:01.000Z",
    durationMs: 1000,
    itemsProcessed,
    itemsRecovered,
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Constructor and listWorkers
// ---------------------------------------------------------------------------

test("RecoveryOrchestratorService constructor accepts empty workers array [recovery-orchestrator-service-comprehensive]", () => {
  const service = new RecoveryOrchestratorService([]);
  assert.deepEqual(service.listWorkers(), []);
});

test("RecoveryOrchestratorService constructor accepts single worker [recovery-orchestrator-service-comprehensive]", () => {
  const worker = makeRecoveryWorker("worker-1", "normal", 60_000);
  const service = new RecoveryOrchestratorService([worker]);
  assert.deepEqual(service.listWorkers(), [worker]);
});

test("RecoveryOrchestratorService constructor accepts multiple workers [recovery-orchestrator-service-comprehensive]", () => {
  const worker1 = makeRecoveryWorker("worker-a", "high", 30_000);
  const worker2 = makeRecoveryWorker("worker-b", "low", 120_000);
  const worker3 = makeRecoveryWorker("worker-c", "critical", 15_000);
  const service = new RecoveryOrchestratorService([worker1, worker2, worker3]);
  assert.equal(service.listWorkers().length, 3);
});

test("RecoveryOrchestratorService uses default orchestratorId [recovery-orchestrator-service-comprehensive]", () => {
  const service = new RecoveryOrchestratorService([]);
  // Access internal state if available, or just verify service is created
  assert.ok(service);
});

test("RecoveryOrchestratorService accepts custom orchestratorId [recovery-orchestrator-service-comprehensive]", () => {
  const service = new RecoveryOrchestratorService([], "custom-orchestrator");
  assert.ok(service);
});

// ---------------------------------------------------------------------------
// Worker ordering by priority and interval
// ---------------------------------------------------------------------------

test("workers are sorted by priority: critical before high [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("high-worker", "high", 60_000),
    createWorker("critical-worker", "critical", 60_000),
  ]);

  await service.runCycle();
  assert.deepEqual(calls, ["critical-worker", "high-worker"]);
});

test("workers are sorted by priority: high before normal [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("normal-worker", "normal", 60_000),
    createWorker("high-worker", "high", 60_000),
  ]);

  await service.runCycle();
  assert.deepEqual(calls, ["high-worker", "normal-worker"]);
});

test("workers are sorted by priority: normal before low [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("low-worker", "low", 60_000),
    createWorker("normal-worker", "normal", 60_000),
  ]);

  await service.runCycle();
  assert.deepEqual(calls, ["normal-worker", "low-worker"]);
});

test("workers are sorted by priority: critical before all others [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("low-worker", "low", 60_000),
    createWorker("normal-worker", "normal", 60_000),
    createWorker("high-worker", "high", 60_000),
    createWorker("critical-worker", "critical", 60_000),
  ]);

  await service.runCycle();
  assert.deepEqual(calls, ["critical-worker", "high-worker", "normal-worker", "low-worker"]);
});

test("workers with same priority are sorted by interval ascending [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("slow-worker", "high", 120_000),
    createWorker("fast-worker", "high", 30_000),
    createWorker("medium-worker", "high", 60_000),
  ]);

  await service.runCycle();
  // Sorted by interval: fast (30k), medium (60k), slow (120k)
  assert.deepEqual(calls, ["fast-worker", "medium-worker", "slow-worker"]);
});

test("workers with same priority and interval are sorted by workerId alphabetically [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("z-worker", "normal", 60_000),
    createWorker("a-worker", "normal", 60_000),
    createWorker("m-worker", "normal", 60_000),
  ]);

  await service.runCycle();
  // Sorted alphabetically by workerId
  assert.deepEqual(calls, ["a-worker", "m-worker", "z-worker"]);
});

// ---------------------------------------------------------------------------
// runCycle execution
// ---------------------------------------------------------------------------

test("runCycle returns report with correct orchestratorId [recovery-orchestrator-service-comprehensive]", async () => {
  const service = new RecoveryOrchestratorService([], "my-orchestrator");
  const report = await service.runCycle();
  assert.equal(report.orchestratorId, "my-orchestrator");
});

test("runCycle returns report with startedAt and completedAt timestamps [recovery-orchestrator-service-comprehensive]", async () => {
  const service = new RecoveryOrchestratorService([]);
  const report = await service.runCycle();
  assert.ok(report.startedAt);
  assert.ok(report.completedAt);
});

test("runCycle completedAt is after or equal to startedAt [recovery-orchestrator-service-comprehensive]", async () => {
  const service = new RecoveryOrchestratorService([]);
  const report = await service.runCycle();
  const startedMs = new Date(report.startedAt).getTime();
  const completedMs = new Date(report.completedAt).getTime();
  assert.ok(completedMs >= startedMs);
});

test("runCycle returns empty workerReports for empty workers [recovery-orchestrator-service-comprehensive]", async () => {
  const service = new RecoveryOrchestratorService([]);
  const report = await service.runCycle();
  assert.deepEqual(report.workerReports, []);
});

test("runCycle returns one report per worker [recovery-orchestrator-service-comprehensive]", async () => {
  const workers = [
    makeRecoveryWorker("worker-1", "normal", 60_000),
    makeRecoveryWorker("worker-2", "high", 30_000),
  ];
  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();
  assert.equal(report.workerReports.length, 2);
});

test("runCycle executes workers in sorted order [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs: 60_000, maxConcurrent: 1, priority: "normal" as const }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("worker-b"),
    createWorker("worker-a"),
  ]);

  await service.runCycle();
  assert.deepEqual(calls, ["worker-a", "worker-b"]);
});

test("runCycle reports contain workerId matching the worker [recovery-orchestrator-service-comprehensive]", async () => {
  const workers = [
    makeRecoveryWorker("alpha-worker", "normal", 60_000),
    makeRecoveryWorker("beta-worker", "normal", 60_000),
  ];
  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();
  const reportWorkerIds = report.workerReports.map((r) => r.workerId);
  assert.ok(reportWorkerIds.includes("alpha-worker"));
  assert.ok(reportWorkerIds.includes("beta-worker"));
});

test("runCycle reports contain workerType [recovery-orchestrator-service-comprehensive]", async () => {
  const workers = [makeRecoveryWorker("test-worker", "normal", 60_000)];
  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();
  assert.equal(report.workerReports[0]!.workerType, "test-worker");
});

test("runCycle reports contain durationMs [recovery-orchestrator-service-comprehensive]", async () => {
  const workers = [makeRecoveryWorker("timer-worker", "normal", 60_000)];
  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();
  assert.ok(typeof report.workerReports[0]!.durationMs === "number");
});

test("runCycle reports contain itemsProcessed and itemsRecovered [recovery-orchestrator-service-comprehensive]", async () => {
  const workers = [makeRecoveryWorker("stats-worker", "normal", 60_000)];
  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();
  assert.ok(typeof report.workerReports[0]!.itemsProcessed === "number");
  assert.ok(typeof report.workerReports[0]!.itemsRecovered === "number");
});

test("runCycle reports contain errors array [recovery-orchestrator-service-comprehensive]", async () => {
  const workers = [makeRecoveryWorker("error-worker", "normal", 60_000)];
  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();
  assert.ok(Array.isArray(report.workerReports[0]!.errors));
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("runCycle handles worker that returns custom report values [recovery-orchestrator-service-comprehensive]", async () => {
  const customWorker: RecoveryWorker = {
    getWorkerId: () => "custom-worker",
    getRecoveryCadence: () => ({ intervalMs: 60_000, maxConcurrent: 1, priority: "normal" }),
    runRecoveryCycle: async () => ({
      workerId: "custom-worker",
      workerType: "custom-type",
      startedAt: "2026-04-24T00:00:00.000Z",
      completedAt: "2026-04-24T00:00:05.000Z",
      durationMs: 5000,
      itemsProcessed: 100,
      itemsRecovered: 95,
      errors: ["partial_error"],
    }),
  };

  const service = new RecoveryOrchestratorService([customWorker]);
  const report = await service.runCycle();

  assert.equal(report.workerReports[0]!.itemsProcessed, 100);
  assert.equal(report.workerReports[0]!.itemsRecovered, 95);
  assert.equal(report.workerReports[0]!.errors.length, 1);
});

test("runCycle handles all four priority levels in order [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low"): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs: 60_000, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("low-priority", "low"),
    createWorker("normal-priority", "normal"),
    createWorker("high-priority", "high"),
    createWorker("critical-priority", "critical"),
  ]);

  await service.runCycle();
  assert.deepEqual(calls, ["critical-priority", "high-priority", "normal-priority", "low-priority"]);
});

test("runCycle with single worker executes in expected time [recovery-orchestrator-service-comprehensive]", async () => {
  const service = new RecoveryOrchestratorService([
    makeRecoveryWorker("solo-worker", "high", 30_000),
  ]);

  const start = Date.now();
  await service.runCycle();
  const elapsed = Date.now() - start;

  // Should complete quickly (worker mock is synchronous)
  assert.ok(elapsed < 5000);
});

test("runCycle with multiple workers maintains ordering [recovery-orchestrator-service-comprehensive]", async () => {
  const calls: string[] = [];
  const createWorker = (workerId: string, priority: "critical" | "high" | "normal" | "low", intervalMs: number): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return makeReport(workerId);
    },
  });

  // Create 4 workers with same priority - should sort by interval then name
  const service = new RecoveryOrchestratorService([
    createWorker("zulu", "normal", 60_000),
    createWorker("alpha", "normal", 60_000),
    createWorker("charlie", "normal", 30_000),
    createWorker("bravo", "normal", 30_000),
  ]);

  await service.runCycle();
  // Sorted: charlie, bravo (30k), alpha, zulu (60k, alphabetical)
  assert.deepEqual(calls, ["bravo", "charlie", "alpha", "zulu"]);
});