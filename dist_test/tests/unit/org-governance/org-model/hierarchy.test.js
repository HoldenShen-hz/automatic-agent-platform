/**
 * Unit tests for OrgModel hierarchy functions
 *
 * @see src/org-governance/org-model/hierarchy/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateOrgHierarchy, listAncestorNodeIds, listDescendantNodeIds, findRootNode, getNodesAtLevel, getNodeDepth, findLowestCommonAncestor, buildReportingChain, detectOrgChangeEvents, } from "../../../../src/org-governance/org-model/hierarchy/index.js";
// Helper to create org nodes
function createNode(overrides = {}) {
    return {
        orgNodeId: overrides.orgNodeId ?? "node-1",
        name: overrides.name ?? "Node",
        nodeType: overrides.nodeType ?? "company",
        parentOrgNodeId: overrides.parentOrgNodeId ?? null,
        ownerUserIds: overrides.ownerUserIds ?? [],
        metadataJson: overrides.metadataJson ?? "{}",
        ...overrides,
    };
}
test("validateOrgHierarchy passes valid hierarchy", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
    ];
    const findings = validateOrgHierarchy(nodes);
    assert.equal(findings.length, 0);
});
test("validateOrgHierarchy detects missing parent", () => {
    const nodes = [
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "unknown-parent" }),
    ];
    const findings = validateOrgHierarchy(nodes);
    assert.ok(findings.some((f) => f.includes("org_hierarchy.missing_parent")));
});
test("validateOrgHierarchy detects self-cycle", () => {
    const nodes = [
        createNode({ orgNodeId: "node", nodeType: "company", parentOrgNodeId: "node" }),
    ];
    const findings = validateOrgHierarchy(nodes);
    assert.ok(findings.some((f) => f.includes("org_hierarchy.self_cycle")));
});
test("listAncestorNodeIds returns correct ancestors", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "department", nodeType: "department", parentOrgNodeId: "division" }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "department" }),
    ];
    const ancestors = listAncestorNodeIds(nodes, "team");
    assert.deepEqual(ancestors, ["department", "division", "company"]);
});
test("listAncestorNodeIds returns empty for root node", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
    ];
    const ancestors = listAncestorNodeIds(nodes, "company");
    assert.deepEqual(ancestors, []);
});
test("listDescendantNodeIds returns correct descendants", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
    ];
    const descendants = listDescendantNodeIds(nodes, "company");
    assert.deepEqual(descendants.sort(), ["division", "team"]);
});
test("findRootNode returns company level node", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    ];
    const root = findRootNode(nodes);
    assert.ok(root);
    assert.equal(root.orgNodeId, "company");
    assert.equal(root.nodeType, "company");
});
test("findRootNode returns null for empty array", () => {
    const root = findRootNode([]);
    assert.equal(root, null);
});
test("getNodesAtLevel returns nodes at specified depth", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division-a", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "division-b", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division-a" }),
    ];
    const level1 = getNodesAtLevel(nodes, 1);
    assert.equal(level1.length, 2);
    assert.ok(level1.some((n) => n.orgNodeId === "division-a"));
    assert.ok(level1.some((n) => n.orgNodeId === "division-b"));
});
test("getNodeDepth returns correct depth for each node", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
    ];
    assert.equal(getNodeDepth(nodes, "company"), 0);
    assert.equal(getNodeDepth(nodes, "division"), 1);
    assert.equal(getNodeDepth(nodes, "team"), 2);
});
test("findLowestCommonAncestor returns correct ancestor", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division-a", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "division-b", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "team-a", nodeType: "team", parentOrgNodeId: "division-a" }),
        createNode({ orgNodeId: "team-b", nodeType: "team", parentOrgNodeId: "division-b" }),
    ];
    const lca = findLowestCommonAncestor(nodes, "team-a", "team-b");
    assert.equal(lca, "company");
});
test("buildReportingChain returns manager chain", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"] }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company", ownerUserIds: ["vp"] }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division", ownerUserIds: ["manager"] }),
        createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team", ownerUserIds: ["employee"] }),
    ];
    const chain = buildReportingChain(nodes, "employee", "member");
    assert.deepEqual(chain, ["manager", "vp", "ceo"]);
});
test("detectOrgChangeEvents detects offboarding", () => {
    const before = [
        createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team", ownerUserIds: ["user-1"] }),
    ];
    const after = [];
    const events = detectOrgChangeEvents(before, after);
    assert.ok(events.some((e) => e.type === "employee_offboarding"));
});
test("detectOrgChangeEvents detects onboarding", () => {
    const before = [];
    const after = [
        createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team", ownerUserIds: ["user-1"] }),
    ];
    const events = detectOrgChangeEvents(before, after);
    assert.ok(events.some((e) => e.type === "employee_onboarding"));
});
test("detectOrgChangeEvents detects transfer", () => {
    const before = [
        createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team-a", ownerUserIds: ["user-1"] }),
    ];
    const after = [
        createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team-b", ownerUserIds: ["user-1"] }),
    ];
    const events = detectOrgChangeEvents(before, after);
    assert.ok(events.some((e) => e.type === "employee_transfer"));
});
test("detectOrgChangeEvents returns empty for no changes", () => {
    const nodes = [
        createNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team", ownerUserIds: ["user-1"] }),
    ];
    const events = detectOrgChangeEvents(nodes, nodes);
    assert.equal(events.length, 0);
});
//# sourceMappingURL=hierarchy.test.js.map