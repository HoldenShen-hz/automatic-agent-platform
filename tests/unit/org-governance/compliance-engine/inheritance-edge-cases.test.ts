/**
 * Unit tests for Compliance Policy Resolver - Additional edge cases
 * Tests for resolveCompliancePolicyForNode function
 */

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

test("resolveCompliancePolicyForNode handles deeply nested org hierarchy", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "company", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "division", nodeType: "division", displayName: "Engineering", parentOrgNodeId: "company" }),
    createNode({ orgNodeId: "department", nodeType: "department", displayName: "Backend", parentOrgNodeId: "division" }),
    createNode({ orgNodeId: "team", nodeType: "team", displayName: "Platform", parentOrgNodeId: "department" }),
    createNode({ orgNodeId: "member", nodeType: "seat", displayName: "Alice", parentOrgNodeId: "team", ownerUserIds: ["user-1"] }),
  ];

  const policiesByNodeId = {
    company: [{ policyId: "company_policy", rules: { retentionDays: 365 } }],
    division: [{ policyId: "division_policy", rules: { encryptionRequired: true } }],
    department: [{ policyId: "dept_policy", rules: { dataClassification: "internal" } }],
    team: [],
    member: [],
  };

  const result = resolveCompliancePolicyForNode(nodes, "member", policiesByNodeId);

  assert.strictEqual(result.retentionDays, 365);
  assert.strictEqual(result.encryptionRequired, true);
  assert.strictEqual(result.dataClassification, "internal");
});

test("resolveCompliancePolicyForNode returns empty when target node not found", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { rule: "value" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "nonexistent_node", policiesByNodeId);

  assert.deepStrictEqual(result, { _denyByDefault: true });
  assert.strictEqual(result.denyByDefault, true);
});

test("resolveCompliancePolicyForNode handles nodes with null parent", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "standalone", nodeType: "seat", displayName: "Bob", ownerUserIds: ["user-2"] }),
  ];

  const policiesByNodeId = {
    standalone: [{ policyId: "standalone_policy", rules: { standaloneRule: true } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "standalone", policiesByNodeId);

  assert.strictEqual(result.standaloneRule, true);
});

test("resolveCompliancePolicyForNode merges multiple policies from same node", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
  ];

  const policiesByNodeId = {
    root: [
      { policyId: "policy_1", rules: { ruleA: 1, ruleB: "value1" } },
      { policyId: "policy_2", rules: { ruleC: true, ruleB: "value2" } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "root", policiesByNodeId);

  assert.strictEqual(result.ruleA, 1);
  assert.strictEqual(result.ruleB, "value2"); // later value wins
  assert.strictEqual(result.ruleC, true);
});

test("resolveCompliancePolicyForNode handles empty policiesByNodeId", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
  ];

  const result = resolveCompliancePolicyForNode(nodes, "root", {});

  assert.deepStrictEqual(result, { _denyByDefault: true });
  assert.strictEqual(result.denyByDefault, true);
});

test("resolveCompliancePolicyForNode handles intermediate node without policies", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "IT", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { globalRule: true } }],
    // dept has no policies
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.strictEqual(result.globalRule, true);
});

test("resolveCompliancePolicyForNode uses last value when same key appears multiple times", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "Sales", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {
    root: [
      { policyId: "p1", rules: { priority: "low" } },
      { policyId: "p2", rules: { priority: "medium" } },
    ],
    dept: [{ policyId: "p3", rules: { priority: "high" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  // Should be "high" as the last value in the lineage
  assert.strictEqual(result.priority, "high");
});

test("resolveCompliancePolicyForNode preserves different keys from different nodes", () => {
  const nodes: readonly OrgNode[] = [
    createNode({ orgNodeId: "root", nodeType: "company", displayName: "Acme Corp" }),
    createNode({ orgNodeId: "dept", nodeType: "department", displayName: "HR", parentOrgNodeId: "root" }),
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { companyWide: true } }],
    dept: [{ policyId: "dept_policy", rules: { hrSpecific: "sensitive" } }],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);

  assert.strictEqual(result.companyWide, true);
  assert.strictEqual(result.hrSpecific, "sensitive");
});
