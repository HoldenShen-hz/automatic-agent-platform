/**
 * Unit tests for OrgModel Service - OrgNode and Reporting Chain
 *
 * @see src/org-governance/org-model/org-node/index.ts
 * @see src/org-governance/org-model/hierarchy/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { OrgNode, OrgNodeType, OrgChangeEvent } from "../../../../src/org-governance/org-model/org-node/index.js";
import {
  OrgNodeTypeSchema,
  OrgNodeSchema,
  isLeafOrgNode,
  getPlatformMapping,
  validateHierarchyDepth,
  createCrossOrgCollaborator,
} from "../../../../src/org-governance/org-model/org-node/index.js";
import {
  validateOrgHierarchy,
  listAncestorNodeIds,
  listDescendantNodeIds,
  findRootNode,
  getNodesAtLevel,
  getNodeDepth,
  findLowestCommonAncestor,
  buildReportingChain,
  detectOrgChangeEvents,
} from "../../../../src/org-governance/org-model/hierarchy/index.js";

// Helper to create org nodes with sensible defaults
function createOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId ?? "node-1",
    nodeType: overrides.nodeType ?? "department",
    displayName: overrides.displayName ?? "Test Node",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
  };
}

test("OrgNodeTypeSchema should accept all valid org node types", () => {
  const validTypes: OrgNodeType[] = ["company", "division", "department", "team", "member"];
  for (const type of validTypes) {
    const result = OrgNodeTypeSchema.safeParse(type);
    assert.strictEqual(result.success, true, `Type ${type} should be valid`);
  }
});

test("OrgNodeTypeSchema should reject invalid org node types", () => {
  const result = OrgNodeTypeSchema.safeParse("invalid_type");
  assert.strictEqual(result.success, false);
});

test("OrgNodeTypeSchema should reject empty string", () => {
  const result = OrgNodeTypeSchema.safeParse("");
  assert.strictEqual(result.success, false);
});

test("OrgNodeSchema should parse a valid org node with all fields", () => {
  const node = {
    orgNodeId: "company-1",
    nodeType: "company",
    displayName: "Acme Corp",
    parentOrgNodeId: null,
    ownerUserIds: ["ceo-1"],
    active: true,
    costCenter: "CC-001",
    metadata: { region: "US" },
  };

  const result = OrgNodeSchema.safeParse(node);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.orgNodeId, "company-1");
    assert.strictEqual(result.data.nodeType, "company");
    assert.strictEqual(result.data.displayName, "Acme Corp");
    assert.strictEqual(result.data.parentOrgNodeId, null);
    assert.deepStrictEqual(result.data.ownerUserIds, ["ceo-1"]);
    assert.strictEqual(result.data.active, true);
    assert.strictEqual(result.data.costCenter, "CC-001");
    assert.deepStrictEqual(result.data.metadata, { region: "US" });
  }
});

test("OrgNodeSchema should apply default values for optional fields", () => {
  const minimal = {
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Engineering",
    parentOrgNodeId: "div-1",
  };

  const result = OrgNodeSchema.safeParse(minimal);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.deepStrictEqual(result.data.ownerUserIds, []);
    assert.strictEqual(result.data.active, true);
    assert.strictEqual(result.data.costCenter, "");
    assert.deepStrictEqual(result.data.metadata, {});
  }
});

test("OrgNodeSchema should reject empty orgNodeId", () => {
  const result = OrgNodeSchema.safeParse({
    orgNodeId: "",
    nodeType: "team",
    displayName: "Test",
  });
  assert.strictEqual(result.success, false);
});

test("OrgNodeSchema should reject empty displayName", () => {
  const result = OrgNodeSchema.safeParse({
    orgNodeId: "node-1",
    nodeType: "team",
    displayName: "",
  });
  assert.strictEqual(result.success, false);
});

test("OrgNodeSchema should accept nullable parentOrgNodeId", () => {
  const result = OrgNodeSchema.safeParse({
    orgNodeId: "company-1",
    nodeType: "company",
    displayName: "Root",
    parentOrgNodeId: null,
  });
  assert.strictEqual(result.success, true);
});

test("OrgNodeSchema should accept string parentOrgNodeId", () => {
  const result = OrgNodeSchema.safeParse({
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Engineering",
    parentOrgNodeId: "div-1",
  });
  assert.strictEqual(result.success, true);
});

test("OrgNodeSchema should reject invalid nodeType", () => {
  const result = OrgNodeSchema.safeParse({
    orgNodeId: "node-1",
    nodeType: "invalid",
    displayName: "Test",
  });
  assert.strictEqual(result.success, false);
});

test("isLeafOrgNode should return true for member nodes", () => {
  const memberNode = createOrgNode({
    orgNodeId: "member-1",
    nodeType: "member",
    displayName: "John Doe",
    parentOrgNodeId: "team-1",
    ownerUserIds: ["user-1"],
  });
  assert.strictEqual(isLeafOrgNode(memberNode), true);
});

test("isLeafOrgNode should return false for company nodes", () => {
  const companyNode = createOrgNode({
    orgNodeId: "company-1",
    nodeType: "company",
    displayName: "Acme Corp",
    parentOrgNodeId: null,
  });
  assert.strictEqual(isLeafOrgNode(companyNode), false);
});

test("isLeafOrgNode should return false for division nodes", () => {
  const divisionNode = createOrgNode({
    orgNodeId: "division-1",
    nodeType: "division",
    displayName: "Engineering",
    parentOrgNodeId: "company-1",
  });
  assert.strictEqual(isLeafOrgNode(divisionNode), false);
});

test("isLeafOrgNode should return false for department nodes", () => {
  const departmentNode = createOrgNode({
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Platform",
    parentOrgNodeId: "division-1",
  });
  assert.strictEqual(isLeafOrgNode(departmentNode), false);
});

test("isLeafOrgNode should return false for team nodes", () => {
  const teamNode = createOrgNode({
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Backend Team",
    parentOrgNodeId: "dept-1",
  });
  assert.strictEqual(isLeafOrgNode(teamNode), false);
});

test("getPlatformMapping should map company to platform", () => {
  assert.strictEqual(getPlatformMapping("company"), "platform");
});

test("getPlatformMapping should map division to tenant_group", () => {
  assert.strictEqual(getPlatformMapping("division"), "tenant_group");
});

test("getPlatformMapping should map department to tenant", () => {
  assert.strictEqual(getPlatformMapping("department"), "tenant");
});

test("getPlatformMapping should map team to domain/pack_group", () => {
  assert.strictEqual(getPlatformMapping("team"), "domain/pack_group");
});

test("getPlatformMapping should map member to principal", () => {
  assert.strictEqual(getPlatformMapping("member"), "principal");
});

test("createCrossOrgCollaborator should create collaborator with generated ID", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "user-guest-1",
    homeOrgNodeId: "partner-company",
    targetOrgNodeId: "dept-eng",
    role: "guest",
    scope: {
      targetOrgNodeId: "dept-eng",
      allowedDomains: ["code-review", "documentation"],
      allowedActions: ["view", "execute"],
      expiresAt: "2026-12-31T23:59:59Z",
    },
    grantedBy: "org-admin-1",
  });

  assert.ok(collaborator.collaboratorId.startsWith("collab:user-guest-1:"));
  assert.strictEqual(collaborator.active, true);
  assert.ok(collaborator.grantedAt);
});

test("createCrossOrgCollaborator should create collaborator with all roles", () => {
  const roles: Array<"guest" | "consultant" | "contractor" | "partner"> = [
    "guest",
    "consultant",
    "contractor",
    "partner",
  ];

  for (const role of roles) {
    const collaborator = createCrossOrgCollaborator({
      userId: `user-${role}`,
      homeOrgNodeId: "partner",
      targetOrgNodeId: "dept-eng",
      role,
      scope: {
        targetOrgNodeId: "dept-eng",
        allowedDomains: ["code-review"],
        allowedActions: ["view"],
        expiresAt: null,
      },
      grantedBy: "admin",
    });

    assert.strictEqual(collaborator.role, role);
  }
});

test("buildReportingChain should build reporting chain for employee", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", ownerUserIds: ["vp"], parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "division" }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", ownerUserIds: ["manager"], parentOrgNodeId: "dept" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "team" }),
  ];

  const chain = buildReportingChain(nodes, "employee", "member");

  // Function traverses all the way up to root (company) and includes all owners
  assert.deepStrictEqual(chain, ["manager", "director", "vp", "ceo"]);
});

test("buildReportingChain should build reporting chain stopping at node with no owners", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", ownerUserIds: [], parentOrgNodeId: "company" }), // no owner
    createOrgNode({ orgNodeId: "dept", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "division" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "dept" }),
  ];

  const chain = buildReportingChain(nodes, "employee", "member");

  // Should skip division (no owners) but include company CEO
  assert.deepStrictEqual(chain, ["director", "ceo"]);
});

test("buildReportingChain should build reporting chain for top-level employee", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "company" }),
  ];

  const chain = buildReportingChain(nodes, "employee", "member");

  assert.deepStrictEqual(chain, ["ceo"]);
});

test("buildReportingChain should return empty chain when node has no parent", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
  ];

  const chain = buildReportingChain(nodes, "ceo", "company");

  assert.deepStrictEqual(chain, []);
});

test("buildReportingChain should return empty chain when node not found", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
  ];

  const chain = buildReportingChain(nodes, "unknown", "nonexistent");

  assert.deepStrictEqual(chain, []);
});

test("buildReportingChain should use first owner when node has multiple owners", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", ownerUserIds: ["vp1", "vp2"], parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "division" }),
  ];

  const chain = buildReportingChain(nodes, "employee", "member");

  // Should use first owner (vp1), then include CEO from company level
  assert.deepStrictEqual(chain, ["vp1", "ceo"]);
});

test("buildReportingChain should handle deep hierarchy with 5 levels", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "c1", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "d1", nodeType: "division", ownerUserIds: ["vp"], parentOrgNodeId: "c1" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "d1" }),
    createOrgNode({ orgNodeId: "t1", nodeType: "team", ownerUserIds: ["manager"], parentOrgNodeId: "dept1" }),
    createOrgNode({ orgNodeId: "m1", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "t1" }),
  ];

  const chain = buildReportingChain(nodes, "employee", "m1");

  // Function traverses up to company level and includes all owners
  assert.deepStrictEqual(chain, ["manager", "director", "vp", "ceo"]);
});

test("buildReportingChain should skip nodes with empty ownerUserIds array", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "c1", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "d1", nodeType: "division", ownerUserIds: [], parentOrgNodeId: "c1" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "d1" }),
    createOrgNode({ orgNodeId: "m1", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "dept1" }),
  ];

  const chain = buildReportingChain(nodes, "employee", "m1");

  // Should skip division (no owners) but include CEO from company level
  assert.deepStrictEqual(chain, ["director", "ceo"]);
});

test("validateOrgHierarchy should pass for valid flat hierarchy", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.strictEqual(findings.length, 0);
});

test("validateOrgHierarchy should pass for valid 5-level hierarchy", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
    createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
    createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.strictEqual(findings.length, 0);
});

test("validateOrgHierarchy should detect missing parent reference", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "nonexistent" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.ok(findings.some((f) => f.includes("org_hierarchy.missing_parent")));
});

test("validateOrgHierarchy should detect self-cycle", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: "company" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.ok(findings.some((f) => f.includes("org_hierarchy.self_cycle")));
});

test("validateOrgHierarchy should detect hierarchy exceeding max depth", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
    createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
    createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
    createOrgNode({ orgNodeId: "p1", nodeType: "member", parentOrgNodeId: "m1" }), // 6th level - exceeds 5
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.ok(findings.some((f) => f.includes("org_hierarchy.exceeds_max_depth")));
});

test("validateOrgHierarchy should return empty for empty nodes array", () => {
  const findings = validateOrgHierarchy([]);

  assert.strictEqual(findings.length, 0);
});

test("validateHierarchyDepth should return valid for empty nodes", () => {
  const result = validateHierarchyDepth([]);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.depth, 0);
});

test("validateHierarchyDepth should return invalid when no root node exists", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "nonexistent" }),
  ];

  const result = validateHierarchyDepth(nodes);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.depth, 0);
});

test("validateHierarchyDepth should return valid for single root node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const result = validateHierarchyDepth(nodes);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.depth, 1);
});

test("validateHierarchyDepth should calculate correct depth for flat hierarchy", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "company" }),
  ];

  const result = validateHierarchyDepth(nodes);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.depth, 2);
});

test("validateHierarchyDepth should calculate correct depth for full 5-level hierarchy", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
    createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
    createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
  ];

  const result = validateHierarchyDepth(nodes);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.depth, 5);
});

test("validateHierarchyDepth should return invalid for 6-level hierarchy", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
    createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
    createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
    createOrgNode({ orgNodeId: "p1", nodeType: "member", parentOrgNodeId: "m1" }),
  ];

  const result = validateHierarchyDepth(nodes);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.depth, 6);
});

test("listAncestorNodeIds should return ancestors in correct order (bottom to top)", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "department", nodeType: "department", parentOrgNodeId: "division" }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "department" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
  ];

  const ancestors = listAncestorNodeIds(nodes, "member");

  assert.deepStrictEqual(ancestors, ["team", "department", "division", "company"]);
});

test("listAncestorNodeIds should return empty array for root node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const ancestors = listAncestorNodeIds(nodes, "company");

  assert.deepStrictEqual(ancestors, []);
});

test("listAncestorNodeIds should return empty array for nonexistent node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const ancestors = listAncestorNodeIds(nodes, "nonexistent");

  assert.deepStrictEqual(ancestors, []);
});

test("listAncestorNodeIds should handle single level parent", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const ancestors = listAncestorNodeIds(nodes, "division");

  assert.deepStrictEqual(ancestors, ["company"]);
});

test("listDescendantNodeIds should return all descendants", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
  ];

  const descendants = listDescendantNodeIds(nodes, "company");

  assert.deepStrictEqual(new Set(descendants), new Set(["division", "dept", "team", "member"]));
});

test("listDescendantNodeIds should return empty array for leaf node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company" }),
  ];

  const descendants = listDescendantNodeIds(nodes, "member");

  assert.deepStrictEqual(descendants, []);
});

test("listDescendantNodeIds should return empty array for nonexistent node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const descendants = listDescendantNodeIds(nodes, "nonexistent");

  assert.deepStrictEqual(descendants, []);
});

test("listDescendantNodeIds should return direct children only", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
  ];

  const descendants = listDescendantNodeIds(nodes, "division");

  assert.deepStrictEqual(descendants.sort(), ["dept"]);
});

test("findRootNode should find root node (company)", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const root = findRootNode(nodes);

  assert.ok(root);
  assert.strictEqual(root.orgNodeId, "company");
  assert.strictEqual(root.nodeType, "company");
});

test("findRootNode should return null for empty array", () => {
  const root = findRootNode([]);

  assert.strictEqual(root, null);
});

test("findRootNode should return null when no root exists", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "nonexistent" }),
  ];

  const root = findRootNode(nodes);

  assert.strictEqual(root, null);
});

test("getNodesAtLevel should get nodes at level 0 (root)", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const level0 = getNodesAtLevel(nodes, 0);

  assert.strictEqual(level0.length, 1);
  assert.strictEqual(level0[0]?.orgNodeId, "company");
});

test("getNodesAtLevel should get nodes at level 1", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division1", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "division2", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const level1 = getNodesAtLevel(nodes, 1);

  assert.strictEqual(level1.length, 2);
  assert.ok(level1.some((n) => n.orgNodeId === "division1"));
  assert.ok(level1.some((n) => n.orgNodeId === "division2"));
});

test("getNodesAtLevel should return empty array for level with no nodes", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const level2 = getNodesAtLevel(nodes, 2);

  assert.strictEqual(level2.length, 0);
});

test("getNodeDepth should return 0 for root node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const depth = getNodeDepth(nodes, "company");

  assert.strictEqual(depth, 0);
});

test("getNodeDepth should return correct depth for nested nodes", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
  ];

  assert.strictEqual(getNodeDepth(nodes, "company"), 0);
  assert.strictEqual(getNodeDepth(nodes, "division"), 1);
  assert.strictEqual(getNodeDepth(nodes, "dept"), 2);
  assert.strictEqual(getNodeDepth(nodes, "team"), 3);
  assert.strictEqual(getNodeDepth(nodes, "member"), 4);
});

test("getNodeDepth should return 0 for nonexistent node", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const depth = getNodeDepth(nodes, "nonexistent");

  assert.strictEqual(depth, 0);
});

test("findLowestCommonAncestor should find LCA for sibling nodes", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "division" }),
    createOrgNode({ orgNodeId: "dept2", nodeType: "department", parentOrgNodeId: "division" }),
  ];

  const lca = findLowestCommonAncestor(nodes, "dept1", "dept2");

  assert.strictEqual(lca, "division");
});

test("findLowestCommonAncestor should find LCA when one node is ancestor of other", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
  ];

  const lca = findLowestCommonAncestor(nodes, "division", "dept");

  assert.strictEqual(lca, "division");
});

test("findLowestCommonAncestor should return company when one node is ancestor of other", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
  ];

  const lca = findLowestCommonAncestor(nodes, "company", "division");

  assert.strictEqual(lca, "company");
});

test("findLowestCommonAncestor should return null for nonexistent nodes", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const lca = findLowestCommonAncestor(nodes, "nonexistent1", "nonexistent2");

  assert.strictEqual(lca, null);
});

test("detectOrgChangeEvents should detect employee onboarding", () => {
  const before: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];
  const after: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
  ];

  const events = detectOrgChangeEvents(before, after);

  assert.ok(events.some((e) => e.type === "employee_onboarding"));
  const onboarding = events.find((e) => e.type === "employee_onboarding") as { type: "employee_onboarding"; userId: string; teamId: string; managerId: string };
  assert.strictEqual(onboarding.userId, "user-1");
  assert.strictEqual(onboarding.teamId, "company");
});

test("detectOrgChangeEvents should detect employee offboarding", () => {
  const before: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
  ];
  const after: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const events = detectOrgChangeEvents(before, after);

  assert.ok(events.some((e) => e.type === "employee_offboarding"));
  const offboarding = events.find((e) => e.type === "employee_offboarding") as { type: "employee_offboarding"; userId: string; teamId: string };
  assert.strictEqual(offboarding.userId, "user-1");
  assert.strictEqual(offboarding.teamId, "company");
});

test("detectOrgChangeEvents should detect employee transfer", () => {
  const before: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "team1", nodeType: "team", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "team2", nodeType: "team", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team1", ownerUserIds: ["user-1"] }),
  ];
  const after: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "team1", nodeType: "team", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "team2", nodeType: "team", parentOrgNodeId: "company" }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team2", ownerUserIds: ["user-1"] }),
  ];

  const events = detectOrgChangeEvents(before, after);

  assert.ok(events.some((e) => e.type === "employee_transfer"));
  const transfer = events.find((e) => e.type === "employee_transfer") as { type: "employee_transfer"; userId: string; fromTeamId: string; toTeamId: string; newManagerId: string };
  assert.strictEqual(transfer.userId, "user-1");
  assert.strictEqual(transfer.fromTeamId, "team1");
  assert.strictEqual(transfer.toTeamId, "team2");
});

test("detectOrgChangeEvents should return empty array when no changes", () => {
  const nodes: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
  ];

  const events = detectOrgChangeEvents(nodes, nodes);

  assert.strictEqual(events.length, 0);
});

test("detectOrgChangeEvents should detect multiple events", () => {
  const before: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member1", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
  ];
  const after: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "member1", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-2"] }), // changed owner
    createOrgNode({ orgNodeId: "member2", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-3"] }), // new
  ];

  const events = detectOrgChangeEvents(before, after);

  assert.ok(events.some((e) => e.type === "employee_onboarding"));
  // Note: user-1 to user-2 is not a transfer, it's just an owner change on existing node
});

test("detectOrgChangeEvents should ignore non-member nodes for offboarding/onboarding", () => {
  const before: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
    createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company" }),
  ];
  const after: OrgNode[] = [
    createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
  ];

  const events = detectOrgChangeEvents(before, after);

  // Team removal should not trigger offboarding (only members)
  assert.ok(!events.some((e) => e.type === "employee_offboarding"));
});
