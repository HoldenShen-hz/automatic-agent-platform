import assert from "node:assert/strict";
import test from "node:test";

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
} from "../../../../../src/org-governance/org-model/hierarchy/index.js";

test("validateOrgHierarchy returns empty array for valid hierarchy", () => {
  const nodes = [
    { orgNodeId: "tenant", nodeType: "tenant" as const, active: true, ownerUserIds: ["admin"], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: ["mgr1"], parentOrgNodeId: "tenant" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: ["lead1"], parentOrgNodeId: "dept1" },
  ];
  const findings = validateOrgHierarchy(nodes);
  assert.equal(findings.length, 0);
});

test("validateOrgHierarchy detects missing parent", () => {
  const nodes = [
    { orgNodeId: "orphan", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "nonexistent" },
  ];
  const findings = validateOrgHierarchy(nodes);
  assert.ok(findings.some(f => f.includes("missing_parent")));
});

test("validateOrgHierarchy detects self-cycle", () => {
  const nodes = [
    { orgNodeId: "self", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "self" },
  ];
  const findings = validateOrgHierarchy(nodes);
  assert.ok(findings.some(f => f.includes("self_cycle")));
});

test("listAncestorNodeIds returns ancestors in order", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "dept1" },
  ];
  const ancestors = listAncestorNodeIds(nodes, "team1");
  assert.deepEqual(ancestors, ["dept1", "company"]);
});

test("listAncestorNodeIds returns empty for root", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
  ];
  const ancestors = listAncestorNodeIds(nodes, "company");
  assert.deepEqual(ancestors, []);
});

test("listAncestorNodeIds throws on circular hierarchy references", () => {
  const nodes = [
    { orgNodeId: "team-a", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "team-b" },
    { orgNodeId: "team-b", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "team-a" },
  ];

  assert.throws(
    () => listAncestorNodeIds(nodes, "team-a"),
    /org_hierarchy\.circular_reference_detected:team-a/,
  );
});

test("listDescendantNodeIds returns all descendants", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
    { orgNodeId: "dept2", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "dept1" },
  ];
  const descendants = listDescendantNodeIds(nodes, "company");
  assert.ok(descendants.includes("dept1"));
  assert.ok(descendants.includes("dept2"));
  assert.ok(descendants.includes("team1"));
});

test("listDescendantNodeIds returns empty for leaf", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
  ];
  const descendants = listDescendantNodeIds(nodes, "team1");
  assert.deepEqual(descendants, []);
});

test("findRootNode returns node without parent", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
  ];
  const root = findRootNode(nodes);
  assert.ok(root != null);
  assert.equal(root.orgNodeId, "company");
});

test("findRootNode returns null for empty array", () => {
  const root = findRootNode([]);
  assert.equal(root, null);
});

test("getNodesAtLevel returns nodes at specified depth", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "dept1" },
  ];
  const level0 = getNodesAtLevel(nodes, 0);
  assert.equal(level0.length, 1);
  assert.equal(level0[0].orgNodeId, "company");

  const level1 = getNodesAtLevel(nodes, 1);
  assert.equal(level1.length, 1);
  assert.equal(level1[0].orgNodeId, "dept1");
});

test("getNodeDepth returns correct depth", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "dept1" },
  ];
  assert.equal(getNodeDepth(nodes, "company"), 0);
  assert.equal(getNodeDepth(nodes, "dept1"), 1);
  assert.equal(getNodeDepth(nodes, "team1"), 2);
});

test("findLowestCommonAncestor returns common ancestor", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: [], parentOrgNodeId: "company" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "dept1" },
    { orgNodeId: "team2", nodeType: "team" as const, active: true, ownerUserIds: [], parentOrgNodeId: "dept1" },
  ];
  const lca = findLowestCommonAncestor(nodes, "team1", "team2");
  assert.equal(lca, "dept1");
});

test("findLowestCommonAncestor returns null when no common ancestor", () => {
  const nodes = [
    { orgNodeId: "company1", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
    { orgNodeId: "company2", nodeType: "company" as const, active: true, ownerUserIds: [], parentOrgNodeId: null },
  ];
  const lca = findLowestCommonAncestor(nodes, "company1", "company2");
  assert.equal(lca, null);
});

test("buildReportingChain builds manager chain", () => {
  const nodes = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["ceo"], parentOrgNodeId: null },
    { orgNodeId: "dept1", nodeType: "department" as const, active: true, ownerUserIds: ["vp1"], parentOrgNodeId: "company" },
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: ["lead1"], parentOrgNodeId: "dept1" },
  ];
  const chain = buildReportingChain(nodes, "emp1", "team1");
  assert.ok(chain.includes("lead1"));
  assert.ok(chain.includes("vp1"));
  assert.ok(chain.includes("ceo"));
});

test("detectOrgChangeEvents detects offboarding", () => {
  const before = [
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: ["lead1"], parentOrgNodeId: "dept1", legalEntityBoundary: { boundaryId: "le-1", legalEntityId: "entity-1", jurisdictionCountry: "CN", dataResidencyRegion: "cn-sh", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["legal_reviewer"], restrictedDataClasses: [] } },
  ];
  const after: typeof before = [];
  const events = detectOrgChangeEvents(before, after, [
    { principalId: "seat-1", userId: "emp1", homeNodeId: "team1", managerUserId: "lead1", active: true },
  ]);
  assert.ok(events.some(e => e.type === "employee_offboarding"));
});

test("detectOrgChangeEvents detects onboarding", () => {
  const before: any[] = [];
  const after = [
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: ["lead1"], parentOrgNodeId: "dept1" },
  ];
  const events = detectOrgChangeEvents(before, after, [
    { principalId: "seat-1", userId: "emp1", homeNodeId: "team1", managerUserId: "lead1", active: true },
  ]);
  assert.ok(events.some(e => e.type === "employee_onboarding"));
});

test("detectOrgChangeEvents detects department merge and restructure", () => {
  const before = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["ceo"], parentOrgNodeId: null },
    { orgNodeId: "dept-a", nodeType: "department" as const, active: true, ownerUserIds: ["mgr-a"], parentOrgNodeId: "company", costCenter: "CC-A", legalEntityBoundary: { boundaryId: "le-a", legalEntityId: "entity-a", jurisdictionCountry: "CN", dataResidencyRegion: "cn-sh", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["legal_reviewer"], restrictedDataClasses: [] } },
    { orgNodeId: "team-a", nodeType: "team" as const, active: true, ownerUserIds: ["lead-a"], parentOrgNodeId: "dept-a" },
  ];
  const after = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["ceo"], parentOrgNodeId: null },
    { orgNodeId: "dept-a", nodeType: "department" as const, active: true, ownerUserIds: ["mgr-b"], parentOrgNodeId: "company", costCenter: "CC-B", legalEntityBoundary: { boundaryId: "le-b", legalEntityId: "entity-b", jurisdictionCountry: "US", dataResidencyRegion: "us-east", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["compliance_officer"], restrictedDataClasses: [] } },
    { orgNodeId: "team-a", nodeType: "team" as const, active: true, ownerUserIds: ["lead-b"], parentOrgNodeId: "dept-a" },
  ];
  const events = detectOrgChangeEvents(before, after);
  assert.ok(events.some(e => e.type === "department_merge" || e.type === "org_restructure"));
});

test("detectOrgChangeEvents records employee transfer target as destination team id", () => {
  const before = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["ceo"], parentOrgNodeId: null },
    { orgNodeId: "dept-a", nodeType: "department" as const, active: true, ownerUserIds: ["mgr-a"], parentOrgNodeId: "company" },
    { orgNodeId: "team-a", nodeType: "team" as const, active: true, ownerUserIds: ["lead-a"], parentOrgNodeId: "dept-a" },
  ];
  const after = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["ceo"], parentOrgNodeId: null },
    { orgNodeId: "dept-b", nodeType: "department" as const, active: true, ownerUserIds: ["mgr-b"], parentOrgNodeId: "company" },
    { orgNodeId: "team-a", nodeType: "team" as const, active: true, ownerUserIds: ["lead-a"], parentOrgNodeId: "dept-b" },
  ];

  const events = detectOrgChangeEvents(before, after, [
    { principalId: "seat-1", userId: "emp-1", homeNodeId: "team-a", managerUserId: "mgr-b", active: true },
  ]);

  const transfer = events.find((event) => event.type === "employee_transfer");
  assert.ok(transfer);
  assert.equal(transfer.toTeamId, "team-a");
});

test("detectOrgChangeEvents returns empty when no changes", () => {
  const before = [
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: ["lead1"], parentOrgNodeId: "dept1" },
  ];
  const after = [
    { orgNodeId: "team1", nodeType: "team" as const, active: true, ownerUserIds: ["lead1"], parentOrgNodeId: "dept1" },
  ];
  const events = detectOrgChangeEvents(before, after);
  assert.equal(events.length, 0);
});

test("buildOrgChangeImpactArtifacts emits downstream governance artifacts", () => {
  const before = [
    { orgNodeId: "company", nodeType: "company" as const, active: true, ownerUserIds: ["ceo"], parentOrgNodeId: null, costCenter: "", metadata: {} },
    { orgNodeId: "dept-a", nodeType: "department" as const, active: true, ownerUserIds: ["mgr-a"], parentOrgNodeId: "company", costCenter: "CC-A", metadata: {}, legalEntityBoundary: { boundaryId: "le-a", legalEntityId: "entity-a", jurisdictionCountry: "CN", dataResidencyRegion: "cn-sh", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["legal_reviewer"], restrictedDataClasses: [] } },
  ];
  const after = [
    { orgNodeId: "dept-a", nodeType: "department" as const, active: true, ownerUserIds: ["mgr-b"], parentOrgNodeId: "missing-company", costCenter: "CC-B", metadata: {}, legalEntityBoundary: { boundaryId: "le-b", legalEntityId: "entity-b", jurisdictionCountry: "US", dataResidencyRegion: "us-east", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["compliance_officer"], restrictedDataClasses: [] } },
  ];
  const artifacts = buildOrgChangeImpactArtifacts(before, after, [
    { principalId: "seat-1", userId: "emp1", homeNodeId: "dept-a", managerUserId: "mgr-a", active: true },
  ]);

  assert.ok(artifacts.approvalReroutes.length > 0);
  assert.ok(artifacts.identityDeprovisioningReports.length > 0);
  assert.ok(artifacts.orphanAgentFreezePolicies.length > 0);
});
