import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateChineseWallPolicy,
  type ChineseWallPolicy,
} from "../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

test("evaluateChineseWallPolicy allows same org node (clear)", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    blockedOrgNodeIds: ["blocked_org"],
  };

  const decision = evaluateChineseWallPolicy(policy, "same_org", "same_org");

  assert.strictEqual(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
});

test("evaluateChineseWallPolicy blocks blocked org node", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    blockedOrgNodeIds: ["blocked_org"],
  };

  const decision = evaluateChineseWallPolicy(policy, "blocked_org", "target_org");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.some((c) => c.includes("blocked")));
});

test("evaluateChineseWallPolicy allows non-blocked org nodes", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    blockedOrgNodeIds: ["blocked_a", "blocked_b"],
  };

  const decision = evaluateChineseWallPolicy(policy, "allowed_org", "target_org");

  assert.strictEqual(decision.allowed, true);
});

test("evaluateChineseWallPolicy allows empty blocked list", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    blockedOrgNodeIds: [],
  };

  const decision = evaluateChineseWallPolicy(policy, "any_org", "target_org");

  assert.strictEqual(decision.allowed, true);
});

test("evaluateChineseWallPolicy blocks conflict groups", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    conflictGroups: {
      "group_a": ["org_1", "org_2"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "org_1", "org_2");

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.blockedGroupId, "group_a");
});

test("evaluateChineseWallPolicy allows different groups", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    conflictGroups: {
      "group_a": ["org_1", "org_2"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "org_1", "org_3");

  assert.strictEqual(decision.allowed, true);
});