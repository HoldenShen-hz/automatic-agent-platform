import assert from "node:assert/strict";
import test from "node:test";

import {
  OrgNodeSchema,
  OrgNodeTypeSchema,
  createCrossOrgCollaborator,
  getPlatformMapping,
  isLeafOrgNode,
  validateHierarchyDepth,
} from "../../../../src/org-governance/org-model/org-node/index.js";

test("org-model/org-node parses legacy fields into canonical aliases", () => {
  const parsed = OrgNodeSchema.parse({
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Engineering",
    parentOrgNodeId: "division-1",
  });

  assert.equal(parsed.nodeId, "dept-1");
  assert.equal(parsed.type, "department");
  assert.equal(parsed.name, "Engineering");
  assert.equal(parsed.parentNodeId, "division-1");
});

test("org-model/org-node rejects deprecated member type", () => {
  assert.throws(() => OrgNodeTypeSchema.parse("member"));
});

test("org-model/org-node maps team to pack-group layer", () => {
  assert.equal(getPlatformMapping("team"), "domain/pack_group");
});

test("org-model/org-node marks only seat as leaf org node", () => {
  assert.equal(isLeafOrgNode({
    orgNodeId: "seat-1",
    nodeType: "seat",
    displayName: "Runtime Seat",
    parentOrgNodeId: "team-1",
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
  }), true);
  assert.equal(isLeafOrgNode({
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Runtime",
    parentOrgNodeId: "dept-1",
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
  }), false);
  assert.equal(isLeafOrgNode({
    orgNodeId: "dept-1",
    nodeType: "department",
    displayName: "Engineering",
    parentOrgNodeId: "division-1",
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
  }), false);
});

test("org-model/org-node enforces four-level depth", () => {
  assert.equal(validateHierarchyDepth([
    { orgNodeId: "company", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "division", nodeType: "division", displayName: "Biz", parentOrgNodeId: "company", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "dept", nodeType: "department", displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ]).valid, true);
});

test("org-model/org-node creates cross-org collaborator ids deterministically", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "user-1",
    homeOrgNodeId: "company-a",
    targetOrgNodeId: "team-b",
    role: "partner",
    scope: {
      targetOrgNodeId: "team-b",
      allowedDomains: ["growth"],
      allowedActions: ["view", "execute"],
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
    grantedBy: "admin-1",
  });

  assert.equal(collaborator.collaboratorId, "collab:user-1:team-b");
});
