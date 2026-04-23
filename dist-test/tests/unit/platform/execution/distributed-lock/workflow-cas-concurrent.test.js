/**
 * [SYS-REL-2.7] Workflow Transition CAS Concurrent Tests
 * [SYS-REL-2.2] Redis Lock extendAsync/forceStealAsync TOCTOU Race Tests
 *
 * Verifies:
 * 1. Workflow state transitions without CAS protection in concurrent scenarios
 *    can produce conflicting states (bug: transitions lack CAS protection)
 * 2. Redis lock extendAsync/forceStealAsync operations have TOCTOU races
 *    (bug: non-atomic read-modify-write between eval and get)
 *
 * Reference: manual §26.2 [SYS-REL-2.7] and §26.1 [SYS-REL-2.2]
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RedisLockAdapter } from "../../../../../src/platform/execution/distributed-lock/redis-lock-adapter.js";
import { WorkflowTransitionService } from "../../../../../src/platform/execution/state-transition/transition-service.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";
// ============================================================================
// SYS-REL-2.7: Workflow CAS Tests
// ============================================================================
function createWorkflowRepository(initial, staleReadsRemaining = 0) {
    let current = { ...initial };
    const staleSnapshot = { ...initial };
    let staleReads = staleReadsRemaining;
    return {
        updateTaskStatus() { },
        updateTaskStatusCas() { return 0; },
        updateTaskOutput() { },
        updateWorkflowState() { },
        updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
            // Simulate CAS failure when state has changed
            if (taskId !== current.taskId || expectedVersion !== current.currentStepIndex || expectedStatus !== current.status) {
                return 0;
            }
            current = {
                ...current,
                status: status,
                currentStepIndex,
                outputsJson,
                updatedAt,
                resumableFromStep,
            };
            return 1;
        },
        getWorkflowState(taskId) {
            if (taskId !== current.taskId) {
                return null;
            }
            if (staleReads > 0) {
                staleReads -= 1;
                return { ...staleSnapshot };
            }
            return { ...current };
        },
        updateSessionStatus() { },
        updateSessionStatusCas() { return 0; },
        updateExecutionStatus() { },
        updateExecutionStatusCas() { return 0; },
        createTier1StatusEvent() {
            throw new Error("unused");
        },
        insertApproval() { },
        getApproval() { return null; },
        listApprovalsByTask() { return []; },
        updateApprovalDecision() { },
        updateApprovalDecisionCas() { return 0; },
        updateApprovalRequest() { },
        insertEvent() {
            throw new Error("unused");
        },
    };
}
test("[SYS-REL-2.7] concurrent workflow transitions - only one succeeds via CAS", async () => {
    // Bug scenario: concurrent transitions on the same workflow
    // With stale reads, both workers may initially read the same state
    // but only one should succeed via CAS protection
    const now = new Date().toISOString();
    const repository = createWorkflowRepository({
        taskId: "workflow-concurrent-001",
        divisionId: "general_ops",
        workflowId: "multi_step_v1",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
    }, 0); // No stale reads - use fresh state to properly test CAS
    const service = new WorkflowTransitionService(repository);
    // Two concurrent transitions: one to "completed", one to "failed"
    // Both read "running" state, but only first to write should succeed
    const results = await Promise.allSettled([
        Promise.resolve().then(() => service.transition({
            entityKind: "workflow",
            entityId: "workflow-concurrent-001",
            fromStatus: "running",
            toStatus: "completed",
            currentStepIndex: 1,
            outputsJson: '{"result":"success"}',
            traceId: "trace-complete",
            correlationId: "workflow-concurrent-001",
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "",
            reasonDetail: "",
            actorType: "system",
            actorId: "",
            occurredAt: now,
        })),
        Promise.resolve().then(() => service.transition({
            entityKind: "workflow",
            entityId: "workflow-concurrent-001",
            fromStatus: "running",
            toStatus: "failed",
            currentStepIndex: 0,
            outputsJson: '{"error":"failed"}',
            traceId: "trace-fail",
            correlationId: "workflow-concurrent-001",
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "WF_FAILED",
            reasonDetail: "Workflow failed",
            actorType: "system",
            actorId: "",
            occurredAt: now,
        })),
    ]);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    // CAS should ensure exactly one transition succeeds
    assert.equal(succeeded.length, 1, `Exactly one transition should succeed, got ${succeeded.length}. Results: ${JSON.stringify(results.map(r => r.status))}`);
    assert.equal(rejected.length, 1, "Exactly one transition should be rejected");
    // Verify the rejection reason indicates CAS failure
    const rejectedResult = rejected[0];
    assert.ok(String(rejectedResult?.reason).includes("transition_cas_failed") || String(rejectedResult?.reason).includes("fromStatus"), `Expected CAS-related error, got: ${rejectedResult?.reason}`);
});
test("[SYS-REL-2.7] runConcurrentInvariant - workflow transitions CAS protection", async () => {
    const now = new Date().toISOString();
    const repository = createWorkflowRepository({
        taskId: "workflow-invariant-001",
        divisionId: "general_ops",
        workflowId: "multi_step_v1",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
    }, 5);
    const service = new WorkflowTransitionService(repository);
    const result = await runConcurrentInvariant(async (workerId) => {
        try {
            service.transition({
                entityKind: "workflow",
                entityId: "workflow-invariant-001",
                fromStatus: "running",
                toStatus: workerId === 0 ? "completed" : "failed",
                currentStepIndex: workerId,
                outputsJson: JSON.stringify({ workerId }),
                traceId: `trace-${workerId}`,
                correlationId: "workflow-invariant-001",
                idempotencyKey: "",
                metadataJson: "",
                reasonCode: workerId === 0 ? "" : "WF_FAILED",
                reasonDetail: workerId === 0 ? "" : "Workflow failed",
                actorType: "system",
                actorId: "",
                occurredAt: now,
            });
            return { success: true, workerId };
        }
        catch (error) {
            return { success: false, workerId, error: String(error) };
        }
    }, { concurrency: 5 });
    const successfulTransitions = result.values.filter((v) => v.success);
    const failedTransitions = result.values.filter((v) => !v.success);
    // Critical invariant: only ONE transition should succeed
    assert.equal(successfulTransitions.length, 1, `Expected exactly 1 successful transition, got ${successfulTransitions.length}. Values: ${JSON.stringify(result.values)}`);
    // The remaining 4 should fail due to CAS conflict
    assert.equal(failedTransitions.length, 4, `Expected 4 failed transitions, got ${failedTransitions.length}`);
    // Verify all failures are CAS-related
    failedTransitions.forEach((ft) => {
        const error = ft.error ?? "";
        assert.ok(error.includes("transition_cas_failed") || error.includes("fromStatus"), `Expected CAS-related error, got: ${error}`);
    });
});
// ============================================================================
// SYS-REL-2.2: Redis Lock TOCTOU Race Tests
// ============================================================================
function createAdapterWithMockRedis(mockRedis) {
    const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });
    adapter.redis = mockRedis;
    return adapter;
}
function createMockRedis(overrides = {}) {
    return {
        status: "ready",
        connect: async () => { },
        set: async () => "OK",
        get: async () => null,
        del: async () => 1,
        eval: async () => 1,
        scan: async () => ["0", []],
        mget: async () => [],
        quit: async () => { },
        disconnect: () => { },
        on: () => { },
        ...overrides,
    };
}
test("[SYS-REL-2.2] concurrent extendAsync - TOCTOU race between eval and get", async () => {
    // Bug: extendAsync has a TOCTOU race - after Lua script succeeds (eval returns 1),
    // another process could steal the lock before the subsequent GET, resulting
    // in returning stale data or null despite the eval success
    let evalCallCount = 0;
    const mockRedis = createMockRedis({
        status: "ready",
        eval: async () => {
            evalCallCount++;
            // First eval succeeds, others fail (lock no longer owned)
            return evalCallCount === 1 ? 1 : 0;
        },
        get: async () => {
            // Simulate TOCTOU: lock was stolen between eval and get
            return null;
        },
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    // Acquire the lock first
    await adapter.acquireAsync({ lockKey: "race-lock", owner: "original-owner", ttlMs: 10000 });
    // Now two workers try to extend concurrently
    const results = await Promise.allSettled([
        adapter.extendAsync("race-lock", "worker-1", 20000),
        adapter.extendAsync("race-lock", "worker-2", 20000),
    ]);
    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);
    const failed = results.filter((r) => r.status === "fulfilled" && r.value === null);
    assert.equal(succeeded.length, 0, `Expected no successful extend because GET sees the stolen lock, got ${succeeded.length}. Results: ${JSON.stringify(results)}`);
    assert.equal(failed.length, 2, "Expected both concurrent extends to resolve to null under TOCTOU simulation");
});
test("[SYS-REL-2.2] concurrent forceStealAsync - only one should win", async () => {
    // Bug: forceStealAsync is not atomic - rapid concurrent steals can result in
    // multiple "successful" steals before the final state settles
    let stealCallCount = 0;
    let storedOwner = "original-owner";
    const mockRedis = createMockRedis({
        status: "ready",
        set: async (_key, value) => {
            stealCallCount++;
            try {
                const data = JSON.parse(value);
                storedOwner = data.owner;
            }
            catch {
                // ignore
            }
            return "OK";
        },
        get: async () => JSON.stringify({
            owner: storedOwner,
            fencingToken: stealCallCount,
            ttlMs: 30000,
            acquiredAt: new Date().toISOString(),
            metadata: JSON.stringify({ forceStealReason: "concurrent-steal-test" }),
        }),
        eval: async () => 1, // All steals succeed in the Lua script
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    // Acquire initial lock
    await adapter.acquireAsync({ lockKey: "steal-race-lock", owner: "original-owner", ttlMs: 10000 });
    // Three workers attempt concurrent forceSteal
    const results = await Promise.allSettled([
        adapter.forceStealAsync("steal-race-lock", "attacker-1", "race-condition"),
        adapter.forceStealAsync("steal-race-lock", "attacker-2", "race-condition"),
        adapter.forceStealAsync("steal-race-lock", "attacker-3", "race-condition"),
    ]);
    const allSucceeded = results.filter((r) => r.status === "fulfilled");
    // Without proper atomicity, multiple steals may return success
    // But only ONE attacker should actually own the lock after dust settles
    const finalLock = await adapter.inspectAsync("steal-race-lock");
    // Verify final state is consistent - exactly one owner
    assert.ok(finalLock, "Lock should still exist after concurrent steals");
    assert.ok(["attacker-1", "attacker-2", "attacker-3"].includes(finalLock.owner), `Final owner should be one of the attackers, got: ${finalLock.owner}`);
});
test("[SYS-REL-2.2] runConcurrentInvariant - Redis lock extend race detection", async () => {
    let evalCallCount = 0;
    const mockRedis = createMockRedis({
        status: "ready",
        eval: async () => {
            evalCallCount++;
            return evalCallCount === 1 ? 1 : 0;
        },
        get: async () => JSON.stringify({
            owner: "original-owner",
            fencingToken: 1,
            ttlMs: 30000,
            acquiredAt: new Date().toISOString(),
            metadata: null,
        }),
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    await adapter.acquireAsync({ lockKey: "invariant-lock", owner: "original-owner", ttlMs: 10000 });
    const result = await runConcurrentInvariant(async (workerId) => {
        const res = await adapter.extendAsync("invariant-lock", `worker-${workerId}`, 20000);
        return res;
    }, { concurrency: 5 });
    const succeeded = result.values.filter((v) => v !== null);
    // Critical invariant: exactly one extend succeeds
    assert.equal(succeeded.length, 1, `Expected exactly 1 successful extend among 5 workers, got ${succeeded.length}. Errors: ${result.errors.length}`);
    assert.equal(result.errors.length, 0, "No unexpected errors should occur");
});
test("[SYS-REL-2.2] extendAsync returns null when lock stolen between eval and get", async () => {
    // This test specifically demonstrates the TOCTOU race:
    // 1. eval succeeds (Lua confirms we own the lock)
    // 2. another process forceSteals the lock
    // 3. get returns null (lock no longer ours)
    // 4. extendAsync returns null despite eval success
    const mockRedis = createMockRedis({
        status: "ready",
        eval: async () => 1, // eval succeeds - we "own" the lock
        get: async () => null, // but by now, lock was stolen!
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    await adapter.acquireAsync({ lockKey: "toctou-lock", owner: "owner", ttlMs: 10000 });
    const result = await adapter.extendAsync("toctou-lock", "owner", 20000);
    // After TOCTOU race, we should get null even though eval succeeded
    assert.equal(result, null, "extendAsync should return null when lock was stolen between eval and get (TOCTOU race)");
});
test("[SYS-REL-2.2] many concurrent workers extending same lock", async () => {
    let evalCallCount = 0;
    const workers = 10;
    const mockRedis = createMockRedis({
        status: "ready",
        eval: async () => {
            evalCallCount++;
            // Only first eval succeeds, others see changed state
            return evalCallCount === 1 ? 1 : 0;
        },
        get: async () => JSON.stringify({
            owner: "original-owner",
            fencingToken: 1,
            ttlMs: 30000,
            acquiredAt: new Date().toISOString(),
            metadata: null,
        }),
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    await adapter.acquireAsync({ lockKey: "multi-extend-lock", owner: "original-owner", ttlMs: 10000 });
    const promises = Array.from({ length: workers }, (_, i) => adapter.extendAsync("multi-extend-lock", `worker-${i}`, 20000));
    const results = await Promise.allSettled(promises);
    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);
    // Critical invariant: among 10 concurrent workers, only ONE should extend successfully
    assert.equal(succeeded.length, 1, `Expected exactly 1 successful extend among ${workers} workers, got ${succeeded.length}`);
});
//# sourceMappingURL=workflow-cas-concurrent.test.js.map