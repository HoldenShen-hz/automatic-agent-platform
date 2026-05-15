import assert from "node:assert/strict";
import test from "node:test";

import { CollaborationProtocolService } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/protocol-service.js";
import { ACPInvariantEnforcer } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";
import type { InvariantContext } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";
import type { ACPMessage } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/types.js";
import type { PermissionSet } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";

const parentPermissions: PermissionSet = {
  resources: ["repo", "kb", "artifact"],
  actions: ["read", "write", "delegate"],
  constraints: { maxTokens: 1000 },
};

const context: InvariantContext = {
  parentPermissions,
  parentRiskMode: 70,
  parentConstraints: { maxTokens: 1000 },
  parentBudgetRemaining: 100,
  globalCallDepth: 4,
};

function createMessage(overrides: Partial<ACPMessage> = {}): ACPMessage {
  return {
    messageId: "msg-1",
    messageType: "task_request",
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "parent-agent",
    receiver_agent_id: "child-agent",
    domain_id: "coding",
    risk_level: 30,
    budget_remaining: 20,
    trace_id: "trace-1",
    payload: {
      permissions: {
        resources: ["repo"],
        actions: ["read"],
        constraints: { maxTokens: 1000 },
      },
      constraints: { maxTokens: 1000 },
    },
    timestamp: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}

test("CollaborationProtocolService creates a valid message", () => {
  const service = new CollaborationProtocolService();
  const message = service.createMessage("task_request", {
    correlation_id: "corr-1",
    parent_run_id: "run-1",
    depth: 1,
    sender_agent_id: "parent-agent",
    receiver_agent_id: "child-agent",
    domain_id: "coding",
    risk_level: 30,
    budget_remaining: 20,
    trace_id: "trace-1",
    payload: {},
  });

  assert.equal(message.messageType, "task_request");
  assert.ok(message.messageId.length > 0);
  assert.ok(message.timestamp.length > 0);
});

test("CollaborationProtocolService validates and sends valid message", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage();

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
  assert.deepEqual(result.violations, []);
});

test("CollaborationProtocolService rejects message with escalated risk", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ risk_level: 99 });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.risk_escalated"));
});

test("CollaborationProtocolService rejects message with exceeded budget", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ budget_remaining: 200 });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.budget_exceeded"));
});

test("CollaborationProtocolService rejects message with exceeded depth", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ depth: 10 });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.depth_exceeded"));
});

test("CollaborationProtocolService rejects message with relaxed constraints", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({
    payload: {
      permissions: {
        resources: ["repo"],
        actions: ["read"],
        constraints: { maxTokens: 5000 },
      },
      constraints: { maxTokens: 5000 },
    },
  });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.constraints_relaxed"));
});

test("CollaborationProtocolService rejects message with non-subset permissions", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({
    payload: {
      permissions: {
        resources: ["repo", "prod"],
        actions: ["read", "admin"],
        constraints: { maxTokens: 1000 },
      },
      constraints: { maxTokens: 1000 },
    },
  });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.permission_not_subset"));
});

test("CollaborationProtocolService handleIncoming delegates to validateAndSend", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage();

  const result = service.handleIncoming(message, context);

  assert.equal(result.accepted, true);
  assert.deepEqual(result.violations, []);
});

test("CollaborationProtocolService with custom invariant enforcer", () => {
  const enforcer = new ACPInvariantEnforcer();
  const service = new CollaborationProtocolService(enforcer);
  const message = createMessage();

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService accepts completion_report with evidence", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({
    messageType: "completion_report",
    payload: {
      evidence: ["artifact:1", "artifact:2"],
      result_summary: "task completed successfully",
      artifacts: ["artifact:1", "artifact:2"],
    },
  });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService rejects completion_report without evidence", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({
    messageType: "completion_report",
    payload: {
      result_summary: "task completed",
    },
  });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.completion_missing_evidence"));
});

test("CollaborationProtocolService accepts takeover_notice with audit_trail_ref", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({
    messageType: "takeover_notice",
    payload: { audit_trail_ref: "audit:handoff-123" },
  });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService rejects takeover_notice without audit_trail_ref", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({
    messageType: "takeover_notice",
    payload: {},
  });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes("acp.takeover_missing_audit"));
});

test("CollaborationProtocolService accepts task_offer message type", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ messageType: "task_offer" });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService accepts task_accept message type", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ messageType: "task_accept" });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService accepts task_reject message type", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ messageType: "task_reject" });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService accepts partial_result message type", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ messageType: "partial_result" });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});

test("CollaborationProtocolService accepts escalation_request message type", () => {
  const service = new CollaborationProtocolService();
  const message = createMessage({ messageType: "escalation_request" });

  const result = service.validateAndSend(message, context);

  assert.equal(result.accepted, true);
});
