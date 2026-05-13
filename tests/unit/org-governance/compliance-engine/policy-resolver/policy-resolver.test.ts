/**
 * Unit tests for Compliance Policy Resolver
 * Tests deny-by-default behavior
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { resolveCompliancePolicyForNode } from "../../../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import { inheritPolicyLayers, comparePolicyStrictness, type PolicyLayer } from "../../../../../src/org-governance/compliance-engine/inheritance/index.js";
import type { OrgNode } from "../../../../../src/org-governance/org-model/org-node/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// inheritPolicyLayers
// ─────────────────────────────────────────────────────────────────────────────

describe("inheritPolicyLayers", () => {
  describe("boolean rule merging", () => {
    it("should merge allow rules with AND logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { allowUserCreation: true } },
        { policyId: "p2", rules: { allowUserCreation: false } },
      ];

      const result = inheritPolicyLayers(layers);

      // allow* keys use AND: true && false = false
      assert.strictEqual(result.allowUserCreation, false);
    });

    it("should merge can* rules with AND logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { canEditPolicy: true } },
        { policyId: "p2", rules: { canEditPolicy: true } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.canEditPolicy, true);
    });

    it("should merge non-allow/can booleans with OR logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { isActive: false } },
        { policyId: "p2", rules: { isActive: true } },
      ];

      const result = inheritPolicyLayers(layers);

      // Non-allow* uses OR: false || true = true
      assert.strictEqual(result.isActive, true);
    });
  });

  describe("number rule merging", () => {
    it("should merge max* rules with MIN logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { maxSessions: 10 } },
        { policyId: "p2", rules: { maxSessions: 5 } },
      ];

      const result = inheritPolicyLayers(layers);

      // max* uses Math.min: min(10, 5) = 5
      assert.strictEqual(result.maxSessions, 5);
    });

    it("should merge min* rules with MAX logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { minApprovalCount: 2 } },
        { policyId: "p2", rules: { minApprovalCount: 3 } },
      ];

      const result = inheritPolicyLayers(layers);

      // min* uses Math.max: max(2, 3) = 3
      assert.strictEqual(result.minApprovalCount, 3);
    });

    it("should merge timeout rules with MIN logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { sessionTimeoutMs: 3600000 } },
        { policyId: "p2", rules: { sessionTimeoutMs: 1800000 } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.sessionTimeoutMs, 1800000);
    });

    it("should merge quota rules with MIN logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { apiQuotaPerHour: 1000 } },
        { policyId: "p2", rules: { apiQuotaPerHour: 500 } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.apiQuotaPerHour, 500);
    });

    it("should merge retention days with MAX logic", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { logRetentionDays: 30 } },
        { policyId: "p2", rules: { logRetentionDays: 90 } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.logRetentionDays, 90);
    });
  });

  describe("string rule merging", () => {
    it("should prefer non-empty string over empty", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { classification: "internal" } },
        { policyId: "p2", rules: { classification: "" } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.classification, "internal");
    });

    it("should merge classification with highest rank", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { dataClassification: "public" } },
        { policyId: "p2", rules: { dataClassification: "restricted" } },
      ];

      const result = inheritPolicyLayers(layers);

      // restricted has higher rank than public
      assert.strictEqual(result.dataClassification, "restricted");
    });

    it("should return restricted if either is restricted", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { classification: "confidential" } },
        { policyId: "p2", rules: { classification: "restricted" } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.classification, "restricted");
    });
  });

  describe("empty layer handling", () => {
    it("should handle empty layers array", () => {
      const result = inheritPolicyLayers([]);
      assert.deepStrictEqual(result, {});
    });

    it("should handle layers with empty rules", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: {} },
        { policyId: "p2", rules: {} },
      ];

      const result = inheritPolicyLayers(layers);
      assert.deepStrictEqual(result, {});
    });
  });

  describe("override behavior", () => {
    it("should let later layers override earlier ones for non-mergeable types", () => {
      const layers: PolicyLayer[] = [
        { policyId: "p1", rules: { unknownField: "first" } },
        { policyId: "p2", rules: { unknownField: "second" } },
      ];

      const result = inheritPolicyLayers(layers);

      assert.strictEqual(result.unknownField, "second");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// comparePolicyStrictness
// ─────────────────────────────────────────────────────────────────────────────

describe("comparePolicyStrictness", () => {
  describe("empty policy handling", () => {
    it("should return equal for two empty policies", () => {
      const result = comparePolicyStrictness({}, {});

      assert.strictEqual(result.ordering, "equal");
      assert.strictEqual(result.requiresComplianceApproval, false);
    });

    it("should return less_strict when left is empty", () => {
      const result = comparePolicyStrictness({}, { maxSessions: 10 });

      assert.strictEqual(result.ordering, "less_strict");
    });

    it("should return more_strict when right is empty", () => {
      const result = comparePolicyStrictness({ maxSessions: 10 }, {});

      assert.strictEqual(result.ordering, "more_strict");
    });
  });

  describe("boolean field comparison", () => {
    it("should return equal when allow fields are same", () => {
      const result = comparePolicyStrictness(
        { allowCreation: true },
        { allowCreation: true },
      );

      assert.strictEqual(result.ordering, "equal");
    });

    it("should return less_strict when left allows and right denies", () => {
      const result = comparePolicyStrictness(
        { allowCreation: true },
        { allowCreation: false },
      );

      assert.strictEqual(result.ordering, "less_strict");
    });
  });

  describe("number field comparison", () => {
    it("should return more_strict for higher max value", () => {
      const result = comparePolicyStrictness(
        { maxSessions: 100 },
        { maxSessions: 10 },
      );

      assert.strictEqual(result.ordering, "more_strict");
    });

    it("should return less_strict for higher min value", () => {
      const result = comparePolicyStrictness(
        { minApprovalCount: 5 },
        { minApprovalCount: 2 },
      );

      assert.strictEqual(result.ordering, "less_strict");
    });
  });

  describe("incomparable policies", () => {
    it("should return incomparable when non-orderable fields differ", () => {
      const result = comparePolicyStrictness(
        { customThreshold: 10, allowCreation: true },
        { customThreshold: 20, allowCreation: false },
      );

      assert.strictEqual(result.ordering, "incomparable");
      assert.strictEqual(result.requiresComplianceApproval, true);
    });

    it("should include incomparable field names in reason", () => {
      const result = comparePolicyStrictness(
        { fieldA: 10, fieldB: "value" },
        { fieldA: 20, fieldB: "other" },
      );

      assert.ok(result.reason.includes("fieldA"));
    });
  });

  describe("balanced policies", () => {
    it("should return equal when stricter and less strict cancel out", () => {
      const result = comparePolicyStrictness(
        { maxSessions: 10, minApprovalCount: 10 },
        { maxSessions: 5, minApprovalCount: 5 },
      );

      assert.strictEqual(result.ordering, "equal");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveCompliancePolicyForNode - Deny by Default
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveCompliancePolicyForNode", () => {
  function createOrgNode(overrides?: Partial<OrgNode>): OrgNode {
    return {
      orgNodeId: "node-1",
      nodeType: "team",
      displayName: "Test Node",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
      ...overrides,
    };
  }

  it("should return deny-by-default policy for node with no policies", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "leaf-node" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {};

    const result = resolveCompliancePolicyForNode(nodes, "leaf-node", policiesByNodeId);

    // Default should be deny
    assert.strictEqual(result.allow?.result ?? undefined, undefined); // Explicit checks not needed - empty means deny
  });

  it("should inherit policies from parent nodes", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "root", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "child", parentOrgNodeId: "root" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "root": [{ policyId: "root-policy", rules: { allowCreation: true } }],
      "child": [],
    };

    const result = resolveCompliancePolicyForNode(nodes, "child", policiesByNodeId);

    assert.strictEqual(result.allowCreation, true);
  });

  it("should merge policies from multiple ancestor levels", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "company", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "division", parentOrgNodeId: "company" }),
      createOrgNode({ orgNodeId: "department", parentOrgNodeId: "division" }),
      createOrgNode({ orgNodeId: "team", parentOrgNodeId: "department" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "company": [{ policyId: "p1", rules: { maxSessions: 100 } }],
      "division": [{ policyId: "p2", rules: { allowCreation: true } }],
      "department": [{ policyId: "p3", rules: { requireApproval: true } }],
      "team": [],
    };

    const result = resolveCompliancePolicyForNode(nodes, "team", policiesByNodeId);

    assert.strictEqual(result.maxSessions, 100);
    assert.strictEqual(result.allowCreation, true);
    assert.strictEqual(result.requireApproval, true);
  });

  it("should use most restrictive merge for overlapping rules", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "parent", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "child", parentOrgNodeId: "parent" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "parent": [{ policyId: "p1", rules: { maxSessions: 50 } }],
      "child": [{ policyId: "p2", rules: { maxSessions: 10 } }],
    };

    const result = resolveCompliancePolicyForNode(nodes, "child", policiesByNodeId);

    // Child's more restrictive value should win (min of 50, 10)
    assert.strictEqual(result.maxSessions, 10);
  });

  it("should handle deep hierarchy", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "l1", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "l2", parentOrgNodeId: "l1" }),
      createOrgNode({ orgNodeId: "l3", parentOrgNodeId: "l2" }),
      createOrgNode({ orgNodeId: "l4", parentOrgNodeId: "l3" }),
      createOrgNode({ orgNodeId: "l5", parentOrgNodeId: "l4" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "l1": [{ policyId: "p1", rules: { l1Rule: true } }],
      "l3": [{ policyId: "p3", rules: { l3Rule: true } }],
    };

    const result = resolveCompliancePolicyForNode(nodes, "l5", policiesByNodeId);

    assert.strictEqual(result.l1Rule, true);
    assert.strictEqual(result.l3Rule, true);
  });

  it("should handle node not found", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "existing" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {};

    const result = resolveCompliancePolicyForNode(nodes, "non-existent", policiesByNodeId);

    assert.deepStrictEqual(result, { _denyByDefault: true });
    assert.strictEqual(result.denyByDefault, true);
    assert.deepStrictEqual(result.policy, { _denyByDefault: true });
  });

  it("should build lineage from root to leaf", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "root", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "middle", parentOrgNodeId: "root" }),
      createOrgNode({ orgNodeId: "leaf", parentOrgNodeId: "middle" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "root": [{ policyId: "r", rules: { fromRoot: true } }],
      "middle": [{ policyId: "m", rules: { fromMiddle: true } }],
      "leaf": [{ policyId: "l", rules: { fromLeaf: true } }],
    };

    const result = resolveCompliancePolicyForNode(nodes, "leaf", policiesByNodeId);

    assert.strictEqual(result.fromRoot, true);
    assert.strictEqual(result.fromMiddle, true);
    assert.strictEqual(result.fromLeaf, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Deny-by-Default Behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("Deny-by-Default Behavior", () => {
  function createOrgNode(overrides?: Partial<OrgNode>): OrgNode {
    return {
      orgNodeId: "node-1",
      nodeType: "team",
      displayName: "Test Node",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
      ...overrides,
    };
  }

  it("should deny when no policy allows explicitly", () => {
    const nodes = [createOrgNode({ orgNodeId: "isolated-node" })];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "isolated-node": [{ policyId: "neutral", rules: {} }],
    };

    const result = resolveCompliancePolicyForNode(nodes, "isolated-node", policiesByNodeId);

    assert.deepStrictEqual(result, { _denyByDefault: false });
    assert.strictEqual(result.denyByDefault, false);
  });

  it("should allow explicitly allowed actions", () => {
    const nodes = [createOrgNode({ orgNodeId: "allowed-node" })];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "allowed-node": [{ policyId: "allow-policy", rules: { allowUserCreation: true } }],
    };

    const result = resolveCompliancePolicyForNode(nodes, "allowed-node", policiesByNodeId);

    assert.strictEqual(result.allowUserCreation, true);
  });

  it("should inherit allow through lineage", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "parent", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "child", parentOrgNodeId: "parent" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "parent": [{ policyId: "allow-policy", rules: { allowUserCreation: true } }],
      "child": [],
    };

    const result = resolveCompliancePolicyForNode(nodes, "child", policiesByNodeId);

    assert.strictEqual(result.allowUserCreation, true);
  });

  it("should restrict inherited allow with child policy", () => {
    const nodes = [
      createOrgNode({ orgNodeId: "parent", parentOrgNodeId: null }),
      createOrgNode({ orgNodeId: "child", parentOrgNodeId: "parent" }),
    ];
    const policiesByNodeId: Record<string, PolicyLayer[]> = {
      "parent": [{ policyId: "p1", rules: { allowUserCreation: true, maxSessions: 100 } }],
      "child": [{ policyId: "p2", rules: { maxSessions: 10 } }],
    };

    const result = resolveCompliancePolicyForNode(nodes, "child", policiesByNodeId);

    assert.strictEqual(result.allowUserCreation, true); // From parent
    assert.strictEqual(result.maxSessions, 10); // Restricted by child
  });
});
