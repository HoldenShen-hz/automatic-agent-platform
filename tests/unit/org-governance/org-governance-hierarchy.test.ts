import test from "node:test";
import assert from "node:assert/strict";

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
  buildOrgChangeImpactArtifacts,
} from "../../../src/org-governance/org-model/hierarchy/index.js";
import {
  OrgNodeSchema,
  OrgNodeTypeSchema,
  isLeafOrgNode,
  getPlatformMapping,
  validateHierarchyDepth,
  createCrossOrgCollaborator,
  requiresLegalEntityApproval,
  getLegalEntityApprovalRoles,
} from "../../../src/org-governance/org-model/org-node/index.js";

const tenantNode = { orgNodeId: "tenant", nodeType: "company" as const, displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, costCenter: "CC-000", metadata: {} };
const divisionNode = { orgNodeId: "division", nodeType: "division" as const, displayName: "Engineering", parentOrgNodeId: "tenant", ownerUserIds: ["vp-eng"], active: true, costCenter: "CC-100", metadata: {} };
const deptNode = { orgNodeId: "dept", nodeType: "department" as const, displayName: "Platform", parentOrgNodeId: "division", ownerUserIds: ["dir-platform"], active: true, costCenter: "CC-110", metadata: {} };
const teamNode = { orgNodeId: "team", nodeType: "team" as const, displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: ["lead-runtime"], active: true, costCenter: "CC-111", metadata: {} };
const seatNode = { orgNodeId: "seat", nodeType: "seat" as const, displayName: "Engineer Seat", parentOrgNodeId: "team", ownerUserIds: ["engineer"], active: true, costCenter: "CC-112", metadata: {} };

const fullHierarchy = [tenantNode, divisionNode, deptNode, teamNode];

test("OrgNodeTypeSchema accepts all canonical node types", () => {
  assert.equal(OrgNodeTypeSchema.parse("company"), "company");
  assert.equal(OrgNodeTypeSchema.parse("division"), "division");
  assert.equal(OrgNodeTypeSchema.parse("department"), "department");
  assert.equal(OrgNodeTypeSchema.parse("team"), "team");
  assert.equal(OrgNodeTypeSchema.parse("seat"), "seat");
  assert.throws(() => OrgNodeTypeSchema.parse("tenant"));
  assert.throws(() => OrgNodeTypeSchema.parse("group"));
});

test("OrgNodeSchema transforms legacy field aliases to canonical fields", () => {
  const legacy = OrgNodeSchema.parse({
    orgNodeId: "legacy-team",
    nodeType: "team",
    displayName: "Legacy Team",
    parentOrgNodeId: "dept",
  });
  assert.equal(legacy.nodeId, "legacy-team");
  assert.equal(legacy.orgNodeId, "legacy-team");
  assert.equal(legacy.type, "team");
  assert.equal(legacy.nodeType, "team");
  assert.equal(legacy.name, "Legacy Team");
  assert.equal(legacy.displayName, "Legacy Team");
  assert.equal(legacy.parentNodeId, "dept");
  assert.equal(legacy.parentOrgNodeId, "dept");
});

test("OrgNodeSchema requires either nodeId or orgNodeId", () => {
  assert.throws(() => OrgNodeSchema.parse({ nodeType: "team", displayName: "Test" }));
});

test("isLeafOrgNode returns true for team and seat nodes only", () => {
  assert.equal(isLeafOrgNode(tenantNode), false);
  assert.equal(isLeafOrgNode(divisionNode), false);
  assert.equal(isLeafOrgNode(deptNode), false);
  assert.equal(isLeafOrgNode(teamNode), true);
  assert.equal(isLeafOrgNode(seatNode), true);
});

test("getPlatformMapping returns correct architectural mapping", () => {
  assert.equal(getPlatformMapping("company"), "platform");
  assert.equal(getPlatformMapping("division"), "tenant_group");
  assert.equal(getPlatformMapping("department"), "tenant");
  assert.equal(getPlatformMapping("team"), "domain/pack_group");
  assert.equal(getPlatformMapping("seat"), "principal/seat");
});

test("validateHierarchyDepth accepts valid four-level hierarchy", () => {
  const result = validateHierarchyDepth(fullHierarchy);
  assert.equal(result.valid, true);
  assert.equal(result.depth, 4);
});

test("validateHierarchyDepth rejects hierarchies exceeding four levels", () => {
  const overDepth = [
    tenantNode,
    divisionNode,
    deptNode,
    teamNode,
    { orgNodeId: "sub-team", nodeType: "team" as const, displayName: "SubTeam", parentOrgNodeId: "team", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];
  const result = validateHierarchyDepth(overDepth);
  assert.equal(result.valid, false);
});

test("createCrossOrgCollaborator generates active collaborator with deterministic ID", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "user-1",
    homeOrgNodeId: "company-a",
    targetOrgNodeId: "team-b",
    role: "guest",
    scope: {
      targetOrgNodeId: "team-b",
      allowedDomains: ["ops"],
      allowedActions: ["view"] as const,
      expiresAt: null,
    },
    grantedBy: "admin-1",
  });
  assert.equal(collaborator.active, true);
  assert.equal(collaborator.collaboratorId, "collab:user-1:team-b");
  assert.ok(collaborator.grantedAt.length > 0);
});

test("requiresLegalEntityApproval detects cross-entity boundary changes", () => {
  const usBoundary = {
    boundaryId: "le-us",
    legalEntityId: "acme-us",
    jurisdictionCountry: "US",
    dataResidencyRegion: "us-east",
    crossBorderTransferPolicy: "approval_required" as const,
    crossEntityApprovalRoles: ["compliance_officer"],
    restrictedDataClasses: [],
  };
  const cnBoundary = {
    boundaryId: "le-cn",
    legalEntityId: "acme-cn",
    jurisdictionCountry: "CN",
    dataResidencyRegion: "cn-sh",
    crossBorderTransferPolicy: "approval_required" as const,
    crossEntityApprovalRoles: ["legal_reviewer"],
    restrictedDataClasses: [],
  };
  assert.equal(requiresLegalEntityApproval(usBoundary, usBoundary), false);
  assert.equal(requiresLegalEntityApproval(usBoundary, cnBoundary), true);
});

test("getLegalEntityApprovalRoles returns union of roles when approval required", () => {
  const usBoundary = {
    boundaryId: "le-us",
    legalEntityId: "acme-us",
    jurisdictionCountry: "US",
    dataResidencyRegion: "us-east",
    crossBorderTransferPolicy: "approval_required" as const,
    crossEntityApprovalRoles: ["compliance_officer"],
    restrictedDataClasses: [],
  };
  const cnBoundary = {
    boundaryId: "le-cn",
    legalEntityId: "acme-cn",
    jurisdictionCountry: "CN",
    dataResidencyRegion: "cn-sh",
    crossBorderTransferPolicy: "approval_required" as const,
    crossEntityApprovalRoles: ["legal_reviewer"],
    restrictedDataClasses: [],
  };
  const roles = getLegalEntityApprovalRoles(usBoundary, cnBoundary);
  assert.ok(roles.includes("compliance_officer"));
  assert.ok(roles.includes("legal_reviewer"));
});

test("validateOrgHierarchy detects multiple roots", () => {
  const findings = validateOrgHierarchy([
    { ...tenantNode, orgNodeId: "tenant-2", parentOrgNodeId: null },
    { ...tenantNode, orgNodeId: "tenant-1", parentOrgNodeId: null },
  ]);
  assert.ok(findings.some((f) => f.includes("invalid_root_count")));
});

test("validateOrgHierarchy detects missing parent references", () => {
  const findings = validateOrgHierarchy([
    tenantNode,
    { ...deptNode, parentOrgNodeId: "missing-parent" },
  ]);
  assert.ok(findings.some((f) => f.includes("missing_parent")));
});

test("validateOrgHierarchy detects self-referential cycles", () => {
  const findings = validateOrgHierarchy([
    { ...tenantNode, orgNodeId: "self-ref", parentOrgNodeId: "self-ref" },
  ]);
  assert.ok(findings.some((f) => f.includes("self_cycle")));
});

test("listAncestorNodeIds returns path to root", () => {
  const ancestors = listAncestorNodeIds(fullHierarchy, "team");
  assert.deepEqual(ancestors, ["dept", "division", "tenant"]);
});

test("listAncestorNodeIds returns empty array for root node", () => {
  const ancestors = listAncestorNodeIds(fullHierarchy, "tenant");
  assert.deepEqual(ancestors, []);
});

test("listDescendantNodeIds returns all descendants using breadth-first", () => {
  const descendants = listDescendantNodeIds(fullHierarchy, "division");
  assert.deepEqual(descendants.sort(), ["dept", "team"]);
});

test("findRootNode returns the company-level node", () => {
  const root = findRootNode(fullHierarchy);
  assert.equal(root?.orgNodeId, "tenant");
  assert.equal(root?.nodeType, "company");
});

test("getNodesAtLevel returns nodes at specified depth", () => {
  const level1Nodes = getNodesAtLevel(fullHierarchy, 1);
  assert.equal(level1Nodes.length, 1);
  assert.equal(level1Nodes[0]?.orgNodeId, "division");

  const level3Nodes = getNodesAtLevel(fullHierarchy, 3);
  assert.equal(level3Nodes.length, 1);
  assert.equal(level3Nodes[0]?.orgNodeId, "team");
});

test("getNodeDepth calculates correct depth from root", () => {
  assert.equal(getNodeDepth(fullHierarchy, "tenant"), 0);
  assert.equal(getNodeDepth(fullHierarchy, "division"), 1);
  assert.equal(getNodeDepth(fullHierarchy, "dept"), 2);
  assert.equal(getNodeDepth(fullHierarchy, "team"), 3);
});

test("findLowestCommonAncestor returns shared ancestor", () => {
  const lca = findLowestCommonAncestor(fullHierarchy, "team", "dept");
  assert.equal(lca, "dept");
});

test("findLowestCommonAncestor returns null for nodes in different trees", () => {
  const otherHierarchy = [
    { orgNodeId: "tenant2", nodeType: "company" as const, displayName: "Other", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];
  const combined = [...fullHierarchy, ...otherHierarchy];
  const lca = findLowestCommonAncestor(combined, "team", "tenant2");
  assert.equal(lca, null);
});

test("buildReportingChain walks up the ownership chain", () => {
  const chain = buildReportingChain(fullHierarchy, "engineer-1", "team");
  assert.deepEqual(chain, ["lead-runtime", "dir-platform", "vp-eng", "ceo"]);
});

test("buildReportingChain does not include the employee themselves", () => {
  const chain = buildReportingChain(fullHierarchy, "lead-runtime", "team");
  assert.ok(!chain.includes("lead-runtime"));
});

test("detectOrgChangeEvents identifies employee transfer events via principal assignment", () => {
  const before = [tenantNode, divisionNode, deptNode, teamNode];
  const after = [
    tenantNode,
    divisionNode,
    deptNode,
    { ...teamNode, parentOrgNodeId: "division" },
  ];
  const events = detectOrgChangeEvents(before, after, [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead-runtime", active: true },
  ]);
  assert.ok(events.some((e) => e.type === "employee_transfer"));
});

test("detectOrgChangeEvents identifies org restructure when team moves without assignment", () => {
  const before = [tenantNode, divisionNode, deptNode, teamNode];
  const after = [
    tenantNode,
    divisionNode,
    deptNode,
    { ...teamNode, parentOrgNodeId: "division" },
  ];
  const events = detectOrgChangeEvents(before, after, []);
  assert.ok(events.some((e) => e.type === "org_restructure"));
});

test("detectOrgChangeEvents identifies employee onboarding events", () => {
  const before: typeof fullHierarchy = [];
  const after = [tenantNode, divisionNode, deptNode, teamNode];
  const events = detectOrgChangeEvents(before, after, [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead-runtime", active: true },
  ]);
  assert.ok(events.some((e) => e.type === "employee_onboarding"));
});

test("detectOrgChangeEvents identifies department merge events", () => {
  const before = [tenantNode, divisionNode, deptNode, teamNode];
  const after = [
    tenantNode,
    divisionNode,
    { ...deptNode, parentOrgNodeId: "tenant" },
    teamNode,
  ];
  const events = detectOrgChangeEvents(before, after, []);
  assert.ok(events.some((e) => e.type === "org_restructure"));
});

test("buildOrgChangeImpactArtifacts generates approval reroute records", () => {
  const after = [
    tenantNode,
    divisionNode,
    deptNode,
    { ...teamNode, parentOrgNodeId: "division", ownerUserIds: ["new-lead"] },
  ];
  const artifacts = buildOrgChangeImpactArtifacts(fullHierarchy, after, [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead-runtime", active: true },
  ]);
  assert.ok(artifacts.approvalReroutes.length > 0);
  assert.ok(artifacts.approvalReroutes.some((r) => r.reason === "owner_change"));
});

test("buildOrgChangeImpactArtifacts generates orphan agent freeze policies", () => {
  const after = [
    tenantNode,
    divisionNode,
    { ...deptNode, orgNodeId: "orphaned-dept", parentOrgNodeId: "missing-parent" },
  ];
  const artifacts = buildOrgChangeImpactArtifacts(fullHierarchy, after, []);
  assert.ok(artifacts.orphanAgentFreezePolicies.length > 0);
  assert.equal(artifacts.orphanAgentFreezePolicies[0]?.freezeMode, "deny_and_suspend");
});

test("buildOrgChangeImpactArtifacts generates identity deprovisioning reports", () => {
  const before = [tenantNode, divisionNode, deptNode, teamNode];
  const after: typeof fullHierarchy = [];
  const artifacts = buildOrgChangeImpactArtifacts(before, after, [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead-runtime", active: true },
  ]);
  assert.ok(artifacts.identityDeprovisioningReports.length > 0);
});
