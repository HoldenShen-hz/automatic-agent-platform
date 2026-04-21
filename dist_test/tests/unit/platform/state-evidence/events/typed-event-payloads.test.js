import assert from "node:assert/strict";
import test from "node:test";
test("TaskStatusChangedPayload structure is correct", () => {
    const payload = {
        fromStatus: "pending",
        toStatus: "in_progress",
        reasonCode: "scheduler_dispatch",
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.fromStatus, "pending");
    assert.equal(payload.toStatus, "in_progress");
    assert.equal(payload.reasonCode, "scheduler_dispatch");
});
test("TaskStatusChangedPayload allows optional traceContext", () => {
    const payload = {
        fromStatus: "queued",
        toStatus: "pending",
        reasonCode: "task_queued",
        occurredAt: "2026-04-14T00:00:00.000Z",
        traceContext: {
            traceId: "trace_123",
            spanId: "span_456",
            parentSpanId: null,
            correlationId: null,
        },
    };
    assert.ok(payload.traceContext !== undefined);
    assert.equal(payload.traceContext?.traceId, "trace_123");
});
test("WorkflowStepCompletedPayload structure is correct", () => {
    const payload = {
        workflowId: "wf_123",
        stepId: "step_1",
        outputKey: "result",
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.workflowId, "wf_123");
    assert.equal(payload.stepId, "step_1");
    assert.equal(payload.outputKey, "result");
});
test("WorkflowStepCompletedPayload allows null outputKey", () => {
    const payload = {
        workflowId: "wf_456",
        stepId: "step_2",
        outputKey: null,
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.outputKey, null);
});
test("DecisionRequestedPayload structure is correct", () => {
    const payload = {
        approvalId: "approval_123",
        decisionType: "option_selected",
        requestedAt: "2026-04-14T00:00:00.000Z",
        taskId: "task_456",
        riskLevel: "high",
    };
    assert.equal(payload.approvalId, "approval_123");
    assert.equal(payload.decisionType, "option_selected");
    assert.equal(payload.riskLevel, "high");
});
test("DecisionRequestedPayload allows minimal definition", () => {
    const payload = {
        approvalId: "approval_minimal",
    };
    assert.equal(payload.approvalId, "approval_minimal");
    assert.equal(payload.decisionType, undefined);
    assert.equal(payload.taskId, undefined);
});
test("DecisionRespondedPayload structure is correct", () => {
    const payload = {
        approvalId: "approval_123",
        decisionType: "confirmed",
        responseStatus: "approved",
        respondedAt: "2026-04-14T00:00:00.000Z",
        selectedOptionId: null,
        decision: "approved",
        reasonCode: "user_confirmed",
    };
    assert.equal(payload.approvalId, "approval_123");
    assert.equal(payload.decision, "approved");
});
test("DivisionOutcomePayload structure is correct", () => {
    const payload = {
        divisionId: "platform_team",
        workflowId: "wf_deploy",
        executionId: "exec_789",
        occurredAt: "2026-04-14T00:00:00.000Z",
        reasonCode: "workflow_completed",
    };
    assert.equal(payload.divisionId, "platform_team");
    assert.equal(payload.workflowId, "wf_deploy");
});
test("DivisionOutcomePayload allows null workflowId", () => {
    const payload = {
        divisionId: "general",
        workflowId: null,
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.workflowId, null);
});
test("SubtaskOutcomePayload structure is correct", () => {
    const payload = {
        subtaskId: "subtask_123",
        parentTaskId: "task_456",
        occurredAt: "2026-04-14T00:00:00.000Z",
        reasonCode: "subtask_completed",
    };
    assert.equal(payload.subtaskId, "subtask_123");
    assert.equal(payload.parentTaskId, "task_456");
});
test("CostLimitReachedPayload structure is correct", () => {
    const payload = {
        budgetId: "budget_monthly",
        currentCostUsd: 95.50,
        limitUsd: 100.00,
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.budgetId, "budget_monthly");
    assert.equal(payload.currentCostUsd, 95.50);
    assert.equal(payload.limitUsd, 100.00);
});
test("StreamChunkEmittedPayload structure is correct", () => {
    const payload = {
        streamId: "stream_abc",
        chunkIndex: 5,
        chunkType: "text",
        emittedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.streamId, "stream_abc");
    assert.equal(payload.chunkIndex, 5);
    assert.equal(payload.chunkType, "text");
});
test("DispatchTicketPayload structure is correct", () => {
    const payload = {
        ticketId: "ticket_123",
        executionId: "exec_456",
        occurredAt: "2026-04-14T00:00:00.000Z",
        workerId: "worker_xyz",
        reasonCode: "task_dispatched",
    };
    assert.equal(payload.ticketId, "ticket_123");
    assert.equal(payload.executionId, "exec_456");
    assert.equal(payload.workerId, "worker_xyz");
});
test("DispatchTicketPayload allows minimal definition", () => {
    const payload = {
        ticketId: "ticket_minimal",
        executionId: "exec_minimal",
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.ticketId, "ticket_minimal");
    assert.equal(payload.workerId, undefined);
    assert.equal(payload.reasonCode, undefined);
});
test("WorkerLifecyclePayload structure is correct", () => {
    const payload = {
        workerId: "worker_123",
        executionId: "exec_456",
        occurredAt: "2026-04-14T00:00:00.000Z",
        leaseId: "lease_789",
        reasonCode: "worker_busy",
    };
    assert.equal(payload.workerId, "worker_123");
    assert.equal(payload.executionId, "exec_456");
    assert.equal(payload.leaseId, "lease_789");
});
test("WorkerLifecyclePayload allows null executionId", () => {
    const payload = {
        workerId: "worker_idle",
        executionId: null,
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.executionId, null);
});
test("TakeoverPayload structure is correct", () => {
    const payload = {
        takeoverId: "takeover_123",
        executionId: "exec_456",
        occurredAt: "2026-04-14T00:00:00.000Z",
        actionType: "take_over_task",
    };
    assert.equal(payload.takeoverId, "takeover_123");
    assert.equal(payload.executionId, "exec_456");
    assert.equal(payload.actionType, "take_over_task");
});
test("TakeoverPayload allows minimal definition", () => {
    const payload = {
        takeoverId: "takeover_minimal",
        executionId: "exec_minimal",
        occurredAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(payload.takeoverId, "takeover_minimal");
    assert.equal(payload.actionType, undefined);
});
test("RecoveryPayload structure is correct", () => {
    const payload = {
        executionId: "exec_123",
        decisionId: "decision_456",
        occurredAt: "2026-04-14T00:00:00.000Z",
        reasonCode: "execution_failed",
    };
    assert.equal(payload.executionId, "exec_123");
    assert.equal(payload.decisionId, "decision_456");
    assert.equal(payload.reasonCode, "execution_failed");
});
test("RecoveryPayload allows minimal definition", () => {
    const payload = {
        executionId: "exec_minimal",
        occurredAt: "2026-04-14T00:00:00.000Z",
        reasonCode: "recovery_initiated",
    };
    assert.equal(payload.executionId, "exec_minimal");
    assert.equal(payload.decisionId, undefined);
});
//# sourceMappingURL=typed-event-payloads.test.js.map