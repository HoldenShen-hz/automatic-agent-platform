import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  validateOrgHierarchy,
  listAncestorNodeIds,
  listDescendantNodeIds,
  findRootNode,
  getNodesAtLevel,
  getNodeDepth,
  findLowestCommonAncestor,
  buildReportingChain,
} from "../../../../../src/org-governance/org-model/hierarchy/index.js";
import type { OrgNode } from "../../../../../src/org-governance/org-model/index.js";

function mockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "node-1",
    nodeType: "department",
    displayName: "Test",
    parentOrgNodeId: null,
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
    ...overrides,
  };
}

test("validateOrgHierarchy returns no findings for valid hierarchy", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "division", parentOrgNodeId: "company" }),
    mockOrgNode({ orgNodeId: "dept", parentOrgNodeId: "division" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.strictEqual(findings.length, 0);
});

test("validateOrgHierarchy detects missing parent reference", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "child", parentOrgNodeId: "nonexistent" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.ok(findings.some((f) => f.includes("missing_parent")));
});

test("validateOrgHierarchy detects self-cycle", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "node", parentOrgNodeId: "node" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.ok(findings.some((f) => f.includes("self_cycle")));
});

test("listAncestorNodeIds returns path to root", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "division", parentOrgNodeId: "company" }),
    mockOrgNode({ orgNodeId: "dept", parentOrgNodeId: "division" }),
    mockOrgNode({ orgNodeId: "team", parentOrgNodeId: "dept" }),
  ];

  const ancestors = listAncestorNodeIds(nodes, "team");

  assert.deepStrictEqual(ancestors, ["dept", "division", "company"]);
});

test("listAncestorNodeIds returns empty for root node", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", parentOrgNodeId: null }),
  ];

  const ancestors = listAncestorNodeIds(nodes, "company");

  assert.strictEqual(ancestors.length, 0);
});

test("listDescendantNodeIds returns all descendants", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "division", parentOrgNodeId: "company" }),
    mockOrgNode({ orgNodeId: "dept", parentOrgNodeId: "division" }),
    mockOrgNode({ orgNodeId: "team", parentOrgNodeId: "dept" }),
    mockOrgNode({ orgNodeId: "member", parentOrgNodeId: "team" }),
  ];

  const descendants = listDescendantNodeIds(nodes, "company");

  assert.ok(descendants.includes("division"));
  assert.ok(descendants.includes("dept"));
  assert.ok(descendants.includes("team"));
  assert.ok(descendants.includes("member"));
  assert.strictEqual(descendants.length, 4);
});

test("listDescendantNodeIds returns empty for leaf node", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "member", parentOrgNodeId: "team" }),
  ];

  const descendants = listDescendantNodeIds(nodes, "member");

  assert.strictEqual(descendants.length, 0);
});

test("findRootNode returns company-level node", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", parentOrgNodeId: null, nodeType: "company" }),
    mockOrgNode({ orgNodeId: "dept", parentOrgNodeId: "company" }),
  ];

  const root = findRootNode(nodes);

  assert.strictEqual(root?.orgNodeId, "company");
});

test("findRootNode returns null for empty nodes", () => {
  const root = findRootNode([]);

  assert.strictEqual(root, null);
});

test("getNodesAtLevel returns nodes at specified depth", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "root", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "child1", parentOrgNodeId: "root" }),
    mockOrgNode({ orgNodeId: "child2", parentOrgNodeId: "root" }),
    mockOrgNode({ orgNodeId: "grandchild", parentOrgNodeId: "child1" }),
  ];

  const level1 = getNodesAtLevel(nodes, 1);
  assert.strictEqual(level1.length, 2);

  const level2 = getNodesAtLevel(nodes, 2);
  assert.strictEqual(level2.length, 1);
});

test("getNodeDepth returns correct depth for node", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "root", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "child", parentOrgNodeId: "root" }),
    mockOrgNode({ orgNodeId: "grandchild", parentOrgNodeId: "child" }),
  ];

  assert.strictEqual(getNodeDepth(nodes, "root"), 0);
  assert.strictEqual(getNodeDepth(nodes, "child"), 1);
  assert.strictEqual(getNodeDepth(nodes, "grandchild"), 2);
});

test("findLowestCommonAncestor returns common ancestor", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "root", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "child1", parentOrgNodeId: "root" }),
    mockOrgNode({ orgNodeId: "child2", parentOrgNodeId: "root" }),
    mockOrgNode({ orgNodeId: "gc1", parentOrgNodeId: "child1" }),
    mockOrgNode({ orgNodeId: "gc2", parentOrgNodeId: "child2" }),
  ];

  const lca = findLowestCommonAncestor(nodes, "gc1", "gc2");

  assert.strictEqual(lca, "root");
});

test("findLowestCommonAncestor returns one node when it is ancestor of other", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "root", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "child", parentOrgNodeId: "root" }),
    mockOrgNode({ orgNodeId: "grandchild", parentOrgNodeId: "child" }),
  ];

  const lca = findLowestCommonAncestor(nodes, "child", "grandchild");

  assert.strictEqual(lca, "child");
});

test("buildReportingChain builds owner chain to root", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
    mockOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company", ownerUserIds: ["vp"] }),
    mockOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division", ownerUserIds: ["director"] }),
    mockOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept", ownerUserIds: ["manager"] }),
    mockOrgNode({ orgNodeId: "member", nodeType: "seat", parentOrgNodeId: "team", ownerUserIds: ["employee"] }),
  ];

  const chain = buildReportingChain(nodes, "employee", "member");

  assert.deepStrictEqual(chain, ["manager", "director", "vp", "ceo"]);
});

test("buildReportingChain stops at node with no owners", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null, ownerUserIds: ["ceo"] }),
    mockOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "company", ownerUserIds: [] }),
    mockOrgNode({ orgNodeId: "member", nodeType: "seat", parentOrgNodeId: "dept", ownerUserIds: ["employee"] }),
  ];

  const chain = buildReportingChain(nodes, "employee", "member");

  assert.deepStrictEqual(chain, ["ceo"]);
});

test("validateOrgHierarchy detects depth exceeding 5", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "l0", parentOrgNodeId: null }),
    mockOrgNode({ orgNodeId: "l1", parentOrgNodeId: "l0" }),
    mockOrgNode({ orgNodeId: "l2", parentOrgNodeId: "l1" }),
    mockOrgNode({ orgNodeId: "l3", parentOrgNodeId: "l2" }),
    mockOrgNode({ orgNodeId: "l4", parentOrgNodeId: "l3" }),
    mockOrgNode({ orgNodeId: "l5", parentOrgNodeId: "l4" }),
    mockOrgNode({ orgNodeId: "l6", parentOrgNodeId: "l5" }),
  ];

  const findings = validateOrgHierarchy(nodes);

  assert.ok(findings.some((f) => f.includes("exceeds_max_depth")));
});

test("listAncestorNodeIds returns empty for nonexistent node", () => {
  const nodes = [mockOrgNode({ orgNodeId: "existing", parentOrgNodeId: null })];

  const ancestors = listAncestorNodeIds(nodes, "nonexistent");

  assert.strictEqual(ancestors.length, 0);
});

test("listDescendantNodeIds returns empty for nonexistent node", () => {
  const nodes = [mockOrgNode({ orgNodeId: "existing", parentOrgNodeId: null })];

  const descendants = listDescendantNodeIds(nodes, "nonexistent");

  assert.strictEqual(descendants.length, 0);
});
