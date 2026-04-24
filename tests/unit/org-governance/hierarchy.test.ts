/**
 * Unit tests for org-model/hierarchy module
 *
 * @see src/org-governance/org-model/hierarchy/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { OrgNode, OrgChangeEvent } from "../../../src/org-governance/org-model/org-node/index.js";
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
} from "../../../src/org-governance/org-model/hierarchy/index.js";

// Mock OrgNode factory
function createMockOrgNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType: OrgNode["nodeType"] }): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType,
    displayName: overrides.displayName ?? `Node ${overrides.orgNodeId}`,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
  };
}

const COMPANY = createMockOrgNode({ orgNodeId: "company-1", nodeType: "company" });
const DIVISION = createMockOrgNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" });
const DEPARTMENT = createMockOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "division-1" });
const TEAM = createMockOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["manager-1"] });
const MEMBER = createMockOrgNode({ orgNodeId: "member-1", nodeType: "member", parentOrgNodeId: "team-1", ownerUserIds: ["user-1"] });
const MEMBER2 = createMockOrgNode({ orgNodeId: "member-2", nodeType: "member", parentOrgNodeId: "team-1", ownerUserIds: ["user-2"] });

const SAMPLE_HIERARCHY: readonly OrgNode[] = [COMPANY, DIVISION, DEPARTMENT, TEAM, MEMBER, MEMBER2];

test("validateOrgHierarchy passes for valid hierarchy", () => {
  const findings = validateOrgHierarchy(SAMPLE_HIERARCHY);
  assert.deepStrictEqual(findings, []);
});

test("validateOrgHierarchy detects missing parent", () => {
  const orphanNode = createMockOrgNode({ orgNodeId: "orphan", nodeType: "team", parentOrgNodeId: "nonexistent" });
  const findings = validateOrgHierarchy([COMPANY, orphanNode]);
  assert.ok(findings.some(f => f.includes("org_hierarchy.missing_parent:orphan")), "should report missing parent");
});

test("validateOrgHierarchy detects self-cycle", () => {
  const selfCycleNode = createMockOrgNode({ orgNodeId: "self-cycle", nodeType: "company", parentOrgNodeId: "self-cycle" });
  const findings = validateOrgHierarchy([selfCycleNode]);
  assert.ok(findings.some(f => f.includes("org_hierarchy.self_cycle:self-cycle")), "should report self cycle");
});

test("validateOrgHierarchy detects exceeding max depth", () => {
  const nodes: OrgNode[] = [];
  let parent: string | null = null;
  for (let i = 0; i < 7; i++) {
    const id = `depth-node-${i}`;
    nodes.push(createMockOrgNode({ orgNodeId: id, nodeType: i === 6 ? "member" : "team", parentOrgNodeId: parent }));
    parent = id;
  }
  const findings = validateOrgHierarchy(nodes);
  assert.ok(findings.some(f => f.includes("org_hierarchy.exceeds_max_depth")), "should report max depth exceeded");
});

test("validateOrgHierarchy allows empty nodes", () => {
  const findings = validateOrgHierarchy([]);
  assert.deepStrictEqual(findings, []);
});

test("listAncestorNodeIds returns correct ancestors", () => {
  const ancestors = listAncestorNodeIds(SAMPLE_HIERARCHY, "member-1");
  assert.deepStrictEqual(ancestors, ["team-1", "dept-1", "division-1", "company-1"]);
});

test("listAncestorNodeIds returns empty for root node", () => {
  const ancestors = listAncestorNodeIds(SAMPLE_HIERARCHY, "company-1");
  assert.deepStrictEqual(ancestors, []);
});

test("listAncestorNodeIds returns empty for nonexistent node", () => {
  const ancestors = listAncestorNodeIds(SAMPLE_HIERARCHY, "nonexistent");
  assert.deepStrictEqual(ancestors, []);
});

test("listDescendantNodeIds returns correct descendants", () => {
  const descendants = listDescendantNodeIds(SAMPLE_HIERARCHY, "company-1");
  assert.deepStrictEqual(descendants.sort(), ["division-1", "dept-1", "team-1", "member-1", "member-2"].sort());
});

test("listDescendantNodeIds returns direct children only", () => {
  const descendants = listDescendantNodeIds(SAMPLE_HIERARCHY, "division-1");
  assert.deepStrictEqual(descendants.sort(), ["dept-1", "team-1", "member-1", "member-2"].sort());
});

test("listDescendantNodeIds returns empty for leaf node", () => {
  const descendants = listDescendantNodeIds(SAMPLE_HIERARCHY, "member-1");
  assert.deepStrictEqual(descendants, []);
});

test("findRootNode returns company level node", () => {
  const root = findRootNode(SAMPLE_HIERARCHY);
  assert.strictEqual(root?.orgNodeId, "company-1");
  assert.strictEqual(root?.nodeType, "company");
});

test("findRootNode returns null for empty hierarchy", () => {
  const root = findRootNode([]);
  assert.strictEqual(root, null);
});

test("findRootNode returns null when no root exists", () => {
  const noRoot = SAMPLE_HIERARCHY.filter(n => n.orgNodeId !== "company-1");
  const root = findRootNode(noRoot);
  assert.strictEqual(root, null);
});

test("getNodesAtLevel returns nodes at specified level", () => {
  const level0 = getNodesAtLevel(SAMPLE_HIERARCHY, 0);
  assert.deepStrictEqual(level0.map(n => n.orgNodeId), ["company-1"]);

  const level1 = getNodesAtLevel(SAMPLE_HIERARCHY, 1);
  assert.deepStrictEqual(level1.map(n => n.orgNodeId), ["division-1"]);
});

test("getNodesAtLevel returns empty array for invalid level", () => {
  const level99 = getNodesAtLevel(SAMPLE_HIERARCHY, 99);
  assert.deepStrictEqual(level99, []);
});

test("getNodeDepth returns correct depth for root", () => {
  const depth = getNodeDepth(SAMPLE_HIERARCHY, "company-1");
  assert.strictEqual(depth, 0);
});

test("getNodeDepth returns correct depth for leaf", () => {
  const depth = getNodeDepth(SAMPLE_HIERARCHY, "member-1");
  assert.strictEqual(depth, 4);
});

test("getNodeDepth returns 0 for nonexistent node", () => {
  const depth = getNodeDepth(SAMPLE_HIERARCHY, "nonexistent");
  assert.strictEqual(depth, 0);
});

test("findLowestCommonAncestor returns correct ancestor", () => {
  const lca = findLowestCommonAncestor(SAMPLE_HIERARCHY, "member-1", "member-2");
  assert.strictEqual(lca, "team-1");
});

test("findLowestCommonAncestor returns root for cross-branch nodes", () => {
  const sibling1 = createMockOrgNode({ orgNodeId: "sibling-1", nodeType: "member", parentOrgNodeId: "dept-1", ownerUserIds: ["user-s1"] });
  const sibling2 = createMockOrgNode({ orgNodeId: "sibling-2", nodeType: "member", parentOrgNodeId: "dept-1", ownerUserIds: ["user-s2"] });
  const hierarchyWithSiblings: OrgNode[] = [...SAMPLE_HIERARCHY, sibling1, sibling2];

  const lca = findLowestCommonAncestor(hierarchyWithSiblings, "member-1", "sibling-1");
  assert.strictEqual(lca, "dept-1");
});

test("findLowestCommonAncestor returns same node for self", () => {
  const lca = findLowestCommonAncestor(SAMPLE_HIERARCHY, "team-1", "team-1");
  assert.strictEqual(lca, "team-1");
});

test("findLowestCommonAncestor returns null for no common ancestor", () => {
  const otherCompany = createMockOrgNode({ orgNodeId: "other-company", nodeType: "company" });
  const otherDivision = createMockOrgNode({ orgNodeId: "other-division", nodeType: "division", parentOrgNodeId: "other-company" });
  const otherHierarchy: OrgNode[] = [otherCompany, otherDivision];

  const lca = findLowestCommonAncestor([...SAMPLE_HIERARCHY, ...otherHierarchy], "member-1", "other-division");
  assert.strictEqual(lca, null);
});

test("buildReportingChain returns manager chain", () => {
  const chain = buildReportingChain(SAMPLE_HIERARCHY, "user-1", "member-1");
  assert.deepStrictEqual(chain, ["manager-1"]);
});

test("buildReportingChain skips nodes without owners", () => {
  const nodeWithoutOwner = createMockOrgNode({ orgNodeId: "dept-no-owner", nodeType: "department", parentOrgNodeId: "division-1", ownerUserIds: [] });
  const teamWithOwner = createMockOrgNode({ orgNodeId: "team-with-owner", nodeType: "team", parentOrgNodeId: "dept-no-owner", ownerUserIds: ["manager-2"] });
  const memberWithoutOwner = createMockOrgNode({ orgNodeId: "member-no-owner", nodeType: "member", parentOrgNodeId: "team-with-owner", ownerUserIds: ["user-3"] });
  const hierarchy: OrgNode[] = [...SAMPLE_HIERARCHY, nodeWithoutOwner, teamWithOwner, memberWithoutOwner];

  const chain = buildReportingChain(hierarchy, "user-3", "member-no-owner");
  assert.deepStrictEqual(chain, ["manager-2"]);
});

test("buildReportingChain returns empty for root node", () => {
  const chain = buildReportingChain(SAMPLE_HIERARCHY, "admin", "company-1");
  assert.deepStrictEqual(chain, []);
});

test("detectOrgChangeEvents detects employee offboarding", () => {
  const before = SAMPLE_HIERARCHY;
  const after = SAMPLE_HIERARCHY.filter(n => n.orgNodeId !== "member-1");

  const events = detectOrgChangeEvents(before, after);
  assert.ok(events.some(e => e.type === "employee_offboarding" && e.userId === "user-1"), "should detect offboarding");
});

test("detectOrgChangeEvents detects employee onboarding", () => {
  const before = SAMPLE_HIERARCHY;
  const newMember = createMockOrgNode({ orgNodeId: "new-member", nodeType: "member", parentOrgNodeId: "team-1", ownerUserIds: ["new-user"] });
  const after = [...SAMPLE_HIERARCHY, newMember];

  const events = detectOrgChangeEvents(before, after);
  assert.ok(events.some(e => e.type === "employee_onboarding" && e.userId === "new-user"), "should detect onboarding");
});

test("detectOrgChangeEvents detects employee transfer", () => {
  const before = SAMPLE_HIERARCHY;
  const newTeam = createMockOrgNode({ orgNodeId: "team-2", nodeType: "team", parentOrgNodeId: "dept-1", ownerUserIds: ["manager-2"] });
  const transferredMember = createMockOrgNode({ orgNodeId: "member-1", nodeType: "member", parentOrgNodeId: "team-2", ownerUserIds: ["user-1"] });
  const after = [COMPANY, DIVISION, DEPARTMENT, newTeam, transferredMember, MEMBER2];

  const events = detectOrgChangeEvents(before, after);
  assert.ok(events.some(e => e.type === "employee_transfer" && e.userId === "user-1"), "should detect transfer");
});

test("detectOrgChangeEvents returns empty for identical hierarchies", () => {
  const events = detectOrgChangeEvents(SAMPLE_HIERARCHY, SAMPLE_HIERARCHY);
  assert.deepStrictEqual(events, []);
});

test("detectOrgChangeEvents ignores non-member nodes for offboarding", () => {
  const before = SAMPLE_HIERARCHY;
  const after = SAMPLE_HIERARCHY.filter(n => n.orgNodeId !== "team-1");

  const events = detectOrgChangeEvents(before, after);
  assert.ok(!events.some(e => e.type === "employee_offboarding"), "should not detect member offboarding for team removal");
});

test("detectOrgChangeEvents handles multiple changes", () => {
  const before = SAMPLE_HIERARCHY;
  const newMember = createMockOrgNode({ orgNodeId: "new-member", nodeType: "member", parentOrgNodeId: "team-1", ownerUserIds: ["new-user"] });
  const after = [...SAMPLE_HIERARCHY.filter(n => n.orgNodeId !== "member-2"), newMember];

  const events = detectOrgChangeEvents(before, after);
  assert.ok(events.length >= 2, "should detect multiple events");
  assert.ok(events.some(e => e.type === "employee_offboarding"), "should detect offboarding");
  assert.ok(events.some(e => e.type === "employee_onboarding"), "should detect onboarding");
});
