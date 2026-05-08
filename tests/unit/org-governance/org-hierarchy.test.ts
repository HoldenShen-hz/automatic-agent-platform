import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrgChangeImpactArtifacts,
  buildReportingChain,
  detectOrgChangeEvents,
  findLowestCommonAncestor,
  listAncestorNodeIds,
  listDescendantNodeIds,
  validateOrgHierarchy,
} from "../../../src/org-governance/org-model/hierarchy/index.js";

const nodes = [
  { orgNodeId: "company", nodeType: "company" as const, displayName: "Acme", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, costCenter: "", metadata: {} },
  { orgNodeId: "division", nodeType: "division" as const, displayName: "Biz", parentOrgNodeId: "company", ownerUserIds: ["vp"], active: true, costCenter: "", metadata: {} },
  { orgNodeId: "dept", nodeType: "department" as const, displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: ["director"], active: true, costCenter: "", metadata: {} },
  { orgNodeId: "team", nodeType: "team" as const, displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: ["lead"], active: true, costCenter: "", metadata: {} },
];

test("org-hierarchy validates canonical org tree", () => {
  assert.deepEqual(validateOrgHierarchy(nodes), []);
});

test("org-hierarchy exposes lineage helpers for canonical nodes", () => {
  assert.deepEqual(listAncestorNodeIds(nodes, "team"), ["dept", "division", "company"]);
  assert.deepEqual(new Set(listDescendantNodeIds(nodes, "company")), new Set(["division", "dept", "team"]));
  assert.equal(findLowestCommonAncestor(nodes, "team", "dept"), "dept");
});

test("org-hierarchy builds reporting chain from team owners upward", () => {
  assert.deepEqual(buildReportingChain(nodes, "engineer", "team"), ["lead", "director", "vp", "ceo"]);
});

test("org-hierarchy detects offboarding from principal assignments", () => {
  const events = detectOrgChangeEvents(nodes, nodes.slice(0, 3), [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead", active: true },
  ]);
  assert.ok(events.some((event) => event.type === "employee_offboarding"));
});

test("org-hierarchy emits downstream remediation artifacts", () => {
  const after = [
    { orgNodeId: "dept", nodeType: "department" as const, displayName: "Eng", parentOrgNodeId: "missing", ownerUserIds: ["director-2"], active: true, costCenter: "CC-2", metadata: {}, legalEntityBoundary: { boundaryId: "le-2", legalEntityId: "entity-2", jurisdictionCountry: "US", dataResidencyRegion: "us-east", crossBorderTransferPolicy: "approval_required" as const, crossEntityApprovalRoles: ["compliance_officer"], restrictedDataClasses: [] } },
  ];
  const artifacts = buildOrgChangeImpactArtifacts(nodes, after, [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "dept", managerUserId: "director", active: true },
  ]);
  assert.ok(artifacts.orphanAgentFreezePolicies.length > 0);
  assert.ok(artifacts.identityDeprovisioningReports.length > 0);
});
