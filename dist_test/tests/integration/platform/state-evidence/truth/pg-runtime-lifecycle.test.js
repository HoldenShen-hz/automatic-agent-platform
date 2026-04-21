import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncRepositoryRegistry } from "../../../../../src/platform/state-evidence/truth/async-repository-registry.js";
import { createTestPgDatabase, resetPgTables, shouldRunPgIntegration } from "../../../../helpers/pg-test-helper.js";
const pgSupport = shouldRunPgIntegration();
test("PostgreSQL async repositories cover execution authoritative view reads", { skip: !pgSupport.enabled }, async () => {
    const db = await createTestPgDatabase();
    try {
        await resetPgTables(db, [
            "event_consumer_acks",
            "events",
            "sessions",
            "workflow_state",
            "execution_prechecks",
            "executions",
            "tasks",
        ]);
        const repos = createAsyncRepositoryRegistry(db);
        await repos.task.insertTask({
            id: "pg_task_runtime",
            parentId: null,
            rootId: "pg_task_runtime",
            divisionId: "general_ops",
            tenantId: null,
            title: "PG runtime task",
            status: "in_progress",
            source: "user",
            priority: "high",
            inputJson: "{\"prompt\":\"ship\"}",
            normalizedInputJson: "{\"prompt\":\"ship\"}",
            outputJson: null,
            estimatedCostUsd: 1,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            completedAt: null,
        });
        await repos.workflow.insertWorkflowState({
            taskId: "pg_task_runtime",
            divisionId: "general_ops",
            workflowId: "wf_pg_runtime",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
        });
        await repos.execution.insertExecution({
            id: "exec_pg_runtime",
            taskId: "pg_task_runtime",
            workflowId: "wf_pg_runtime",
            parentExecutionId: null,
            agentId: "worker_alpha",
            roleId: "operator",
            runKind: "task_run",
            status: "executing",
            inputRef: "input://runtime",
            traceId: "trace_pg_runtime",
            attempt: 1,
            timeoutMs: 30000,
            budgetUsdLimit: 2,
            requiresApproval: 0,
            sandboxMode: "workspace-write",
            allowedToolsJson: "[]",
            allowedPathsJson: "[]",
            maxRetries: 1,
            retryBackoff: "fixed:1000",
            lastErrorCode: null,
            lastErrorMessage: null,
            startedAt: "2026-04-16T00:00:00.000Z",
            finishedAt: null,
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
        });
        await repos.session.insertSession({
            id: "sess_pg_runtime",
            taskId: "pg_task_runtime",
            channel: "cli",
            status: "streaming",
            externalSessionId: null,
            createdAt: "2026-04-16T00:00:01.000Z",
            updatedAt: "2026-04-16T00:00:01.000Z",
        });
        const event = await repos.event.insertEvent({
            id: "evt_pg_runtime",
            taskId: "pg_task_runtime",
            sessionId: "sess_pg_runtime",
            executionId: "exec_pg_runtime",
            eventType: "task:status_changed",
            payloadJson: "{\"status\":\"in_progress\"}",
            traceId: "trace_pg_runtime",
            createdAt: "2026-04-16T00:00:02.000Z",
        });
        assert.equal(event.eventTier, "tier_1");
        assert.deepEqual(await repos.event.getRequiredConsumerIds(event.id), ["task_projection", "inspect_projection"]);
        const view = await repos.operations.loadExecutionAuthoritativeView("exec_pg_runtime");
        assert.equal(view?.execution.id, "exec_pg_runtime");
        assert.equal(view?.task?.id, "pg_task_runtime");
        assert.equal(view?.workflow?.workflowId, "wf_pg_runtime");
        assert.equal(view?.session?.id, "sess_pg_runtime");
    }
    finally {
        await db.close();
    }
});
test("PostgreSQL async repositories cover worker lease and ticket lifecycle", { skip: !pgSupport.enabled }, async () => {
    const db = await createTestPgDatabase();
    try {
        await resetPgTables(db, [
            "remote_log_entries",
            "heartbeat_snapshots",
            "lease_audits",
            "execution_leases",
            "execution_tickets",
            "agent_execution_records",
            "worker_snapshots",
            "sessions",
            "workflow_state",
            "executions",
            "tasks",
        ]);
        const repos = createAsyncRepositoryRegistry(db);
        await repos.task.insertTask({
            id: "pg_task_worker",
            parentId: null,
            rootId: "pg_task_worker",
            divisionId: "general_ops",
            tenantId: null,
            title: "PG worker task",
            status: "in_progress",
            source: "user",
            priority: "normal",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: null,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: "2026-04-16T01:00:00.000Z",
            updatedAt: "2026-04-16T01:00:00.000Z",
            completedAt: null,
        });
        await repos.execution.insertExecution({
            id: "exec_pg_worker",
            taskId: "pg_task_worker",
            workflowId: "wf_pg_worker",
            parentExecutionId: null,
            agentId: "worker_alpha",
            roleId: "operator",
            runKind: "task_run",
            status: "prechecking",
            inputRef: "input://worker",
            traceId: "trace_pg_worker",
            attempt: 1,
            timeoutMs: 30000,
            budgetUsdLimit: null,
            requiresApproval: 0,
            sandboxMode: "workspace-write",
            allowedToolsJson: "[]",
            allowedPathsJson: "[]",
            maxRetries: 1,
            retryBackoff: "fixed:1000",
            lastErrorCode: null,
            lastErrorMessage: null,
            startedAt: null,
            finishedAt: null,
            createdAt: "2026-04-16T01:00:00.000Z",
            updatedAt: "2026-04-16T01:00:00.000Z",
        });
        await repos.worker.upsertWorkerSnapshot({
            workerId: "worker_alpha",
            status: "idle",
            placement: "local",
            isolationLevel: "standard",
            repoVersion: "v1",
            remoteSessionStatus: null,
            lastAcknowledgedStreamOffset: null,
            streamResumeSuccessRate: null,
            credentialRefreshSuccessRate: null,
            sessionConsistencyCheckStatus: null,
            sessionConsistencyCheckedAt: null,
            workspaceSyncStatus: null,
            workspaceSyncCheckedAt: null,
            saturation: 0.1,
            activeLeaseCount: 0,
            meanStartupLatencyMs: 50,
            sandboxSuccessRate: 1,
            repoCacheHitRate: null,
            registrationVerifiedAt: null,
            registrationChallengeId: null,
            capabilitiesJson: "[\"ts\"]",
            runningExecutionsJson: "[]",
            maxConcurrency: 2,
            queueAffinity: null,
            runtimeInstanceId: "runtime-1",
            restartedFromRuntimeInstanceId: null,
            restartGeneration: 0,
            cpuPct: 10,
            memoryMb: 128,
            toolBacklogCount: 0,
            currentStepId: null,
            lastProgressAt: null,
            lastHeartbeatAt: "2026-04-16T01:00:01.000Z",
            updatedAt: "2026-04-16T01:00:01.000Z",
        });
        await repos.worker.upsertAgentExecutionRecord({
            executionId: "exec_pg_worker",
            taskId: "pg_task_worker",
            agentId: "worker_alpha",
            workflowId: "wf_pg_worker",
            roleId: "operator",
            runKind: "task_run",
            runtimeInstanceId: "runtime-1",
            restartedFromRuntimeInstanceId: null,
            restartGeneration: 0,
            status: "ticket_pending",
            planJson: "{\"queue\":\"default\"}",
            currentStepId: null,
            lastToolName: null,
            toolCallCount: 0,
            lastDecisionJson: null,
            lastErrorCode: null,
            retryCount: 0,
            progressMessage: "waiting for dispatch",
            startedAt: "2026-04-16T01:00:00.000Z",
            createdAt: "2026-04-16T01:00:00.000Z",
            updatedAt: "2026-04-16T01:00:01.000Z",
            completedAt: null,
        });
        await repos.worker.insertExecutionTicket({
            id: "ticket_pg_worker",
            executionId: "exec_pg_worker",
            taskId: "pg_task_worker",
            priority: "normal",
            queueName: "default",
            dispatchTarget: "any",
            requiredIsolationLevel: "standard",
            requiredRepoVersion: null,
            requiredCapabilitiesJson: "[\"ts\"]",
            dispatchAfter: "2026-04-16T01:00:01.000Z",
            attempt: 1,
            status: "pending",
            assignedWorkerId: null,
            leaseId: null,
            claimedAt: null,
            consumedAt: null,
            invalidatedAt: null,
            createdAt: "2026-04-16T01:00:01.000Z",
            updatedAt: "2026-04-16T01:00:01.000Z",
        });
        await repos.worker.insertExecutionLease({
            id: "lease_pg_worker",
            executionId: "exec_pg_worker",
            workerId: "worker_alpha",
            attempt: 1,
            fencingToken: 1,
            queueName: "default",
            status: "active",
            leasedAt: "2026-04-16T01:00:02.000Z",
            expiresAt: "2026-04-16T01:01:02.000Z",
            lastHeartbeatAt: "2026-04-16T01:00:02.000Z",
            releasedAt: null,
            reasonCode: null,
        });
        await repos.worker.claimExecutionTicket({
            ticketId: "ticket_pg_worker",
            assignedWorkerId: "worker_alpha",
            leaseId: "lease_pg_worker",
            claimedAt: "2026-04-16T01:00:02.000Z",
        });
        await repos.worker.renewExecutionLease("lease_pg_worker", "2026-04-16T01:02:02.000Z", "2026-04-16T01:01:00.000Z");
        await repos.worker.insertLeaseAudit({
            id: "laudit_pg_worker",
            executionId: "exec_pg_worker",
            leaseId: "lease_pg_worker",
            workerId: "worker_alpha",
            fencingToken: 1,
            eventType: "lease_renewed",
            reasonCode: null,
            recordedAt: "2026-04-16T01:01:00.000Z",
        });
        await repos.worker.insertHeartbeatSnapshot({
            id: "hb_pg_worker",
            executionId: "exec_pg_worker",
            agentId: "worker_alpha",
            runtimeInstanceId: "runtime-1",
            restartGeneration: 0,
            status: "executing",
            progressMessage: "still running",
            cpuPct: 20,
            memoryMb: 256,
            sampledAt: "2026-04-16T01:01:00.000Z",
        });
        await repos.worker.insertRemoteLog({
            id: "rlog_pg_worker",
            taskId: "pg_task_worker",
            executionId: "exec_pg_worker",
            workerId: "worker_alpha",
            runtimeInstanceId: "runtime-1",
            level: "info",
            message: "worker progressing",
            contextJson: "{\"step\":\"compile\"}",
            createdAt: "2026-04-16T01:01:01.000Z",
        });
        await repos.worker.consumeExecutionTicket("ticket_pg_worker", "2026-04-16T01:01:02.000Z");
        await repos.worker.closeExecutionLease({
            leaseId: "lease_pg_worker",
            status: "released",
            releasedAt: "2026-04-16T01:01:03.000Z",
            reasonCode: "completed",
        });
        const ticket = await repos.worker.getExecutionTicket("ticket_pg_worker");
        const lease = await repos.worker.getExecutionLease("lease_pg_worker");
        const audits = await repos.lease.listLeaseAudits("exec_pg_worker");
        const heartbeats = await repos.worker.listHeartbeatSnapshotsByExecution("exec_pg_worker");
        const remoteLogs = await repos.worker.listRemoteLogsByExecution("exec_pg_worker");
        assert.equal(ticket?.status, "consumed");
        assert.equal(ticket?.assignedWorkerId, "worker_alpha");
        assert.equal(lease?.status, "released");
        assert.equal(lease?.reasonCode, "completed");
        assert.equal(audits.length, 1);
        assert.equal(heartbeats[0]?.progressMessage, "still running");
        assert.equal(remoteLogs[0]?.message, "worker progressing");
    }
    finally {
        await db.close();
    }
});
//# sourceMappingURL=pg-runtime-lifecycle.test.js.map