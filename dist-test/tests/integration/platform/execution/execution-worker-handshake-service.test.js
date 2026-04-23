import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { ExecutionResourceCeilingGuard } from "../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";
import { ExecutionWorkerHandshakeService } from "../../../../src/platform/execution/worker-pool/execution-worker-handshake-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
function seedClaimableExecution(db, store, workerOverrides = {}) {
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
        taskId: "task-worker-claim",
        executionId: "exec-worker-claim",
        traceId: "trace-worker-claim",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-worker-claim");
    workers.recordHeartbeat({
        workerId: "worker-claim",
        status: "idle",
        placement: "local",
        capabilities: ["bash"],
        runningExecutionIds: [],
        maxConcurrency: 1,
        queueAffinity: "default",
        runtimeInstanceId: "runtime-claim-1",
        occurredAt: "2026-04-04T11:00:00.000Z",
        ...workerOverrides,
    });
    const created = dispatch.createTicket({
        executionId: "exec-worker-claim",
        queueName: "default",
        requiredCapabilities: ["bash"],
        occurredAt: "2026-04-04T11:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
        queueName: "default",
        leaseTtlMs: 30_000,
        occurredAt: "2026-04-04T11:00:06.000Z",
    });
    return {
        ticketId: created.ticket.id,
        leaseId: dispatched.leaseId ?? "",
    };
}
test("execution worker handshake service consumes claimed tickets and records claim heartbeats", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-claim.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const seeded = seedClaimableExecution(db, store);
        const decision = handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            remoteLogs: [
                {
                    level: "info",
                    message: "remote runtime connected and ready to claim execution",
                    context: { stage: "claim" },
                },
            ],
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const ticket = store.getExecutionTicket(seeded.ticketId);
        const execution = store.getExecution("exec-worker-claim");
        const heartbeats = store.listHeartbeatSnapshotsByExecution("exec-worker-claim");
        const worker = store.getWorkerSnapshot("worker-claim");
        const agentExecution = store.getAgentExecutionRecord("exec-worker-claim");
        const events = store.listEventsForTask("task-worker-claim");
        const remoteLogs = store.listRemoteLogsByTask("task-worker-claim");
        db.close();
        assert.equal(decision.accepted, true);
        assert.equal(ticket?.status, "consumed");
        assert.equal(execution?.status, "executing");
        assert.equal(worker?.status, "busy");
        assert.ok(worker?.runningExecutionsJson.includes("exec-worker-claim"));
        assert.equal(worker?.runtimeInstanceId, "runtime-claim-1");
        assert.equal(worker?.restartGeneration, 0);
        assert.equal(agentExecution?.status, "executing");
        assert.equal(agentExecution?.agentId, "worker-claim");
        assert.equal(agentExecution?.progressMessage, "worker claim accepted");
        assert.equal(heartbeats.length, 1);
        assert.equal(heartbeats[0]?.runtimeInstanceId, "runtime-claim-1");
        assert.ok(events.some((event) => event.eventType === "worker:claim_accepted"));
        assert.equal(remoteLogs.length, 1);
        assert.equal(remoteLogs[0]?.workerId, "worker-claim");
        assert.match(remoteLogs[0]?.message ?? "", /ready to claim execution/i);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service renews leases and records execution heartbeats", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-heartbeat.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const seeded = seedClaimableExecution(db, store);
        handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const decision = handshake.recordHeartbeat({
            executionId: "exec-worker-claim",
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            ttlMs: 30_000,
            runtimeInstanceId: "runtime-claim-2",
            progressMessage: "still running",
            lastToolName: "bash.exec",
            toolCallCount: 3,
            cpuPct: 48.5,
            memoryMb: 256,
            remoteLogs: [
                {
                    level: "warn",
                    message: "remote filesystem sync lagging behind latest checkpoint",
                    context: { lagMs: 3500 },
                },
            ],
            toolBacklogCount: 4,
            currentStepId: "step-execute",
            occurredAt: "2026-04-04T11:00:10.000Z",
        });
        const lease = store.getExecutionLease(seeded.leaseId);
        const heartbeats = store.listHeartbeatSnapshotsByExecution("exec-worker-claim");
        const events = store.listEventsForTask("task-worker-claim");
        const worker = store.getWorkerSnapshot("worker-claim");
        const agentExecution = store.getAgentExecutionRecord("exec-worker-claim");
        const remoteLogs = store.listRemoteLogsByExecution("exec-worker-claim");
        db.close();
        assert.equal(decision.accepted, true);
        assert.equal(lease?.lastHeartbeatAt, "2026-04-04T11:00:10.000Z");
        assert.equal(heartbeats.length, 2);
        assert.equal(heartbeats[1]?.progressMessage, "still running");
        assert.equal(worker?.cpuPct, 48.5);
        assert.equal(worker?.memoryMb, 256);
        assert.equal(worker?.toolBacklogCount, 4);
        assert.equal(worker?.currentStepId, "step-execute");
        assert.equal(worker?.lastProgressAt, "2026-04-04T11:00:10.000Z");
        assert.equal(worker?.runtimeInstanceId, "runtime-claim-2");
        assert.equal(worker?.restartedFromRuntimeInstanceId, "runtime-claim-1");
        assert.equal(worker?.restartGeneration, 1);
        assert.equal(agentExecution?.runtimeInstanceId, "runtime-claim-2");
        assert.equal(agentExecution?.restartGeneration, 1);
        assert.equal(agentExecution?.lastToolName, "bash.exec");
        assert.equal(agentExecution?.toolCallCount, 3);
        assert.equal(heartbeats[1]?.runtimeInstanceId, "runtime-claim-2");
        assert.equal(heartbeats[1]?.restartGeneration, 1);
        assert.ok(events.some((event) => event.eventType === "worker:heartbeat_recorded"));
        assert.equal(remoteLogs.length, 1);
        assert.equal(remoteLogs[0]?.level, "warn");
        assert.match(remoteLogs[0]?.message ?? "", /filesystem sync lagging/i);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service rejects untrusted remote workers before execution ownership transfers", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-remote-untrusted.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const workers = new WorkerRegistryService(store);
        const seeded = seedClaimableExecution(db, store);
        workers.recordHeartbeat({
            workerId: "worker-claim",
            status: "idle",
            placement: "remote",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:650",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:00:06.500Z",
        });
        const decision = handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const events = store.listEventsForTask("task-worker-claim");
        db.close();
        assert.equal(decision.accepted, false);
        assert.equal(decision.reasonCode, "worker_not_trusted");
        assert.ok(events.some((event) => {
            if (event.eventType !== "worker:claim_rejected") {
                return false;
            }
            const payload = JSON.parse(event.payloadJson);
            return payload.reasonCode === "worker_not_trusted";
        }));
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service preserves draining workers while their active execution continues", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-draining.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const workers = new WorkerRegistryService(store);
        const seeded = seedClaimableExecution(db, store);
        workers.recordHeartbeat({
            workerId: "worker-claim",
            status: "draining",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-04T11:00:06.500Z",
        });
        const claimDecision = handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const heartbeatDecision = handshake.recordHeartbeat({
            executionId: "exec-worker-claim",
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            ttlMs: 30_000,
            runtimeInstanceId: "runtime-claim-1",
            progressMessage: "draining but still finishing active work",
            occurredAt: "2026-04-04T11:00:10.000Z",
        });
        const worker = store.getWorkerSnapshot("worker-claim");
        db.close();
        assert.equal(claimDecision.accepted, true);
        assert.equal(heartbeatDecision.accepted, true);
        assert.equal(worker?.status, "draining");
        assert.ok(worker?.runningExecutionsJson.includes("exec-worker-claim"));
        assert.equal(worker?.toolBacklogCount, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service rejects heartbeats that exceed execution resource ceilings", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-resource-limit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store, {
            resourceCeilingGuard: new ExecutionResourceCeilingGuard({
                maxToolCalls: 2,
                maxMemoryMb: null,
                maxElapsedMs: null,
            }),
        });
        const seeded = seedClaimableExecution(db, store);
        handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const decision = handshake.recordHeartbeat({
            executionId: "exec-worker-claim",
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            ttlMs: 30_000,
            toolCallCount: 3,
            occurredAt: "2026-04-04T11:00:10.000Z",
        });
        const heartbeats = store.listHeartbeatSnapshotsByExecution("exec-worker-claim");
        const agentExecution = store.getAgentExecutionRecord("exec-worker-claim");
        const events = store.listEventsForTask("task-worker-claim");
        db.close();
        assert.equal(decision.accepted, false);
        assert.equal(decision.reasonCode, "resource_limit_exceeded");
        assert.equal(heartbeats.length, 1);
        assert.equal(agentExecution?.lastErrorCode, "agent.resource_limit.tool_calls_exceeded");
        assert.ok(events.some((event) => {
            if (event.eventType !== "worker:heartbeat_rejected") {
                return false;
            }
            const payload = JSON.parse(event.payloadJson);
            return (payload.reasonCode === "resource_limit_exceeded"
                && payload.resourceLimit?.reasonCode === "agent.resource_limit.tool_calls_exceeded");
        }));
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service rejects stale fencing heartbeats after failover", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-stale.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const leases = new ExecutionLeaseService(db, store);
        const seeded = seedClaimableExecution(db, store);
        handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        leases.reclaimExpiredLeases("2026-04-04T11:01:00.000Z");
        const reacquired = leases.acquireLease({
            executionId: "exec-worker-claim",
            workerId: "worker-claim",
            ttlMs: 30_000,
            queueName: "default",
            occurredAt: "2026-04-04T11:01:00.000Z",
        });
        const decision = handshake.recordHeartbeat({
            executionId: "exec-worker-claim",
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            ttlMs: 30_000,
            runtimeInstanceId: "runtime-claim-1",
            occurredAt: "2026-04-04T11:01:05.000Z",
        });
        db.close();
        assert.equal(reacquired.lease?.fencingToken, 2);
        assert.equal(decision.accepted, false);
        assert.equal(decision.reasonCode, "stale_fencing_token");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service rejects remote viewer-only claims before execution ownership transfers", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-remote-viewer-only.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const seeded = seedClaimableExecution(db, store, {
            placement: "remote",
            registrationVerifiedAt: "2026-04-04T11:00:06.000Z",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:700",
            sessionConsistencyCheckStatus: "passed",
        });
        const decision = handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            remoteSessionStatus: "viewer_only",
            lastAcknowledgedStreamOffset: "stream:701",
            sessionConsistencyCheckStatus: "passed",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const ticket = store.getExecutionTicket(seeded.ticketId);
        const execution = store.getExecution("exec-worker-claim");
        const events = store.listEventsForTask("task-worker-claim");
        db.close();
        assert.equal(decision.accepted, false);
        assert.equal(decision.reasonCode, "remote_session_viewer_only");
        assert.equal(ticket?.status, "claimed");
        assert.equal(execution?.status, "created");
        assert.ok(events.some((event) => {
            if (event.eventType !== "worker:claim_rejected") {
                return false;
            }
            const payload = JSON.parse(event.payloadJson);
            return payload.reasonCode === "remote_session_viewer_only";
        }));
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service rejects remote consistency mismatches during heartbeats", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-remote-mismatch.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const seeded = seedClaimableExecution(db, store, {
            placement: "remote",
            registrationVerifiedAt: "2026-04-04T11:00:06.000Z",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:800",
            sessionConsistencyCheckStatus: "passed",
        });
        handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:801",
            sessionConsistencyCheckStatus: "passed",
            occurredAt: "2026-04-04T11:00:07.000Z",
        });
        const leaseBefore = store.getExecutionLease(seeded.leaseId);
        const decision = handshake.recordHeartbeat({
            executionId: "exec-worker-claim",
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            ttlMs: 30_000,
            runtimeInstanceId: "runtime-claim-1",
            remoteSessionStatus: "reconnecting",
            lastAcknowledgedStreamOffset: "stream:802",
            sessionConsistencyCheckStatus: "mismatch",
            occurredAt: "2026-04-04T11:00:10.000Z",
        });
        const lease = store.getExecutionLease(seeded.leaseId);
        const events = store.listEventsForTask("task-worker-claim");
        db.close();
        assert.equal(decision.accepted, false);
        assert.equal(decision.reasonCode, "remote_session_consistency_mismatch");
        assert.equal(lease?.lastHeartbeatAt, leaseBefore?.lastHeartbeatAt ?? null);
        assert.ok(events.some((event) => {
            if (event.eventType !== "worker:heartbeat_rejected") {
                return false;
            }
            const payload = JSON.parse(event.payloadJson);
            return payload.reasonCode === "remote_session_consistency_mismatch";
        }));
    }
    finally {
        cleanupPath(workspace);
    }
});
test("execution worker handshake service rejects remote workspace sync conflicts before execution ownership transfers", () => {
    const workspace = createTempWorkspace("aa-worker-handshake-");
    const dbPath = join(workspace, "worker-handshake-remote-workspace-conflict.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const handshake = new ExecutionWorkerHandshakeService(db, store);
        const seeded = seedClaimableExecution(db, store, {
            placement: "remote",
            registrationVerifiedAt: "2026-04-07T11:00:06.000Z",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:900",
            sessionConsistencyCheckStatus: "passed",
        });
        const decision = handshake.claimExecution({
            ticketId: seeded.ticketId,
            workerId: "worker-claim",
            leaseId: seeded.leaseId,
            fencingToken: 1,
            runtimeInstanceId: "runtime-claim-1",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:901",
            sessionConsistencyCheckStatus: "passed",
            workspaceSyncStatus: "conflict",
            workspaceSyncCheckedAt: "2026-04-07T11:00:07.000Z",
            occurredAt: "2026-04-07T11:00:07.000Z",
        });
        const ticket = store.getExecutionTicket(seeded.ticketId);
        const execution = store.getExecution("exec-worker-claim");
        const events = store.listEventsForTask("task-worker-claim");
        db.close();
        assert.equal(decision.accepted, false);
        assert.equal(decision.reasonCode, "remote_workspace_sync_conflict");
        assert.equal(ticket?.status, "claimed");
        assert.equal(execution?.status, "created");
        assert.ok(events.some((event) => {
            if (event.eventType !== "worker:claim_rejected") {
                return false;
            }
            const payload = JSON.parse(event.payloadJson);
            return payload.reasonCode === "remote_workspace_sync_conflict" && payload.workspaceSyncStatus === "conflict";
        }));
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=execution-worker-handshake-service.test.js.map