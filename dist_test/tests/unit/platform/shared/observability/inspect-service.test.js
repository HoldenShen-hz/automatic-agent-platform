import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../../src/platform/execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
function seedWorkflowAndSession(db, store, input) {
    db.transaction(() => {
        store.insertWorkflowState({
            taskId: input.taskId,
            divisionId: input.divisionId ?? "general_ops",
            workflowId: input.workflowId ?? "single_agent_minimal",
            currentStepIndex: 0,
            status: input.workflowStatus ?? "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: input.updatedAt,
            updatedAt: input.updatedAt,
        });
        store.insertSession({
            id: input.sessionId,
            taskId: input.taskId,
            channel: "test",
            status: input.sessionStatus ?? "open",
            externalSessionId: null,
            createdAt: input.updatedAt,
            updatedAt: input.updatedAt,
        });
    });
}
test("inspect service query layer returns filtered task and workflow summaries", () => {
    const workspace = createTempWorkspace("aa-inspect-query-unit-");
    const dbPath = join(workspace, "inspect-query-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const approvals = new ApprovalService(db, store);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-query-pending",
            executionId: "exec-query-pending",
            traceId: "trace-query-pending",
        });
        seedWorkflowAndSession(db, store, {
            taskId: "task-query-pending",
            sessionId: "sess-query-pending",
            workflowStatus: "running",
            updatedAt: "2026-04-05T10:00:00.000Z",
        });
        db.connection
            .prepare(`UPDATE tasks SET title = ?, status = ?, updated_at = ?, division_id = ? WHERE id = ?`)
            .run("Pending approval task", "awaiting_decision", "2026-04-05T10:00:00.000Z", "general_ops", "task-query-pending");
        approvals.createRequest({
            taskId: "task-query-pending",
            executionId: "exec-query-pending",
            sourceAgentId: "agent-query",
            reason: "Need approval",
            riskLevel: "high",
            options: ["approve", "reject"],
            context: { sessionId: "inspect-query-session" },
            timeoutPolicy: "reject",
        });
        seedTaskAndExecution(db, store, {
            taskId: "task-query-completed",
            executionId: "exec-query-completed",
            traceId: "trace-query-completed",
        });
        seedWorkflowAndSession(db, store, {
            taskId: "task-query-completed",
            sessionId: "sess-query-completed",
            workflowStatus: "completed",
            updatedAt: "2026-04-05T10:05:00.000Z",
        });
        db.connection
            .prepare(`UPDATE tasks
         SET title = ?, status = ?, updated_at = ?, completed_at = ?
         WHERE id = ?`)
            .run("Completed task", "done", "2026-04-05T10:05:00.000Z", "2026-04-05T10:05:00.000Z", "task-query-completed");
        db.connection
            .prepare(`UPDATE executions SET status = ?, updated_at = ?, finished_at = ? WHERE id = ?`)
            .run("succeeded", "2026-04-05T10:05:00.000Z", "2026-04-05T10:05:00.000Z", "exec-query-completed");
        const taskSummaries = inspect.queryTaskInspectSummaries({
            taskStatus: "awaiting_decision",
            hasPendingApproval: true,
        });
        const workflowSummaries = inspect.queryWorkflowInspectSummaries({
            workflowStatus: "running",
            taskStatus: "awaiting_decision",
        });
        assert.equal(taskSummaries.length, 1);
        assert.equal(taskSummaries[0]?.taskId, "task-query-pending");
        assert.equal(taskSummaries[0]?.pendingApprovalCount, 1);
        assert.equal(taskSummaries[0]?.activeExecutionId, "exec-query-pending");
        assert.equal(taskSummaries[0]?.workflowStatus, "running");
        assert.equal(workflowSummaries.length, 1);
        assert.equal(workflowSummaries[0]?.taskId, "task-query-pending");
        assert.equal(workflowSummaries[0]?.pendingApprovalCount, 1);
        assert.equal(workflowSummaries[0]?.workflowId, "single_agent_minimal");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service query layer merges approval and dispatch decisions with filters", () => {
    const workspace = createTempWorkspace("aa-inspect-decision-unit-");
    const dbPath = join(workspace, "inspect-decision-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const approvals = new ApprovalService(db, store);
        const workers = new WorkerRegistryService(store);
        const dispatch = new ExecutionDispatchService(db, store);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-query-decisions",
            executionId: "exec-query-decisions",
            traceId: "trace-query-decisions",
        });
        seedWorkflowAndSession(db, store, {
            taskId: "task-query-decisions",
            sessionId: "sess-query-decisions",
            workflowStatus: "running",
            updatedAt: "2026-04-05T11:00:00.000Z",
        });
        db.connection.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run("2026-04-05T11:00:00.000Z", "task-query-decisions");
        db.connection.prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`).run("created", "2026-04-05T11:00:00.000Z", "exec-query-decisions");
        const approval = approvals.createRequest({
            taskId: "task-query-decisions",
            executionId: "exec-query-decisions",
            sourceAgentId: "agent-approval-query",
            reason: "Need decision summary",
            riskLevel: "medium",
            options: ["approve", "reject"],
            context: { sessionId: "decision-query-session" },
            timeoutPolicy: "reject",
        });
        approvals.applyDecision({
            approvalId: approval.approvalId,
            decisionType: "rejected",
            respondedBy: "operator-query",
            respondedAt: "2026-04-05T11:00:10.000Z",
        });
        workers.recordHeartbeat({
            workerId: "worker-query-decision",
            status: "idle",
            capabilities: ["bash", "edit"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-05T11:00:15.000Z",
        });
        dispatch.createTicket({
            executionId: "exec-query-decisions",
            queueName: "default",
            requiredCapabilities: ["bash", "edit"],
            occurredAt: "2026-04-05T11:00:16.000Z",
        });
        dispatch.dispatchNext({
            queueName: "default",
            leaseTtlMs: 30_000,
            occurredAt: "2026-04-05T11:00:17.000Z",
        });
        const allDecisions = inspect.queryDecisionInspectSummaries({
            taskId: "task-query-decisions",
        });
        const approvalDecisions = inspect.queryDecisionInspectSummaries({
            taskId: "task-query-decisions",
            decisionType: "approval",
            status: "rejected",
        });
        const dispatchDecisions = inspect.queryDecisionInspectSummaries({
            taskId: "task-query-decisions",
            decisionType: "dispatch",
            status: "dispatched",
        });
        assert.equal(allDecisions.length, 2);
        assert.equal(approvalDecisions.length, 1);
        assert.equal(approvalDecisions[0]?.decisionId, approval.approvalId);
        assert.equal(approvalDecisions[0]?.actorId, "operator-query");
        assert.equal(approvalDecisions[0]?.sourceAgentId, "agent-approval-query");
        assert.equal(dispatchDecisions.length, 1);
        assert.equal(dispatchDecisions[0]?.executionId, "exec-query-decisions");
        assert.equal(dispatchDecisions[0]?.selectedWorkerId, "worker-query-decision");
        assert.equal(dispatchDecisions[0]?.queueName, "default");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service enriches remote dispatch decisions with placement and fallback summaries", () => {
    const workspace = createTempWorkspace("aa-inspect-remote-routing-unit-");
    const dbPath = join(workspace, "inspect-remote-routing-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const dispatch = new ExecutionDispatchService(db, store);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-remote-routing",
            executionId: "exec-remote-routing",
            traceId: "trace-remote-routing",
        });
        seedWorkflowAndSession(db, store, {
            taskId: "task-remote-routing",
            sessionId: "sess-remote-routing",
            workflowStatus: "running",
            updatedAt: "2026-04-05T12:30:00.000Z",
        });
        db.connection.prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`).run("created", "2026-04-05T12:30:00.000Z", "exec-remote-routing");
        workers.recordHeartbeat({
            workerId: "worker-remote-offline",
            status: "offline",
            placement: "remote",
            registrationVerifiedAt: "2026-04-05T12:30:05.000Z",
            capabilities: ["bash", "edit"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-05T12:30:05.000Z",
        });
        workers.recordHeartbeat({
            workerId: "worker-local-fallback",
            status: "idle",
            placement: "local",
            capabilities: ["bash", "edit"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-05T12:30:05.000Z",
        });
        dispatch.createTicket({
            executionId: "exec-remote-routing",
            queueName: "default",
            dispatchTarget: "prefer_remote",
            requiredCapabilities: ["bash", "edit"],
            occurredAt: "2026-04-05T12:30:06.000Z",
        });
        dispatch.dispatchNext({
            queueName: "default",
            leaseTtlMs: 30_000,
            occurredAt: "2026-04-05T12:30:07.000Z",
        });
        const taskInspect = inspect.getTaskInspectView("task-remote-routing");
        const executionInspect = inspect.getExecutionInspectView("exec-remote-routing");
        assert.equal(taskInspect.dispatchDecisions.length, 1);
        assert.equal(taskInspect.dispatchDecisions[0]?.selectedWorkerPlacement, "local");
        assert.equal(taskInspect.dispatchDecisions[0]?.fallbackApplied, true);
        assert.equal(taskInspect.dispatchDecisions[0]?.remoteAvailability, "unavailable");
        assert.deepEqual(taskInspect.dispatchDecisions[0]?.remoteRejectedWorkerIds, ["worker-remote-offline"]);
        assert.deepEqual(taskInspect.dispatchDecisions[0]?.localAcceptedWorkerIds, ["worker-local-fallback"]);
        assert.equal(taskInspect.remoteRoutingSummary.totalDecisions, 1);
        assert.equal(taskInspect.remoteRoutingSummary.remoteDecisionCount, 1);
        assert.equal(taskInspect.remoteRoutingSummary.healthyDecisionCount, 0);
        assert.equal(taskInspect.remoteRoutingSummary.partialAvailableDecisionCount, 0);
        assert.equal(taskInspect.remoteRoutingSummary.degradedDecisionCount, 0);
        assert.equal(taskInspect.remoteRoutingSummary.unavailableDecisionCount, 1);
        assert.equal(taskInspect.remoteRoutingSummary.remoteDispatchCount, 0);
        assert.equal(taskInspect.remoteRoutingSummary.localDispatchCount, 1);
        assert.equal(taskInspect.remoteRoutingSummary.localFallbackCount, 1);
        assert.equal(taskInspect.remoteRoutingSummary.latestRemoteAvailability, "unavailable");
        assert.equal(taskInspect.remoteRoutingSummary.latestSelectedWorkerPlacement, "local");
        assert.deepEqual(taskInspect.remoteRoutingSummary.remoteWorkerIds, ["worker-remote-offline"]);
        assert.deepEqual(taskInspect.remoteRoutingSummary.localWorkerIds, ["worker-local-fallback"]);
        assert.equal(executionInspect.remoteRoutingSummary.localFallbackCount, 1);
        assert.equal(executionInspect.dispatchDecisions[0]?.reasonCode, "remote.fallback_local.unavailable");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service remote routing summary counts partial availability states", () => {
    const workspace = createTempWorkspace("aa-inspect-remote-summary-partial-unit-");
    const dbPath = join(workspace, "inspect-remote-summary-partial-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const dispatch = new ExecutionDispatchService(db, store);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-remote-summary-partial",
            executionId: "exec-remote-summary-partial",
            traceId: "trace-remote-summary-partial",
        });
        db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-remote-summary-partial");
        workers.recordHeartbeat({
            workerId: "worker-remote-summary-capacity-full",
            status: "busy",
            placement: "remote",
            registrationVerifiedAt: "2026-04-06T13:10:00.000Z",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:101",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-busy"],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T13:10:00.000Z",
        });
        workers.recordHeartbeat({
            workerId: "worker-remote-summary-missing-cap",
            status: "idle",
            placement: "remote",
            registrationVerifiedAt: "2026-04-06T13:10:00.000Z",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:102",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T13:10:00.000Z",
        });
        dispatch.createTicket({
            executionId: "exec-remote-summary-partial",
            queueName: "default",
            dispatchTarget: "require_remote",
            requiredCapabilities: ["bash", "edit"],
            occurredAt: "2026-04-06T13:10:05.000Z",
        });
        dispatch.dispatchNext({
            queueName: "default",
            leaseTtlMs: 30_000,
            occurredAt: "2026-04-06T13:10:06.000Z",
        });
        const partialInspect = inspect.getTaskInspectView("task-remote-summary-partial");
        assert.equal(partialInspect.remoteRoutingSummary.partialAvailableDecisionCount, 1);
        assert.equal(partialInspect.remoteRoutingSummary.degradedDecisionCount, 0);
        assert.equal(partialInspect.dispatchDecisions[0]?.reasonCode, "remote.partial_available");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service remote routing summary counts degraded availability states", () => {
    const workspace = createTempWorkspace("aa-inspect-remote-summary-degraded-unit-");
    const dbPath = join(workspace, "inspect-remote-summary-degraded-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const dispatch = new ExecutionDispatchService(db, store);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-remote-summary-degraded",
            executionId: "exec-remote-summary-degraded",
            traceId: "trace-remote-summary-degraded",
        });
        db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-remote-summary-degraded");
        workers.recordHeartbeat({
            workerId: "worker-remote-summary-viewer-a",
            status: "idle",
            placement: "remote",
            registrationVerifiedAt: "2026-04-06T13:11:00.000Z",
            remoteSessionStatus: "viewer_only",
            lastAcknowledgedStreamOffset: "stream:103",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T13:11:00.000Z",
        });
        workers.recordHeartbeat({
            workerId: "worker-remote-summary-viewer-b",
            status: "idle",
            placement: "remote",
            registrationVerifiedAt: "2026-04-06T13:11:00.000Z",
            remoteSessionStatus: "viewer_only",
            lastAcknowledgedStreamOffset: "stream:104",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T13:11:00.000Z",
        });
        dispatch.createTicket({
            executionId: "exec-remote-summary-degraded",
            priority: "high",
            queueName: "default",
            dispatchTarget: "require_remote",
            requiredCapabilities: ["bash"],
            occurredAt: "2026-04-06T13:11:05.000Z",
        });
        dispatch.dispatchNext({
            queueName: "default",
            leaseTtlMs: 30_000,
            occurredAt: "2026-04-06T13:11:06.000Z",
        });
        const degradedInspect = inspect.getTaskInspectView("task-remote-summary-degraded");
        assert.equal(degradedInspect.remoteRoutingSummary.partialAvailableDecisionCount, 0);
        assert.equal(degradedInspect.remoteRoutingSummary.degradedDecisionCount, 1);
        assert.equal(degradedInspect.dispatchDecisions[0]?.reasonCode, "remote.session_unready");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service query layer lists remote worker summaries with session telemetry", () => {
    const workspace = createTempWorkspace("aa-inspect-workers-unit-");
    const dbPath = join(workspace, "inspect-workers-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const inspect = new InspectService(store);
        workers.recordHeartbeat({
            workerId: "worker-inspect-remote",
            status: "idle",
            placement: "remote",
            registrationVerifiedAt: "2026-04-05T12:30:00.000Z",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:77",
            streamResumeSuccessRate: 0.96,
            credentialRefreshSuccessRate: 0.97,
            sessionConsistencyCheckStatus: "passed",
            sessionConsistencyCheckedAt: "2026-04-05T12:30:00.000Z",
            saturation: 0.6,
            activeLeaseCount: 2,
            meanStartupLatencyMs: 410,
            sandboxSuccessRate: 0.98,
            repoCacheHitRate: 0.91,
            capabilities: ["bash"],
            runningExecutionIds: ["exec-a"],
            maxConcurrency: 3,
            queueAffinity: "default",
            occurredAt: "2026-04-05T12:30:00.000Z",
        });
        const workersSummary = inspect.queryWorkerInspectSummaries({
            placement: "remote",
            remoteSessionStatus: "connected",
        });
        assert.equal(workersSummary.length, 1);
        assert.equal(workersSummary[0]?.workerId, "worker-inspect-remote");
        assert.equal(workersSummary[0]?.schedulingStatus, "healthy");
        assert.equal(workersSummary[0]?.lastAcknowledgedStreamOffset, "stream:77");
        assert.equal(workersSummary[0]?.streamResumeSuccessRate, 0.96);
        assert.equal(workersSummary[0]?.credentialRefreshSuccessRate, 0.97);
        assert.equal(workersSummary[0]?.sessionConsistencyCheckStatus, "passed");
        assert.equal(workersSummary[0]?.activeLeaseCount, 2);
        assert.equal(workersSummary[0]?.availableSlots, 2);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service summarizes lease handovers for task and execution views", () => {
    const workspace = createTempWorkspace("aa-inspect-handover-unit-");
    const dbPath = join(workspace, "inspect-handover-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const workers = new WorkerRegistryService(store);
        const leases = new ExecutionLeaseService(db, store);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-inspect-handover",
            executionId: "exec-inspect-handover",
            traceId: "trace-inspect-handover",
        });
        workers.recordHeartbeat({
            workerId: "worker-handover-source",
            status: "draining",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-inspect-handover"],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T12:00:00.000Z",
        });
        workers.recordHeartbeat({
            workerId: "worker-handover-target",
            status: "idle",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: "2026-04-06T12:00:00.000Z",
        });
        const granted = leases.acquireLease({
            executionId: "exec-inspect-handover",
            workerId: "worker-handover-source",
            ttlMs: 30_000,
            occurredAt: "2026-04-06T12:00:00.000Z",
        });
        const handover = leases.handoverLease({
            leaseId: granted.lease?.id ?? "",
            workerId: "worker-handover-source",
            newWorkerId: "worker-handover-target",
            ttlMs: 30_000,
            reasonCode: "inspect.handover",
            occurredAt: "2026-04-06T12:00:10.000Z",
        });
        const taskInspect = inspect.getTaskInspectView("task-inspect-handover");
        const executionInspect = inspect.getExecutionInspectView("exec-inspect-handover");
        assert.equal(handover.outcome, "handed_over");
        assert.equal(taskInspect.leaseHandoverSummary.totalHandovers, 1);
        assert.equal(taskInspect.leaseHandoverSummary.latestHandoverAt, "2026-04-06T12:00:10.000Z");
        assert.equal(taskInspect.leaseHandoverSummary.latestReasonCode, "inspect.handover");
        assert.equal(taskInspect.leaseHandoverSummary.latestPreviousWorkerId, "worker-handover-source");
        assert.equal(taskInspect.leaseHandoverSummary.latestWorkerId, "worker-handover-target");
        assert.deepEqual(taskInspect.leaseHandoverSummary.workerIds, ["worker-handover-source", "worker-handover-target"]);
        assert.equal(executionInspect.leaseHandoverSummary.totalHandovers, 1);
        assert.equal(executionInspect.leaseHandoverSummary.latestWorkerId, "worker-handover-target");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("inspect service projects task and step outputs into unified result envelopes", () => {
    const workspace = createTempWorkspace("aa-inspect-results-unit-");
    const dbPath = join(workspace, "inspect-results-unit.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const inspect = new InspectService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-query-results",
            executionId: "exec-query-results",
            traceId: "trace-query-results",
        });
        seedWorkflowAndSession(db, store, {
            taskId: "task-query-results",
            sessionId: "sess-query-results",
            workflowStatus: "completed",
            updatedAt: "2026-04-05T12:00:00.000Z",
        });
        db.connection
            .prepare(`UPDATE tasks SET status = ?, output_json = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
            .run("done", JSON.stringify({
            summary: "Task completed with artifact-backed output",
            result: "final answer",
            score: 0.98,
        }), "2026-04-05T12:00:00.000Z", "2026-04-05T12:00:00.000Z", "task-query-results");
        db.connection
            .prepare(`UPDATE executions SET status = ?, updated_at = ?, finished_at = ? WHERE id = ?`)
            .run("succeeded", "2026-04-05T12:00:00.000Z", "2026-04-05T12:00:00.000Z", "exec-query-results");
        store.insertArtifact({
            artifactId: "artifact-query-results",
            taskId: "task-query-results",
            executionId: "exec-query-results",
            stepId: "finalize",
            kind: "report",
            storagePath: join(workspace, "artifacts", "task-query-results", "artifact-query-results", "final.json"),
            fileName: "final.json",
            mimeType: "application/json",
            sizeBytes: 128,
            checksum: "abc123",
            lineageJson: JSON.stringify({ source: "unit-test" }),
            createdAt: "2026-04-05T12:00:00.000Z",
        });
        store.insertStepOutput({
            id: "step-query-results",
            taskId: "task-query-results",
            stepId: "finalize",
            roleId: "general_executor",
            status: "partial_success",
            dataJson: JSON.stringify({
                summary: "Finalize draft",
                result: "report generated",
            }),
            summary: "Finalize draft",
            artifactsJson: JSON.stringify([
                {
                    artifactId: "artifact-query-results",
                    kind: "report",
                    uri: join(workspace, "artifacts", "task-query-results", "artifact-query-results", "final.json"),
                    createdAt: "2026-04-05T12:00:00.000Z",
                },
            ]),
            tokenCost: 77,
            durationMs: 1800,
            validationJson: JSON.stringify({
                valid: false,
                warnings: ["missing_optional_section"],
            }),
            producedAt: "2026-04-05T12:00:00.000Z",
        });
        const view = inspect.getTaskInspectView("task-query-results");
        assert.equal(view.taskResult?.status, "success");
        assert.equal(view.taskResult?.humanSummary, "Task completed with artifact-backed output");
        assert.equal(view.taskResult?.artifacts.length, 1);
        assert.deepEqual(view.taskResult?.metrics, {
            tokenCost: 77,
            durationMs: 1800,
        });
        assert.equal(view.stepResults.length, 1);
        assert.equal(view.stepResults[0]?.status, "partial");
        assert.ok(view.stepResults[0]?.warnings.includes("partial_success"));
        assert.ok(view.stepResults[0]?.warnings.includes("validation_failed"));
        assert.ok(view.stepResults[0]?.warnings.includes("validation:missing_optional_section"));
        assert.equal(view.stepResults[0]?.artifacts[0]?.mimeType, "application/json");
        assert.deepEqual(view.stepResults[0]?.metrics, {
            tokenCost: 77,
            durationMs: 1800,
        });
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=inspect-service.test.js.map