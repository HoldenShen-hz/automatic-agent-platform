import assert from "node:assert/strict";
import test from "node:test";
test("AgentExecutionRecord structure is correct", () => {
    const record = {
        executionId: "exec_123",
        taskId: "task_456",
        agentId: "agent_789",
        workflowId: "wf_abc",
        roleId: "role_def",
        runKind: "task_run",
        runtimeInstanceId: "runtime_ghi",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "running",
        planJson: '{"steps":["step1","step2"]}',
        currentStepId: "step_1",
        lastToolName: "bash",
        toolCallCount: 5,
        lastDecisionJson: '{"decision":"continue"}',
        lastErrorCode: null,
        retryCount: 0,
        progressMessage: "Processing step 1",
        startedAt: "2026-04-14T00:00:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
        completedAt: null,
    };
    assert.equal(record.executionId, "exec_123");
    assert.equal(record.runKind, "task_run");
    assert.equal(record.toolCallCount, 5);
    assert.equal(record.currentStepId, "step_1");
});
test("AgentExecutionRecord allows null optional fields", () => {
    const record = {
        executionId: "exec_simple",
        taskId: "task_simple",
        agentId: "agent_simple",
        workflowId: null,
        roleId: null,
        runKind: "tool_call",
        runtimeInstanceId: null,
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "created",
        planJson: "{}",
        currentStepId: null,
        lastToolName: null,
        toolCallCount: 0,
        lastDecisionJson: null,
        lastErrorCode: null,
        retryCount: 0,
        progressMessage: null,
        startedAt: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        completedAt: null,
    };
    assert.equal(record.workflowId, null);
    assert.equal(record.runtimeInstanceId, null);
    assert.equal(record.currentStepId, null);
    assert.equal(record.startedAt, null);
});
test("AgentExecutionRecord allows replay runKind", () => {
    const record = {
        executionId: "exec_replay",
        taskId: "task_replay",
        agentId: "agent_replay",
        workflowId: null,
        roleId: null,
        runKind: "replay",
        runtimeInstanceId: null,
        restartedFromRuntimeInstanceId: "runtime_original",
        restartGeneration: 1,
        status: "running",
        planJson: "{}",
        currentStepId: null,
        lastToolName: null,
        toolCallCount: 0,
        lastDecisionJson: null,
        lastErrorCode: null,
        retryCount: 1,
        progressMessage: null,
        startedAt: "2026-04-14T00:00:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
        completedAt: null,
    };
    assert.equal(record.runKind, "replay");
    assert.equal(record.restartGeneration, 1);
});
test("RunKind accepts all valid values", () => {
    const kinds = ["task_run", "tool_call", "approval_resume", "replay"];
    assert.equal(kinds.length, 4);
});
test("WorkerSnapshotRecord structure is correct", () => {
    const record = {
        workerId: "worker_123",
        status: "busy",
        placement: "local",
        isolationLevel: "standard",
        repoVersion: "v1.0.0",
        remoteSessionStatus: null,
        capabilitiesJson: '{"tools":["bash","edit"]}',
        runningExecutionsJson: '["exec_1","exec_2"]',
        maxConcurrency: 5,
        queueAffinity: null,
        runtimeInstanceId: null,
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        cpuPct: 45.5,
        memoryMb: 512,
        toolBacklogCount: 0,
        currentStepId: null,
        lastProgressAt: "2026-04-14T00:00:30.000Z",
        lastHeartbeatAt: "2026-04-14T00:01:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.workerId, "worker_123");
    assert.equal(record.status, "busy");
    assert.equal(record.placement, "local");
    assert.equal(record.maxConcurrency, 5);
});
test("WorkerSnapshotRecord allows remote placement with session status", () => {
    const record = {
        workerId: "worker_remote",
        status: "busy",
        placement: "remote",
        isolationLevel: "hardened",
        repoVersion: "v1.0.0",
        remoteSessionStatus: "connected",
        sessionConsistencyCheckStatus: "passed",
        workspaceSyncStatus: "aligned",
        capabilitiesJson: "{}",
        runningExecutionsJson: "[]",
        maxConcurrency: 10,
        queueAffinity: "region-us-east",
        runtimeInstanceId: "runtime_abc",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        cpuPct: 30.0,
        memoryMb: 1024,
        toolBacklogCount: 2,
        currentStepId: "step_xyz",
        lastProgressAt: "2026-04-14T00:00:30.000Z",
        lastHeartbeatAt: "2026-04-14T00:01:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.placement, "remote");
    assert.equal(record.remoteSessionStatus, "connected");
    assert.equal(record.sessionConsistencyCheckStatus, "passed");
});
test("WorkerSnapshotRecord allows null optional fields", () => {
    const record = {
        workerId: "worker_minimal",
        status: "idle",
        capabilitiesJson: "{}",
        runningExecutionsJson: "[]",
        maxConcurrency: 1,
        queueAffinity: null,
        runtimeInstanceId: null,
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        cpuPct: null,
        memoryMb: null,
        toolBacklogCount: 0,
        currentStepId: null,
        lastProgressAt: null,
        lastHeartbeatAt: "2026-04-14T00:01:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.placement, undefined);
    assert.equal(record.repoVersion, undefined);
    assert.equal(record.cpuPct, null);
});
test("WorkerStatus accepts all valid values", () => {
    const statuses = ["idle", "busy", "draining", "degraded", "unavailable", "quarantined", "offline"];
    assert.equal(statuses.length, 7);
});
test("WorkerPlacement accepts all valid values", () => {
    const placements = ["local", "remote"];
    assert.equal(placements.length, 2);
});
test("WorkerIsolationLevel accepts all valid values", () => {
    const levels = ["standard", "hardened", "strict"];
    assert.equal(levels.length, 3);
});
test("RemoteSessionStatus accepts all valid values", () => {
    const statuses = ["connecting", "connected", "reconnecting", "degraded", "failed", "viewer_only"];
    assert.equal(statuses.length, 6);
});
test("SessionConsistencyCheckStatus accepts all valid values", () => {
    const statuses = ["unknown", "passed", "mismatch"];
    assert.equal(statuses.length, 3);
});
test("WorkspaceSyncStatus accepts all valid values", () => {
    const statuses = ["unknown", "aligned", "conflict"];
    assert.equal(statuses.length, 3);
});
test("CoordinatorInstanceRecord structure is correct", () => {
    const record = {
        coordinatorId: "coord_123",
        region: "us-east-1",
        role: "primary",
        queueAffinity: null,
        status: "active",
        maxConcurrentDispatches: 100,
        activeDispatchCount: 15,
        backlogCount: 5,
        cpuPct: 25.0,
        shardJson: '{"shards":[1,2,3]}',
        lastHeartbeatAt: "2026-04-14T00:01:00.000Z",
        metadataJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.coordinatorId, "coord_123");
    assert.equal(record.status, "active");
    assert.equal(record.activeDispatchCount, 15);
});
test("CoordinatorInstanceRecord allows draining status", () => {
    const record = {
        coordinatorId: "coord_draining",
        region: "us-west-2",
        role: "secondary",
        queueAffinity: "region-us-west",
        status: "draining",
        maxConcurrentDispatches: 50,
        activeDispatchCount: 3,
        backlogCount: 10,
        cpuPct: 60.0,
        shardJson: "{}",
        lastHeartbeatAt: "2026-04-14T00:01:00.000Z",
        metadataJson: '{"reason":"maintenance"}',
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.status, "draining");
    assert.equal(record.queueAffinity, "region-us-west");
});
test("CoordinatorInstanceStatus accepts all valid values", () => {
    const statuses = ["active", "draining", "offline"];
    assert.equal(statuses.length, 3);
});
test("WorkerRegistrationChallengeRecord structure is correct", () => {
    const record = {
        id: "challenge_123",
        workerId: "worker_456",
        challengeTokenHash: "sha256:abc123def456",
        allowedCapabilitiesJson: '{"capabilities":["tool_use","file_read"]}',
        expiresAt: "2026-04-14T01:00:00.000Z",
        usedAt: null,
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.id, "challenge_123");
    assert.equal(record.usedAt, null);
    assert.ok(record.expiresAt > record.createdAt);
});
test("WorkerRegistrationChallengeRecord allows used challenge", () => {
    const record = {
        id: "challenge_used",
        workerId: "worker_789",
        challengeTokenHash: "sha256:used_hash",
        allowedCapabilitiesJson: "{}",
        expiresAt: "2026-04-14T01:00:00.000Z",
        usedAt: "2026-04-14T00:30:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.ok(record.usedAt !== null);
});
test("FileLockRecord structure is correct", () => {
    const record = {
        id: "lock_123",
        taskId: "task_456",
        executionId: "exec_789",
        lockScope: "workspace",
        resourcePath: "/workspace/project",
        lockMode: "exclusive",
        ownerId: "worker_abc",
        expiresAt: "2026-04-14T01:00:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.lockScope, "workspace");
    assert.equal(record.lockMode, "exclusive");
    assert.equal(record.resourcePath, "/workspace/project");
});
test("FileLockRecord allows null taskId and executionId", () => {
    const record = {
        id: "lock_system",
        taskId: null,
        executionId: null,
        lockScope: "global",
        resourcePath: "/tmp/shared",
        lockMode: "shared",
        ownerId: "system",
        expiresAt: "2026-04-14T12:00:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.taskId, null);
    assert.equal(record.executionId, null);
});
test("HeartbeatSnapshotRecord structure is correct", () => {
    const record = {
        id: "hb_123",
        executionId: "exec_456",
        agentId: "agent_789",
        runtimeInstanceId: "runtime_abc",
        restartGeneration: 0,
        status: "running",
        progressMessage: "Processing task step 3",
        cpuPct: 35.5,
        memoryMb: 256,
        sampledAt: "2026-04-14T00:00:30.000Z",
    };
    assert.equal(record.executionId, "exec_456");
    assert.equal(record.status, "running");
    assert.equal(record.cpuPct, 35.5);
});
test("HeartbeatSnapshotRecord allows null optional fields", () => {
    const record = {
        id: "hb_minimal",
        executionId: "exec_minimal",
        agentId: "agent_minimal",
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: "created",
        progressMessage: null,
        cpuPct: null,
        memoryMb: null,
        sampledAt: "2026-04-14T00:00:30.000Z",
    };
    assert.equal(record.runtimeInstanceId, null);
    assert.equal(record.progressMessage, null);
    assert.equal(record.cpuPct, null);
});
//# sourceMappingURL=worker-types.test.js.map