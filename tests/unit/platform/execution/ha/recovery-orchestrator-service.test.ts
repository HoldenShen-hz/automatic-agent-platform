import assert from "node:assert/strict";
import test from "node:test";

import { RecoveryOrchestratorService } from "../../../../../src/platform/execution/ha/recovery-orchestrator-service.js";
import type { RecoveryWorker } from "../../../../../src/platform/contracts/types/recovery-cadence.js";

test("RecoveryOrchestratorService orders workers by priority and interval", async () => {
  const calls: string[] = [];
  const createWorker = (
    workerId: string,
    priority: "critical" | "high" | "normal" | "low",
    intervalMs: number,
  ): RecoveryWorker => ({
    getWorkerId: () => workerId,
    getRecoveryCadence: () => ({ intervalMs, maxConcurrent: 1, priority }),
    runRecoveryCycle: async () => {
      calls.push(workerId);
      return {
        workerId,
        workerType: workerId,
        startedAt: "2026-04-24T00:00:00.000Z",
        completedAt: "2026-04-24T00:00:01.000Z",
        durationMs: 1000,
        itemsProcessed: 1,
        itemsRecovered: 1,
        errors: [],
      };
    },
  });

  const service = new RecoveryOrchestratorService([
    createWorker("normal-worker", "normal", 60_000),
    createWorker("critical-worker", "critical", 120_000),
    createWorker("high-worker", "high", 30_000),
  ]);

  const report = await service.runCycle();

  assert.deepStrictEqual(calls, ["critical-worker", "high-worker", "normal-worker"]);
  assert.equal(report.workerReports.length, 3);
});
