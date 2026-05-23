import test from "node:test";
import assert from "node:assert/strict";
import { resolveCompliancePolicyForNode } from "../../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";

function createNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType: OrgNode["nodeType"] }): OrgNode {
  return {
    ...overrides,
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType,
    displayName: overrides.displayName ?? overrides.orgNodeId,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
    effectivePolicies: overrides.effectivePolicies ?? {},
    status: overrides.status ?? "active",
  };
}

test("resolveCompliancePolicyForNode returns merged policy for a leaf node", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "Engineering", parentOrgNodeId: "root" }),
    createNode({ orgNodeId: "team", nodeType: "team", displayName: "Backend", parentOrgNodeId: "dept" }),
    createNode({ orgNodeId: "member", nodeType: "seat", displayName: "Alice", parentOrgNodeId: "team", ownerUserIds: ["user-1"] }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { level: "company" } }],
    dept: [{ policyId: "dept_policy", rules: { dataClassification: "standard" } }],
    team: [{ policyId: "team_policy", rules: { encryptionRequired: true } }],
    member: [],
  };

  const result = resolveCompliancePolicyForNode(nodes, "member", policiesByNodeId);

  assert.strictEqual(result.level, "company");
  assert.strictEqual(result.dataClassification, "standard");
  assert.strictEqual(result.encryptionRequired, true);
});

test("resolveCompliancePolicyForNode returns company-level policy for company node", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { complianceMode: "strict" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "root", policiesByNodeId);

  assert.strictEqual(result.complianceMode, "strict");
});

test("resolveCompliancePolicyForNode returns merged policy for intermediate node", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "Sales", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "p1", rules: { retentionDays: 90 } }],
    dept: [{ policyId: "p2", rules: { retentionDays: 30 } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.strictEqual(result.retentionDays, 30);
});

test("resolveCompliancePolicyForNode returns empty object when node has no policies in lineage", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "IT", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {};

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.deepStrictEqual(result, { _denyByDefault: true });
  assert.strictEqual(result.denyByDefault, true);
});

test("resolveCompliancePolicyForNode handles node with no parent", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "member", nodeType: "seat", displayName: "Bob", ownerUserIds: ["user-2"] }),
  ];

  const policiesByNodeId = {
    member: [{ policyId: "member_policy", rules: { auditEnabled: true } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "member", policiesByNodeId);

  assert.strictEqual(result.auditEnabled, true);
});

test("resolveCompliancePolicyForNode returns multiple policies from single node", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
  ];

  const policiesByNodeId = {
    root: [
      { policyId: "p1", rules: { ruleA: 1 } },
      { policyId: "p2", rules: { ruleB: 2 } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "root", policiesByNodeId);

  assert.strictEqual(result.policy.ruleA, 1);
  assert.strictEqual(result.policy.ruleB, 2);
});

test("resolveCompliancePolicyForNode returns denyByDefault=false when policies exist in lineage", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "Engineering", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { level: "company" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.strictEqual(result.denyByDefault, false);
  assert.strictEqual(result.policy.level, "company");
});

test("resolveCompliancePolicyForNode returns denyByDefault=true when no policies exist in lineage", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "IT", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {};

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.strictEqual(result.denyByDefault, true);
  assert.deepStrictEqual(result.policy, { _denyByDefault: true });
});

test("resolveCompliancePolicyForNode returns denyByDefault=true for node with empty policy array", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "IT", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {
    root: [],
    dept: [],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.strictEqual(result.denyByDefault, true);
  assert.deepStrictEqual(result.policy, { _denyByDefault: true });
});
