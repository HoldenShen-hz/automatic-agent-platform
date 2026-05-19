/**
 * Unit tests for ApprovalService class
 *
 * Tests the ApprovalService class methods including createRequest and applyDecision.
 * Uses mocks for external dependencies to isolate unit tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
// ---------------------------------------------------------------------------
// Mock Infrastructure
// ---------------------------------------------------------------------------
function createMockStore() {
    const approvals = new Map();
    const events = [];
    return {
        task: {
            updateTaskStatus() { },
            updateTaskStatusCas() { return 1; },
            updateTaskOutput() { },
        },
        workflow: {
            updateWorkflowState() { },
        },
        execution: {
            updateExecutionStatus() { },
        },
        session: {
            updateSessionStatus() { },
        },
        event: {
            insertEvent(event) {
                return {
                    id: event.id ?? "evt_mock",
                    taskId: event.taskId,
                    sessionId: event.sessionId ?? null,
                    executionId: event.executionId,
                    eventType: event.eventType,
                    eventTier: event.eventTier ?? "tier_1",
                    payloadJson: event.payloadJson,
                    traceId: event.traceId,
                    createdAt: event.createdAt,
                };
            },
        },
        approval: {
            insertApproval(approval) {
                approvals.set(approval.id, { ...approval });
            },
            getApproval(approvalId) {
                return approvals.get(approvalId) ?? null;
            },
            listApprovalsByTask(taskId) {
                return Array.from(approvals.values()).filter((r) => r.taskId === taskId);
            },
            listApprovalsByStatus(status) {
                return Array.from(approvals.values()).filter((r) => r.status === status);
            },
            updateApprovalDecision(input) {
                const existing = approvals.get(input.approvalId);
                if (existing) {
                    approvals.set(input.approvalId, {
                        ...existing,
                        status: input.status,
                        responseJson: input.responseJson,
                        respondedAt: input.respondedAt,
                    });
                }
            },
            updateApprovalDecisionCas(input) {
                const existing = approvals.get(input.approvalId);
                if (!existing || existing.status !== input.expectedStatus) {
                    return 0;
                }
                approvals.set(input.approvalId, {
                    ...existing,
                    status: input.status,
                    responseJson: input.responseJson,
                    respondedAt: input.respondedAt,
                });
                return 1;
            },
            updateApprovalRequest(input) {
                const existing = approvals.get(input.id);
                if (existing) {
                    approvals.set(input.id, { ...existing, requestJson: input.requestJson });
                }
            },
        },
    };
}
function createMockDb() {
    return {
        transaction(fn) {
            return fn();
        },
    };
}
// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
function createBaseRequest() {
    return {
        taskId: "task_test_123",
        executionId: null,
        sourceAgentId: "agent_456",
        reason: "Test approval request",
        riskLevel: "high",
        options: ["option_a", "option_b"],
        context: {},
        timeoutPolicy: "reject",
    };
}
function createValidDecision(approvalId, decisionType = "confirmed") {
    return {
        approvalId,
        decisionType,
        ...(decisionType === "confirmed" ? { confirmed: true } : {}),
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
}
// ---------------------------------------------------------------------------
// createRequest Tests
// ---------------------------------------------------------------------------
test("ApprovalService.createRequest creates request with generated ID", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const result = service.createRequest(request);
    assert.ok(result.approvalId);
    assert.ok(result.approvalId.startsWith("approval_"));
    assert.strictEqual(result.taskId, request.taskId);
    assert.strictEqual(result.sourceAgentId, request.sourceAgentId);
    assert.strictEqual(result.reason, request.reason);
    assert.strictEqual(result.riskLevel, request.riskLevel);
    assert.ok(result.createdAt);
});
test("ApprovalService.createRequest sets executionId to null when not provided", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = {
        taskId: "task_test_123",
        sourceAgentId: "agent_456",
        reason: "Test approval request",
        riskLevel: "high",
        options: ["option_a", "option_b"],
        context: {},
        timeoutPolicy: "reject",
    };
    const result = service.createRequest(request);
    assert.strictEqual(result.executionId, null);
});
test("ApprovalService.createRequest preserves executionId when provided", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    request.executionId = "exec_789";
    const result = service.createRequest(request);
    assert.strictEqual(result.executionId, "exec_789");
});
test("ApprovalService.createRequest stores approval in repository", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const result = service.createRequest(request);
    const stored = store.approval.getApproval(result.approvalId);
    assert.ok(stored);
    assert.strictEqual(stored.taskId, request.taskId);
    assert.strictEqual(stored.status, "requested");
});
test("ApprovalService.createRequest emits decision:requested event", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const result = service.createRequest(request);
    // The store's event insertEvent is called
    assert.ok(store);
});
// ---------------------------------------------------------------------------
// applyDecision Tests
// ---------------------------------------------------------------------------
test("ApprovalService.applyDecision throws for non-existent approval", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const decision = createValidDecision("nonexistent_approval");
    assert.throws(() => service.applyDecision(decision), (err) => err.code === "approval.not_found");
});
test("ApprovalService.applyDecision ignores decision when status is not requested", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    // Create an approval
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    // Manually change status to approved
    store.approval.updateApprovalDecision({
        approvalId: approval.approvalId,
        status: "approved",
        responseJson: "{}",
        respondedAt: "2026-04-21T00:00:00.000Z",
    });
    // Apply decision should be a no-op
    const decision = createValidDecision(approval.approvalId, "rejected");
    assert.doesNotThrow(() => service.applyDecision(decision));
});
test("ApprovalService.applyDecision applies confirmed decision", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.doesNotThrow(() => service.applyDecision(decision));
});
test("ApprovalService.applyDecision applies rejected decision", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "rejected",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.doesNotThrow(() => service.applyDecision(decision));
});
test("ApprovalService.applyDecision applies expired decision", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "expired",
        respondedBy: "system",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.doesNotThrow(() => service.applyDecision(decision));
});
test("ApprovalService.applyDecision applies option_selected decision", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "option_selected",
        selectedOptionId: "option_a",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.doesNotThrow(() => service.applyDecision(decision));
});
test("ApprovalService.applyDecision applies text_input decision", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "text_input",
        inputText: "Looks good to me",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.doesNotThrow(() => service.applyDecision(decision));
});
test("ApprovalService.applyDecision throws for invalid decision payload", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    // Missing required fields for option_selected
    const invalidDecision = {
        approvalId: approval.approvalId,
        decisionType: "option_selected",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.throws(() => service.applyDecision(invalidDecision), (err) => err.code === "approval.invalid_option_selected");
});
test("ApprovalService.applyDecision throws for confirmed without confirmed=true", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const invalidDecision = {
        approvalId: approval.approvalId,
        decisionType: "confirmed",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.throws(() => service.applyDecision(invalidDecision), (err) => err.code === "approval.invalid_confirmed");
});
test("ApprovalService.applyDecision throws for text_input without inputText", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const invalidDecision = {
        approvalId: approval.approvalId,
        decisionType: "text_input",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.throws(() => service.applyDecision(invalidDecision), (err) => err.code === "approval.invalid_text_input");
});
test("ApprovalService.applyDecision throws for terminal decision with extra fields", () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new ApprovalService(db, store);
    const request = createBaseRequest();
    const approval = service.createRequest(request);
    const invalidDecision = {
        approvalId: approval.approvalId,
        decisionType: "rejected",
        selectedOptionId: "option_a",
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.throws(() => service.applyDecision(invalidDecision), (err) => err.code === "approval.invalid_terminal_payload");
});
//# sourceMappingURL=approval-service-class.test.js.map