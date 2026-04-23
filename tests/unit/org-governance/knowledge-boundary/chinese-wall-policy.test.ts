import assert from "node:assert/strict";
import test from "node:test";

import { evaluateChineseWallPolicy } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

test("evaluateChineseWallPolicy returns allowed when no conflict", () => {
  const policy = {
    policyId: "cwp_1",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_hr", "dept_finance");

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.blockedGroupId, null);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
});

test("evaluateChineseWallPolicy blocks when both orgs in same conflict group", () => {
  const policy = {
    policyId: "cwp_1",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_finance", "dept_legal");

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.blockedGroupId, "group_finance_legal");
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_blocked"));
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.conflict_group:group_finance_legal"));
});

test("evaluateChineseWallPolicy allows when requester and target are same org", () => {
  const policy = {
    policyId: "cwp_1",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_finance", "dept_finance");

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.blockedGroupId, null);
});

test("evaluateChineseWallPolicy handles multiple conflict groups", () => {
  const policy = {
    policyId: "cwp_multi",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
      "group_hr_it": ["dept_hr", "dept_it"],
    },
  };

  const decision1 = evaluateChineseWallPolicy(policy, "dept_hr", "dept_it");
  assert.strictEqual(decision1.allowed, false);
  assert.strictEqual(decision1.blockedGroupId, "group_hr_it");

  const decision2 = evaluateChineseWallPolicy(policy, "dept_finance", "dept_it");
  assert.strictEqual(decision2.allowed, true);
});

test("evaluateChineseWallPolicy handles empty conflict groups", () => {
  const policy = {
    policyId: "cwp_empty",
    conflictGroups: {},
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_finance", "dept_legal");

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.blockedGroupId, null);
});

test("evaluateChineseWallPolicy handles org in multiple groups", () => {
  const policy = {
    policyId: "cwp_overlap",
    conflictGroups: {
      "group_a": ["dept_shared", "dept_a"],
      "group_b": ["dept_shared", "dept_b"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "dept_shared", "dept_a");
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.blockedGroupId, "group_a");
});
