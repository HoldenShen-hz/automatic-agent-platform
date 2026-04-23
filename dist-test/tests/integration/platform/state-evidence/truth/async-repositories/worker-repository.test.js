// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncWorkerRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/worker-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
test.skip("AsyncWorkerRepository", (group) => {
    let harness;
    group.beforeEach(async () => {
        const workspace = createTempWorkspace("aa-async-worker-repo-");
        const dbPath = join(workspace, "worker-repo.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const adapter = new SqliteAsyncAdapter(db);
        const workerRepo = new AsyncWorkerRepository(adapter.asyncConnection);
        const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
        harness = {
            workspace,
            dbPath,
            db,
            adapter,
            workerRepo,
            taskRepo,
            cleanup() {
                db.close();
                cleanupPath(workspace);
            },
        };
    });
    group.afterEach(() => {
        harness.cleanup();
    });
    async function insertTestTask(taskId, tenantId) {
        const task = {
            id: taskId,
            parentId: null,
            rootId: null,
            divisionId: "div-001",
            tenantId,
            title: "Test Task",
            status: "queued",
            source: "test",
            priority: "medium",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: null,
            actualCostUsd: null,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await harness.taskRepo.insertTask(task);
    }
    test("insertHeartbeatSnapshot and listHeartbeatSnapshotsByExecution roundtrip", async () => {
        const snapshot = {
            id: "heartbeat-001",
            executionId: "exec-hb-001",
            agentId: "agent-hb-001",
            runtimeInstanceId: "instance-001",
            restartGeneration: 0,
            status: "running",
            progressMessage: "Processing step 1",
            cpuPct: 45.5,
            memoryMb: 256,
            sampledAt: "2026-04-23T10:05:00.000Z",
        };
        await harness.workerRepo.insertHeartbeatSnapshot(snapshot);
        const listed = await harness.workerRepo.listHeartbeatSnapshotsByExecution("exec-hb-001");
        assert.equal(listed.length, 1);
        assert.equal(listed[0].executionId, "exec-hb-001");
        assert.equal(listed[0].cpuPct, 45.5);
    });
    test("upsertWorkerSnapshot and getWorkerSnapshot roundtrip", async () => {
        const snapshot = {
            workerId: "worker-001",
            status: "active",
            placement: "local",
            isolationLevel: "standard",
            repoVersion: "v1.0.0",
            remoteSessionStatus: null,
            lastAcknowledgedStreamOffset: null,
            streamResumeSuccessRate: null,
            credentialRefreshSuccessRate: null,
            sessionConsistencyCheckStatus: null,
            sessionConsistencyCheckedAt: null,
            workspaceSyncStatus: null,
            workspaceSyncCheckedAt: null,
            saturation: 0.5,
            activeLeaseCount: 2,
            meanStartupLatencyMs: 1500,
            sandboxSuccessRate: 0.98,
            repoCacheHitRate: 0.85,
            registrationVerifiedAt: null,
            registrationChallengeId: null,
            capabilitiesJson: '{"tools":["bash","edit"]}',
            runningExecutionsJson: '["exec-1","exec-2"]',
            maxConcurrency: 5,
            queueAffinity: null,
            runtimeInstanceId: "runtime-001",
            restartedFromRuntimeInstanceId: null,
            restartGeneration: 0,
            cpuPct: 30.0,
            memoryMb: 512,
            toolBacklogCount: 0,
            currentStepId: "step-5",
            lastProgressAt: "2026-04-23T10:30:00.000Z",
            lastHeartbeatAt: "2026-04-23T10:30:00.000Z",
            updatedAt: "2026-04-23T10:30:00.000Z",
        };
        await harness.workerRepo.upsertWorkerSnapshot(snapshot);
        const retrieved = await harness.workerRepo.getWorkerSnapshot("worker-001");
        assert.equal(retrieved?.workerId, "worker-001");
        assert.equal(retrieved?.status, "active");
        assert.equal(retrieved?.saturation, 0.5);
        assert.equal(retrieved?.maxConcurrency, 5);
    });
    test("upsertWorkerSnapshot updates existing record", async () => {
        const snapshot = {
            workerId: "worker-update-001",
            status: "active",
            placement: "local",
            isolationLevel: "standard",
            repoVersion: null,
            remoteSessionStatus: null,
            lastAcknowledgedStreamOffset: null,
            streamResumeSuccessRate: null,
            credentialRefreshSuccessRate: null,
            sessionConsistencyCheckStatus: null,
            sessionConsistencyCheckedAt: null,
            workspaceSyncStatus: null,
            workspaceSyncCheckedAt: null,
            saturation: 0.3,
            activeLeaseCount: 1,
            meanStartupLatencyMs: null,
            sandboxSuccessRate: null,
            repoCacheHitRate: null,
            registrationVerifiedAt: null,
            registrationChallengeId: null,
            capabilitiesJson: "[]",
            runningExecutionsJson: "[]",
            maxConcurrency: 3,
            queueAffinity: null,
            runtimeInstanceId: "runtime-update",
            restartedFromRuntimeInstanceId: null,
            restartGeneration: 0,
            cpuPct: 20.0,
            memoryMb: 256,
            toolBacklogCount: 0,
            currentStepId: null,
            lastProgressAt: null,
            lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workerRepo.upsertWorkerSnapshot(snapshot);
        const updatedSnapshot = {
            ...snapshot,
            saturation: 0.8,
            activeLeaseCount: 5,
            lastHeartbeatAt: "2026-04-23T11:00:00.000Z",
            updatedAt: "2026-04-23T11:00:00.000Z",
        };
        await harness.workerRepo.upsertWorkerSnapshot(updatedSnapshot);
        const retrieved = await harness.workerRepo.getWorkerSnapshot("worker-update-001");
        assert.equal(retrieved?.saturation, 0.8);
        assert.equal(retrieved?.activeLeaseCount, 5);
    });
    test("listWorkerSnapshots returns all workers when no filter", async () => {
        const workers = ["worker-list-1", "worker-list-2", "worker-list-3"];
        for (const workerId of workers) {
            await harness.workerRepo.upsertWorkerSnapshot({
                workerId,
                status: "active",
                placement: "local",
                isolationLevel: "standard",
                repoVersion: null,
                remoteSessionStatus: null,
                lastAcknowledgedStreamOffset: null,
                streamResumeSuccessRate: null,
                credentialRefreshSuccessRate: null,
                sessionConsistencyCheckStatus: null,
                sessionConsistencyCheckedAt: null,
                workspaceSyncStatus: null,
                workspaceSyncCheckedAt: null,
                saturation: 0.5,
                activeLeaseCount: 1,
                meanStartupLatencyMs: null,
                sandboxSuccessRate: null,
                repoCacheHitRate: null,
                registrationVerifiedAt: null,
                registrationChallengeId: null,
                capabilitiesJson: "[]",
                runningExecutionsJson: "[]",
                maxConcurrency: 5,
                queueAffinity: null,
                runtimeInstanceId: `runtime-${workerId}`,
                restartedFromRuntimeInstanceId: null,
                restartGeneration: 0,
                cpuPct: 50.0,
                memoryMb: 512,
                toolBacklogCount: 0,
                currentStepId: null,
                lastProgressAt: null,
                lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
                updatedAt: "2026-04-23T10:00:00.000Z",
            });
        }
        const listed = await harness.workerRepo.listWorkerSnapshots();
        assert.equal(listed.length, 3);
    });
    test("listWorkerSnapshots filters by status", async () => {
        await harness.workerRepo.upsertWorkerSnapshot({
            workerId: "worker-status-active",
            status: "active",
            placement: "local",
            isolationLevel: "standard",
            repoVersion: null,
            remoteSessionStatus: null,
            lastAcknowledgedStreamOffset: null,
            streamResumeSuccessRate: null,
            credentialRefreshSuccessRate: null,
            sessionConsistencyCheckStatus: null,
            sessionConsistencyCheckedAt: null,
            workspaceSyncStatus: null,
            workspaceSyncCheckedAt: null,
            saturation: 0.5,
            activeLeaseCount: 0,
            meanStartupLatencyMs: null,
            sandboxSuccessRate: null,
            repoCacheHitRate: null,
            registrationVerifiedAt: null,
            registrationChallengeId: null,
            capabilitiesJson: "[]",
            runningExecutionsJson: "[]",
            maxConcurrency: 5,
            queueAffinity: null,
            runtimeInstanceId: "runtime-active",
            restartedFromRuntimeInstanceId: null,
            restartGeneration: 0,
            cpuPct: 10.0,
            memoryMb: 128,
            toolBacklogCount: 0,
            currentStepId: null,
            lastProgressAt: null,
            lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        });
        await harness.workerRepo.upsertWorkerSnapshot({
            workerId: "worker-status-draining",
            status: "draining",
            placement: "local",
            isolationLevel: "standard",
            repoVersion: null,
            remoteSessionStatus: null,
            lastAcknowledgedStreamOffset: null,
            streamResumeSuccessRate: null,
            credentialRefreshSuccessRate: null,
            sessionConsistencyCheckStatus: null,
            sessionConsistencyCheckedAt: null,
            workspaceSyncStatus: null,
            workspaceSyncCheckedAt: null,
            saturation: 0.0,
            activeLeaseCount: 0,
            meanStartupLatencyMs: null,
            sandboxSuccessRate: null,
            repoCacheHitRate: null,
            registrationVerifiedAt: null,
            registrationChallengeId: null,
            capabilitiesJson: "[]",
            runningExecutionsJson: "[]",
            maxConcurrency: 5,
            queueAffinity: null,
            runtimeInstanceId: "runtime-draining",
            restartedFromRuntimeInstanceId: null,
            restartGeneration: 0,
            cpuPct: 5.0,
            memoryMb: 64,
            toolBacklogCount: 0,
            currentStepId: null,
            lastProgressAt: null,
            lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        });
        const activeWorkers = await harness.workerRepo.listWorkerSnapshots("active");
        assert.equal(activeWorkers.length, 1);
        assert.equal(activeWorkers[0].workerId, "worker-status-active");
        const drainingWorkers = await harness.workerRepo.listWorkerSnapshots("draining");
        assert.equal(drainingWorkers.length, 1);
        assert.equal(drainingWorkers[0].workerId, "worker-status-draining");
    });
    test("insertExecutionTicket and getExecutionTicket roundtrip", async () => {
        await insertTestTask("task-ticket-001", "tenant-ticket");
        const ticket = {
            id: "ticket-001",
            executionId: "exec-ticket-001",
            taskId: "task-ticket-001",
            priority: 10,
            queueName: "default",
            dispatchTarget: "worker-1",
            requiredIsolationLevel: "standard",
            requiredRepoVersion: null,
            requiredCapabilitiesJson: "[]",
            dispatchAfter: "2026-04-23T10:30:00.000Z",
            attempt: 1,
            status: "pending",
            assignedWorkerId: null,
            leaseId: null,
            claimedAt: null,
            consumedAt: null,
            invalidatedAt: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workerRepo.insertExecutionTicket(ticket);
        const retrieved = await harness.workerRepo.getExecutionTicket("ticket-001");
        assert.equal(retrieved?.id, "ticket-001");
        assert.equal(retrieved?.executionId, "exec-ticket-001");
        assert.equal(retrieved?.priority, 10);
        assert.equal(retrieved?.status, "pending");
    });
    test("claimExecutionTicket updates ticket status", async () => {
        await insertTestTask("task-ticket-claim", "tenant-ticket-claim");
        const ticket = {
            id: "ticket-claim-001",
            executionId: "exec-ticket-claim",
            taskId: "task-ticket-claim",
            priority: 5,
            queueName: "default",
            dispatchTarget: "any",
            requiredIsolationLevel: "standard",
            requiredRepoVersion: null,
            requiredCapabilitiesJson: "[]",
            dispatchAfter: "2026-04-23T10:30:00.000Z",
            attempt: 1,
            status: "pending",
            assignedWorkerId: null,
            leaseId: null,
            claimedAt: null,
            consumedAt: null,
            invalidatedAt: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workerRepo.insertExecutionTicket(ticket);
        await harness.workerRepo.claimExecutionTicket({
            ticketId: "ticket-claim-001",
            assignedWorkerId: "worker-claim-001",
            leaseId: "lease-claim-001",
            claimedAt: "2026-04-23T10:35:00.000Z",
        });
        const retrieved = await harness.workerRepo.getExecutionTicket("ticket-claim-001");
        assert.equal(retrieved?.status, "claimed");
        assert.equal(retrieved?.assignedWorkerId, "worker-claim-001");
    });
    test("consumeExecutionTicket marks ticket as consumed", async () => {
        await insertTestTask("task-ticket-consume", "tenant-ticket-consume");
        const ticket = {
            id: "ticket-consume-001",
            executionId: "exec-ticket-consume",
            taskId: "task-ticket-consume",
            priority: 3,
            queueName: "default",
            dispatchTarget: "any",
            requiredIsolationLevel: "standard",
            requiredRepoVersion: null,
            requiredCapabilitiesJson: "[]",
            dispatchAfter: "2026-04-23T10:30:00.000Z",
            attempt: 1,
            status: "pending",
            assignedWorkerId: null,
            leaseId: null,
            claimedAt: null,
            consumedAt: null,
            invalidatedAt: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workerRepo.insertExecutionTicket(ticket);
        await harness.workerRepo.claimExecutionTicket({
            ticketId: "ticket-consume-001",
            assignedWorkerId: "worker-consume",
            leaseId: "lease-consume",
            claimedAt: "2026-04-23T10:35:00.000Z",
        });
        await harness.workerRepo.consumeExecutionTicket("ticket-consume-001", "2026-04-23T11:00:00.000Z");
        const retrieved = await harness.workerRepo.getExecutionTicket("ticket-consume-001");
        assert.equal(retrieved?.status, "consumed");
    });
    test("insertExecutionLease and getExecutionLease roundtrip", async () => {
        await insertTestTask("task-lease-001", "tenant-lease");
        const lease = {
            id: "lease-001",
            executionId: "exec-lease-001",
            workerId: "worker-lease-001",
            attempt: 1,
            fencingToken: 1,
            queueName: "default",
            status: "active",
            leasedAt: "2026-04-23T10:00:00.000Z",
            expiresAt: "2026-04-23T10:30:00.000Z",
            lastHeartbeatAt: null,
            releasedAt: null,
            reasonCode: null,
        };
        await harness.workerRepo.insertExecutionLease(lease);
        const retrieved = await harness.workerRepo.getExecutionLease("lease-001");
        assert.equal(retrieved?.id, "lease-001");
        assert.equal(retrieved?.executionId, "exec-lease-001");
        assert.equal(retrieved?.status, "active");
    });
    test("getActiveExecutionLease returns active lease for execution", async () => {
        await insertTestTask("task-lease-active", "tenant-lease-active");
        const lease = {
            id: "lease-active-001",
            executionId: "exec-lease-active",
            workerId: "worker-active",
            attempt: 1,
            fencingToken: 1,
            queueName: "default",
            status: "active",
            leasedAt: "2026-04-23T10:00:00.000Z",
            expiresAt: "2026-04-23T10:30:00.000Z",
            lastHeartbeatAt: null,
            releasedAt: null,
            reasonCode: null,
        };
        await harness.workerRepo.insertExecutionLease(lease);
        const activeLease = await harness.workerRepo.getActiveExecutionLease("exec-lease-active");
        assert.equal(activeLease?.id, "lease-active-001");
    });
    test("renewExecutionLease updates expiration", async () => {
        await insertTestTask("task-lease-renew", "tenant-lease-renew");
        const lease = {
            id: "lease-renew-001",
            executionId: "exec-lease-renew",
            workerId: "worker-renew",
            attempt: 1,
            fencingToken: 1,
            queueName: "default",
            status: "active",
            leasedAt: "2026-04-23T10:00:00.000Z",
            expiresAt: "2026-04-23T10:30:00.000Z",
            lastHeartbeatAt: null,
            releasedAt: null,
            reasonCode: null,
        };
        await harness.workerRepo.insertExecutionLease(lease);
        await harness.workerRepo.renewExecutionLease("lease-renew-001", "2026-04-23T11:00:00.000Z", "2026-04-23T10:45:00.000Z");
        const retrieved = await harness.workerRepo.getExecutionLease("lease-renew-001");
        assert.equal(retrieved?.expiresAt, "2026-04-23T11:00:00.000Z");
    });
    test("closeExecutionLease releases the lease", async () => {
        await insertTestTask("task-lease-close", "tenant-lease-close");
        const lease = {
            id: "lease-close-001",
            executionId: "exec-lease-close",
            workerId: "worker-close",
            attempt: 1,
            fencingToken: 1,
            queueName: "default",
            status: "active",
            leasedAt: "2026-04-23T10:00:00.000Z",
            expiresAt: "2026-04-23T10:30:00.000Z",
            lastHeartbeatAt: null,
            releasedAt: null,
            reasonCode: null,
        };
        await harness.workerRepo.insertExecutionLease(lease);
        await harness.workerRepo.closeExecutionLease({
            leaseId: "lease-close-001",
            status: "released",
            releasedAt: "2026-04-23T10:45:00.000Z",
            reasonCode: "task_completed",
        });
        const retrieved = await harness.workerRepo.getExecutionLease("lease-close-001");
        assert.equal(retrieved?.status, "released");
        assert.equal(retrieved?.reasonCode, "task_completed");
    });
    test("getLatestFencingToken returns highest token for execution", async () => {
        await insertTestTask("task-fencing", "tenant-fencing");
        // Insert leases with different fencing tokens
        const leases = [
            { id: "fence-001", executionId: "exec-fence", workerId: "worker-1", attempt: 1, fencingToken: 1, queueName: "default", status: "active", leasedAt: "2026-04-23T10:00:00.000Z", expiresAt: "2026-04-23T10:30:00.000Z", lastHeartbeatAt: null, releasedAt: null, reasonCode: null },
            { id: "fence-002", executionId: "exec-fence", workerId: "worker-2", attempt: 1, fencingToken: 2, queueName: "default", status: "released", leasedAt: "2026-04-23T10:05:00.000Z", expiresAt: "2026-04-23T10:35:00.000Z", lastHeartbeatAt: null, releasedAt: null, reasonCode: null },
            { id: "fence-003", executionId: "exec-fence", workerId: "worker-3", attempt: 1, fencingToken: 3, queueName: "default", status: "active", leasedAt: "2026-04-23T10:10:00.000Z", expiresAt: "2026-04-23T10:40:00.000Z", lastHeartbeatAt: null, releasedAt: null, reasonCode: null },
        ];
        for (const lease of leases) {
            await harness.workerRepo.insertExecutionLease(lease);
        }
        const latestToken = await harness.workerRepo.getLatestFencingToken("exec-fence");
        assert.equal(latestToken, 3);
    });
});
//# sourceMappingURL=worker-repository.test.js.map