/**
 * Unit tests for OrgChart and sync functions
 *
 * @see src/org-governance/org-model/org-node/index.ts
 * @see src/org-governance/org-model/sync/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildOrgChart, diffOrgCharts, mergeOrgNodes, } from "../../../../src/org-governance/org-model/sync/index.js";
// Helper to create org nodes
function createNode(overrides = {}) {
    return {
        orgNodeId: overrides.orgNodeId ?? "node-1",
        displayName: overrides.displayName ?? "Node",
        nodeType: overrides.nodeType ?? "company",
        parentOrgNodeId: overrides.parentOrgNodeId ?? null,
        ownerUserIds: overrides.ownerUserIds ?? [],
        metadata: overrides.metadata ?? {},
        active: overrides.active ?? true,
        costCenter: overrides.costCenter ?? "",
        ...overrides,
    };
}
test("buildOrgChart creates chart with root node", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    ];
    const chart = buildOrgChart(nodes, "scim");
    assert.equal(chart.root.orgNodeId, "company");
    assert.equal(chart.syncSource, "scim");
    assert.equal(chart.nodes.length, 2);
    assert.ok(chart.lastSyncedAt);
});
test("buildOrgChart throws when no root node", () => {
    const nodes = [
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "unknown" }),
    ];
    assert.throws(() => buildOrgChart(nodes, "manual"), /no root node/);
});
test("buildOrgChart accepts valid sync sources", () => {
    const nodes = [createNode({ orgNodeId: "company", nodeType: "company" })];
    const scimChart = buildOrgChart(nodes, "scim");
    assert.equal(scimChart.syncSource, "scim");
    const manualChart = buildOrgChart(nodes, "manual");
    assert.equal(manualChart.syncSource, "manual");
    const hrApiChart = buildOrgChart(nodes, "hr_api");
    assert.equal(hrApiChart.syncSource, "hr_api");
});
test("mergeOrgNodes combines two node collections", () => {
    const existing = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
    ];
    const incoming = [
        createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
        createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
    ];
    const merged = mergeOrgNodes(existing, incoming);
    assert.equal(merged.length, 3);
    assert.ok(merged.some((n) => n.orgNodeId === "company"));
    assert.ok(merged.some((n) => n.orgNodeId === "division"));
    assert.ok(merged.some((n) => n.orgNodeId === "team"));
});
test("mergeOrgNodes prefers incoming nodes on conflict", () => {
    const existing = [
        createNode({ orgNodeId: "team", displayName: "Old Name", nodeType: "team", parentOrgNodeId: "division" }),
    ];
    const incoming = [
        createNode({ orgNodeId: "team", displayName: "New Name", nodeType: "team", parentOrgNodeId: "division" }),
    ];
    const merged = mergeOrgNodes(existing, incoming);
    const team = merged.find((n) => n.orgNodeId === "team");
    assert.ok(team);
    assert.equal(team.displayName, "New Name");
});
test("mergeOrgNodes handles empty existing collection", () => {
    const existing = [];
    const incoming = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
    ];
    const merged = mergeOrgNodes(existing, incoming);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].orgNodeId, "company");
});
test("mergeOrgNodes handles empty incoming collection", () => {
    const existing = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
    ];
    const incoming = [];
    const merged = mergeOrgNodes(existing, incoming);
    assert.equal(merged.length, 1);
});
test("diffOrgCharts detects new nodes", () => {
    const before = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [createNode({ orgNodeId: "company", nodeType: "company" })],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    assert.ok(changed.includes("division"));
});
test("diffOrgCharts detects displayName changes", () => {
    const before = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [createNode({ orgNodeId: "company", displayName: "Old Name", nodeType: "company" })],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [createNode({ orgNodeId: "company", displayName: "New Name", nodeType: "company" })],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    assert.ok(changed.includes("company"));
});
test("diffOrgCharts detects parentOrgNodeId changes", () => {
    const before = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company" }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    assert.ok(changed.includes("team"));
});
test("diffOrgCharts detects ownerUserIds changes", () => {
    const before = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company", ownerUserIds: ["user-2"] }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    assert.ok(changed.includes("team"));
});
test("diffOrgCharts detects active status changes", () => {
    const before = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company", active: true }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company", active: false }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    assert.ok(changed.includes("team"));
});
test("diffOrgCharts returns empty when no changes", () => {
    const node = createNode({ orgNodeId: "company", nodeType: "company" });
    const before = {
        root: node,
        nodes: [node],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: node,
        nodes: [node],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    assert.equal(changed.length, 0);
});
test("diffOrgCharts is order-sensitive for ownerUserIds", () => {
    // Note: diffOrgCharts uses join(",") comparison which is order-sensitive
    const before = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company", ownerUserIds: ["user-1", "user-2"] }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const after = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes: [
            createNode({ orgNodeId: "company", nodeType: "company" }),
            createNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company", ownerUserIds: ["user-2", "user-1"] }),
        ],
        syncSource: "scim",
        lastSyncedAt: new Date().toISOString(),
    };
    const changed = diffOrgCharts(before, after);
    // Order difference is detected because join(",") produces different strings
    assert.ok(changed.includes("team"));
});
test("OrgChart interface accepts readonly nodes", () => {
    const nodes = [
        createNode({ orgNodeId: "company", nodeType: "company" }),
    ];
    const chart = {
        root: createNode({ orgNodeId: "company", nodeType: "company" }),
        nodes,
        syncSource: "manual",
        lastSyncedAt: new Date().toISOString(),
    };
    assert.equal(chart.nodes.length, 1);
    assert.equal(chart.syncSource, "manual");
});
//# sourceMappingURL=org-chart.test.js.map