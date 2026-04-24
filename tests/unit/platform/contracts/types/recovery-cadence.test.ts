import assert from "node:assert/strict";
import test from "node:test";

import {
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryReportError,
  type RecoveryWorker,
  buildRecoveryCadence,
} from "../../../../../src/platform/contracts/types/recovery-cadence.js";

// ---------------------------------------------------------------------------
// RecoveryCadence
// ---------------------------------------------------------------------------

test("buildRecoveryCadence creates valid cadence", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 5000 });
  assert.equal(cadence.intervalMs, 5000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "normal");
});

test("buildRecoveryCadence uses provided maxConcurrent", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: 10 });
  assert.equal(cadence.intervalMs, 1000);
  assert.equal(cadence.maxConcurrent, 10);
});

test("buildRecoveryCadence uses provided priority", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 2000, priority: "high" });
  assert.equal(cadence.priority, "high");
});

test("buildRecoveryCadence clamps intervalMs to minimum 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 0 });
  assert.equal(cadence.intervalMs, 1);
});

test("buildRecoveryCadence clamps negative intervalMs to 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: -100 });
  assert.equal(cadence.intervalMs, 1);
});

test("buildRecoveryCadence clamps maxConcurrent to minimum 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: 0 });
  assert.equal(cadence.maxConcurrent, 1);
});

test("buildRecoveryCadence clamps negative maxConcurrent to 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: -5 });
  assert.equal(cadence.maxConcurrent, 1);
});

test("buildRecoveryCadence truncates decimal values", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1500.7, maxConcurrent: 3.9 });
  assert.equal(cadence.intervalMs, 1500);
  assert.equal(cadence.maxConcurrent, 3);
});

test("RecoveryCadence structure has expected readonly fields", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 5000 });
  // Verify structure matches readonly interface
  assert.equal(typeof cadence.intervalMs, "number");
  assert.equal(typeof cadence.maxConcurrent, "number");
  assert.equal(typeof cadence.priority, "string");
  // Priority should be one of the valid values
  assert.ok(["critical", "high", "normal", "low"].includes(cadence.priority));
});

// ---------------------------------------------------------------------------
// RecoveryReportError
// ---------------------------------------------------------------------------

test("RecoveryReportError structure is correct", () => {
  const error: RecoveryReportError = {
    code: "ERR_CONNECTION_TIMEOUT",
    message: "Failed to connect to worker",
    details: { host: "worker-1", port: 8080 },
  };
  assert.equal(error.code, "ERR_CONNECTION_TIMEOUT");
  assert.equal(error.message, "Failed to connect to worker");
  assert.equal(error.details?.host, "worker-1");
});

test("RecoveryReportError allows optional details", () => {
  const error: RecoveryReportError = {
    code: "ERR_NO_WORKERS",
    message: "No workers available",
  };
  assert.equal(error.details, undefined);
});

// ---------------------------------------------------------------------------
// RecoveryReport
// ---------------------------------------------------------------------------

test("RecoveryReport structure is correct", () => {
  const report: RecoveryReport = {
    workerId: "worker_123",
    workerType: "recovery-agent",
    startedAt: "2026-04-23T00:00:00.000Z",
    completedAt: "2026-04-23T00:01:00.000Z",
    durationMs: 60000,
    itemsProcessed: 100,
    itemsRecovered: 98,
    errors: [],
  };
  assert.equal(report.workerId, "worker_123");
  assert.equal(report.itemsRecovered, 98);
  assert.equal(report.errors.length, 0);
});

test("RecoveryReport includes errors when present", () => {
  const report: RecoveryReport = {
    workerId: "worker_456",
    workerType: "recovery-agent",
    startedAt: "2026-04-23T00:00:00.000Z",
    completedAt: "2026-04-23T00:01:30.000Z",
    durationMs: 90000,
    itemsProcessed: 50,
    itemsRecovered: 45,
    errors: [
      { code: "ERR_TIMEOUT", message: "Item 12 timed out" },
      { code: "ERR_CONNECT", message: "Item 34 connection failed" },
    ],
  };
  assert.equal(report.errors.length, 2);
  assert.equal(report.errors[0]?.code, "ERR_TIMEOUT");
});

test("RecoveryReport allows optional metadata", () => {
  const report: RecoveryReport = {
    workerId: "worker_789",
    workerType: "recovery-agent",
    startedAt: "2026-04-23T00:00:00.000Z",
    completedAt: "2026-04-23T00:00:30.000Z",
    durationMs: 30000,
    itemsProcessed: 10,
    itemsRecovered: 10,
    errors: [],
    metadata: { region: "us-east-1", cluster: "prod" },
  };
  assert.equal(report.metadata?.region, "us-east-1");
});

// ---------------------------------------------------------------------------
// RecoveryWorker
// ---------------------------------------------------------------------------

test("RecoveryWorker interface - class implements getWorkerId", () => {
  class TestWorker implements RecoveryWorker {
    getWorkerId(): string {
      return "worker_test_123";
    }
    getRecoveryCadence(): RecoveryCadence {
      return { intervalMs: 5000, maxConcurrent: 2, priority: "high" };
    }
    async runRecoveryCycle(): Promise<RecoveryReport> {
      return {
        workerId: "worker_test_123",
        workerType: "test",
        startedAt: "2026-04-23T00:00:00.000Z",
        completedAt: "2026-04-23T00:00:30.000Z",
        durationMs: 30000,
        itemsProcessed: 10,
        itemsRecovered: 10,
        errors: [],
      };
    }
  }
  const worker = new TestWorker();
  assert.equal(worker.getWorkerId(), "worker_test_123");
});

test("RecoveryWorker interface - class implements getRecoveryCadence", () => {
  class TestWorker implements RecoveryWorker {
    getWorkerId(): string {
      return "worker_cadence";
    }
    getRecoveryCadence(): RecoveryCadence {
      return { intervalMs: 10000, maxConcurrent: 5, priority: "critical" };
    }
    async runRecoveryCycle(): Promise<RecoveryReport> {
      throw new Error("not implemented");
    }
  }
  const worker = new TestWorker();
  const cadence = worker.getRecoveryCadence();
  assert.equal(cadence.priority, "critical");
  assert.equal(cadence.maxConcurrent, 5);
});

test("RecoveryWorker interface - class implements runRecoveryCycle", async () => {
  class TestWorker implements RecoveryWorker {
    getWorkerId(): string {
      return "worker_async";
    }
    getRecoveryCadence(): RecoveryCadence {
      return { intervalMs: 1000, maxConcurrent: 1, priority: "normal" };
    }
    async runRecoveryCycle(): Promise<RecoveryReport> {
      return {
        workerId: "worker_async",
        workerType: "test",
        startedAt: "2026-04-23T00:00:00.000Z",
        completedAt: "2026-04-23T00:00:05.000Z",
        durationMs: 5000,
        itemsProcessed: 25,
        itemsRecovered: 25,
        errors: [],
      };
    }
  }
  const worker = new TestWorker();
  const report = await worker.runRecoveryCycle();
  assert.equal(report.itemsRecovered, 25);
});

// ---------------------------------------------------------------------------
// RecoveryWorkerPriority
// ---------------------------------------------------------------------------

test("RecoveryWorkerPriority accepts critical priority", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, priority: "critical" });
  assert.equal(cadence.priority, "critical");
});

test("RecoveryWorkerPriority accepts high priority", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, priority: "high" });
  assert.equal(cadence.priority, "high");
});

test("RecoveryWorkerPriority accepts normal priority", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, priority: "normal" });
  assert.equal(cadence.priority, "normal");
});

test("RecoveryWorkerPriority accepts low priority", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, priority: "low" });
  assert.equal(cadence.priority, "low");
});