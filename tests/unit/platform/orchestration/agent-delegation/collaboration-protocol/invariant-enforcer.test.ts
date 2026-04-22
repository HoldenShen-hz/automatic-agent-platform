import assert from "node:assert/strict";
import test from "node:test";

import type { PermissionSet } from "../../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";
import { ACPInvariantEnforcer, CollaborationProtocolService, type ACPMessage, type InvariantContext } from "../../../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/index.js";

const parentPermissions: PermissionSet = {
  resources: ["repo", "kb", "artifact"],
  actions: ["read", "write", "delegate"],
  constraints: { maxTokens: 1000, region: "cn-shanghai" },
};

const context: InvariantContext = {
  parentPermissions,
  parentRiskMode: 70,
  parentConstraints: { maxTokens: 1000, region: "cn-shanghai" },
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
        constraints: { maxTokens: 1000, region: "cn-shanghai" },
      },
      constraints: { maxTokens: 1000, region: "cn-shanghai" },
    },
    timestamp: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}

test("ACPInvariantEnforcer validates all seven invariants", () => {
  const enforcer = new ACPInvariantEnforcer();
  assert.equal(enforcer.checkPermissionSubset({ ...parentPermissions, resources: ["repo"], actions: ["read"] }, parentPermissions), true);
  assert.equal(enforcer.checkRiskNotEscalated(10, 70), true);
  assert.equal(enforcer.checkConstraintNotRelaxed({ maxTokens: 1000, region: "cn-shanghai" }, context.parentConstraints), true);
  assert.equal(enforcer.checkCompletionHasEvidence(createMessage({ messageType: "completion_report", payload: { evidence: ["artifact:1"], result_summary: "done" } })), true);
  assert.equal(enforcer.checkTakeoverAudit(createMessage({ messageType: "takeover_notice", payload: { audit_trail_ref: "audit:1" } })), true);
  assert.equal(enforcer.checkBudgetNotExceeded(20, 100), true);
  assert.equal(enforcer.checkDepthLimit(1, 4), true);
});

test("ACPInvariantEnforcer reports violations when invariants are broken", () => {
  const enforcer = new ACPInvariantEnforcer();
  const result = enforcer.enforceAll(
    createMessage({
      depth: 9,
      risk_level: 99,
      budget_remaining: 200,
      payload: {
        permissions: {
          resources: ["repo", "prod"],
          actions: ["read", "admin"],
          constraints: { maxTokens: 5000 },
        },
        constraints: { maxTokens: 5000 },
      },
    }),
    context,
  );

  assert.equal(result.passed, false);
  assert.ok(result.violations.includes("acp.permission_not_subset"));
  assert.ok(result.violations.includes("acp.risk_escalated"));
  assert.ok(result.violations.includes("acp.constraints_relaxed"));
  assert.ok(result.violations.includes("acp.budget_exceeded"));
  assert.ok(result.violations.includes("acp.depth_exceeded"));
});

test("CollaborationProtocolService validates completion evidence and takeover audit", () => {
  const protocol = new CollaborationProtocolService();
  const completion = protocol.validateAndSend(
    createMessage({
      messageType: "completion_report",
      payload: { evidence: ["artifact:1"], result_summary: "done", artifacts: ["artifact:1"] },
    }),
    context,
  );
  const takeover = protocol.handleIncoming(
    createMessage({
      messageType: "takeover_notice",
      payload: { audit_trail_ref: "audit:handoff" },
    }),
    context,
  );

  assert.equal(completion.accepted, true);
  assert.equal(takeover.accepted, true);
});
