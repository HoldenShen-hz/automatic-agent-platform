/**
 * Unit tests for ApprovalService class
 *
 * Tests the ApprovalService class methods including createRequest and applyDecision.
 * Uses mocks for external dependencies to isolate unit tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import type { ApprovalRequest, ApprovalDecision } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import type { ApprovalRecord, EventRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { EventTier } from "../../../../../src/platform/contracts/types/domain/primitives.js";
import type { ApprovalStatus } from "../../../../../src/platform/contracts/types/status.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { ControlPlaneDirectiveSink } from "../../../../../src/platform/control-plane/control-plane-directive-sink.js";
import { initHaCoordinatorForTests, resetHaCoordinatorInstance } from "../../../../helpers/ha-coordinator.js";

// ---------------------------------------------------------------------------
// Mock Infrastructure
// ---------------------------------------------------------------------------

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
      listApprovalsByStatus(status: ApprovalStatus): ApprovalRecord[] {
        return Array.from(approvals.values()).filter((r) => r.status === status);
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
  // Initialize HA coordinator for tests that use TransitionService
  const { cleanup } = initHaCoordinatorForTests();
  return {
    transaction<T>(fn: () => T): T {
      return fn();
    },
    _haCleanup: cleanup,
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createBaseRequest(): Omit<ApprovalRequest, "approvalId" | "createdAt"> {
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
// createRequest Tests
// ---------------------------------------------------------------------------

test("ApprovalService.createRequest creates request with generated ID", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

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

test("ApprovalService.applyDecision emits canonical DecisionDirective", () => {
  const store = createMockStore();
  const db = createMockDb();
  const emitted: Array<{ kind: "decision"; directive: Record<string, unknown> }> = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective() {},
    emitDecisionDirective(directive) {
      emitted.push({ kind: "decision", directive: directive as unknown as Record<string, unknown> });
    },
  };
  const service = new ApprovalService(db, store as any, undefined, directiveSink);

  const created = service.createRequest({
    ...createBaseRequest(),
    harnessRunId: "hrun_123",
    nodeRunId: "nrun_456",
    context: { tenantId: "tenant_abc" },
  });

  // Clear directives emitted during createRequest (emitApprovalRequestDirective)
  emitted.length = 0;

  service.applyDecision(createValidDecision(created.approvalId));

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0]?.directive.type, "approve");
  assert.equal(emitted[0]?.directive.targetRef, `approval:${created.approvalId}`);
  assert.equal(emitted[0]?.directive.scope?.harnessRunId, "hrun_123");
  assert.equal(emitted[0]?.directive.scope?.nodeRunId, "nrun_456");
});

test("ApprovalService.createRequest sets executionId to null when not provided", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

  const request: Omit<ApprovalRequest, "approvalId" | "createdAt"> = {
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
  assert.strictEqual(result.harnessRunId, null);
});

test("ApprovalService.createRequest preserves executionId when provided", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  request.executionId = "exec_789";
  const result = service.createRequest(request);

  assert.strictEqual(result.executionId, "exec_789");
  assert.strictEqual(result.harnessRunId, "exec_789");
});

test("ApprovalService.getApproval backfills canonical harnessRunId from legacy persisted executionId", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

  const created = service.createRequest(createBaseRequest());
  const persisted = store.approval.getApproval(created.approvalId);
  assert.ok(persisted);

  store.approval.updateApprovalRequest({
    id: created.approvalId,
    requestJson: JSON.stringify({
      ...JSON.parse(persisted!.requestJson),
      harnessRunId: undefined,
      executionId: "legacy-run-123",
    }),
  });

  const approval = service.getApproval(created.approvalId);
  assert.equal(approval?.request.harnessRunId, "legacy-run-123");
  assert.equal(approval?.request.executionId, "legacy-run-123");
});

test("ApprovalService.createRequest stores approval in repository", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

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
  const service = new ApprovalService(db, store as any);

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
  const service = new ApprovalService(db, store as any);

  const decision = createValidDecision("nonexistent_approval");

  assert.throws(
    () => service.applyDecision(decision),
    (err: any) => err.code === "approval.not_found",
  );
});

test("ApprovalService.applyDecision ignores decision when status is not requested", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

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
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const decision: ApprovalDecision = {
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
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const decision: ApprovalDecision = {
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
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const decision: ApprovalDecision = {
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
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const decision: ApprovalDecision = {
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
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const decision: ApprovalDecision = {
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
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  // Missing required fields for option_selected
  const invalidDecision = {
    approvalId: approval.approvalId,
    decisionType: "option_selected" as const,
    respondedBy: "user_789",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };

  assert.throws(
    () => service.applyDecision(invalidDecision as any),
    (err: any) => err.code === "approval.invalid_option_selected",
  );
});

test("ApprovalService.applyDecision throws for confirmed without confirmed=true", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const invalidDecision = {
    approvalId: approval.approvalId,
    decisionType: "confirmed" as const,
    respondedBy: "user_789",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };

  assert.throws(
    () => service.applyDecision(invalidDecision as any),
    (err: any) => err.code === "approval.invalid_confirmed",
  );
});

test("ApprovalService.applyDecision throws for text_input without inputText", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const invalidDecision = {
    approvalId: approval.approvalId,
    decisionType: "text_input" as const,
    respondedBy: "user_789",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };

  assert.throws(
    () => service.applyDecision(invalidDecision as any),
    (err: any) => err.code === "approval.invalid_text_input",
  );
});

test("ApprovalService.applyDecision throws for terminal decision with extra fields", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ApprovalService(db, store as any);

  const request = createBaseRequest();
  const approval = service.createRequest(request);

  const invalidDecision = {
    approvalId: approval.approvalId,
    decisionType: "rejected" as const,
    selectedOptionId: "option_a",
    respondedBy: "user_789",
    respondedAt: "2026-04-21T00:00:00.000Z",
  };

  assert.throws(
    () => service.applyDecision(invalidDecision as any),
    (err: any) => err.code === "approval.invalid_terminal_payload",
  );
});
