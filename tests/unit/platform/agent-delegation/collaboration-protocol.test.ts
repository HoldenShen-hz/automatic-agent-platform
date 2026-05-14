import assert from "node:assert/strict";
import test from "node:test";

import { CollaborationProtocolService } from "../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/protocol-service.js";
import { ACPInvariantEnforcer, type InvariantContext } from "../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";

import type { ACPMessage } from "../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/types.js";

import type { PermissionSet } from "../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

function createMockPermissionSet(overrides: Partial<PermissionSet> = {}): PermissionSet {
  return {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
    ...overrides,
  };
}

function createMockInvariantContext(overrides: Partial<InvariantContext> = {}): InvariantContext {
  return {
    parentPermissions: createMockPermissionSet(),
    parentRiskMode: 50,
    parentConstraints: {},
    parentBudgetRemaining: 1000,
    globalCallDepth: 3,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CollaborationProtocolService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CollaborationProtocolService.createMessage creates valid ACPMessage", () => {
  const service = new CollaborationProtocolService();

  const message = service.createMessage("task_request", {
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: { data: "test" },
  });

  assert.ok(message.messageId.startsWith("acp_msg_"));
  assert.equal(message.messageType, "task_request");
  assert.ok(message.timestamp.length > 0);
  assert.equal(message.correlation_id, "corr-1");
  assert.equal(message.depth, 1);
});

test("CollaborationProtocolService.createMessage supports all message types", () => {
  const service = new CollaborationProtocolService();
  const messageTypes = [
    "task_request",
    "task_offer",
    "task_accept",
    "task_reject",
    "partial_result",
    "escalation_request",
    "completion_report",
    "takeover_notice",
  ] as const;

  for (const type of messageTypes) {
    const message = service.createMessage(type, {
      correlation_id: "corr-1",
      parent_run_id: "run-1",
      depth: 1,
      sender_agent_id: "agent-1",
      receiver_agent_id: "agent-2",
      domain_id: "test",
      risk_level: 25,
      budget_remaining: 500,
      trace_id: "trace-1",
      payload: {},
    });

    assert.equal(message.messageType, type, `Failed for type ${type}`);
  }
});

test("CollaborationProtocolService.validateAndSend returns accepted for valid message", () => {
  const service = new CollaborationProtocolService();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  const result = service.validateAndSend(message, createMockInvariantContext());

  assert.equal(result.accepted, true);
  assert.deepEqual(result.violations, []);
});

test("CollaborationProtocolService.handleIncoming delegates to validateAndSend", () => {
  const service = new CollaborationProtocolService();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  const validateResult = service.validateAndSend(message, createMockInvariantContext());
  const handleResult = service.handleIncoming(message, createMockInvariantContext());

  assert.equal(handleResult.accepted, validateResult.accepted);
  assert.deepEqual(handleResult.violations, validateResult.violations);
});

// ─────────────────────────────────────────────────────────────────────────────
// ACPInvariantEnforcer Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkPermissionSubset returns true when child is subset", () => {
  const enforcer = new ACPInvariantEnforcer();

  const parent: PermissionSet = {
    resources: ["resource-1", "resource-2"],
    actions: ["action-1", "action-2"],
    constraints: {},
  };

  const child: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };

  assert.equal(enforcer.checkPermissionSubset(child, parent), true);
});

test("ACPInvariantEnforcer.checkPermissionSubset returns false when child has extra resources", () => {
  const enforcer = new ACPInvariantEnforcer();

  const parent: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };

  const child: PermissionSet = {
    resources: ["resource-1", "resource-2"],
    actions: ["action-1"],
    constraints: {},
  };

  assert.equal(enforcer.checkPermissionSubset(child, parent), false);
});

test("ACPInvariantEnforcer.checkPermissionSubset returns false when child has extra actions", () => {
  const enforcer = new ACPInvariantEnforcer();

  const parent: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };

  const child: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1", "action-2"],
    constraints: {},
  };

  assert.equal(enforcer.checkPermissionSubset(child, parent), false);
});

test("ACPInvariantEnforcer.checkRiskNotEscalated returns true when child risk <= parent risk", () => {
  const enforcer = new ACPInvariantEnforcer();

  assert.equal(enforcer.checkRiskNotEscalated(25, 50), true);
  assert.equal(enforcer.checkRiskNotEscalated(50, 50), true);
  assert.equal(enforcer.checkRiskNotEscalated(0, 50), true);
});

test("ACPInvariantEnforcer.checkRiskNotEscalated returns false when child risk > parent risk", () => {
  const enforcer = new ACPInvariantEnforcer();

  assert.equal(enforcer.checkRiskNotEscalated(51, 50), false);
  assert.equal(enforcer.checkRiskNotEscalated(100, 50), false);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns true when constraints preserved", () => {
  const enforcer = new ACPInvariantEnforcer();

  const parentConstraints = { maxDurationMs: 5000, maxTokens: 1000 };
  const childConstraints = { maxDurationMs: 5000, maxTokens: 1000 };

  assert.equal(enforcer.checkConstraintNotRelaxed(childConstraints, parentConstraints), true);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns false when constraint missing", () => {
  const enforcer = new ACPInvariantEnforcer();

  const parentConstraints = { maxDurationMs: 5000 };
  const childConstraints = {};

  assert.equal(enforcer.checkConstraintNotRelaxed(childConstraints, parentConstraints), false);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns false when constraint value changed", () => {
  const enforcer = new ACPInvariantEnforcer();

  const parentConstraints = { maxDurationMs: 5000 };
  const childConstraints = { maxDurationMs: 6000 };

  assert.equal(enforcer.checkConstraintNotRelaxed(childConstraints, parentConstraints), false);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns true for non-completion messages", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkCompletionHasEvidence(message), true);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns true for completion with evidence", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "completion_report",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: { evidence: ["evidence-1", "evidence-2"] },
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkCompletionHasEvidence(message), true);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns false for completion without evidence", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "completion_report",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkCompletionHasEvidence(message), false);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns false for completion with empty evidence", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "completion_report",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: { evidence: [] },
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkCompletionHasEvidence(message), false);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns true for non-takeover messages", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkTakeoverAudit(message), true);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns true for takeover with audit_trail_ref", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "takeover_notice",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: { audit_trail_ref: "audit-ref-123" },
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkTakeoverAudit(message), true);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns false for takeover without audit_trail_ref", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "takeover_notice",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkTakeoverAudit(message), false);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns false for takeover with empty audit_trail_ref", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "takeover_notice",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: { audit_trail_ref: "" },
    timestamp: new Date().toISOString(),
  };

  assert.equal(enforcer.checkTakeoverAudit(message), false);
});

test("ACPInvariantEnforcer.checkBudgetNotExceeded returns true when child budget <= parent budget", () => {
  const enforcer = new ACPInvariantEnforcer();

  assert.equal(enforcer.checkBudgetNotExceeded(500, 1000), true);
  assert.equal(enforcer.checkBudgetNotExceeded(1000, 1000), true);
  assert.equal(enforcer.checkBudgetNotExceeded(0, 1000), true);
});

test("ACPInvariantEnforcer.checkBudgetNotExceeded returns false when child budget > parent budget", () => {
  const enforcer = new ACPInvariantEnforcer();

  assert.equal(enforcer.checkBudgetNotExceeded(1001, 1000), false);
  assert.equal(enforcer.checkBudgetNotExceeded(2000, 1000), false);
});

test("ACPInvariantEnforcer.checkDepthLimit returns true when depth <= maxDepth", () => {
  const enforcer = new ACPInvariantEnforcer();

  assert.equal(enforcer.checkDepthLimit(3, 5), true);
  assert.equal(enforcer.checkDepthLimit(5, 5), true);
  assert.equal(enforcer.checkDepthLimit(0, 5), true);
});

test("ACPInvariantEnforcer.checkDepthLimit returns false when depth > maxDepth", () => {
  const enforcer = new ACPInvariantEnforcer();

  assert.equal(enforcer.checkDepthLimit(6, 5), false);
  assert.equal(enforcer.checkDepthLimit(10, 5), false);
});

test("ACPInvariantEnforcer.enforceAll returns passed true when all checks pass", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentPermissions: {
      resources: ["resource-1", "resource-2"],
      actions: ["action-1", "action-2"],
      constraints: {},
    },
    parentRiskMode: 50,
    parentBudgetRemaining: 1000,
    globalCallDepth: 5,
  });

  const result = enforcer.enforceAll(message, context);

  assert.equal(result.passed, true);
  assert.deepEqual(result.violations, []);
});

test("ACPInvariantEnforcer.enforceAll returns violations for failed checks", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 10, // Exceeds globalCallDepth of 5
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 75, // Exceeds parentRiskMode of 50
    budget_remaining: 2000, // Exceeds parentBudgetRemaining of 1000
    trace_id: "trace-1",
    payload: {
      permissions: {
        resources: ["resource-1", "resource-2"], // Not a subset of parent's single resource
        actions: ["action-1"],
        constraints: {},
      },
    },
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    parentRiskMode: 50,
    parentBudgetRemaining: 1000,
    globalCallDepth: 5,
  });

  const result = enforcer.enforceAll(message, context);

  assert.equal(result.passed, false);
  assert.ok(result.violations.length > 0);
});

test("ACPInvariantEnforcer.enforceAll detects permission not subset", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {
      permissions: {
        resources: ["resource-1", "resource-2"], // Not subset
        actions: ["action-1"],
        constraints: {},
      },
    },
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
  });

  const result = enforcer.enforceAll(message, context);

  assert.ok(result.violations.includes("acp.permission_not_subset"));
});

test("ACPInvariantEnforcer.enforceAll detects risk escalation", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 75, // Exceeds parent risk of 50
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentRiskMode: 50,
  });

  const result = enforcer.enforceAll(message, context);

  assert.ok(result.violations.includes("acp.risk_escalated"));
});

test("ACPInvariantEnforcer.enforceAll detects constraint relaxation", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {
      constraints: { maxDurationMs: 10000 }, // Parent has 5000
    },
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentConstraints: { maxDurationMs: 5000 },
  });

  const result = enforcer.enforceAll(message, context);

  assert.ok(result.violations.includes("acp.constraints_relaxed"));
});

test("ACPInvariantEnforcer.enforceAll detects completion missing evidence", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "completion_report",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {}, // Missing evidence
    timestamp: new Date().toISOString(),
  };

  const result = enforcer.enforceAll(message, createMockInvariantContext());

  assert.ok(result.violations.includes("acp.completion_missing_evidence"));
});

test("ACPInvariantEnforcer.enforceAll detects takeover missing audit", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "takeover_notice",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {}, // Missing audit_trail_ref
    timestamp: new Date().toISOString(),
  };

  const result = enforcer.enforceAll(message, createMockInvariantContext());

  assert.ok(result.violations.includes("acp.takeover_missing_audit"));
});

test("ACPInvariantEnforcer.enforceAll detects budget exceeded", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 2000, // Exceeds parentBudgetRemaining of 1000
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentBudgetRemaining: 1000,
  });

  const result = enforcer.enforceAll(message, context);

  assert.ok(result.violations.includes("acp.budget_exceeded"));
});

test("ACPInvariantEnforcer.enforceAll detects depth exceeded", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 10, // Exceeds globalCallDepth of 5
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 25,
    budget_remaining: 500,
    trace_id: "trace-1",
    payload: {},
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    globalCallDepth: 5,
  });

  const result = enforcer.enforceAll(message, context);

  assert.ok(result.violations.includes("acp.depth_exceeded"));
});

test("ACPInvariantEnforcer.enforceAll collects multiple violations", () => {
  const enforcer = new ACPInvariantEnforcer();

  const message: ACPMessage = {
    messageId: "msg-1",
    messageType: "completion_report",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 10,
    sender_agent_id: "agent-1",
    receiver_agent_id: "agent-2",
    domain_id: "test",
    risk_level: 75,
    budget_remaining: 2000,
    trace_id: "trace-1",
    payload: {}, // Missing evidence
    timestamp: new Date().toISOString(),
  };

  const context = createMockInvariantContext({
    parentRiskMode: 50,
    parentBudgetRemaining: 1000,
    globalCallDepth: 5,
  });

  const result = enforcer.enforceAll(message, context);

  assert.ok(result.violations.length >= 4);
});
