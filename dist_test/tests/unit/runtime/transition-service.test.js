import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../src/platform/execution/state-transition/transition-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
test("transition service writes tier1 ack records for task status change", () => {
    const workspace = createTempWorkspace("aa-transition-");
    try {
        const db = new SqliteDatabase(join(workspace, "test.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new TransitionService(db, store);
        const now = nowIso();
        const taskId = newId("task");
        const executionId = newId("exec");
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Transition test",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent",
                roleId: "general_executor",
                runKind: "task_run",
                status: "created",
                inputRef: null,
                traceId: "trace-1",
                attempt: 1,
                timeoutMs: 1000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: null,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        service.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "queued",
            toStatus: "in_progress",
            executionId,
            reasonCode: "task.started",
            traceId: "trace-1",
            actorType: "system",
            idempotencyKey: "task-start-1",
            metadataJson: JSON.stringify({ source: "unit-test" }),
            occurredAt: nowIso(),
        });
        const snapshot = store.loadTaskSnapshot(taskId);
        assert.equal(snapshot.task.status, "in_progress");
        assert.equal(snapshot.events.length, 1);
        assert.equal(snapshot.events[0]?.eventType, "task:status_changed");
        const eventPayload = snapshot.events[0] ? JSON.parse(snapshot.events[0].payloadJson) : null;
        const traceContext = eventPayload?.traceContext;
        assert.equal(traceContext?.traceId, "trace-1");
        assert.equal(typeof traceContext?.spanId, "string");
        assert.equal(traceContext?.correlationId, taskId);
        assert.equal(eventPayload?.entityKind, "task");
        assert.equal(eventPayload?.entityId, taskId);
        assert.equal(eventPayload?.actorType, "system");
        assert.equal(eventPayload?.idempotencyKey, "task-start-1");
        assert.equal(eventPayload?.metadataJson, "{\"source\":\"unit-test\"}");
        const ackRow = db.connection.prepare("SELECT COUNT(*) AS count FROM event_consumer_acks").get();
        const ackCount = Number(ackRow?.count ?? 0);
        assert.ok(ackCount >= 1);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("transition service rejects illegal task terminal reentry", () => {
    const workspace = createTempWorkspace("aa-transition-");
    try {
        const db = new SqliteDatabase(join(workspace, "test.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new TransitionService(db, store);
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Terminal task",
                status: "done",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: "{}",
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: now,
            });
            store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent",
                roleId: "general_executor",
                runKind: "task_run",
                status: "succeeded",
                inputRef: null,
                traceId: "trace-2",
                attempt: 1,
                timeoutMs: 1000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: now,
                createdAt: now,
                updatedAt: now,
            });
        });
        assert.throws(() => {
            service.transitionTaskStatus({
                entityKind: "task",
                entityId: taskId,
                fromStatus: "done",
                toStatus: "in_progress",
                executionId,
                reasonCode: "task.recover",
                traceId: "trace-2",
                actorType: "recovery",
                occurredAt: nowIso(),
            });
        }, /task\.invalid_transition/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("transition service rejects awaiting user sessions from pausing again", () => {
    const workspace = createTempWorkspace("aa-transition-");
    try {
        const db = new SqliteDatabase(join(workspace, "session-transition.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new TransitionService(db, store);
        const now = nowIso();
        db.transaction(() => {
            store.insertTask({
                id: "task-session-transition",
                parentId: null,
                rootId: "task-session-transition",
                divisionId: "general_ops",
                title: "Session transition",
                status: "awaiting_decision",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertSession({
                id: "sess-session-transition",
                taskId: "task-session-transition",
                channel: "cli",
                status: "awaiting_user",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        assert.throws(() => {
            service.transitionSessionStatus({
                entityKind: "session",
                entityId: "sess-session-transition",
                fromStatus: "awaiting_user",
                toStatus: "paused",
                reasonCode: "session.pause_again",
                traceId: "trace-session-transition",
                actorType: "system",
                occurredAt: nowIso(),
            });
        }, /session\.invalid_transition/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("transition service updates approval status through the unified approval transition entry", () => {
    const workspace = createTempWorkspace("aa-transition-");
    try {
        const db = new SqliteDatabase(join(workspace, "approval-transition.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new TransitionService(db, store);
        const now = nowIso();
        db.transaction(() => {
            store.insertTask({
                id: "task-approval-transition",
                parentId: null,
                rootId: "task-approval-transition",
                divisionId: "general_ops",
                title: "Approval transition",
                status: "awaiting_decision",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertApproval({
                id: "approval-transition-1",
                taskId: "task-approval-transition",
                executionId: null,
                status: "requested",
                requestJson: "{\"reason\":\"Need approval\"}",
                responseJson: null,
                timeoutPolicy: "reject",
                createdAt: now,
                respondedAt: null,
            });
        });
        service.transitionApprovalStatus({
            entityKind: "approval",
            entityId: "approval-transition-1",
            fromStatus: "requested",
            toStatus: "approved",
            responseJson: JSON.stringify({
                approvalId: "approval-transition-1",
                decisionType: "confirmed",
            }),
            reasonCode: "approval.approved",
            traceId: "trace-approval-transition",
            actorType: "user",
            actorId: "operator-1",
            occurredAt: "2026-04-11T08:00:00.000Z",
        });
        const approval = store.getApproval("approval-transition-1");
        assert.equal(approval?.status, "approved");
        assert.equal(approval?.respondedAt, "2026-04-11T08:00:00.000Z");
        assert.match(approval?.responseJson ?? "", /"decisionType":"confirmed"/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("transition service blocks task execution for approval atomically", () => {
    const workspace = createTempWorkspace("aa-transition-blocked-");
    try {
        const db = new SqliteDatabase(join(workspace, "blocked-for-approval.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new TransitionService(db, store);
        const now = nowIso();
        db.transaction(() => {
            store.insertTask({
                id: "task-blocked-approval",
                parentId: null,
                rootId: "task-blocked-approval",
                divisionId: "general_ops",
                title: "Approval gate",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertWorkflowState({
                taskId: "task-blocked-approval",
                divisionId: "general_ops",
                workflowId: "single_agent_minimal",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "[]",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
            store.insertSession({
                id: "session-blocked-approval",
                taskId: "task-blocked-approval",
                channel: "cli",
                status: "streaming",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
            store.insertExecution({
                id: "exec-blocked-approval",
                taskId: "task-blocked-approval",
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: "trace-blocked-approval",
                attempt: 1,
                timeoutMs: 1000,
                budgetUsdLimit: 1,
                requiresApproval: 1,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        const result = service.transitionBlockedForApproval({
            taskId: "task-blocked-approval",
            sessionId: "session-blocked-approval",
            executionId: "exec-blocked-approval",
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "running",
            currentSessionStatus: "streaming",
            currentExecutionStatus: "executing",
            workflowCurrentStepIndex: 0,
            workflowOutputsJson: "[{\"stepId\":\"s1\"}]",
            approval: {
                sourceAgentId: "agent",
                reason: "Need operator confirmation",
                riskLevel: "high",
                options: ["approve", "reject"],
                context: { sessionId: "session-blocked-approval" },
                timeoutPolicy: "reject",
            },
            context: {
                reasonCode: "approval.required",
                traceId: "trace-blocked-approval",
                actorType: "system",
                occurredAt: "2026-04-11T10:00:00.000Z",
            },
        });
        const snapshot = store.loadTaskSnapshot("task-blocked-approval");
        const approval = store.getApproval(result.approvalId);
        assert.equal(snapshot.task.status, "awaiting_decision");
        assert.equal(snapshot.workflow?.status, "paused");
        assert.equal(snapshot.session?.status, "awaiting_user");
        assert.equal(snapshot.execution?.status, "blocked");
        assert.equal(approval?.status, "requested");
        assert.match(approval?.requestJson ?? "", /Need operator confirmation/);
        const decisionEvent = store.listEventsForTask("task-blocked-approval").find((event) => event.eventType === "decision:requested");
        assert.ok(decisionEvent);
        assert.equal(result.createdAt, "2026-04-11T10:00:00.000Z");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("transition service rejects approval terminal reentry", () => {
    const workspace = createTempWorkspace("aa-transition-");
    try {
        const db = new SqliteDatabase(join(workspace, "approval-transition-invalid.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new TransitionService(db, store);
        const now = nowIso();
        db.transaction(() => {
            store.insertTask({
                id: "task-approval-invalid",
                parentId: null,
                rootId: "task-approval-invalid",
                divisionId: "general_ops",
                title: "Approval invalid transition",
                status: "awaiting_decision",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            store.insertApproval({
                id: "approval-transition-invalid",
                taskId: "task-approval-invalid",
                executionId: null,
                status: "approved",
                requestJson: "{\"reason\":\"Need approval\"}",
                responseJson: "{\"decisionType\":\"confirmed\"}",
                timeoutPolicy: "reject",
                createdAt: now,
                respondedAt: now,
            });
        });
        assert.throws(() => {
            service.transitionApprovalStatus({
                entityKind: "approval",
                entityId: "approval-transition-invalid",
                fromStatus: "approved",
                toStatus: "rejected",
                responseJson: "{\"decisionType\":\"rejected\"}",
                reasonCode: "approval.rejected",
                traceId: "trace-approval-invalid",
                actorType: "system",
                occurredAt: nowIso(),
            });
        }, /approval\.invalid_transition/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=transition-service.test.js.map