import assert from "node:assert/strict";
import test from "node:test";

import { MultiPartyApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/multi-party-approval-service.js";
import type { ApprovalDecision, ApprovalRequest } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { ApprovalRecord, EventRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { EventTier } from "../../../../../src/platform/contracts/types/domain/primitives.js";
import type { ApprovalStatus } from "../../../../../src/platform/contracts/types/status.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

// ---------------------------------------------------------------------------
// Mock Infrastructure
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock of the AuthoritativeTaskStore that the
 * AuthoritativeTaskStoreRuntimeLifecycleRepository expects.
 *
 * The repository uses: store.approval.insertApproval(), store.approval.getApproval(), etc.
 * and: store.event.insertEvent()
 */
function createMockStore() {
  const approvals = new Map<string, ApprovalRecord>();
  const events: EventRecord[] = [];

  return {
    task: {
      updateTaskStatus() {},
      updateTaskStatusCas() { return 1; },
      updateTaskOutput() {},
    },
    workflow: {
      updateWorkflowState() {},
    },
    execution: {
      updateExecutionStatus() {},
    },
    session: {
      updateSessionStatus() {},
    },
    event: {
      insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & { eventTier?: string; sessionId?: string | null }): EventRecord {
        return {
          id: event.id ?? "evt_mock",
          taskId: event.taskId,
          sessionId: event.sessionId ?? null,
          executionId: event.executionId,
          eventType: event.eventType,
          eventTier: (event.eventTier as EventTier) ?? "tier_1",
          payloadJson: event.payloadJson,
          traceId: event.traceId,
          createdAt: event.createdAt,
        };
      },
    },
    approval: {
      insertApproval(approval: ApprovalRecord): void {
        approvals.set(approval.id, { ...approval });
      },
      getApproval(approvalId: string): ApprovalRecord | null {
        return approvals.get(approvalId) ?? null;
      },
      listApprovalsByTask(taskId: string): ApprovalRecord[] {
        return Array.from(approvals.values()).filter((r) => r.taskId === taskId);
      },
      updateApprovalDecision(input: { approvalId: string; status: ApprovalStatus; responseJson: string; respondedAt: string }): void {
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
      updateApprovalDecisionCas(input: {
        approvalId: string;
        expectedStatus: ApprovalStatus;
        status: ApprovalStatus;
        responseJson: string;
        respondedAt: string;
      }): number {
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
      updateApprovalRequest(input: { id: string; requestJson: string }): void {
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
    transaction<T>(fn: () => T): T {
      return fn();
    },
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createBaseRequest(): Omit<ApprovalRequest, "approvalId" | "createdAt" | "requiredApprovals" | "approverGroups" | "approvalsReceived"> {
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

function createValidDecision(approvalId: string, decisionType: ApprovalDecision["decisionType"] = "confirmed"): ApprovalDecision {
  return {
    approvalId,
    decisionType,
    ...(decisionType === "confirmed" ? { confirmed: true as const } : {}),
    respondedBy: "user_789",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// createMultiPartyRequest Tests
// ---------------------------------------------------------------------------

test("createMultiPartyRequest creates request with default requiredApprovals=1", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

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
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const result = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  assert.strictEqual(result.requiredApprovals, 3);
  assert.strictEqual(result.context["originalRequiredApprovals"], 3);
});

test("createMultiPartyRequest creates request with approverGroups", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const groups = ["group_a", "group_b"] as const;
  const result = service.createMultiPartyRequest(request, { approverGroups: groups });

  assert.deepStrictEqual(result.approverGroups, groups);
});

test("createMultiPartyRequest sets multiPartyEnabled in context", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const result = service.createMultiPartyRequest(request);

  assert.strictEqual(result.context["multiPartyEnabled"], true);
});

test("createMultiPartyRequest preserves existing context fields", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  request.context = { existingKey: "existingValue" };
  const result = service.createMultiPartyRequest(request);

  assert.strictEqual(result.context["existingKey"], "existingValue");
  assert.strictEqual(result.context["multiPartyEnabled"], true);
});

test("createMultiPartyRequest with executionId sets executionId", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  request.executionId = "exec_789";
  const result = service.createMultiPartyRequest(request);

  assert.strictEqual(result.executionId, "exec_789");
});

test("getPendingApproval returns null for non-existent approval", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const result = service.getPendingApproval("nonexistent");

  assert.strictEqual(result, null);
});

test("getPendingApproval returns pending record after request creation", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const result = service.createMultiPartyRequest(request, { requiredApprovals: 2 });

  const pending = service.getPendingApproval(result.approvalId);

  assert.ok(pending);
  assert.strictEqual(pending!.approvalId, result.approvalId);
  assert.strictEqual(pending!.requiredApprovals, 2);
  assert.strictEqual(pending!.approvalsReceived, 0);
  assert.strictEqual(pending!.status, "pending");
  assert.deepStrictEqual(pending!.decisions, []);
});

// ---------------------------------------------------------------------------
// applyDecision Tests
// ---------------------------------------------------------------------------

test("applyDecision throws for invalid decision payload", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request);

  const invalidDecision = {
    approvalId: approval.approvalId,
    decisionType: "option_selected" as const,
    // missing selectedOptionId
    respondedBy: "user_789",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };

  assert.throws(
    () => service.applyDecision(invalidDecision as any),
    (err: any) => err.code === "approval.invalid_option_selected",
  );
});

test("applyDecision throws for non-existent approval", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const decision = createValidDecision("nonexistent_approval");

  assert.throws(
    () => service.applyDecision(decision),
    (err: any) => err.code === "approval.not_found",
  );
});

test("applyDecision records decision in pending record", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request);

  const decision = createValidDecision(approval.approvalId, "confirmed");
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.decisions.length, 1);
  assert.strictEqual(pending!.decisions[0]!.respondedBy, "user_789");
});

test("applyDecision with rejected finalizes immediately", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  const decision = createValidDecision(approval.approvalId, "rejected");
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.status, "rejected");
});

test("applyDecision with expired finalizes immediately", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  const decision = createValidDecision(approval.approvalId, "expired");
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.status, "rejected");
});

test("applyDecision increments approvalsReceived for partial approval", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  const decision = createValidDecision(approval.approvalId, "confirmed");
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.approvalsReceived, 1);
  assert.strictEqual(pending!.status, "pending");
});

test("applyDecision reaches approved status when requiredApprovals met", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 2 });

  const decision1 = createValidDecision(approval.approvalId, "confirmed");
  decision1.respondedBy = "user_1";
  service.applyDecision(decision1);

  let pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.status, "pending");
  assert.strictEqual(pending!.approvalsReceived, 1);

  const decision2 = createValidDecision(approval.approvalId, "confirmed");
  decision2.respondedBy = "user_2";
  service.applyDecision(decision2);

  pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.status, "approved");
  assert.strictEqual(pending!.approvalsReceived, 2);
});

test("applyDecision with text_input records decision correctly", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 2 });

  const decision: ApprovalDecision = {
    approvalId: approval.approvalId,
    decisionType: "text_input",
    inputText: "Looks good",
    respondedBy: "user_abc",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.decisions.length, 1);
  assert.strictEqual(pending!.decisions[0]!.decisionType, "text_input");
});

test("applyDecision with option_selected records decision correctly", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 2 });

  const decision: ApprovalDecision = {
    approvalId: approval.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "option_a",
    respondedBy: "user_abc",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.decisions[0]!.decisionType, "option_selected");
});

// ---------------------------------------------------------------------------
// getApprovalProgress Tests
// ---------------------------------------------------------------------------

test("getApprovalProgress returns null for non-existent approval", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const result = service.getApprovalProgress("nonexistent");

  assert.strictEqual(result, null);
});

test("getApprovalProgress returns progress from pending record", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  const progress = service.getApprovalProgress(approval.approvalId);

  assert.ok(progress);
  assert.strictEqual(progress.received, 0);
  assert.strictEqual(progress.required, 3);
  assert.strictEqual(progress.remaining, 3);
});

test("getApprovalProgress updates after partial approval", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

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
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const result = service.isApproverInGroups("user_abc", []);

  assert.strictEqual(result, true);
});

test("isApproverInGroups returns true when approver is in groups", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const result = service.isApproverInGroups("admin", ["admin", "superadmin"]);

  assert.strictEqual(result, true);
});

test("isApproverInGroups returns false when approver is not in groups", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const result = service.isApproverInGroups("guest", ["admin", "superadmin"]);

  assert.strictEqual(result, false);
});

// ---------------------------------------------------------------------------
// Integration / Edge Cases
// ---------------------------------------------------------------------------

test("multiple sequential approvals accumulate correctly", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  for (let i = 1; i <= 3; i++) {
    const decision = createValidDecision(approval.approvalId, "confirmed");
    decision.respondedBy = `user_${i}`;
    service.applyDecision(decision);

    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending!.approvalsReceived, i);

    if (i < 3) {
      assert.strictEqual(pending!.status, "pending");
    } else {
      assert.strictEqual(pending!.status, "approved");
    }
  }
});

test("single requiredApprovals results in immediate approval", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 1 });

  const decision = createValidDecision(approval.approvalId, "confirmed");
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.status, "approved");
});

test("rejected decision sets status to rejected", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

  const decision = createValidDecision(approval.approvalId, "rejected");
  service.applyDecision(decision);

  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.status, "rejected");
});

test("applyDecision ignores decision when status is not requested", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new MultiPartyApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createMultiPartyRequest(request);

  // Manually change status in the mock store's approval map to simulate non-pending status
  const existing = store.approval.getApproval(approval.approvalId);
  assert.ok(existing);
  store.approval.updateApprovalDecision({
    approvalId: approval.approvalId,
    status: "approved",
    responseJson: "{}",
    respondedAt: "2026-04-21T00:00:00.000Z",
  });

  // applyDecision should return early when status !== "requested"
  const decision = createValidDecision(approval.approvalId, "confirmed");
  service.applyDecision(decision); // Should not throw, just return early

  // Decision should NOT be added since status was not "requested"
  const pending = service.getPendingApproval(approval.approvalId);
  assert.ok(pending);
  assert.strictEqual(pending!.decisions.length, 0); // No new decision added
});
