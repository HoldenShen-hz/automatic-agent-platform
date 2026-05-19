/**
 * Worker Writeback CLI Tests
 *
 * Tests for worker-writeback.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for worker writeback argument building
// ---------------------------------------------------------------------------
test("writeback builds arguments with executionId and worker info", () => {
    const envConfig = {
        executionId: "exec-123",
        workerId: "worker-456",
        leaseId: "lease-789",
        fencingToken: 42,
        runtimeInstanceId: undefined,
        restartedFromRuntimeInstanceId: undefined,
        terminalStatus: "done",
        lastToolName: undefined,
        toolCallCount: undefined,
        taskOutputJson: '{"result": "success"}',
        outputsJson: null,
        reasonCode: null,
        progressMessage: null,
        cpuPct: undefined,
        memoryMb: undefined,
        toolBacklogCount: undefined,
        currentStepId: undefined,
        lastProgressAt: undefined,
        workspaceSyncStatus: undefined,
        workspaceSyncCheckedAt: undefined,
        remoteLogs: undefined,
        occurredAt: undefined,
    };
    const args = {
        executionId: envConfig.executionId,
        workerId: envConfig.workerId,
        leaseId: envConfig.leaseId,
        fencingToken: envConfig.fencingToken,
        terminalStatus: envConfig.terminalStatus,
        taskOutputJson: envConfig.taskOutputJson,
    };
    if (envConfig.runtimeInstanceId !== undefined) {
        args.runtimeInstanceId = envConfig.runtimeInstanceId;
    }
    assert.equal(args.executionId, "exec-123");
    assert.equal(args.workerId, "worker-456");
    assert.equal(args.terminalStatus, "done");
    assert.equal(args.taskOutputJson, '{"result": "success"}');
});
test("writeback includes optional runtime instance when provided", () => {
    const envConfig = {
        executionId: "exec-123",
        workerId: "worker-456",
        leaseId: "lease-789",
        fencingToken: 42,
        runtimeInstanceId: "runtime-abc",
        terminalStatus: "done",
        taskOutputJson: '{"ok": true}',
    };
    const args = {
        executionId: envConfig.executionId,
        workerId: envConfig.workerId,
        leaseId: envConfig.leaseId,
        fencingToken: envConfig.fencingToken,
        terminalStatus: envConfig.terminalStatus,
        taskOutputJson: envConfig.taskOutputJson,
    };
    if (envConfig.runtimeInstanceId !== undefined) {
        args.runtimeInstanceId = envConfig.runtimeInstanceId;
    }
    assert.equal(args.runtimeInstanceId, "runtime-abc");
});
test("writeback includes metrics when provided", () => {
    const envConfig = {
        executionId: "exec-123",
        workerId: "worker-456",
        leaseId: "lease-789",
        fencingToken: 42,
        terminalStatus: "done",
        taskOutputJson: '{"result": "success"}',
        cpuPct: 45.5,
        memoryMb: 1024,
        toolCallCount: 200,
    };
    const args = {
        executionId: envConfig.executionId,
        workerId: envConfig.workerId,
        leaseId: envConfig.leaseId,
        fencingToken: envConfig.fencingToken,
        terminalStatus: envConfig.terminalStatus,
        taskOutputJson: envConfig.taskOutputJson,
    };
    if (envConfig.cpuPct !== undefined) {
        args.cpuPct = envConfig.cpuPct;
    }
    if (envConfig.memoryMb !== undefined) {
        args.memoryMb = envConfig.memoryMb;
    }
    if (envConfig.toolCallCount !== undefined) {
        args.toolCallCount = envConfig.toolCallCount;
    }
    assert.equal(args.cpuPct, 45.5);
    assert.equal(args.memoryMb, 1024);
    assert.equal(args.toolCallCount, 200);
});
test("writeback includes outputsJson when provided", () => {
    const envConfig = {
        executionId: "exec-123",
        workerId: "worker-456",
        leaseId: "lease-789",
        fencingToken: 42,
        terminalStatus: "done",
        taskOutputJson: '{"result": "success"}',
        outputsJson: '{"artifacts": ["file1.txt"]}',
    };
    const args = {
        executionId: envConfig.executionId,
        workerId: envConfig.workerId,
        leaseId: envConfig.leaseId,
        fencingToken: envConfig.fencingToken,
        terminalStatus: envConfig.terminalStatus,
        taskOutputJson: envConfig.taskOutputJson,
    };
    if (envConfig.outputsJson) {
        args.outputsJson = envConfig.outputsJson;
    }
    assert.equal(args.outputsJson, '{"artifacts": ["file1.txt"]}');
});
test("writeback includes remoteLogs when provided", () => {
    const remoteLogs = [
        { level: "info", message: "Processing started", occurredAt: "2024-01-01T00:00:00.000Z" },
    ];
    const envConfig = {
        executionId: "exec-123",
        workerId: "worker-456",
        leaseId: "lease-789",
        fencingToken: 42,
        terminalStatus: "done",
        taskOutputJson: '{"result": "success"}',
        remoteLogs,
    };
    const args = {
        executionId: envConfig.executionId,
        workerId: envConfig.workerId,
        leaseId: envConfig.leaseId,
        fencingToken: envConfig.fencingToken,
        terminalStatus: envConfig.terminalStatus,
        taskOutputJson: envConfig.taskOutputJson,
    };
    if (envConfig.remoteLogs !== undefined) {
        args.remoteLogs = envConfig.remoteLogs;
    }
    assert.deepEqual(args.remoteLogs, remoteLogs);
});
//# sourceMappingURL=worker-writeback.test.js.map