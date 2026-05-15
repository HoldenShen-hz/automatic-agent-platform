/**
 * Unit tests for ACPInvariantEnforcer - Individual Method Coverage
 *
 * Tests for individual invariant check methods not covered in the main test file:
 * - checkPermissionSubset with edge cases
 * - checkRiskNotEscalated edge cases
 * - checkConstraintNotRelaxed edge cases
 * - checkCompletionHasEvidence edge cases
 * - checkTakeoverAudit edge cases
 * - checkBudgetNotExceeded edge cases
 * - checkDepthLimit edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ACPInvariantEnforcer } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";
import type { PermissionSet } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";
import type { ACPMessage } from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/types.js";

const enforcer = new ACPInvariantEnforcer();

const parentPermissions: PermissionSet = {
  resources: ["repo", "kb", "artifact"],
  actions: ["read", "write", "delegate"],
  constraints: { maxTokens: 1000 },
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

// ─────────────────────────────────────────────────────────────────────────────
// checkPermissionSubset Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkPermissionSubset returns true for subset permissions", () => {
  const child: PermissionSet = {
    resources: ["repo"],
    actions: ["read"],
    constraints: { maxTokens: 500 },
  };

  assert.equal(enforcer.checkPermissionSubset(child, parentPermissions), true);
});

test("ACPInvariantEnforcer.checkPermissionSubset returns false for extra resource", () => {
  const child: PermissionSet = {
    resources: ["repo", "prod"], // prod not in parent
    actions: ["read"],
    constraints: { maxTokens: 500 },
  };

  assert.equal(enforcer.checkPermissionSubset(child, parentPermissions), false);
});

test("ACPInvariantEnforcer.checkPermissionSubset returns false for extra action", () => {
  const child: PermissionSet = {
    resources: ["repo"],
    actions: ["read", "admin"], // admin not in parent
    constraints: { maxTokens: 500 },
  };

  assert.equal(enforcer.checkPermissionSubset(child, parentPermissions), false);
});

test("ACPInvariantEnforcer.checkPermissionSubset returns true for identical permissions", () => {
  const child: PermissionSet = {
    resources: ["repo", "kb", "artifact"],
    actions: ["read", "write", "delegate"],
    constraints: { maxTokens: 1000 },
  };

  assert.equal(enforcer.checkPermissionSubset(child, parentPermissions), true);
});

test("ACPInvariantEnforcer.checkPermissionSubset returns true for empty child permissions", () => {
  const child: PermissionSet = {
    resources: [],
    actions: [],
    constraints: {},
  };

  assert.equal(enforcer.checkPermissionSubset(child, parentPermissions), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkRiskNotEscalated Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkRiskNotEscalated returns true when child equals parent", () => {
  assert.equal(enforcer.checkRiskNotEscalated(50, 50), true);
});

test("ACPInvariantEnforcer.checkRiskNotEscalated returns true when child is lower", () => {
  assert.equal(enforcer.checkRiskNotEscalated(30, 70), true);
});

test("ACPInvariantEnforcer.checkRiskNotEscalated returns false when child exceeds parent", () => {
  assert.equal(enforcer.checkRiskNotEscalated(80, 50), false);
});

test("ACPInvariantEnforcer.checkRiskNotEscalated returns true when both are zero", () => {
  assert.equal(enforcer.checkRiskNotEscalated(0, 0), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkConstraintNotRelaxed Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns true for identical constraints", () => {
  const child = { maxTokens: 1000 };
  const parent = { maxTokens: 1000 };

  assert.equal(enforcer.checkConstraintNotRelaxed(child, parent), true);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns false when child is more restrictive", () => {
  // Constraint values differ (500 vs 1000), so parent constraint is not preserved
  const child = { maxTokens: 500 };
  const parent = { maxTokens: 1000 };

  assert.equal(enforcer.checkConstraintNotRelaxed(child, parent), false);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns false when child omits parent constraint", () => {
  const child = {};
  const parent = { maxTokens: 1000 };

  assert.equal(enforcer.checkConstraintNotRelaxed(child, parent), false);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns false when child has different value", () => {
  const child = { maxTokens: 2000 }; // More than parent - relaxed
  const parent = { maxTokens: 1000 };

  assert.equal(enforcer.checkConstraintNotRelaxed(child, parent), false);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns true for nested objects", () => {
  const child = { nested: { value: 100 } };
  const parent = { nested: { value: 100 } };

  assert.equal(enforcer.checkConstraintNotRelaxed(child, parent), true);
});

test("ACPInvariantEnforcer.checkConstraintNotRelaxed returns false for nested objects with different values", () => {
  const child = { nested: { value: 200 } };
  const parent = { nested: { value: 100 } };

  assert.equal(enforcer.checkConstraintNotRelaxed(child, parent), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkCompletionHasEvidence Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns true for non-completion message", () => {
  const message = createMessage({ messageType: "task_request" });

  assert.equal(enforcer.checkCompletionHasEvidence(message), true);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns true with evidence array", () => {
  const message = createMessage({
    messageType: "completion_report",
    payload: { evidence: ["artifact:1"], result_summary: "done" },
  });

  assert.equal(enforcer.checkCompletionHasEvidence(message), true);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns true with multiple evidence", () => {
  const message = createMessage({
    messageType: "completion_report",
    payload: { evidence: ["artifact:1", "artifact:2", "artifact:3"], result_summary: "done" },
  });

  assert.equal(enforcer.checkCompletionHasEvidence(message), true);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns false for empty evidence", () => {
  const message = createMessage({
    messageType: "completion_report",
    payload: { evidence: [], result_summary: "done" },
  });

  assert.equal(enforcer.checkCompletionHasEvidence(message), false);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns false when evidence missing", () => {
  const message = createMessage({
    messageType: "completion_report",
    payload: { result_summary: "done" },
  });

  assert.equal(enforcer.checkCompletionHasEvidence(message), false);
});

test("ACPInvariantEnforcer.checkCompletionHasEvidence returns false for non-array evidence", () => {
  const message = createMessage({
    messageType: "completion_report",
    payload: { evidence: "not-an-array", result_summary: "done" } as unknown as { evidence: string[] },
  });

  // Array.isArray check fails for string
  assert.equal(enforcer.checkCompletionHasEvidence(message), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkTakeoverAudit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkTakeoverAudit returns true for non-takeover message", () => {
  const message = createMessage({ messageType: "task_request" });

  assert.equal(enforcer.checkTakeoverAudit(message), true);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns true with valid audit_trail_ref", () => {
  const message = createMessage({
    messageType: "takeover_notice",
    payload: { audit_trail_ref: "audit:handoff-123" },
  });

  assert.equal(enforcer.checkTakeoverAudit(message), true);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns false for empty audit_trail_ref", () => {
  const message = createMessage({
    messageType: "takeover_notice",
    payload: { audit_trail_ref: "" },
  });

  assert.equal(enforcer.checkTakeoverAudit(message), false);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns false for missing audit_trail_ref", () => {
  const message = createMessage({
    messageType: "takeover_notice",
    payload: {},
  });

  assert.equal(enforcer.checkTakeoverAudit(message), false);
});

test("ACPInvariantEnforcer.checkTakeoverAudit returns false for non-string audit_trail_ref", () => {
  const message = createMessage({
    messageType: "takeover_notice",
    payload: { audit_trail_ref: 123 as unknown as string },
  });

  assert.equal(enforcer.checkTakeoverAudit(message), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkBudgetNotExceeded Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkBudgetNotExceeded returns true when equal", () => {
  assert.equal(enforcer.checkBudgetNotExceeded(100, 100), true);
});

test("ACPInvariantEnforcer.checkBudgetNotExceeded returns true when child is lower", () => {
  assert.equal(enforcer.checkBudgetNotExceeded(50, 100), true);
});

test("ACPInvariantEnforcer.checkBudgetNotExceeded returns false when child exceeds parent", () => {
  assert.equal(enforcer.checkBudgetNotExceeded(150, 100), false);
});

test("ACPInvariantEnforcer.checkBudgetNotExceeded returns true when both are zero", () => {
  assert.equal(enforcer.checkBudgetNotExceeded(0, 0), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkDepthLimit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.checkDepthLimit returns true when equal", () => {
  assert.equal(enforcer.checkDepthLimit(5, 5), true);
});

test("ACPInvariantEnforcer.checkDepthLimit returns true when child is shallower", () => {
  assert.equal(enforcer.checkDepthLimit(3, 5), true);
});

test("ACPInvariantEnforcer.checkDepthLimit returns false when child exceeds parent", () => {
  assert.equal(enforcer.checkDepthLimit(7, 5), false);
});

test("ACPInvariantEnforcer.checkDepthLimit returns true when both are zero", () => {
  assert.equal(enforcer.checkDepthLimit(0, 0), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// enforceAll Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ACPInvariantEnforcer.enforceAll returns passed true when no violations", () => {
  const message = createMessage();
  const context = {
    parentPermissions,
    parentRiskMode: 70,
    parentConstraints: { maxTokens: 1000 },
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = enforcer.enforceAll(message, context);

  assert.equal(result.passed, true);
  assert.deepEqual(result.violations, []);
});

test("ACPInvariantEnforcer.enforceAll collects multiple violations", () => {
  const message = createMessage({
    depth: 10,
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
  });
  const context = {
    parentPermissions,
    parentRiskMode: 50,
    parentConstraints: { maxTokens: 1000 },
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = enforcer.enforceAll(message, context);

  assert.equal(result.passed, false);
  assert.ok(result.violations.length >= 4);
  assert.ok(result.violations.includes("acp.permission_not_subset"));
  assert.ok(result.violations.includes("acp.risk_escalated"));
  assert.ok(result.violations.includes("acp.budget_exceeded"));
  assert.ok(result.violations.includes("acp.depth_exceeded"));
});

test("ACPInvariantEnforcer.enforceAll skips permission check when payload.permissions is undefined", () => {
  const message = createMessage({
    payload: {}, // No permissions field
  });
  const context = {
    parentPermissions,
    parentRiskMode: 70,
    parentConstraints: { maxTokens: 1000 },
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = enforcer.enforceAll(message, context);

  // Should not have permission violation since permissions is not checked
  assert.ok(!result.violations.includes("acp.permission_not_subset"));
});

test("ACPInvariantEnforcer.enforceAll skips constraints check when payload.constraints is undefined", () => {
  const message = createMessage({
    payload: {
      permissions: {
        resources: ["repo"],
        actions: ["read"],
        constraints: { maxTokens: 1000 },
      },
      // No constraints field
    },
  });
  const context = {
    parentPermissions,
    parentRiskMode: 70,
    parentConstraints: { maxTokens: 1000 },
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = enforcer.enforceAll(message, context);

  // Should not have constraints violation since constraints is not checked
  assert.ok(!result.violations.includes("acp.constraints_relaxed"));
});

test("ACPInvariantEnforcer.enforceAll handles missing completion evidence", () => {
  const message = createMessage({
    messageType: "completion_report",
    payload: { evidence: [], result_summary: "no evidence" },
  });
  const context = {
    parentPermissions,
    parentRiskMode: 70,
    parentConstraints: { maxTokens: 1000 },
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = enforcer.enforceAll(message, context);

  assert.equal(result.passed, false);
  assert.ok(result.violations.includes("acp.completion_missing_evidence"));
});

test("ACPInvariantEnforcer.enforceAll handles missing takeover audit", () => {
  const message = createMessage({
    messageType: "takeover_notice",
    payload: {},
  });
  const context = {
    parentPermissions,
    parentRiskMode: 70,
    parentConstraints: { maxTokens: 1000 },
    parentBudgetRemaining: 100,
    globalCallDepth: 5,
  };

  const result = enforcer.enforceAll(message, context);

  assert.equal(result.passed, false);
  assert.ok(result.violations.includes("acp.takeover_missing_audit"));
});
