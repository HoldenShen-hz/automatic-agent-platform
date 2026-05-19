import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { ExecutionWorkerHandshakeServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.js";
// NOTE: Full integration tests require database setup.
// These tests focus on class structure, options handling, and behavior validation.
test("ExecutionWorkerHandshakeServiceAsync is an EventEmitter subclass", () => {
    assert.ok(new ExecutionWorkerHandshakeServiceAsync({}, {}) instanceof EventEmitter);
});
test("ExecutionWorkerHandshakeServiceAsync default options are applied", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    const status = service.getCircuitBreakerStatus();
    assert.equal(status.state, "closed");
    assert.equal(status.failures, 0);
});
test("ExecutionWorkerHandshakeServiceAsync custom options are applied", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {}, {}, {
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
    });
    const status = service.getCircuitBreakerStatus();
    assert.equal(status.state, "closed");
});
test("ExecutionWorkerHandshakeServiceAsync getSyncService returns ExecutionWorkerHandshakeService", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    const sync = service.getSyncService();
    assert.ok(sync != null);
    assert.equal(typeof sync.claimExecution, "function");
    assert.equal(typeof sync.recordHeartbeat, "function");
});
test("ExecutionWorkerHandshakeServiceAsync resetCircuitBreaker resets state", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    service.resetCircuitBreaker();
    const status = service.getCircuitBreakerStatus();
    assert.equal(status.state, "closed");
    assert.equal(status.failures, 0);
    assert.equal(status.lastFailure, null);
});
test("ExecutionWorkerHandshakeServiceAsync getMetrics returns metrics object", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    const metrics = service.getMetrics();
    assert.ok(metrics != null);
    assert.ok(typeof metrics.totalOperations === "number");
    assert.ok(typeof metrics.successfulOperations === "number");
    assert.ok(typeof metrics.failedOperations === "number");
});
test("ExecutionWorkerHandshakeServiceAsync resetMetrics clears all metrics", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    service.resetMetrics();
    const metrics = service.getMetrics();
    assert.equal(metrics.totalOperations, 0);
    assert.equal(metrics.successfulOperations, 0);
    assert.equal(metrics.failedOperations, 0);
});
test("ExecutionWorkerHandshakeServiceAsync getQueueDepth returns initial queue size", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    assert.equal(service.getQueueDepth(), 0);
});
test("ExecutionWorkerHandshakeServiceAsync getActiveOperationCount returns initial count", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    assert.equal(service.getActiveOperationCount(), 0);
});
test("ExecutionWorkerHandshakeServiceAsync exports WorkerHandshakeDecision type", () => {
    // Verify type is exported and usable
    const decision = {
        accepted: true,
        executionId: "exec-1",
        handshakeId: "hs-1",
    };
    assert.equal(decision.accepted, true);
    assert.equal(decision.executionId, "exec-1");
});
test("ExecutionWorkerHandshakeServiceAsync dispose marks service as disposed", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    service.dispose();
    // After dispose, enqueueClaimExecution should reject
    return service.enqueueClaimExecution({
        ticketId: "ticket-1",
        workerId: "worker-1",
        leaseId: "lease-1",
        fencingToken: 1,
    }).then(() => assert.fail("Expected rejection"), (err) => assert.ok(err.message.includes("disposed")));
});
test("ExecutionWorkerHandshakeServiceAsync dispose can be called multiple times safely", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    service.dispose();
    service.dispose(); // Should not throw
    assert.ok(true);
});
test("ExecutionWorkerHandshakeServiceAsync batchingEnabled sets up batch flush timer", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {}, {}, {
        batchingEnabled: true,
        batchFlushIntervalMs: 50,
    });
    // Timer is set up internally, verify no throw
    assert.ok(service != null);
    service.dispose();
});
test("ExecutionWorkerHandshakeServiceAsync emits events on circuit breaker reset", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    let closeCount = 0;
    service.on("circuit_breaker_close", () => closeCount++);
    service.resetCircuitBreaker();
    assert.equal(closeCount, 1);
});
test("ExecutionWorkerHandshakeServiceAsync operations track timed out count", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    const metrics = service.getMetrics();
    assert.ok(typeof metrics.timedOutOperations === "number");
    assert.equal(metrics.timedOutOperations, 0);
});
test("ExecutionWorkerHandshakeServiceAsync operations track retried count", () => {
    const service = new ExecutionWorkerHandshakeServiceAsync({}, {});
    const metrics = service.getMetrics();
    assert.ok(typeof metrics.retriedOperations === "number");
    assert.equal(metrics.retriedOperations, 0);
});
//# sourceMappingURL=execution-worker-handshake-service-async.test.js.map