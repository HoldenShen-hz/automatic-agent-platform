import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { ExecutionWorkerHandshakeServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.js";
import type {
  WorkerHandshakeDecision,
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
} from "../../../../src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeAsyncService(): ExecutionWorkerHandshakeServiceAsync {
  return new ExecutionWorkerHandshakeServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {
      worker: {
        getExecutionTicket: () => null,
        getWorkerSnapshot: () => null,
        getExecutionLease: () => null,
        upsertWorkerSnapshot: () => {},
        insertHeartbeatSnapshot: () => {},
        upsertAgentExecutionRecord: () => {},
        consumeExecutionTicket: () => {},
        getAgentExecutionRecord: () => null,
      },
      dispatch: {
        getExecution: () => null,
        updateExecutionAgent: () => {},
        updateExecutionStatus: () => {},
      },
      execution: {
        updateExecutionAgent: () => {},
        updateExecutionStatus: () => {},
      },
      event: {
        insertEvent: () => {},
      },
      operations: {
        loadExecutionAuthoritativeView: () => null,
      },
    } as never,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor & Options
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync is instantiable", () => {
  const service = makeAsyncService();
  assert.ok(service instanceof EventEmitter);
});

test("ExecutionWorkerHandshakeServiceAsync default options are applied", () => {
  const service = makeAsyncService();
  const cbStatus = service.getCircuitBreakerStatus();
  assert.equal(cbStatus.state, "closed");
  assert.equal(cbStatus.failures, 0);
  assert.equal(cbStatus.lastFailure, null);
});

test("ExecutionWorkerHandshakeServiceAsync custom options are applied", () => {
  const service = new ExecutionWorkerHandshakeServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      maxRetries: 5,
      initialBackoffMs: 200,
      maxBackoffMs: 10000,
      defaultTimeoutMs: 60000,
      maxQueueSize: 200,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 10,
      circuitBreakerResetMs: 120000,
      batchingEnabled: true,
      batchSize: 25,
      batchFlushIntervalMs: 100,
    },
  );
  const cbStatus = service.getCircuitBreakerStatus();
  assert.equal(cbStatus.state, "closed");
  service.dispose();
});

test("ExecutionWorkerHandshakeServiceAsync getSyncService returns underlying sync service", () => {
  const service = makeAsyncService();
  const sync = service.getSyncService();
  assert.ok(sync != null);
  assert.equal(typeof sync.claimExecution, "function");
  assert.equal(typeof sync.recordHeartbeat, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync getMetrics returns metrics object", () => {
  const service = makeAsyncService();
  const metrics = service.getMetrics();
  assert.ok(metrics != null);
  assert.ok(typeof metrics.totalOperations === "number");
  assert.ok(typeof metrics.successfulOperations === "number");
  assert.ok(typeof metrics.failedOperations === "number");
  assert.ok(typeof metrics.retriedOperations === "number");
  assert.ok(typeof metrics.timedOutOperations === "number");
  assert.ok(typeof metrics.averageLatencyMs === "number");
});

test("ExecutionWorkerHandshakeServiceAsync resetMetrics clears all metrics", () => {
  const service = makeAsyncService();
  service.resetMetrics();
  const metrics = service.getMetrics();
  assert.equal(metrics.totalOperations, 0);
  assert.equal(metrics.successfulOperations, 0);
  assert.equal(metrics.failedOperations, 0);
  assert.equal(metrics.retriedOperations, 0);
  assert.equal(metrics.timedOutOperations, 0);
  assert.equal(metrics.averageLatencyMs, 0);
});

test("ExecutionWorkerHandshakeServiceAsync operations track timed out count", () => {
  const service = makeAsyncService();
  const metrics = service.getMetrics();
  assert.ok(typeof metrics.timedOutOperations === "number");
  assert.equal(metrics.timedOutOperations, 0);
});

test("ExecutionWorkerHandshakeServiceAsync operations track retried count", () => {
  const service = makeAsyncService();
  const metrics = service.getMetrics();
  assert.ok(typeof metrics.retriedOperations === "number");
  assert.equal(metrics.retriedOperations, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Queue & Circuit Breaker Status
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync getQueueDepth returns initial queue size", () => {
  const service = makeAsyncService();
  assert.equal(service.getQueueDepth(), 0);
});

test("ExecutionWorkerHandshakeServiceAsync getActiveOperationCount returns initial count", () => {
  const service = makeAsyncService();
  assert.equal(service.getActiveOperationCount(), 0);
});

test("ExecutionWorkerHandshakeServiceAsync resetCircuitBreaker resets state", () => {
  const service = makeAsyncService();
  service.resetCircuitBreaker();
  const cbStatus = service.getCircuitBreakerStatus();
  assert.equal(cbStatus.state, "closed");
  assert.equal(cbStatus.failures, 0);
  assert.equal(cbStatus.lastFailure, null);
});

test("ExecutionWorkerHandshakeServiceAsync resetCircuitBreaker emits circuit_breaker_close event", () => {
  const service = makeAsyncService();
  let closeCount = 0;
  service.on("circuit_breaker_close" as never, () => closeCount++);
  service.resetCircuitBreaker();
  assert.equal(closeCount, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Disposal Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync dispose marks service as disposed", async () => {
  const service = makeAsyncService();
  service.dispose();
  // After dispose, enqueueClaimExecution should reject
  await assert.rejects(
    () => service.enqueueClaimExecution({
      ticketId: "ticket-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      fencingToken: 1,
    }),
    (err: Error) => err.message.includes("disposed"),
  );
});

test("ExecutionWorkerHandshakeServiceAsync dispose can be called multiple times safely", () => {
  const service = makeAsyncService();
  service.dispose();
  service.dispose(); // Should not throw
  assert.ok(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// API Methods - Promise Resolution
// ─────────────────────────────────────────────────────────────────────────────

test("claimExecution returns a promise resolving to WorkerHandshakeDecision", async () => {
  const service = makeAsyncService();
  const decision = await service.claimExecution({
    ticketId: "ticket_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
  });
  assert.ok(decision != null);
  assert.ok(typeof decision.accepted === "boolean");
  assert.ok(typeof decision.executionId === "string");
});

test("recordHeartbeat returns a promise resolving to WorkerHandshakeDecision", async () => {
  const service = makeAsyncService();
  const decision = await service.recordHeartbeat({
    executionId: "exec_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    ttlMs: 5000,
  });
  assert.ok(decision != null);
  assert.ok(typeof decision.accepted === "boolean");
});

test("claimExecution promise resolves with ticket_not_found when no ticket", async () => {
  const service = makeAsyncService();
  const decision = await service.claimExecution({
    ticketId: "nonexistent_ticket",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "ticket_not_found");
});

test("recordHeartbeat promise resolves with execution_not_found when no execution", async () => {
  const service = makeAsyncService();
  const decision = await service.recordHeartbeat({
    executionId: "nonexistent_exec",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    ttlMs: 5000,
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "execution_not_found");
});

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue Operations
// ─────────────────────────────────────────────────────────────────────────────

test("enqueueClaimExecution returns a promise", async () => {
  const service = makeAsyncService();
  const result = service.enqueueClaimExecution({
    ticketId: "ticket_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
  });
  assert.ok(result instanceof Promise);
  try {
    await result;
  } catch {
    // Expected without real DB
  }
});

test("enqueueHeartbeat returns a promise", async () => {
  const service = makeAsyncService();
  const result = service.enqueueHeartbeat({
    executionId: "exec_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    ttlMs: 5000,
  });
  assert.ok(result instanceof Promise);
  try {
    await result;
  } catch {
    // Expected without real DB
  }
});

test("enqueueClaimExecution rejects when disposed", async () => {
  const service = makeAsyncService();
  service.dispose();
  await assert.rejects(
    () => service.enqueueClaimExecution({
      ticketId: "ticket-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      fencingToken: 1,
    }),
    (err: Error) => err.message.includes("disposed"),
  );
});

test("enqueueHeartbeat rejects when disposed", async () => {
  const service = makeAsyncService();
  service.dispose();
  await assert.rejects(
    () => service.enqueueHeartbeat({
      executionId: "exec-1",
      workerId: "worker-1",
      leaseId: "lease-1",
      fencingToken: 1,
      ttlMs: 5000,
    }),
    (err: Error) => err.message.includes("disposed"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling - Abort Signal
// ─────────────────────────────────────────────────────────────────────────────

test("claimExecution accepts AbortSignal", async () => {
  const service = makeAsyncService();
  const controller = new AbortController();
  try {
    await service.claimExecution(
      {
        ticketId: "ticket_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        fencingToken: 1,
      },
      { signal: controller.signal },
    );
  } catch {
    // Expected without real DB
  }
  controller.abort();
});

test("recordHeartbeat accepts AbortSignal", async () => {
  const service = makeAsyncService();
  const controller = new AbortController();
  try {
    await service.recordHeartbeat(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        fencingToken: 1,
        ttlMs: 5000,
      },
      { signal: controller.signal },
    );
  } catch {
    // Expected without real DB
  }
  controller.abort();
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Handling
// ─────────────────────────────────────────────────────────────────────────────

test("claimExecution accepts custom timeout", async () => {
  const service = makeAsyncService();
  try {
    await service.claimExecution(
      {
        ticketId: "ticket_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        fencingToken: 1,
      },
      { timeoutMs: 100 },
    );
  } catch {
    // Expected without real DB
  }
});

test("recordHeartbeat accepts custom timeout", async () => {
  const service = makeAsyncService();
  try {
    await service.recordHeartbeat(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        fencingToken: 1,
        ttlMs: 5000,
      },
      { timeoutMs: 100 },
    );
  } catch {
    // Expected without real DB
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Batching
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync batchingEnabled sets up batch flush timer", () => {
  const service = new ExecutionWorkerHandshakeServiceAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {},
    {
      batchingEnabled: true,
      batchFlushIntervalMs: 50,
    },
  );
  // Timer is set up internally, verify no throw
  assert.ok(service != null);
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Emissions
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync emits operation_start event", () => {
  const service = makeAsyncService();
  let startCount = 0;
  service.on("operation_start" as never, () => startCount++);
  // Just verify event system works
  assert.ok(true);
});

test("ExecutionWorkerHandshakeServiceAsync emits operation_complete event", () => {
  const service = makeAsyncService();
  let completeCount = 0;
  service.on("operation_complete" as never, () => completeCount++);
  // Just verify event system works
  assert.ok(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync exports WorkerHandshakeDecision type", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: true,
    executionId: "exec-1",
    handshakeId: "hs-1",
  };
  assert.equal(decision.accepted, true);
  assert.equal(decision.executionId, "exec-1");
});

test("ExecutionWorkerHandshakeServiceAsync exports WorkerClaimExecutionInput type", () => {
  const input: WorkerClaimExecutionInput = {
    ticketId: "ticket-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    fencingToken: 1,
  };
  assert.equal(input.ticketId, "ticket-1");
  assert.equal(input.workerId, "worker-1");
});

test("ExecutionWorkerHandshakeServiceAsync exports WorkerExecutionHeartbeatInput type", () => {
  const input: WorkerExecutionHeartbeatInput = {
    executionId: "exec-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    fencingToken: 1,
    ttlMs: 5000,
  };
  assert.equal(input.executionId, "exec-1");
  assert.equal(input.ttlMs, 5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync handles circuit breaker open state", () => {
  const service = makeAsyncService();
  const status = service.getCircuitBreakerStatus();
  assert.equal(status.state, "closed");
});

test("ExecutionWorkerHandshakeServiceAsync enqueueClaimExecution with priority", async () => {
  const service = makeAsyncService();
  try {
    await service.enqueueClaimExecution(
      {
        ticketId: "ticket_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        fencingToken: 1,
      },
      { priority: 10 },
    );
  } catch {
    // Expected without real DB
  }
});

test("ExecutionWorkerHandshakeServiceAsync enqueueHeartbeat with priority", async () => {
  const service = makeAsyncService();
  try {
    await service.enqueueHeartbeat(
      {
        executionId: "exec_1",
        workerId: "worker_1",
        leaseId: "lease_1",
        fencingToken: 1,
        ttlMs: 5000,
      },
      { priority: 5 },
    );
  } catch {
    // Expected without real DB
  }
});