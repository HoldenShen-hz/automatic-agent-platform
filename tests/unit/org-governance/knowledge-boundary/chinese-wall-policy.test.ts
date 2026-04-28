import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateChineseWallPolicy,
  type ChineseWallPolicy,
  type ChineseWallDecision,
} from "../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

test("evaluateChineseWallPolicy returns allowed when requester and target are not in same conflict group", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-1",
    conflictGroups: {
      "financial": ["node-finance-1", "node-finance-2"],
      "healthcare": ["node-health-1"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "node-finance-1", "node-health-1");

  assert.equal(decision.allowed, true);
  assert.equal(decision.blockedGroupId, null);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
});

test("evaluateChineseWallPolicy blocks when both nodes in same conflict group", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-1",
    conflictGroups: {
      "financial": ["node-finance-1", "node-finance-2"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "node-finance-1", "node-finance-2");

  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedGroupId, "financial");
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_blocked"));
  assert.ok(decision.reasonCodes.some(code => code.includes("conflict_group:financial")));
});

test("evaluateChineseWallPolicy allows same node (no self-blocking)", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-1",
    conflictGroups: {
      "financial": ["node-finance-1", "node-finance-2"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "node-finance-1", "node-finance-1");

  assert.equal(decision.allowed, true);
  assert.equal(decision.blockedGroupId, null);
});

test("evaluateChineseWallPolicy handles empty conflict groups", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-1",
    conflictGroups: {},
  };

  const decision = evaluateChineseWallPolicy(policy, "node-a", "node-b");

  assert.equal(decision.allowed, true);
  assert.equal(decision.blockedGroupId, null);
});

test("evaluateChineseWallPolicy handles node not in any conflict group", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-1",
    conflictGroups: {
      "financial": ["node-finance-1", "node-finance-2"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "node-unknown", "node-finance-1");

  assert.equal(decision.allowed, true);
  assert.equal(decision.blockedGroupId, null);
});

test("evaluateChineseWallPolicy handles multiple conflict groups", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-1",
    conflictGroups: {
      "group-a": ["node-a1", "node-a2"],
      "group-b": ["node-b1", "node-b2"],
      "group-c": ["node-c1", "node-c2"],
    },
  };

  const decision1 = evaluateChineseWallPolicy(policy, "node-a1", "node-b1");
  assert.equal(decision1.allowed, true);

  const decision2 = evaluateChineseWallPolicy(policy, "node-a1", "node-a2");
  assert.equal(decision2.allowed, false);
  assert.equal(decision2.blockedGroupId, "group-a");

  const decision3 = evaluateChineseWallPolicy(policy, "node-b1", "node-b2");
  assert.equal(decision3.allowed, false);
  assert.equal(decision3.blockedGroupId, "group-b");
});

test("evaluateChineseWallPolicy requires compliance officer reset after expiry", () => {
  const policy: ChineseWallPolicy = {
    policyId: "policy-expiry",
    conflictGroups: {},
    wallExpiryPolicy: "expires_at",
    expiresAt: "2024-01-01T00:00:00.000Z",
    resetRequiresApprovalRole: "compliance_officer",
    coolDownUntil: "2024-01-02T00:00:00.000Z",
    residualScanRequired: true,
  };

  const blocked = evaluateChineseWallPolicy(policy, "node-a", "node-b", {
    nowIso: "2024-01-03T00:00:00.000Z",
  });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasonCodes.includes("knowledge_boundary.chinese_wall_reset_requires_compliance_officer"));

  const allowed = evaluateChineseWallPolicy(policy, "node-a", "node-b", {
    approvedByRole: "compliance_officer",
    residualScanCompleted: true,
    nowIso: "2024-01-03T00:00:00.000Z",
  });
  assert.equal(allowed.allowed, true);
  assert.ok(allowed.reasonCodes.includes("knowledge_boundary.chinese_wall_expired_and_reset"));
});
