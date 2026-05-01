import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateChineseWallPolicy,
  type ChineseWallPolicy,
} from "../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

test("evaluateChineseWallPolicy allows same org node", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    blockedOrgNodeIds: ["blocked_org"],
  };

  const decision = evaluateChineseWallPolicy(policy, "same_org", "same_org");

  assert.strictEqual(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("chinese_wall.same_org_node"));
});

test("evaluateChineseWallPolicy blocks blocked org node", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cwall_1",
    blockedOrgNodeIds: ["blocked_org"],
  };

  const decision = evaluateChineseWallPolicy(policy, "blocked_org", "target_org");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.some((c) => c.includes("chinese_wall.blocked_org")));
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