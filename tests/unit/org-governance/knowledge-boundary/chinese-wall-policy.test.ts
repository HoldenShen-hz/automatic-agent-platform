import assert from "node:assert/strict";
import test from "node:test";

import { evaluateChineseWallPolicy } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

test("evaluateChineseWallPolicy returns allowed when requesterOrgNodeId is null/undefined consideration", () => {
  // Same org node should always be allowed even if in conflict group
  const policy = {
    policyId: "cwp_1",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
    },
  };

  // Same org node - requester and target are identical
  const decision = evaluateChineseWallPolicy(policy, "dept_finance", "dept_finance");
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.blockedGroupId, null);
});

test("evaluateChineseWallPolicy returns blocked decision with reason codes", () => {
  const policy = {
    policyId: "cwp_block_test",
    conflictGroups: {
      "group_a": ["dept_a", "dept_b"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_a", "dept_b");

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.blockedGroupId, "group_a");
  assert.ok(decision.reasonCodes.length >= 2);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_blocked"));
  assert.ok(decision.reasonCodes.some((code) => code.startsWith("knowledge_boundary.conflict_group:")));
});

test("evaluateChineseWallPolicy is case sensitive on org node ids", () => {
  const policy = {
    policyId: "cwp_1",
    conflictGroups: {
      "group_lower": ["dept_finance"],
    },
  };

  // dept_FINANCE (uppercase) is not in the conflict group that contains dept_finance (lowercase)
  const decision = evaluateChineseWallPolicy(policy, "dept_FINANCE", "dept_finance");

  // Since they're different strings and dept_FINANCE is not in the group, this should be allowed
  assert.strictEqual(decision.allowed, true);
});

test("evaluateChineseWallPolicy handles multiple conflict groups and finds first match", () => {
  const policy = {
    policyId: "cwp_multi",
    conflictGroups: {
      "group_first": ["dept_a", "dept_b"],
      "group_second": ["dept_c", "dept_d"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_a", "dept_b");

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.blockedGroupId, "group_first");
});

test("evaluateChineseWallPolicy returns clear reason code when allowed", () => {
  const policy = {
    policyId: "cwp_clear",
    conflictGroups: {
      "group_legal": ["dept_legal", "dept_compliance"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_hr", "dept_finance");

  assert.strictEqual(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
});

test("evaluateChineseWallPolicy does not block when only one org is in conflict group", () => {
  const policy = {
    policyId: "cwp_partial",
    conflictGroups: {
      "group_finance": ["dept_finance", "dept_legal"],
    },
  };

  // Only requester is in the group, target is not
  const decision = evaluateChineseWallPolicy(policy, "dept_finance", "dept_hr");

  assert.strictEqual(decision.allowed, true);
});

test("evaluateChineseWallPolicy does not block when only target org is in conflict group", () => {
  const policy = {
    policyId: "cwp_partial_2",
    conflictGroups: {
      "group_finance": ["dept_finance", "dept_legal"],
    },
  };

  // Only target is in the group, requester is not
  const decision = evaluateChineseWallPolicy(policy, "dept_hr", "dept_finance");

  assert.strictEqual(decision.allowed, true);
});