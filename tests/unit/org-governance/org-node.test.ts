import assert from "node:assert/strict";
import test from "node:test";

import {
  OrgNodeSchema,
  OrgNodeTypeSchema,
  isLeafOrgNode,
  getPlatformMapping,
  validateHierarchyDepth,
  createCrossOrgCollaborator,
  requiresLegalEntityApproval,
} from "../../../src/org-governance/org-model/org-node/index.js";

test("OrgNodeTypeSchema accepts canonical node types only", () => {
  for (const type of ["tenant", "division", "department", "team", "seat"] as const) {
    assert.equal(OrgNodeTypeSchema.parse(type), type);
  }
  assert.throws(() => OrgNodeTypeSchema.parse("company"));
});

test("OrgNodeSchema preserves legacy aliases and canonical fields", () => {
  const node = OrgNodeSchema.parse({
    orgNodeId: "team-1",
    nodeType: "team",
    displayName: "Platform",
    parentOrgNodeId: "dept-1",
  });

  assert.equal(node.nodeId, "team-1");
  assert.equal(node.type, "team");
  assert.equal(node.name, "Platform");
  assert.equal(node.parentNodeId, "dept-1");
});

test("isLeafOrgNode treats seat as leaf org node", () => {
  assert.equal(isLeafOrgNode({
    orgNodeId: "seat-1",
    nodeType: "seat",
    displayName: "Engineer Seat",
    parentOrgNodeId: "team-1",
    ownerUserIds: ["engineer-1"],
    active: true,
    costCenter: "",
    metadata: {},
  }), true);
});

test("getPlatformMapping follows canonical five-level mapping", () => {
  assert.equal(getPlatformMapping("tenant"), "platform");
  assert.equal(getPlatformMapping("division"), "tenant_group");
  assert.equal(getPlatformMapping("department"), "tenant");
  assert.equal(getPlatformMapping("team"), "domain/pack_group");
  assert.equal(getPlatformMapping("seat"), "resource/seat");
});

test("validateHierarchyDepth enforces four-level maximum", () => {
  const valid = validateHierarchyDepth([
    { orgNodeId: "tenant", nodeType: "tenant", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "division", nodeType: "division", displayName: "Biz", parentOrgNodeId: "tenant", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "dept", nodeType: "department", displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ]);
  assert.equal(valid.valid, true);
  assert.equal(valid.depth, 4);

  const invalid = validateHierarchyDepth([
    { orgNodeId: "tenant", nodeType: "tenant", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "division", nodeType: "division", displayName: "Biz", parentOrgNodeId: "tenant", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "dept", nodeType: "department", displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "team-child", nodeType: "team", displayName: "Overflow", parentOrgNodeId: "team", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ]);
  assert.equal(invalid.valid, false);
});

test("createCrossOrgCollaborator returns active scoped collaborator", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "user-1",
    homeOrgNodeId: "company-a",
    targetOrgNodeId: "team-1",
    role: "guest",
    scope: {
      targetOrgNodeId: "team-1",
      allowedDomains: ["ops"],
      allowedActions: ["view"],
      expiresAt: null,
    },
    grantedBy: "admin-1",
  });

  assert.equal(collaborator.active, true);
  assert.equal(collaborator.collaboratorId, "collab:user-1:team-1");
});

test("requiresLegalEntityApproval detects cross-jurisdiction boundary", () => {
  assert.equal(requiresLegalEntityApproval(
    {
      boundaryId: "le-cn",
      legalEntityId: "cn-co",
      jurisdictionCountry: "CN",
      dataResidencyRegion: "cn-sh",
      crossBorderTransferPolicy: "approval_required",
      crossEntityApprovalRoles: ["legal_reviewer"],
      restrictedDataClasses: [],
    },
    {
      boundaryId: "le-us",
      legalEntityId: "us-co",
      jurisdictionCountry: "US",
      dataResidencyRegion: "us-east",
      crossBorderTransferPolicy: "approval_required",
      crossEntityApprovalRoles: ["compliance_officer"],
      restrictedDataClasses: [],
    },
  ), true);
});
