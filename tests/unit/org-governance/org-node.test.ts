/**
 * Unit tests for org-model/org-node module
 *
 * @see src/org-governance/org-model/org-node/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  OrgNodeTypeSchema,
  OrgNodeSchema,
  isLeafOrgNode,
  getPlatformMapping,
  validateHierarchyDepth,
  createCrossOrgCollaborator,
  type OrgNode,
  type OrgNodeType,
  type CollaboratorRole,
} from "../../../src/org-governance/org-model/org-node/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OrgNodeTypeSchema validates all valid node types", () => {
  assert.equal(OrgNodeTypeSchema.parse("company"), "company");
  assert.equal(OrgNodeTypeSchema.parse("division"), "division");
  assert.equal(OrgNodeTypeSchema.parse("department"), "department");
  assert.equal(OrgNodeTypeSchema.parse("team"), "team");
  assert.equal(OrgNodeTypeSchema.parse("member"), "member");
});

test("OrgNodeTypeSchema rejects invalid node type", () => {
  assert.throws(() => OrgNodeTypeSchema.parse("invalid"));
  assert.throws(() => OrgNodeTypeSchema.parse("root"));
  assert.throws(() => OrgNodeTypeSchema.parse(""));
});

test("OrgNodeSchema validates complete org node", () => {
  const node = OrgNodeSchema.parse({
    orgNodeId: "node-1",
    nodeType: "department",
    displayName: "Engineering",
    parentOrgNodeId: "division-1",
    ownerUserIds: ["user-1", "user-2"],
    active: true,
    costCenter: "CC-123",
    metadata: { region: "us-west" },
  });

  assert.equal(node.orgNodeId, "node-1");
  assert.equal(node.nodeType, "department");
  assert.equal(node.displayName, "Engineering");
  assert.equal(node.parentOrgNodeId, "division-1");
  assert.deepStrictEqual(node.ownerUserIds, ["user-1", "user-2"]);
  assert.equal(node.active, true);
  assert.equal(node.costCenter, "CC-123");
  assert.deepStrictEqual(node.metadata, { region: "us-west" });
});

test("OrgNodeSchema applies defaults", () => {
  const node = OrgNodeSchema.parse({
    orgNodeId: "node-1",
    nodeType: "team",
    displayName: "Team Alpha",
    parentOrgNodeId: "dept-1",
  });

  assert.equal(node.parentOrgNodeId, "dept-1");
  assert.deepStrictEqual(node.ownerUserIds, []);
  assert.equal(node.active, true);
  assert.equal(node.costCenter, "");
  assert.deepStrictEqual(node.metadata, {});
});

test("OrgNodeSchema allows null parentOrgNodeId for root", () => {
  const root = OrgNodeSchema.parse({
    orgNodeId: "company-1",
    nodeType: "company",
    displayName: "Acme Corp",
    parentOrgNodeId: null,
  });

  assert.equal(root.parentOrgNodeId, null);
});

test("OrgNodeSchema rejects empty orgNodeId", () => {
  assert.throws(() => OrgNodeSchema.parse({
    orgNodeId: "",
    nodeType: "department",
    displayName: "Test",
  }));
});

test("OrgNodeSchema rejects empty displayName", () => {
  assert.throws(() => OrgNodeSchema.parse({
    orgNodeId: "node-1",
    nodeType: "department",
    displayName: "",
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// isLeafOrgNode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isLeafOrgNode returns true for member node", () => {
  const member: OrgNode = {
    orgNodeId: "member-1",
    nodeType: "member",
    displayName: "John Doe",
    parentOrgNodeId: "team-1",
    ownerUserIds: ["user-1"],
    active: true,
    costCenter: "",
    metadata: {},
  };

  assert.equal(isLeafOrgNode(member), true);
});

test("isLeafOrgNode returns false for team node", () => {
  const team: OrgNode = {
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Platform Team",
    parentOrgNodeId: "dept-1",
    ownerUserIds: ["manager-1"],
    active: true,
    costCenter: "",
    metadata: {},
  };

  assert.equal(isLeafOrgNode(team), false);
});

test("isLeafOrgNode returns false for company node", () => {
  const company: OrgNode = {
    orgNodeId: "company-1",
    nodeType: "company",
    displayName: "Acme Corp",
    parentOrgNodeId: null,
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
  };

  assert.equal(isLeafOrgNode(company), false);
});

test("isLeafOrgNode returns false for all non-member types", () => {
  const types: OrgNodeType[] = ["company", "division", "department", "team"];

  for (const nodeType of types) {
    const node: OrgNode = {
      orgNodeId: `${nodeType}-1`,
      nodeType,
      displayName: `Test ${nodeType}`,
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    };
    assert.equal(isLeafOrgNode(node), false, `Expected false for ${nodeType}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// getPlatformMapping Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPlatformMapping returns correct mappings", () => {
  assert.equal(getPlatformMapping("company"), "platform");
  assert.equal(getPlatformMapping("division"), "tenant_group");
  assert.equal(getPlatformMapping("department"), "tenant");
  assert.equal(getPlatformMapping("team"), "domain/pack_group");
  assert.equal(getPlatformMapping("member"), "principal");
});

test("getPlatformMapping returns consistent values", () => {
  const results = new Set<string>();
  const types: OrgNodeType[] = ["company", "division", "department", "team", "member"];

  for (const nodeType of types) {
    results.add(getPlatformMapping(nodeType));
  }

  assert.equal(results.size, 5, "All mappings should be unique");
});

// ─────────────────────────────────────────────────────────────────────────────
// validateHierarchyDepth Tests
// ─────────────────────────────────────────────────────────────────────────────

test("validateHierarchyDepth returns valid for empty array", () => {
  const result = validateHierarchyDepth([]);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 0);
});

test("validateHierarchyDepth returns invalid when no root", () => {
  const nodes: OrgNode[] = [
    {
      orgNodeId: "child-1",
      nodeType: "department",
      displayName: "Child",
      parentOrgNodeId: "nonexistent-parent",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];

  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, false);
  assert.equal(result.depth, 0);
});

test("validateHierarchyDepth returns valid for depth 5 (max allowed)", () => {
  const nodes: OrgNode[] = [];
  let parent: string | null = null;

  for (let i = 0; i < 5; i++) {
    const id = `node-${i}`;
    const nodeType: OrgNodeType = i === 4 ? "member" : "team";
    nodes.push({
      orgNodeId: id,
      nodeType,
      displayName: `Node ${i}`,
      parentOrgNodeId: parent,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    });
    parent = id;
  }

  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 5);
});

test("validateHierarchyDepth returns invalid for depth 6 (exceeds max)", () => {
  const nodes: OrgNode[] = [];
  let parent: string | null = null;

  for (let i = 0; i < 6; i++) {
    const id = `node-${i}`;
    const nodeType: OrgNodeType = i === 5 ? "member" : "team";
    nodes.push({
      orgNodeId: id,
      nodeType,
      displayName: `Node ${i}`,
      parentOrgNodeId: parent,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    });
    parent = id;
  }

  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, false);
  assert.equal(result.depth, 6);
});

test("validateHierarchyDepth returns correct depth for branching hierarchy", () => {
  const nodes: OrgNode[] = [
    {
      orgNodeId: "root",
      nodeType: "company",
      displayName: "Root",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "dept-1",
      nodeType: "department",
      displayName: "Dept 1",
      parentOrgNodeId: "root",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "dept-2",
      nodeType: "department",
      displayName: "Dept 2",
      parentOrgNodeId: "root",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "member-1",
      nodeType: "member",
      displayName: "Member 1",
      parentOrgNodeId: "dept-1",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "member-2",
      nodeType: "member",
      displayName: "Member 2",
      parentOrgNodeId: "dept-2",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];

  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, true);
  // Tree structure: root(1) -> dept(2) -> member(3). Max depth is 3.
  assert.equal(result.depth, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// createCrossOrgCollaborator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createCrossOrgCollaborator creates collaborator with guest role", () => {
  const input = {
    userId: "user-1",
    homeOrgNodeId: "company-home",
    targetOrgNodeId: "company-partner",
    role: "guest" as CollaboratorRole,
    scope: {
      targetOrgNodeId: "company-partner",
      allowedDomains: ["docs", "tasks"],
      allowedActions: ["view"] as const,
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
    grantedBy: "admin-user",
  };

  const collaborator = createCrossOrgCollaborator(input);

  assert.ok(collaborator.collaboratorId.startsWith("collab:"));
  assert.equal(collaborator.userId, "user-1");
  assert.equal(collaborator.homeOrgNodeId, "company-home");
  assert.equal(collaborator.targetOrgNodeId, "company-partner");
  assert.equal(collaborator.role, "guest");
  assert.equal(collaborator.grantedBy, "admin-user");
  assert.ok(collaborator.grantedAt.length > 0);
  assert.equal(collaborator.active, true);
});

test("createCrossOrgCollaborator generates unique collaboratorId", () => {
  const input = {
    userId: "user-1",
    homeOrgNodeId: "company-home",
    targetOrgNodeId: "company-partner",
    role: "contractor" as CollaboratorRole,
    scope: {
      targetOrgNodeId: "company-partner",
      allowedDomains: ["docs"],
      allowedActions: ["view", "execute"] as const,
      expiresAt: null,
    },
    grantedBy: "admin-user",
  };

  const collab1 = createCrossOrgCollaborator(input);

  const input2 = { ...input, userId: "user-2" };
  const collab2 = createCrossOrgCollaborator(input2);

  assert.notEqual(collab1.collaboratorId, collab2.collaboratorId);
  assert.ok(collab1.collaboratorId.includes("user-1"));
  assert.ok(collab2.collaboratorId.includes("user-2"));
});

test("createCrossOrgCollaborator handles all collaborator roles", () => {
  const roles: CollaboratorRole[] = ["guest", "consultant", "contractor", "partner"];

  for (const role of roles) {
    const input = {
      userId: `user-${role}`,
      homeOrgNodeId: "home",
      targetOrgNodeId: "target",
      role,
      scope: {
        targetOrgNodeId: "target",
        allowedDomains: [],
        allowedActions: ["view"] as const,
        expiresAt: null,
      },
      grantedBy: "admin",
    };

    const collaborator = createCrossOrgCollaborator(input);
    assert.equal(collaborator.role, role, `Role ${role} should be preserved`);
  }
});

test("createCrossOrgCollaborator sets grantedAt to current time", () => {
  const before = new Date().toISOString();

  const input = {
    userId: "user-1",
    homeOrgNodeId: "home",
    targetOrgNodeId: "target",
    role: "guest" as CollaboratorRole,
    scope: {
      targetOrgNodeId: "target",
      allowedDomains: [],
      allowedActions: ["view"] as const,
      expiresAt: null,
    },
    grantedBy: "admin",
  };

  const collaborator = createCrossOrgCollaborator(input);
  const after = new Date().toISOString();

  assert.ok(collaborator.grantedAt >= before);
  assert.ok(collaborator.grantedAt <= after);
});
