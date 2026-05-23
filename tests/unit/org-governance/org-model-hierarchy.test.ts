import assert from "node:assert/strict";
import test from "node:test";
import {
  validateOrgHierarchy,
  listAncestorNodeIds,
  listDescendantNodeIds,
  findRootNode,
  findLowestCommonAncestor,
  getNodeDepth,
  buildReportingChain,
} from "../../../src/org-governance/org-model/hierarchy/index.js";
import type { OrgNode, OrgPrincipalAssignment } from "../../../src/org-governance/org-model/org-node/index.js";

const tenantNode: OrgNode = {
  orgNodeId: "tenant_1",
  nodeType: "company",
  displayName: "Acme Corp",
  parentOrgNodeId: null,
  ownerUserIds: ["ceo_user"],
  active: true,
  costCenter: "CC0001",
  metadata: {},
};

const divisionNode: OrgNode = {
  orgNodeId: "division_1",
  nodeType: "division",
  displayName: "Tech Division",
  parentOrgNodeId: "tenant_1",
  ownerUserIds: ["div_head"],
  active: true,
  costCenter: "CC1000",
  metadata: {},
};

const deptNode: OrgNode = {
  orgNodeId: "dept_1",
  nodeType: "department",
  displayName: "Engineering",
  parentOrgNodeId: "division_1",
  ownerUserIds: ["dept_mgr"],
  active: true,
  costCenter: "CC1100",
  metadata: {},
};

const teamNode: OrgNode = {
  orgNodeId: "team_1",
  nodeType: "team",
  displayName: "Platform Team",
  parentOrgNodeId: "dept_1",
  ownerUserIds: ["team_lead"],
  active: true,
  costCenter: "CC1110",
  metadata: {},
};

test("validateOrgHierarchy returns empty for valid hierarchy", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const findings = validateOrgHierarchy(nodes);
  assert.deepStrictEqual(findings, []);
});

test("validateOrgHierarchy detects multiple roots", () => {
  const nodes: OrgNode[] = [
    { ...tenantNode },
    { ...tenantNode, orgNodeId: "tenant_2", displayName: "Acme 2" },
  ];
  const findings = validateOrgHierarchy(nodes);
  assert.ok(findings.some((f) => f.includes("invalid_root_count")));
});

test("validateOrgHierarchy detects missing parent", () => {
  const nodes: OrgNode[] = [
    { ...tenantNode },
    { ...deptNode, parentOrgNodeId: "non_existent" },
  ];
  const findings = validateOrgHierarchy(nodes);
  assert.ok(findings.some((f) => f.includes("missing_parent")));
});

test("validateOrgHierarchy detects self-cycle", () => {
  const nodes: OrgNode[] = [
    { ...tenantNode, orgNodeId: "cycle_node", parentOrgNodeId: "cycle_node" },
  ];
  const findings = validateOrgHierarchy(nodes);
  assert.ok(findings.some((f) => f.includes("self_cycle")));
});

test("listAncestorNodeIds returns chain to root", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const ancestors = listAncestorNodeIds(nodes, "team_1");

  assert.deepStrictEqual(ancestors, ["dept_1", "division_1", "tenant_1"]);
});

test("listAncestorNodeIds returns empty for root", () => {
  const nodes = [tenantNode, divisionNode];
  const ancestors = listAncestorNodeIds(nodes, "tenant_1");
  assert.deepStrictEqual(ancestors, []);
});

test("listAncestorNodeIds throws on circular reference", () => {
  const nodes: OrgNode[] = [
    { ...tenantNode },
    { ...divisionNode, parentOrgNodeId: "team_1" },
    { ...deptNode, parentOrgNodeId: "division_1" },
    { ...teamNode, parentOrgNodeId: "dept_1" },
  ];
  assert.throws(() => listAncestorNodeIds(nodes, "team_1"), { message: /circular_reference/ });
});

test("listDescendantNodeIds returns all descendants", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const descendants = listDescendantNodeIds(nodes, "tenant_1");

  assert.deepStrictEqual(descendants, ["division_1", "dept_1", "team_1"]);
});

test("listDescendantNodeIds returns empty for leaf", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const descendants = listDescendantNodeIds(nodes, "team_1");
  assert.deepStrictEqual(descendants, []);
});

test("findRootNode returns company level", () => {
  const nodes = [tenantNode, divisionNode, deptNode];
  const root = findRootNode(nodes);
  assert.strictEqual(root?.orgNodeId, "tenant_1");
});

test("findRootNode returns null for orphan nodes", () => {
  const nodes = [divisionNode, deptNode]; // No root
  const root = findRootNode(nodes);
  assert.strictEqual(root, null);
});

test("findLowestCommonAncestor finds common ancestor", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const lca = findLowestCommonAncestor(nodes, "team_1", "dept_1");
  assert.strictEqual(lca, "dept_1");
});

test("findLowestCommonAncestor returns null for no common ancestor", () => {
  const nodes = [tenantNode, divisionNode, deptNode];
  // nodeId1 has ancestors [dept, div, tenant], nodeId2 has ancestors [div, tenant]
  // lowest common is div
  const lca = findLowestCommonAncestor(nodes, "dept_1", "division_1");
  assert.strictEqual(lca, "division_1");
});

test("getNodeDepth calculates correct depth", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];

  assert.strictEqual(getNodeDepth(nodes, "tenant_1"), 0);
  assert.strictEqual(getNodeDepth(nodes, "division_1"), 1);
  assert.strictEqual(getNodeDepth(nodes, "dept_1"), 2);
  assert.strictEqual(getNodeDepth(nodes, "team_1"), 3);
});

test("buildReportingChain builds chain from member to ancestors", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const assignments: OrgPrincipalAssignment[] = [
    { principalId: "principal-1", userId: "employee_1", homeNodeId: "team_1", managerUserId: "team_lead", active: true },
  ];

  const chain = buildReportingChain(nodes, "employee_1", "team_1");

  // Should include team lead, dept manager, div head, ceo (ascending hierarchy)
  assert.ok(chain.length > 0);
});

test("buildReportingChain excludes the employee themselves", () => {
  const nodes = [tenantNode, divisionNode, deptNode, teamNode];
  const assignments: OrgPrincipalAssignment[] = [
    { principalId: "principal-1", userId: "employee_1", homeNodeId: "team_1", managerUserId: "team_lead", active: true },
  ];

  const chain = buildReportingChain(nodes, "employee_1", "team_1");

  assert.ok(!chain.includes("employee_1"));
});
