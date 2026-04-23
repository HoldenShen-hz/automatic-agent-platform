/**
 * Unit tests for OrgNode schemas and functions
 *
 * @see src/org-governance/org-model/org-node/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  OrgNodeSchema,
  OrgNodeTypeSchema,
  isLeafOrgNode,
  getPlatformMapping,
  validateHierarchyDepth,
  createCrossOrgCollaborator,
  type OrgNode,
  type OrgNodeType,
  type CrossOrgCollaborator,
} from "../../../../src/org-governance/org-model/org-node/index.js";

// Helper to create org nodes
function createNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId ?? "node-1",
    displayName: overrides.displayName ?? "Node",
    nodeType: overrides.nodeType ?? "company",
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    metadata: overrides.metadata ?? {},
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    ...overrides,
  };
}

test("OrgNodeTypeSchema accepts valid node types", () => {
  const types: OrgNodeType[] = ["company", "division", "department", "team", "member"];
  for (const type of types) {
    const result = OrgNodeTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Type ${type} should be valid`);
  }
});

test("OrgNodeTypeSchema rejects invalid node type", () => {
  const result = OrgNodeTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("OrgNodeSchema parses valid org node", () => {
  const node = createNode({ orgNodeId: "company-1", nodeType: "company" });
  const result = OrgNodeSchema.safeParse(node);
  assert.equal(result.success, true);
});

test("OrgNodeSchema requires non-empty orgNodeId", () => {
  const result = OrgNodeSchema.safeParse({ orgNodeId: "", nodeType: "company", displayName: "Test" });
  assert.equal(result.success, false);
});

test("OrgNodeSchema requires non-empty displayName", () => {
  const result = OrgNodeSchema.safeParse({ orgNodeId: "node-1", nodeType: "company", displayName: "" });
  assert.equal(result.success, false);
});

test("OrgNodeSchema has correct defaults", () => {
  const result = OrgNodeSchema.safeParse({ orgNodeId: "node-1", nodeType: "company", displayName: "Test" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.parentOrgNodeId, null);
    assert.deepEqual(result.data.ownerUserIds, []);
    assert.deepEqual(result.data.metadata, {});
    assert.equal(result.data.active, true);
    assert.equal(result.data.costCenter, "");
  }
});

test("isLeafOrgNode returns true for member node", () => {
  const node = createNode({ nodeType: "member" });
  assert.equal(isLeafOrgNode(node), true);
});

test("isLeafOrgNode returns false for non-member node", () => {
  const node = createNode({ nodeType: "team" });
  assert.equal(isLeafOrgNode(node), false);
});

test("getPlatformMapping returns correct mappings", () => {
  assert.equal(getPlatformMapping("company"), "platform");
  assert.equal(getPlatformMapping("division"), "tenant_group");
  assert.equal(getPlatformMapping("department"), "tenant");
  assert.equal(getPlatformMapping("team"), "domain/pack_group");
  assert.equal(getPlatformMapping("member"), "principal");
});

test("validateHierarchyDepth returns valid for empty array", () => {
  const result = validateHierarchyDepth([]);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 0);
});

test("validateHierarchyDepth returns invalid when no root", () => {
  const nodes = [
    createNode({ orgNodeId: "node-1", nodeType: "team", parentOrgNodeId: "unknown" }),
  ];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, false);
});

test("validateHierarchyDepth returns valid for single root node", () => {
  const nodes = [createNode({ orgNodeId: "company", nodeType: "company" })];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 1);
});

test("validateHierarchyDepth returns valid for hierarchy within 5 levels", () => {
  const nodes = [
    createNode({ orgNodeId: "company", nodeType: "company" }),
    createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    createNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
    createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept" }),
    createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
  ];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 5);
});

test("validateHierarchyDepth returns invalid when depth exceeds 5", () => {
  const nodes = [
    createNode({ orgNodeId: "company", nodeType: "company" }),
    createNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "company" }),
    createNode({ orgNodeId: "d2", nodeType: "division", parentOrgNodeId: "d1" }),
    createNode({ orgNodeId: "d3", nodeType: "department", parentOrgNodeId: "d2" }),
    createNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "d3" }),
    createNode({ orgNodeId: "t2", nodeType: "team", parentOrgNodeId: "t1" }),
    createNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t2" }),
  ];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, false);
  assert.equal(result.depth, 7);
});

test("createCrossOrgCollaborator creates valid collaborator", () => {
  const input = {
    userId: "user-1",
    homeOrgNodeId: "home-org",
    targetOrgNodeId: "target-org",
    role: "guest" as const,
    scope: {
      targetOrgNodeId: "target-org",
      allowedDomains: ["domain-1"],
      allowedActions: ["view"] as const,
      expiresAt: null,
    },
    grantedBy: "admin-1",
  };

  const collaborator = createCrossOrgCollaborator(input);

  assert.equal(collaborator.collaboratorId, "collab:user-1:target-org");
  assert.equal(collaborator.userId, "user-1");
  assert.equal(collaborator.homeOrgNodeId, "home-org");
  assert.equal(collaborator.targetOrgNodeId, "target-org");
  assert.equal(collaborator.role, "guest");
  assert.equal(collaborator.grantedBy, "admin-1");
  assert.equal(collaborator.active, true);
  assert.ok(collaborator.grantedAt);
});

test("createCrossOrgCollaborator generates ISO timestamp", () => {
  const input = {
    userId: "user-1",
    homeOrgNodeId: "home-org",
    targetOrgNodeId: "target-org",
    role: "contractor" as const,
    scope: {
      targetOrgNodeId: "target-org",
      allowedDomains: [],
      allowedActions: ["execute"] as const,
      expiresAt: "2026-12-31T23:59:59Z",
    },
    grantedBy: "admin-1",
  };

  const collaborator = createCrossOrgCollaborator(input);
  const timestamp = Date.parse(collaborator.grantedAt);

  assert.ok(!isNaN(timestamp));
  assert.ok(timestamp <= Date.now());
});
