/**
 * Unit tests for Policy Resolver
 * Tests cover specific security and correctness issues:
 * - Issue #1980: No deny-by-default, returns empty object=allow when no policy
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resolveCompliancePolicyForNode } from "../../../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import type { PolicyLayer } from "../../../../../src/org-governance/compliance-engine/inheritance/index.js";

function createOrgNode(overrides: Partial<{
  orgNodeId: string;
  nodeType: "company" | "department" | "team";
  parentOrgNodeId: string | null;
  ownerUserIds: string[];
  active: boolean;
}> = {}): {
  orgNodeId: string;
  nodeType: "company" | "department" | "team";
  displayName: string;
  parentOrgNodeId: string | null;
  ownerUserIds: string[];
  active: boolean;
  costCenter: string;
  metadata: Record<string, unknown>;
} {
  return {
    orgNodeId: overrides.orgNodeId ?? "node-1",
    nodeType: overrides.nodeType ?? "department",
    displayName: "Test Node",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: "cc-1",
    metadata: {},
  };
}

// ─── Issue #1980: No deny-by-default, returns empty object=allow when no policy ─

test("resolveCompliancePolicyForNode returns empty object when no policies exist - demonstrates allow-by-default bug", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    // No policies at all
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept-1", policiesByNodeId);

  // BUG: When no policy exists, the function returns an empty object `{}`
  // An empty object is truthy and often interpreted as "allow" in permission checks
  // This is a deny-by-default violation - without explicit policy, access should be denied
  assert.deepStrictEqual(result, {});
  // An empty result means "no restrictions" which equals "allow everything"
  // This is the security bug - no policy should mean deny, not allow
});

test("resolveCompliancePolicyForNode returns empty object for unknown node - demonstrates allow-by-default bug", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "dept-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "dept-1": [], // Node exists but has no policies
  };

  const result = resolveCompliancePolicyForNode(nodes, "nonexistent-node", policiesByNodeId);

  // BUG: For unknown node, also returns empty object (walks up lineage, finds nothing)
  // This means unknown nodes get empty policy = allow by default
  assert.deepStrictEqual(result, {});
});

test("resolveCompliancePolicyForNode returns empty object when lineage has no policies - demonstrates bug", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    // Even though lineage exists, no policies are defined
  };

  const result = resolveCompliancePolicyForNode(nodes, "team-1", policiesByNodeId);

  // BUG: Full lineage but no policies anywhere = empty object = allow
  assert.deepStrictEqual(result, {});
});

test("resolveCompliancePolicyForNode with explicit policies returns merged policy", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "dept-1": [
      { policyId: "policy-1", rules: { max_retries: 3, timeout_ms: 5000 } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept-1", policiesByNodeId);

  assert.ok(Object.keys(result).length > 0);
  assert.equal((result as { max_retries?: number }).max_retries, 3);
});

test("resolveCompliancePolicyForNode inherits from parent nodes", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "company-1": [
      { policyId: "policy-company", rules: { global_setting: "enabled" } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept-1", policiesByNodeId);

  // Should inherit from parent
  assert.ok((result as { global_setting?: string }).global_setting, "enabled");
});

test("resolveCompliancePolicyForNode merges multiple inherited policies", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "division-1", parentOrgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "division-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "company-1": [
      { policyId: "policy-company", rules: { company_rule: true } },
    ],
    "division-1": [
      { policyId: "policy-division", rules: { division_rule: true } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept-1", policiesByNodeId);

  // Should merge both policies
  assert.ok((result as { company_rule?: boolean }).company_rule);
  assert.ok((result as { division_rule?: boolean }).division_rule);
});

test("resolveCompliancePolicyForNode child policies override parent policies", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "company-1": [
      { policyId: "policy-company", rules: { setting: "parent_value" } },
    ],
    "dept-1": [
      { policyId: "policy-dept", rules: { setting: "child_value" } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "dept-1", policiesByNodeId);

  // Child should override parent
  assert.equal((result as { setting?: string }).setting, "child_value");
});

test("resolveCompliancePolicyForNode handles deep hierarchy", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "division-1", parentOrgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "division-1" }),
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "company-1": [
      { policyId: "policy-1", rules: { level: 1 } },
    ],
    "division-1": [
      { policyId: "policy-2", rules: { level: 2 } },
    ],
    "dept-1": [
      { policyId: "policy-3", rules: { level: 3 } },
    ],
    "team-1": [
      { policyId: "policy-4", rules: { level: 4 } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "team-1", policiesByNodeId);

  // All levels should be inherited
  assert.equal((result as { level?: number }).level, 4); // Team overrides
});

test("resolveCompliancePolicyForNode with single node and no parent", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "company-1": [
      { policyId: "policy-1", rules: { setting: "value" } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "company-1", policiesByNodeId);

  assert.equal((result as { setting?: string }).setting, "value");
});

test("resolveCompliancePolicyForNode empty lineage for root node returns empty", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1", parentOrgNodeId: null }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {};

  const result = resolveCompliancePolicyForNode(nodes, "company-1", policiesByNodeId);

  // Empty policies = empty object = allow (BUG)
  assert.deepStrictEqual(result, {});
});

test("resolveCompliancePolicyForNode with partial lineage coverage", () => {
  const nodes = [
    createOrgNode({ orgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "dept-1", parentOrgNodeId: "company-1" }),
    createOrgNode({ orgNodeId: "team-1", parentOrgNodeId: "dept-1" }),
  ];

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    "company-1": [
      { policyId: "policy-1", rules: { rule1: "from_company" } },
    ],
    // dept-1 has no policy
    "team-1": [
      { policyId: "policy-team", rules: { rule3: "from_team" } },
    ],
  };

  const result = resolveCompliancePolicyForNode(nodes, "team-1", policiesByNodeId);

  // Should have company policy and team policy
  assert.equal((result as { rule1?: string }).rule1, "from_company");
  assert.equal((result as { rule3?: string }).rule3, "from_team");
});
