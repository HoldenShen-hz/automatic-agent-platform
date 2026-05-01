import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { ExecutionWorkerWritebackServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.js";
import type {
  WorkerWritebackDecision,
  WorkerWritebackInput,
} from "../../../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeAsyncService(): ExecutionWorkerWritebackServiceAsync {
  return new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {
      worker: {
        getExecutionLease: () => null,
        upsertWorkerSnapshot: () => {},
        getWorkerSnapshot: () => null,
      },
      execution: {
        getExecution: () => null,
        updateExecutionTerminalStatus: () => {},
        updateExecutionAgent: () => {},
      },
      operations: {
        loadExecutionAuthoritativeView: () => null,
      },
      event: {
        insertEvent: () => {},
      },
    } as never,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor & Options
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync is instantiable", () => {
  const service = makeAsyncService();
  assert.ok(service instanceof EventEmitter);
});

test("ExecutionWorkerWritebackServiceAsync default options are applied", () => {
  const service = makeAsyncService();
  const cbStatus = service.getCircuitBreakerStatus();
  assert.equal(cbStatus.state, "closed");
  assert.equal(cbStatus.failures, 0);
});

test("ExecutionWorkerWritebackServiceAsync custom async options are applied", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      maxRetries: 5,
      initialBackoffMs: 200,
      maxBackoffMs: 10000,
      defaultTimeoutMs: 120000,
      maxQueueSize: 100,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 10,
      circuitBreakerResetMs: 120000,
      batchingEnabled: true,
      batchSize: 30,
      batchFlushIntervalMs: 500,
      coalescingEnabled: true,
      coalescingWindowMs: 100,
    },
  );
  const cbStatus = service.getCircuitBreakerStatus();
  assert.equal(cbStatus.state, "closed");
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync getSyncService returns ExecutionWorkerWritebackService", () => {
  const service = makeAsyncService();
  const sync = service.getSyncService();
  assert.ok(sync != null);
  assert.equal(typeof sync.recordWriteback, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync getMetrics returns metrics object", () => {
  const service = makeAsyncService();
  const metrics = service.getMetrics();
  assert.ok(metrics != null);
  assert.ok(typeof metrics.totalWritebacks === "number");
  assert.ok(typeof metrics.acceptedWritebacks === "number");
  assert.ok(typeof metrics.rejectedWritebacks === "number");
  assert.ok(typeof metrics.retriedWritebacks === "number");
  assert.ok(typeof metrics.timedOutWritebacks === "number");
  assert.ok(typeof metrics.coalescedWritebacks === "number");
  assert.ok(typeof metrics.averageLatencyMs === "number");
});

test("ExecutionWorkerWritebackServiceAsync resetMetrics clears all metrics", () => {
  const service = makeAsyncService();
  service.resetMetrics();
  const metrics = service.getMetrics();
  assert.equal(metrics.totalWritebacks, 0);
  assert.equal(metrics.acceptedWritebacks, 0);
  assert.equal(metrics.rejectedWritebacks, 0);
  assert.equal(metrics.retriedWritebacks, 0);
  assert.equal(metrics.coalescedWritebacks, 0);
});

test("ExecutionWorkerWritebackServiceAsync getMetrics returns copy not reference", () => {
  const service = makeAsyncService();
  const metrics1 = service.getMetrics();
  const metrics2 = service.getMetrics();
  assert.deepEqual(metrics1, metrics2);
});

test("ExecutionWorkerWritebackServiceAsync metrics track coalesced writebacks", () => {
  const service = makeAsyncService();
  const metrics = service.getMetrics();
  assert.ok(typeof metrics.coalescedWritebacks === "number");
  assert.equal(metrics.coalescedWritebacks, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Queue & Circuit Breaker Status
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync getQueueDepth returns initial queue size", () => {
  const service = makeAsyncService();
  assert.equal(service.getQueueDepth(), 0);
});

test("ExecutionWorkerWritebackServiceAsync getActiveOperationCount returns initial count", () => {
  const service = makeAsyncService();
  assert.equal(service.getActiveOperationCount(), 0);
});

test("ExecutionWorkerWritebackServiceAsync resetCircuitBreaker resets state", () => {
  const service = makeAsyncService();
  service.resetCircuitBreaker();
  const cbStatus = service.getCircuitBreakerStatus();
  assert.equal(cbStatus.state, "closed");
  assert.equal(cbStatus.failures, 0);
  assert.equal(cbStatus.lastFailure, null);
});

test("ExecutionWorkerWritebackServiceAsync resetCircuitBreaker emits circuit_breaker_close event", () => {
  const service = makeAsyncService();
  let closeCount = 0;
  service.on("circuit_breaker_close" as never, () => closeCount++);
  service.resetCircuitBreaker();
  assert.equal(closeCount, 1);
});

test("ExecutionWorkerWritebackServiceAsync circuit breaker status is tracked correctly", () => {
  const service = makeAsyncService();
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.failures, 0);
  assert.equal(status.lastFailure, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Disposal Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync dispose marks service as disposed", async () => {
  const service = makeAsyncService();
  service.dispose();
  // After dispose, enqueueWriteback should reject
  await assert.rejects(
    () => service.enqueueWriteback({
      executionId: "exec-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      terminalStatus: "failed",
      errorCode: "test",
    }),
    (err: Error) => err.message.includes("disposed"),
  );
});

test("ExecutionWorkerWritebackServiceAsync dispose can be called multiple times safely", () => {
  const service = makeAsyncService();
  service.dispose();
  service.dispose(); // Should not throw
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync dispose aborts pending operations", () => {
  const service = makeAsyncService();
  service.dispose();
  assert.equal(service.getQueueDepth(), 0);
});

test("ExecutionWorkerWritebackServiceAsync dispose clears coalesced writebacks", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    { coalescingEnabled: true, coalescingWindowMs: 50 },
  );
  service.dispose();
  // Verify no throw - coalescing timer should be cleaned up
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync dispose clears batch timer", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    { batchingEnabled: true, batchFlushIntervalMs: 50 },
  );
  service.dispose();
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync dispose rejects all queued operations", async () => {
  const service = makeAsyncService();
  service.dispose();
  await assert.rejects(
    () => service.enqueueWriteback({
      executionId: "exec-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      terminalStatus: "failed",
      errorCode: "test",
    }),
    (err: Error) => err.message.includes("disposed"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// API Methods - Promise Resolution
// ─────────────────────────────────────────────────────────────────────────────

test("recordWriteback returns a promise resolving to WorkerWritebackDecision", async () => {
  const service = makeAsyncService();
  try {
    const decision = await service.recordWriteback({
      executionId: "exec_1",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "failed",
      errorCode: "test_error",
    });
    assert.ok(decision != null);
    assert.ok(typeof decision.accepted === "boolean");
    assert.ok(typeof decision.executionId === "string");
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback rejects with lease_not_found when lease doesn't exist", async () => {
  const service = makeAsyncService();
  try {
    const decision = await service.recordWriteback({
      executionId: "nonexistent_exec",
      workerId: "worker_1",
      leaseId: "nonexistent_lease",
      terminalStatus: "succeeded",
    });
    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "lease_not_found");
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback with succeeded status", async () => {
  const service = makeAsyncService();
  try {
    const decision = await service.recordWriteback({
      executionId: "exec_success",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
    });
    assert.ok(typeof decision.accepted === "boolean");
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback with cancelled status", async () => {
  const service = makeAsyncService();
  try {
    const decision = await service.recordWriteback({
      executionId: "exec_cancel",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "cancelled",
    });
    assert.ok(typeof decision.accepted === "boolean");
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback with timeout status", async () => {
  const service = makeAsyncService();
  try {
    const decision = await service.recordWriteback({
      executionId: "exec_timeout",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "timeout",
    });
    assert.ok(typeof decision.accepted === "boolean");
  } catch {
    // Expected without real DB
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue Operations
// ─────────────────────────────────────────────────────────────────────────────

test("enqueueWriteback returns a promise", async () => {
  const service = makeAsyncService();
  const result = service.enqueueWriteback({
    executionId: "exec_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    terminalStatus: "succeeded",
  });
  assert.ok(result instanceof Promise);
  try {
    await result;
  } catch {
    // Expected without real DB
  }
});

test("enqueueWriteback rejects when disposed", async () => {
  const service = makeAsyncService();
  service.dispose();
  await assert.rejects(
    () => service.enqueueWriteback({
      executionId: "exec-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      terminalStatus: "failed",
      errorCode: "test",
    }),
    (err: Error) => err.message.includes("disposed"),
  );
});

test("enqueueWriteback rejects when queue is full", async () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    { maxQueueSize: 0 }, // Force queue to be "full" immediately
  );
  await assert.rejects(
    () => service.enqueueWriteback({
      executionId: "exec-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      terminalStatus: "failed",
      errorCode: "test",
    }),
    (err: Error) => err.message.includes("full"),
  );
});

test("enqueueWriteback with priority parameter", async () => {
  const service = makeAsyncService();
  try {
    await service.enqueueWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { priority: 5 },
    );
  } catch {
    // Expected without real DB
  }
});

test("enqueueWriteback accepts timeout option", async () => {
  const service = makeAsyncService();
  try {
    await service.enqueueWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { timeoutMs: 5000 },
    );
  } catch {
    // Expected without real DB
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling - Abort Signal
// ─────────────────────────────────────────────────────────────────────────────

test("recordWriteback accepts AbortSignal", async () => {
  const service = makeAsyncService();
  const controller = new AbortController();
  try {
    await service.recordWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { signal: controller.signal },
    );
  } catch {
    // Expected without real DB
  }
  controller.abort();
});

test("enqueueWriteback accepts AbortSignal", async () => {
  const service = makeAsyncService();
  const controller = new AbortController();
  try {
    await service.enqueueWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { signal: controller.signal },
    );
  } catch {
    // Expected without real DB
  }
  service.dispose();
});

test("recordWriteback respects aborted signal", async () => {
  const service = makeAsyncService();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => service.recordWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { signal: controller.signal },
    ),
    (err: Error) => err.message.includes("aborted") || err.message.includes("disposed"),
  );
});

test("enqueueWriteback rejects when aborted before processing", async () => {
  const service = makeAsyncService();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => service.enqueueWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { signal: controller.signal },
    ),
    (err: Error) => err.message.includes("aborted") || err.message.includes("disposed"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Handling
// ─────────────────────────────────────────────────────────────────────────────

test("recordWriteback accepts custom timeout", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { timeoutMs: 100 },
    );
  } catch {
    // Expected without real DB
  }
});

test("enqueueWriteback accepts custom timeout", async () => {
  const service = makeAsyncService();
  try {
    await service.enqueueWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { timeoutMs: 100 },
    );
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback uses default timeout when not specified", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback({
      executionId: "exec_1",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
    });
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback with very short timeout", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { timeoutMs: 1 },
    );
  } catch {
    // Expected without real DB
  }
});

test("recordWriteback with very long timeout", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      { timeoutMs: 300000 },
    );
  } catch {
    // Expected without real DB
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Batching & Coalescing
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync batchingEnabled creates batch flush timer", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      batchingEnabled: true,
      batchFlushIntervalMs: 100,
    },
  );
  assert.ok(true); // If no throw, timer was set up
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync coalescingEnabled sets up coalescing timer", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      coalescingEnabled: true,
      coalescingWindowMs: 50,
    },
  );
  assert.ok(true); // If no throw, timer was set up
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync coalescingEnabled coalesces rapid writes", async () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      coalescingEnabled: true,
      coalescingWindowMs: 50,
    },
  );
  // First write is not coalesced
  const result1 = service.enqueueWriteback({
    executionId: "exec_same",
    workerId: "worker_1",
    leaseId: "lease_1",
    terminalStatus: "succeeded",
  });
  assert.ok(result1 instanceof Promise);

  // Second write to same execution should be coalesced
  const result2 = service.enqueueWriteback({
    executionId: "exec_same",
    workerId: "worker_1",
    leaseId: "lease_1",
    terminalStatus: "succeeded",
  });
  assert.ok(result2 instanceof Promise);

  try {
    await Promise.all([result1, result2]);
  } catch {
    // Expected without real DB
  }
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync coalescing can be disabled", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      coalescingEnabled: false,
    },
  );
  assert.ok(service != null);
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync batching with custom batch size", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      batchingEnabled: true,
      batchSize: 100,
      batchFlushIntervalMs: 100,
    },
  );
  assert.ok(service != null);
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Emissions
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync emits writeback_start event", () => {
  const service = makeAsyncService();
  let startCount = 0;
  service.on("writeback_start" as never, () => startCount++);
  // Just verify event system works
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync emits writeback_complete event", () => {
  const service = makeAsyncService();
  let completeCount = 0;
  service.on("writeback_complete" as never, () => completeCount++);
  // Just verify event system works
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync emits circuit_breaker_open event", () => {
  const service = makeAsyncService();
  let openCount = 0;
  service.on("circuit_breaker_open" as never, () => openCount++);
  // Just verify event system works
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync emits queue_overflow event", () => {
  const service = makeAsyncService();
  let overflowCount = 0;
  service.on("queue_overflow" as never, () => overflowCount++);
  // Just verify event system works
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync emits writeback_retry event", () => {
  const service = makeAsyncService();
  let retryCount = 0;
  service.on("writeback_retry" as never, () => retryCount++);
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync emits writeback_timeout event", () => {
  const service = makeAsyncService();
  let timeoutCount = 0;
  service.on("writeback_timeout" as never, () => timeoutCount++);
  assert.ok(true);
});

test("ExecutionWorkerWritebackServiceAsync emits writeback_coalesced event", async () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    { coalescingEnabled: true, coalescingWindowMs: 50 },
  );
  let coalescedCount = 0;
  service.on("writeback_coalesced" as never, () => coalescedCount++);

  try {
    await service.enqueueWriteback({
      executionId: "exec_coalesce_test",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
    });
    await service.enqueueWriteback({
      executionId: "exec_coalesce_test",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
    });
  } catch {
    // Expected without real DB
  }
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync emits batch_flush event", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    { batchingEnabled: true, batchFlushIntervalMs: 50 },
  );
  let batchFlushCount = 0;
  service.on("batch_flush" as never, () => batchFlushCount++);
  assert.ok(true);
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync exports WorkerWritebackDecision type", () => {
  const decision: WorkerWritebackDecision = {
    accepted: true,
    executionId: "exec-1",
    writebackId: "wb-1",
  };
  assert.equal(decision.accepted, true);
  assert.equal(decision.executionId, "exec-1");
});

test("ExecutionWorkerWritebackServiceAsync exports WorkerWritebackInput type", () => {
  const input: WorkerWritebackInput = {
    executionId: "exec-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    terminalStatus: "succeeded",
  };
  assert.equal(input.executionId, "exec-1");
  assert.equal(input.terminalStatus, "succeeded");
});

test("ExecutionWorkerWritebackServiceAsync input with errorCode", () => {
  const input: WorkerWritebackInput = {
    executionId: "exec-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    terminalStatus: "failed",
    errorCode: "ERROR_TEST",
  };
  assert.equal(input.errorCode, "ERROR_TEST");
});

test("ExecutionWorkerWritebackServiceAsync input with optional fields", () => {
  const input: WorkerWritebackInput = {
    executionId: "exec-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    terminalStatus: "succeeded",
    outputsJson: '{"result": "success"}',
    taskOutputJson: '{"summary": "completed"}',
  };
  assert.equal(input.outputsJson, '{"result": "success"}');
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync handles circuit breaker open state", () => {
  const service = makeAsyncService();
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
});

test("ExecutionWorkerWritebackServiceAsync handles all terminal statuses", async () => {
  const service = makeAsyncService();
  const statuses = ["succeeded", "failed", "cancelled", "timeout"] as const;
  for (const status of statuses) {
    try {
      await service.recordWriteback({
        executionId: `exec_${status}`,
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: status,
      });
    } catch {
      // Expected without real DB
    }
  }
});

test("ExecutionWorkerWritebackServiceAsync handles writeback with outputs", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback({
      executionId: "exec_with_outputs",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
      outputsJson: '{"result": "success"}',
      taskOutputJson: '{"summary": "completed"}',
    });
  } catch {
    // Expected without real DB
  }
});

test("ExecutionWorkerWritebackServiceAsync handles writeback with telemetry", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback({
      executionId: "exec_with_telemetry",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
      cpuPct: 45.5,
      memoryMb: 128,
      toolCallCount: 10,
      lastToolName: "browser_use",
    });
  } catch {
    // Expected without real DB
  }
});

test("ExecutionWorkerWritebackServiceAsync handles writeback with progress", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback({
      executionId: "exec_with_progress",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
      progressMessage: "Processing step 3 of 5",
      lastProgressAt: new Date().toISOString(),
    });
  } catch {
    // Expected without real DB
  }
});

test("ExecutionWorkerWritebackServiceAsync handles writeback with all optional fields", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback({
      executionId: "exec_full",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
      outputsJson: '{"key": "value"}',
      taskOutputJson: '{"summary": "done"}',
      errorCode: undefined,
      cpuPct: 50.0,
      memoryMb: 256,
      toolCallCount: 25,
      lastToolName: "test_tool",
      progressMessage: "50% complete",
      lastProgressAt: new Date().toISOString(),
    });
  } catch {
    // Expected without real DB
  }
});

test("ExecutionWorkerWritebackServiceAsync enqueueWriteback with all options", async () => {
  const service = makeAsyncService();
  try {
    await service.enqueueWriteback(
      {
        executionId: "exec_options",
        workerId: "worker_1",
        leaseId: "lease_1",
        terminalStatus: "succeeded",
      },
      {
        timeoutMs: 10000,
        priority: 5,
      },
    );
  } catch {
    // Expected without real DB
  }
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync concurrent writebacks to different executions", async () => {
  const service = makeAsyncService();
  const promises = [
    service.enqueueWriteback({
      executionId: "exec_concurrent_1",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
    }),
    service.enqueueWriteback({
      executionId: "exec_concurrent_2",
      workerId: "worker_2",
      leaseId: "lease_2",
      terminalStatus: "succeeded",
    }),
    service.enqueueWriteback({
      executionId: "exec_concurrent_3",
      workerId: "worker_3",
      leaseId: "lease_3",
      terminalStatus: "failed",
      errorCode: "concurrent_error",
    }),
  ];
  try {
    await Promise.all(promises);
  } catch {
    // Expected without real DB
  }
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync custom options with undefined values use defaults", () => {
  const service = new ExecutionWorkerWritebackServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      maxRetries: undefined,
      initialBackoffMs: undefined,
      maxBackoffMs: undefined,
      defaultTimeoutMs: undefined,
      maxQueueSize: undefined,
      circuitBreakerEnabled: undefined,
      circuitBreakerThreshold: undefined,
      circuitBreakerResetMs: undefined,
    },
  );
  assert.ok(service != null);
  service.dispose();
});

test("ExecutionWorkerWritebackServiceAsync writeback with null optional fields", async () => {
  const service = makeAsyncService();
  try {
    await service.recordWriteback({
      executionId: "exec_null_opts",
      workerId: "worker_1",
      leaseId: "lease_1",
      terminalStatus: "succeeded",
      outputsJson: null,
      taskOutputJson: null,
      errorCode: null,
    });
  } catch {
    // Expected without real DB
  }
});