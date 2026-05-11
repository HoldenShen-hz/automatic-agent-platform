import assert from "node:assert/strict";
import test from "node:test";

import { resolveCompliancePolicyForNode } from "../../../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import { inheritPolicyLayers, type PolicyLayer } from "../../../../../src/org-governance/compliance-engine/inheritance/index.js";

// Mock OrgNode type for testing
interface OrgNode {
  orgNodeId: string;
  parentOrgNodeId: string | null;
  active: boolean;
  nodeType: string;
}

function createMockOrgNode(id: string, parentId: string | null): OrgNode {
  return {
    orgNodeId: id,
    parentOrgNodeId: parentId,
    active: true,
    nodeType: "team",
  };
}

test("resolveCompliancePolicyForNode returns denyByDefault=true for unknown node", () => {
  const nodes: OrgNode[] = [
    createMockOrgNode("node1", null),
  ];
  const policies: Record<string, PolicyLayer[]> = {};

  const result = resolveCompliancePolicyForNode(nodes, "unknown_node", policies);
  assert.deepEqual(result.policy, {});
  assert.equal(result.denyByDefault, true);
});

test("resolveCompliancePolicyForNode returns denyByDefault=true for node with no policy in lineage", () => {
  const nodes: OrgNode[] = [
    createMockOrgNode("company", null),
    createMockOrgNode("team", "company"),
  ];
  const policies: Record<string, PolicyLayer[]> = {
    // neither node has a policy
  };

  const result = resolveCompliancePolicyForNode(nodes, "team", policies);
  assert.deepEqual(result.policy, {});
  assert.equal(result.denyByDefault, true);
});

test("resolveCompliancePolicyForNode returns policy for single node without parent", () => {
  const nodes: OrgNode[] = [
    createMockOrgNode("company", null),
  ];
  const policies: Record<string, PolicyLayer[]> = {
    company: [{ policyId: "p1", rules: { accessLevel: "admin" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "company", policies);
  assert.deepEqual(result.policy, { accessLevel: "admin" });
  assert.equal(result.denyByDefault, false);
});

test("resolveCompliancePolicyForNode merges policies from lineage", () => {
  const nodes: OrgNode[] = [
    createMockOrgNode("company", null),
    createMockOrgNode("division", "company"),
    createMockOrgNode("department", "division"),
  ];
  const policies: Record<string, PolicyLayer[]> = {
    company: [{ policyId: "p1", rules: { level: "company_level" } }],
    division: [{ policyId: "p2", rules: { level: "division_level" } }],
    department: [{ policyId: "p3", rules: { level: "department_level" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "department", policies);
  // inheritPolicyLayers merges in order, so last one wins
  assert.equal(result.policy["level"], "department_level");
  assert.equal(result.denyByDefault, false);
});

test("resolveCompliancePolicyForNode uses fallback when node has no policy", () => {
  const nodes: OrgNode[] = [
    createMockOrgNode("company", null),
    createMockOrgNode("team", "company"),
  ];
  const policies: Record<string, PolicyLayer[]> = {
    company: [{ policyId: "p1", rules: { inherited: "yes" } }],
    // team has no policy
  };

  const result = resolveCompliancePolicyForNode(nodes, "team", policies);
  assert.deepEqual(result.policy, { inherited: "yes" });
  assert.equal(result.denyByDefault, false);
});

test("resolveCompliancePolicyForNode handles missing parent gracefully", () => {
  const nodes: OrgNode[] = [
    createMockOrgNode("child", "nonexistent_parent"),
  ];
  const policies: Record<string, PolicyLayer[]> = {
    child: [{ policyId: "p1", rules: { value: 42 } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "child", policies);
  assert.deepEqual(result.policy, { value: 42 });
  assert.equal(result.denyByDefault, false);
});

test("resolveCompliancePolicyForNode handles empty nodes array", () => {
  const nodes: OrgNode[] = [];
  const policies: Record<string, PolicyLayer[]> = {};

  const result = resolveCompliancePolicyForNode(nodes, "any_node", policies);
  assert.deepEqual(result.policy, {});
  assert.equal(result.denyByDefault, true);
});