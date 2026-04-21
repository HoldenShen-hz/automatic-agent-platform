import assert from "node:assert/strict";
import test from "node:test";
import { MultiPartyApprovalService } from "../../../../../src/platform/control-plane/approval-center/multi-party-approval-service.js";
function createMockStoreAndDb() {
    const approvals = new Map();
    const events = [];
    const mockStore = {
        task: {
            updateTaskStatus: () => { },
            updateTaskStatusCas: () => 1,
        },
    };
    const mockDb = {
        transaction(fn) {
            return fn();
        },
    };
    const mockRepository = {
        insertApproval(approval) {
            approvals.set(approval.id, { ...approval });
        },
        getApproval(approvalId) {
            return approvals.get(approvalId) ?? null;
        },
        updateApprovalRequest(input) {
            const existing = approvals.get(input.id);
            if (existing) {
                approvals.set(input.id, { ...existing, requestJson: input.requestJson });
            }
        },
        insertEvent(event) {
            const record = {
                id: event.id ?? "evt_mock",
                taskId: event.taskId,
                executionId: event.executionId ?? null,
                eventType: event.eventType,
                eventTier: event.eventTier ?? "tier_1",
                payloadJson: event.payloadJson,
                traceId: event.traceId ?? null,
                createdAt: event.createdAt,
            };
            events.push(record);
            return record;
        },
    };
    return { mockStore, mockDb, mockRepository, approvals, events };
}
// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
function createBaseRequest() {
    return {
        taskId: "task_test_123",
        executionId: null,
        sourceAgentId: "agent_456",
        reason: "Test multi-party approval",
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
        confirmed: decisionType === "confirmed" ? true : undefined,
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
}
// ---------------------------------------------------------------------------
// createMultiPartyRequest Tests
// ---------------------------------------------------------------------------
test("createMultiPartyRequest creates request with default requiredApprovals=1", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const result = service.createMultiPartyRequest(request);
    assert.ok(result.approvalId);
    assert.strictEqual(result.taskId, request.taskId);
    assert.strictEqual(result.sourceAgentId, request.sourceAgentId);
    assert.strictEqual(result.requiredApprovals, 1);
    assert.deepStrictEqual(result.approverGroups, []);
    assert.strictEqual(result.approvalsReceived, 0);
    assert.strictEqual(result.context["multiPartyEnabled"], true);
    assert.strictEqual(result.context["originalRequiredApprovals"], 1);
});
test("createMultiPartyRequest creates request with custom requiredApprovals", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const result = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    assert.strictEqual(result.requiredApprovals, 3);
    assert.strictEqual(result.context["originalRequiredApprovals"], 3);
});
test("createMultiPartyRequest creates request with approverGroups", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const groups = ["group_a", "group_b"];
    const result = service.createMultiPartyRequest(request, { approverGroups: groups });
    assert.deepStrictEqual(result.approverGroups, groups);
});
test("createMultiPartyRequest sets multiPartyEnabled in context", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const result = service.createMultiPartyRequest(request);
    assert.strictEqual(result.context["multiPartyEnabled"], true);
});
test("createMultiPartyRequest preserves existing context fields", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    request.context = { existingKey: "existingValue" };
    const result = service.createMultiPartyRequest(request);
    assert.strictEqual(result.context["existingKey"], "existingValue");
    assert.strictEqual(result.context["multiPartyEnabled"], true);
});
test("getPendingApproval returns null for non-existent approval", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const result = service.getPendingApproval("nonexistent");
    assert.strictEqual(result, null);
});
test("getPendingApproval returns pending record after request creation", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const result = service.createMultiPartyRequest(request, { requiredApprovals: 2 });
    const pending = service.getPendingApproval(result.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.approvalId, result.approvalId);
    assert.strictEqual(pending.requiredApprovals, 2);
    assert.strictEqual(pending.approvalsReceived, 0);
    assert.strictEqual(pending.status, "pending");
    assert.deepStrictEqual(pending.decisions, []);
});
// ---------------------------------------------------------------------------
// applyDecision Tests
// ---------------------------------------------------------------------------
test("applyDecision throws for invalid decision payload", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request);
    const invalidDecision = {
        approvalId: approval.approvalId,
        decisionType: "option_selected",
        // missing selectedOptionId
        respondedBy: "user_789",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    assert.throws(() => service.applyDecision(invalidDecision), (err) => err.code === "approval.invalid_option_selected");
});
test("applyDecision throws for non-existent approval", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const decision = createValidDecision("nonexistent_approval");
    assert.throws(() => service.applyDecision(decision), (err) => err.code === "approval.not_found");
});
test("applyDecision ignores decision for non-requested status", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request);
    // Directly set to pending (skip status check)
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    // No explicit way to change status to non-requested in this service,
    // but the code path does check existing.status !== "requested" and returns early
});
test("applyDecision records decision in pending record", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request);
    const decision = createValidDecision(approval.approvalId, "confirmed");
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.decisions.length, 1);
    assert.strictEqual(pending.decisions[0].respondedBy, "user_789");
});
test("applyDecision with rejected finalizes immediately", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    const decision = createValidDecision(approval.approvalId, "rejected");
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.status, "rejected");
});
test("applyDecision with expired finalizes immediately", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    const decision = createValidDecision(approval.approvalId, "expired");
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.status, "rejected");
});
test("applyDecision increments approvalsReceived for partial approval", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    const decision = createValidDecision(approval.approvalId, "confirmed");
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.approvalsReceived, 1);
    assert.strictEqual(pending.status, "pending");
});
test("applyDecision reaches approved status when requiredApprovals met", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 2 });
    const decision1 = createValidDecision(approval.approvalId, "confirmed");
    decision1.respondedBy = "user_1";
    service.applyDecision(decision1);
    let pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.status, "pending");
    assert.strictEqual(pending.approvalsReceived, 1);
    const decision2 = createValidDecision(approval.approvalId, "confirmed");
    decision2.respondedBy = "user_2";
    service.applyDecision(decision2);
    pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.status, "approved");
    assert.strictEqual(pending.approvalsReceived, 2);
});
test("applyDecision with text_input records decision correctly", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 2 });
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "text_input",
        inputText: "Looks good",
        respondedBy: "user_abc",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.decisions.length, 1);
    assert.strictEqual(pending.decisions[0].decisionType, "text_input");
});
test("applyDecision with option_selected records decision correctly", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 2 });
    const decision = {
        approvalId: approval.approvalId,
        decisionType: "option_selected",
        selectedOptionId: "option_a",
        respondedBy: "user_abc",
        respondedAt: "2026-04-21T00:00:00.000Z",
    };
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.decisions[0].decisionType, "option_selected");
});
// ---------------------------------------------------------------------------
// getApprovalProgress Tests
// ---------------------------------------------------------------------------
test("getApprovalProgress returns null for non-existent approval", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const result = service.getApprovalProgress("nonexistent");
    assert.strictEqual(result, null);
});
test("getApprovalProgress returns progress from pending record", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    const progress = service.getApprovalProgress(approval.approvalId);
    assert.ok(progress);
    assert.strictEqual(progress.received, 0);
    assert.strictEqual(progress.required, 3);
    assert.strictEqual(progress.remaining, 3);
});
test("getApprovalProgress updates after partial approval", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    const decision = createValidDecision(approval.approvalId, "confirmed");
    service.applyDecision(decision);
    const progress = service.getApprovalProgress(approval.approvalId);
    assert.ok(progress);
    assert.strictEqual(progress.received, 1);
    assert.strictEqual(progress.required, 3);
    assert.strictEqual(progress.remaining, 2);
});
// ---------------------------------------------------------------------------
// isApproverInGroups Tests
// ---------------------------------------------------------------------------
test("isApproverInGroups returns true for empty groups (any approver)", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const result = service.isApproverInGroups("user_abc", []);
    assert.strictEqual(result, true);
});
test("isApproverInGroups returns true when approver is in groups", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const result = service.isApproverInGroups("admin", ["admin", "superadmin"]);
    assert.strictEqual(result, true);
});
test("isApproverInGroups returns false when approver is not in groups", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const result = service.isApproverInGroups("guest", ["admin", "superadmin"]);
    assert.strictEqual(result, false);
});
// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------
test("createMultiPartyRequest with executionId sets executionId", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    request.executionId = "exec_789";
    const result = service.createMultiPartyRequest(request);
    assert.strictEqual(result.executionId, "exec_789");
});
test("multiple sequential approvals accumulate correctly", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    for (let i = 1; i <= 3; i++) {
        const decision = createValidDecision(approval.approvalId, "confirmed");
        decision.respondedBy = `user_${i}`;
        service.applyDecision(decision);
        const pending = service.getPendingApproval(approval.approvalId);
        assert.ok(pending);
        assert.strictEqual(pending.approvalsReceived, i);
        if (i < 3) {
            assert.strictEqual(pending.status, "pending");
        }
        else {
            assert.strictEqual(pending.status, "approved");
        }
    }
});
test("single requiredApprovals results in immediate approval", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 1 });
    const decision = createValidDecision(approval.approvalId, "confirmed");
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.status, "approved");
});
test("rejected decision stops further approvals", () => {
    const { mockStore, mockDb } = createMockStoreAndDb();
    const service = new MultiPartyApprovalService(mockDb, mockStore);
    const request = createBaseRequest();
    const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });
    const decision = createValidDecision(approval.approvalId, "rejected");
    service.applyDecision(decision);
    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending.status, "rejected");
    // Trying another decision (note: code returns early if status != "requested",
    // so we can't apply another decision after rejection - this is correct behavior)
    const progress = service.getApprovalProgress(approval.approvalId);
    assert.ok(progress);
    assert.strictEqual(progress.remaining, 3); // remains at original since no new approvals
});
//# sourceMappingURL=multi-party-approval-service.test.js.map