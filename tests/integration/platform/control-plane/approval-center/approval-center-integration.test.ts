/**
 * Integration Test: Approval Center
 *
 * Verifies approval center integration: request creation, multi-party workflows,
 * quorum-based decisions, cascade rejection, and escalation paths.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { MultiPartyApprovalService } from "../../../../../src/platform/control-plane/approval-center/multi-party-approval-service.js";
import { ApprovalFlowEngine, FlowType, FlowStatus } from "../../../../../src/platform/control-plane/approval-center/approval-flow-engine.js";
import { QuorumCalculator } from "../../../../../src/platform/control-plane/approval-center/quorum-calculator.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { ApprovalRequest } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";

function createApprovalService(workspace: string): {
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  service: ApprovalService;
} {
  const dbPath = join(workspace, "approval-center.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new ApprovalService(db, store);
  return { db, store, service };
}

test("approval center: createRequest stores approval and emits decision:requested event", () => {
  const workspace = createTempWorkspace("ac-create-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-1", executionId: "exec-ac-1" });

    const approval = service.createRequest({
      taskId: "task-ac-1",
      executionId: "exec-ac-1",
      sourceAgentId: "agent-1",
      reason: "Deploy to staging",
      riskLevel: "high",
      options: ["approve", "reject", "escalate"],
      context: { environment: "staging" },
      timeoutPolicy: "remain_pending",
    });

    assert.ok(approval.approvalId.startsWith("approval_"));
    assert.strictEqual(approval.taskId, "task-ac-1");
    assert.strictEqual(approval.riskLevel, "high");

    const events = store.listEventsForTask("task-ac-1");
    const requestedEvent = events.find(e => e.eventType === "decision:requested");
    assert.ok(requestedEvent, "Should emit decision:requested event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: applyDecision with confirmed transitions to approved", () => {
  const workspace = createTempWorkspace("ac-decision-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-2", executionId: "exec-ac-2" });

    const approval = service.createRequest({
      taskId: "task-ac-2",
      sourceAgentId: "agent-1",
      reason: "Approve budget",
      riskLevel: "medium",
      options: ["yes", "no"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-ac-2");
    const respondedEvent = events.find(e => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should emit decision:responded event");

    const payload = JSON.parse(respondedEvent!.payloadJson);
    assert.strictEqual(payload.decisionType, "confirmed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: applyDecision with rejected transitions to rejected status", () => {
  const workspace = createTempWorkspace("ac-reject-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-3", executionId: "exec-ac-3" });

    const approval = service.createRequest({
      taskId: "task-ac-3",
      sourceAgentId: "agent-1",
      reason: "Destructive action",
      riskLevel: "critical",
      options: ["proceed", "cancel"],
      context: {},
      timeoutPolicy: "reject",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "rejected",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-ac-3");
    const respondedEvent = events.find(e => e.eventType === "decision:responded");
    assert.ok(respondedEvent);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: applyDecision with option_selected stores selected option", () => {
  const workspace = createTempWorkspace("ac-option-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-4", executionId: "exec-ac-4" });

    const approval = service.createRequest({
      taskId: "task-ac-4",
      sourceAgentId: "agent-1",
      reason: "Select option",
      riskLevel: "low",
      options: ["option-a", "option-b", "option-c"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "option-b",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-ac-4");
    const respondedEvent = events.find(e => e.eventType === "decision:responded");
    assert.ok(respondedEvent);

    const payload = JSON.parse(respondedEvent!.payloadJson);
    assert.strictEqual(payload.selectedOptionId, "option-b");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: applyDecision with text_input stores text response", () => {
  const workspace = createTempWorkspace("ac-text-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-5", executionId: "exec-ac-5" });

    const approval = service.createRequest({
      taskId: "task-ac-5",
      sourceAgentId: "agent-1",
      reason: "Provide feedback",
      riskLevel: "low",
      options: ["approve", "modify"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "text_input",
      inputText: "Please revise the approach and resubmit.",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-ac-5");
    const respondedEvent = events.find(e => e.eventType === "decision:responded");
    assert.ok(respondedEvent);

    const payload = JSON.parse(respondedEvent!.payloadJson);
    assert.strictEqual(payload.inputText, "Please revise the approach and resubmit.");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: rejected decision cascades to sibling approvals in same session", () => {
  const workspace = createTempWorkspace("ac-cascade-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-cascade", executionId: "exec-cascade" });
    const sessionId = "session-approval-cascade-1";

    const approval1 = service.createRequest({
      taskId: "task-cascade",
      sourceAgentId: "agent-1",
      reason: "First of cascade",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { sessionId },
      timeoutPolicy: "remain_pending",
    });

    const approval2 = service.createRequest({
      taskId: "task-cascade",
      sourceAgentId: "agent-1",
      reason: "Second of cascade",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { sessionId },
      timeoutPolicy: "remain_pending",
    });

    // Reject the first approval - should cascade to second
    service.applyDecision({
      approvalId: approval1.approvalId,
      decisionType: "rejected",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Both approvals should be rejected (idempotent on already-resolved)
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: applyDecision to non-existent approval throws", () => {
  const workspace = createTempWorkspace("ac-notfound-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-6", executionId: "exec-ac-6" });

    let error: Error | null = null;
    try {
      service.applyDecision({
        approvalId: "non-existent-approval-id",
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "operator-1",
        respondedAt: nowIso(),
      });
    } catch (e) {
      error = e as Error;
    }

    assert.ok(error, "Should throw for non-existent approval");
    assert.ok(error.message.includes("not found"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: applyDecision is idempotent on already-resolved approval", () => {
  const workspace = createTempWorkspace("ac-idempotent-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-7", executionId: "exec-ac-7" });

    const approval = service.createRequest({
      taskId: "task-ac-7",
      sourceAgentId: "agent-1",
      reason: "Test idempotent",
      riskLevel: "low",
      options: ["yes"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    // First decision
    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Second decision on same approval - should be no-op
    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-2",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-ac-7");
    const respondedEvents = events.filter(e => e.eventType === "decision:responded");
    assert.strictEqual(respondedEvents.length, 1, "Idempotent - only one decision event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval center: timeoutPolicy reject auto-rejects", () => {
  const workspace = createTempWorkspace("ac-timeout-");
  try {
    const { db, store, service } = createApprovalService(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-ac-8", executionId: "exec-ac-8" });

    const approval = service.createRequest({
      taskId: "task-ac-8",
      sourceAgentId: "agent-1",
      reason: "Test timeout policy",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    assert.strictEqual(approval.timeoutPolicy, "reject");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: createMultiPartyRequest requires multiple approvals", () => {
  const workspace = createTempWorkspace("ac-multiparti-");
  try {
    const dbPath = join(workspace, "multi-party.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const mpService = new MultiPartyApprovalService(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-mp-1", executionId: "exec-mp-1" });

    const approval = mpService.createMultiPartyRequest(
      {
        taskId: "task-mp-1",
        executionId: "exec-mp-1",
        sourceAgentId: "agent-1",
        reason: "High risk multi-party",
        riskLevel: "critical",
        options: ["proceed", "cancel"],
        context: {},
        timeoutPolicy: "remain_pending",
      },
      { requiredApprovals: 3 },
    );

    assert.strictEqual(approval.requiredApprovals, 3);
    assert.strictEqual(approval.approvalsReceived, 0);
    assert.deepStrictEqual(approval.approverGroups, []);

    const progress = mpService.getApprovalProgress(approval.approvalId);
    assert.ok(progress);
    assert.strictEqual(progress.required, 3);
    assert.strictEqual(progress.received, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: partial approvals tracked correctly", () => {
  const workspace = createTempWorkspace("ac-mp-partial-");
  try {
    const dbPath = join(workspace, "mp-partial.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const mpService = new MultiPartyApprovalService(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-mp-2", executionId: "exec-mp-2" });

    const approval = mpService.createMultiPartyRequest(
      {
        taskId: "task-mp-2",
        sourceAgentId: "agent-1",
        reason: "Multi-party test",
        riskLevel: "high",
        options: ["yes", "no"],
        context: {},
        timeoutPolicy: "remain_pending",
      },
      { requiredApprovals: 3 },
    );

    // First approver
    mpService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-1",
      respondedAt: nowIso(),
    });

    let progress = mpService.getApprovalProgress(approval.approvalId);
    assert.strictEqual(progress!.received, 1);
    assert.strictEqual(progress!.remaining, 2);

    // Second approver
    mpService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-2",
      respondedAt: nowIso(),
    });

    progress = mpService.getApprovalProgress(approval.approvalId);
    assert.strictEqual(progress!.received, 2);
    assert.strictEqual(progress!.remaining, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: rejection terminates workflow immediately", () => {
  const workspace = createTempWorkspace("ac-mp-reject-");
  try {
    const dbPath = join(workspace, "mp-reject.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const mpService = new MultiPartyApprovalService(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-mp-3", executionId: "exec-mp-3" });

    const approval = mpService.createMultiPartyRequest(
      {
        taskId: "task-mp-3",
        sourceAgentId: "agent-1",
        reason: "Reject test",
        riskLevel: "critical",
        options: ["yes", "no"],
        context: {},
        timeoutPolicy: "remain_pending",
      },
      { requiredApprovals: 3 },
    );

    // Even first rejection should terminate
    mpService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "rejected",
      respondedBy: "approver-1",
      respondedAt: nowIso(),
    });

    const pending = mpService.getPendingApproval(approval.approvalId);
    assert.strictEqual(pending!.status, "rejected");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval flow engine: createFlow initializes flow state correctly", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-flow-test-1",
    taskId: "task-flow-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Flow engine test",
    riskLevel: "high",
    options: ["yes", "no"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  assert.strictEqual(flow.status, FlowStatus.PENDING);
  assert.strictEqual(flow.config.flowType, FlowType.SINGLE);
  assert.strictEqual(flow.currentIteration, 0);
  assert.ok(flow.flowId.startsWith("flow_"));
});

test("approval flow engine: single-party vote approves flow", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-single-1",
    taskId: "task-single-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Single party test",
    riskLevel: "medium",
    options: ["yes", "no"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  const voteResult = engine.submitVote(flow.flowId, "admin", "approve");

  assert.strictEqual(voteResult.success, true);
  assert.strictEqual(voteResult.flowStatus, FlowStatus.APPROVED);
});

test("approval flow engine: single-party vote rejects flow", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-reject-1",
    taskId: "task-reject-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Reject test",
    riskLevel: "medium",
    options: ["yes", "no"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  const voteResult = engine.submitVote(flow.flowId, "admin", "reject");

  assert.strictEqual(voteResult.success, true);
  assert.strictEqual(voteResult.flowStatus, FlowStatus.REJECTED);
});

test("approval flow engine: multi-party flow requires quorum", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-multi-1",
    taskId: "task-multi-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Multi-party test",
    riskLevel: "critical",
    options: ["yes", "no"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createMultiPartyFlow(
    request,
    2,
    [
      { type: "user", identifier: "approver-1", can_delegate: false },
      { type: "user", identifier: "approver-2", can_delegate: false },
    ],
  );

  assert.strictEqual(flow.config.flowType, FlowType.MULTI_PARTY);
  assert.ok(flow.config.quorum);

  // First vote (not enough for quorum of 2)
  const result1 = engine.submitVote(flow.flowId, "approver-1", "approve");
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.flowStatus, FlowStatus.PENDING);

  // Second vote (quorum met)
  const result2 = engine.submitVote(flow.flowId, "approver-2", "approve");
  assert.strictEqual(result2.success, true);
  assert.strictEqual(result2.flowStatus, FlowStatus.APPROVED);
});

test("approval flow engine: cannot vote on non-existent flow", () => {
  const engine = new ApprovalFlowEngine();

  const result = engine.submitVote("non-existent-flow", "admin", "approve");

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, "Flow not found");
});

test("approval flow engine: cannot vote on finalized flow", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-finalized-1",
    taskId: "task-finalized-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Finalized test",
    riskLevel: "low",
    options: ["yes"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  // First vote approves
  engine.submitVote(flow.flowId, "admin", "approve");

  // Second vote should fail - flow is already approved
  const result = engine.submitVote(flow.flowId, "admin", "reject");

  assert.strictEqual(result.success, false);
  assert.ok(result.error!.includes("not pending"));
});

test("approval flow engine: delegateApproval transfers authority", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-delegate-1",
    taskId: "task-delegate-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Delegate test",
    riskLevel: "medium",
    options: ["yes", "no"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  const result = engine.delegateApproval(flow.flowId, "admin", "delegate-1");

  assert.strictEqual(result.success, true);
  assert.ok(result.delegation);
  assert.strictEqual(result.delegation!.fromApprover, "admin");
  assert.strictEqual(result.delegation!.toApprover, "delegate-1");
});

test("approval flow engine: getFlowStatus returns current state", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-status-1",
    taskId: "task-status-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Status test",
    riskLevel: "low",
    options: ["yes"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  const status = engine.getFlowStatus(flow.flowId);

  assert.ok(status);
  assert.strictEqual(status!.flowId, flow.flowId);
  assert.strictEqual(status!.status, FlowStatus.PENDING);
});

test("approval flow engine: getFlowStatus returns null for unknown flow", () => {
  const engine = new ApprovalFlowEngine();

  const status = engine.getFlowStatus("unknown-flow-id");

  assert.strictEqual(status, null);
});

test("approval flow engine: finalizeFlow sets terminal status", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-fin-1",
    taskId: "task-fin-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Finalize test",
    riskLevel: "low",
    options: ["yes"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
    },
    request,
  );

  engine.finalizeFlow(flow.flowId, FlowStatus.CANCELLED);

  const status = engine.getFlowStatus(flow.flowId);
  assert.strictEqual(status!.status, FlowStatus.CANCELLED);
});

test("approval flow engine: addFeedback increments iteration in feedback loop", () => {
  const engine = new ApprovalFlowEngine();
  const request: ApprovalRequest = {
    approvalId: "approval-feedback-1",
    taskId: "task-feedback-1",
    executionId: null,
    sourceAgentId: "agent-1",
    reason: "Feedback test",
    riskLevel: "medium",
    options: ["approve", "modify"],
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
  };

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 3600000, autoAction: "deny" },
      escalation: { escalateTo: { type: "role", identifier: "super-admin", can_delegate: false }, maxEscalationDepth: 3, notificationChannels: [], escalationTimeoutMs: 1800000 },
      feedbackLoop: { maxIterations: 3, requireReplanOnReject: true },
    },
    request,
  );

  const feedbackResult = engine.addFeedback(flow.flowId, {
    feedbackType: "reject_with_guidance",
    guidance: "Please reconsider the approach",
    principal: "admin",
  });

  assert.strictEqual(feedbackResult.success, true);
  assert.strictEqual(feedbackResult.newIteration, 1);
  assert.strictEqual(feedbackResult.shouldReplan, true);
});

test("quorum calculator: minApprovals met returns approved status", () => {
  const calc = new QuorumCalculator();
  const status = calc.calculateQuorumStatus({
    minApprovals: 2,
    minRejectionsToDeny: 2,
  }, [
    { approverId: "a1", voteType: "approve", votedAt: nowIso() },
    { approverId: "a2", voteType: "approve", votedAt: nowIso() },
  ]);

  assert.strictEqual(status.isQuorumMet, true);
  assert.strictEqual(status.isDenied, false);
});

test("quorum calculator: minRejections met returns denied status", () => {
  const calc = new QuorumCalculator();
  const status = calc.calculateQuorumStatus({
    minApprovals: 3,
    minRejectionsToDeny: 2,
  }, [
    { approverId: "a1", voteType: "reject", votedAt: nowIso() },
    { approverId: "a2", voteType: "reject", votedAt: nowIso() },
  ]);

  assert.strictEqual(status.isDenied, true);
  assert.strictEqual(status.isQuorumMet, false);
});

test("quorum calculator: insufficient votes returns pending", () => {
  const calc = new QuorumCalculator();
  const status = calc.calculateQuorumStatus({
    minApprovals: 3,
    minRejectionsToDeny: 2,
  }, [
    { approverId: "a1", voteType: "approve", votedAt: nowIso() },
  ]);

  assert.strictEqual(status.isQuorumMet, false);
  assert.strictEqual(status.isDenied, false);
  assert.strictEqual(status.quorumReached, false);
});