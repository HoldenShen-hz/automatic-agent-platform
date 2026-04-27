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
} from "../../../../../src/org-governance/org-model/org-node/index.js";

test("OrgNodeTypeSchema accepts valid node types", () => {
  const validTypes = ["company", "division", "department", "team", "member"] as const;
  for (const nodeType of validTypes) {
    const result = OrgNodeTypeSchema.parse(nodeType);
    assert.equal(result, nodeType);
  }
});

test("OrgNodeTypeSchema rejects invalid node types", () => {
  assert.throws(() => OrgNodeTypeSchema.parse("invalid"), /Invalid enum value/);
  assert.throws(() => OrgNodeTypeSchema.parse(""), /Invalid enum value/);
});

test("OrgNodeSchema parses valid org node", () => {
  const node: OrgNode = {
    orgNodeId: "node-1",
    nodeType: "company",
    displayName: "Acme Corp",
    parentOrgNodeId: null,
    ownerUserIds: ["user-1"],
    active: true,
    costCenter: "CC001",
    metadata: { region: "us-west" },
  };
  const result = OrgNodeSchema.parse(node);
  assert.equal(result.orgNodeId, "node-1");
  assert.equal(result.nodeType, "company");
  assert.equal(result.displayName, "Acme Corp");
  assert.equal(result.parentOrgNodeId, null);
});

test("OrgNodeSchema applies defaults", () => {
  const minimal = OrgNodeSchema.parse({
    orgNodeId: "node-1",
    nodeType: "team",
    displayName: "Engineering",
  });
  assert.deepEqual(minimal.ownerUserIds, []);
  assert.equal(minimal.active, true);
  assert.equal(minimal.costCenter, "");
  assert.deepEqual(minimal.metadata, {});
});

test("OrgNodeSchema rejects missing required fields", () => {
  assert.throws(() => OrgNodeSchema.parse({ nodeType: "company" }));
  assert.throws(() => OrgNodeSchema.parse({ orgNodeId: "id" }));
});

test("isLeafOrgNode returns true for member node", () => {
  const memberNode: OrgNode = {
    orgNodeId: "user-1",
    nodeType: "member",
    displayName: "John Doe",
    parentOrgNodeId: "team-1",
    ownerUserIds: ["user-1"],
    active: true,
    costCenter: "",
    metadata: {},
  };
  assert.equal(isLeafOrgNode(memberNode), true);
});

test("isLeafOrgNode returns false for non-member nodes", () => {
  const companyNode: OrgNode = {
    orgNodeId: "comp-1",
    nodeType: "company",
    displayName: "Acme",
    parentOrgNodeId: null,
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
  };
  const teamNode: OrgNode = {
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Engineering",
    parentOrgNodeId: "dept-1",
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
  };
  assert.equal(isLeafOrgNode(companyNode), false);
  assert.equal(isLeafOrgNode(teamNode), false);
});

test("getPlatformMapping returns correct mapping for each node type", () => {
  assert.equal(getPlatformMapping("company"), "platform");
  assert.equal(getPlatformMapping("division"), "tenant_group");
  assert.equal(getPlatformMapping("department"), "tenant");
  assert.equal(getPlatformMapping("team"), "domain/pack_group");
  assert.equal(getPlatformMapping("member"), "principal");
});

test("validateHierarchyDepth returns valid for empty nodes", () => {
  const result = validateHierarchyDepth([]);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 0);
});

test("validateHierarchyDepth returns invalid when no root", () => {
  const nodes: OrgNode[] = [
    {
      orgNodeId: "node-1",
      nodeType: "team",
      displayName: "Team",
      parentOrgNodeId: "non-existent",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, false);
});

test("validateHierarchyDepth returns depth for valid hierarchies", () => {
  const nodes: OrgNode[] = [
    {
      orgNodeId: "company-1",
      nodeType: "company",
      displayName: "Acme",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "division-1",
      nodeType: "division",
      displayName: "Tech",
      parentOrgNodeId: "company-1",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "dept-1",
      nodeType: "department",
      displayName: "Engineering",
      parentOrgNodeId: "division-1",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "team-1",
      nodeType: "team",
      displayName: "Backend",
      parentOrgNodeId: "dept-1",
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
    {
      orgNodeId: "member-1",
      nodeType: "member",
      displayName: "John",
      parentOrgNodeId: "team-1",
      ownerUserIds: ["user-1"],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 5);
});

test("validateHierarchyDepth returns invalid for depth > 5", () => {
  const nodes: OrgNode[] = [
    {
      orgNodeId: "node-1",
      nodeType: "company",
      displayName: "Acme",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];
  // Manually create a chain deeper than 5 levels
  const deepNodes = [...nodes];
  for (let i = 0; i < 6; i++) {
    deepNodes.push({
      orgNodeId: `node-${i + 2}`,
      nodeType: "member",
      displayName: `Node ${i + 2}`,
      parentOrgNodeId: deepNodes[deepNodes.length - 1].orgNodeId,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    });
  }
  const result = validateHierarchyDepth(deepNodes);
  assert.equal(result.valid, false);
  assert.ok(result.depth > 5);
});

test("createCrossOrgCollaborator builds valid collaborator", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "user-123",
    homeOrgNodeId: "company-home",
    targetOrgNodeId: "division-target",
    role: "guest",
    scope: {
      targetOrgNodeId: "division-target",
      allowedDomains: ["coding", "operations"],
      allowedActions: ["view", "execute"],
      expiresAt: "2025-12-31T23:59:59Z",
    },
    grantedBy: "admin-user",
  });

  assert.ok(collaborator.collaboratorId.startsWith("collab:"));
  assert.ok(collaborator.collaboratorId.includes("user-123"));
  assert.equal(collaborator.userId, "user-123");
  assert.equal(collaborator.homeOrgNodeId, "company-home");
  assert.equal(collaborator.targetOrgNodeId, "division-target");
  assert.equal(collaborator.role, "guest");
  assert.ok(collaborator.grantedAt.length > 0);
  assert.equal(collaborator.active, true);
});

test("createCrossOrgCollaborator works with contractor role", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "contractor-456",
    homeOrgNodeId: "external-company",
    targetOrgNodeId: "team-1",
    role: "contractor",
    scope: {
      targetOrgNodeId: "team-1",
      allowedDomains: ["operations"],
      allowedActions: ["execute"],
      expiresAt: null,
    },
    grantedBy: "manager-user",
  });

  assert.equal(collaborator.role, "contractor");
  assert.equal(collaborator.scope.expiresAt, null);
  assert.equal(collaborator.active, true);
});

test("validateHierarchyDepth handles single node", () => {
  const nodes: OrgNode[] = [
    {
      orgNodeId: "company-1",
      nodeType: "company",
      displayName: "Single Org",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];
  const result = validateHierarchyDepth(nodes);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 1);
});