/**
 * Unit tests for org-model/sync module
 *
 * @see src/org-governance/org-model/sync/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OrgSyncRecordSchema, mergeOrgNodes, buildOrgChart, diffOrgCharts, } from "../../../src/org-governance/org-model/sync/index.js";
// ─────────────────────────────────────────────────────────────────────────────
// Mock OrgNode factory
// ─────────────────────────────────────────────────────────────────────────────
function createOrgNode(overrides) {
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
// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Tests
// ─────────────────────────────────────────────────────────────────────────────
test("OrgSyncRecordSchema validates valid record", () => {
    const record = OrgSyncRecordSchema.parse({
        syncId: "sync-1",
        providerId: "scim-provider",
        changedNodeIds: ["node-1", "node-2"],
        completedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(record.syncId, "sync-1");
    assert.equal(record.providerId, "scim-provider");
    assert.deepStrictEqual(record.changedNodeIds, ["node-1", "node-2"]);
    assert.equal(record.completedAt, "2026-04-20T00:00:00.000Z");
});
test("OrgSyncRecordSchema applies defaults", () => {
    const record = OrgSyncRecordSchema.parse({
        syncId: "sync-1",
        providerId: "hr-api",
        completedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.deepStrictEqual(record.changedNodeIds, []);
});
test("OrgSyncRecordSchema rejects empty syncId", () => {
    assert.throws(() => OrgSyncRecordSchema.parse({
        syncId: "",
        providerId: "scim",
        completedAt: "2026-04-20T00:00:00.000Z",
    }));
});
test("OrgSyncRecordSchema rejects empty providerId", () => {
    assert.throws(() => OrgSyncRecordSchema.parse({
        syncId: "sync-1",
        providerId: "",
        completedAt: "2026-04-20T00:00:00.000Z",
    }));
});
// ─────────────────────────────────────────────────────────────────────────────
// mergeOrgNodes Tests
// ─────────────────────────────────────────────────────────────────────────────
test("mergeOrgNodes adds new nodes", () => {
    const existing = [
        createOrgNode({ orgNodeId: "node-1", nodeType: "department" }),
    ];
    const incoming = [
        createOrgNode({ orgNodeId: "node-2", nodeType: "team" }),
    ];
    const result = mergeOrgNodes(existing, incoming);
    assert.equal(result.length, 2);
    assert.ok(result.some((n) => n.orgNodeId === "node-1"));
    assert.ok(result.some((n) => n.orgNodeId === "node-2"));
});
test("mergeOrgNodes updates existing nodes", () => {
    const existing = [
        createOrgNode({ orgNodeId: "node-1", nodeType: "department", displayName: "Old Name" }),
    ];
    const incoming = [
        createOrgNode({ orgNodeId: "node-1", nodeType: "department", displayName: "New Name" }),
    ];
    const result = mergeOrgNodes(existing, incoming);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.displayName, "New Name");
});
test("mergeOrgNodes gives precedence to incoming for same ID", () => {
    const existing = [
        createOrgNode({
            orgNodeId: "node-1",
            nodeType: "department",
            displayName: "Existing",
            ownerUserIds: ["user-1"],
            active: true,
        }),
    ];
    const incoming = [
        createOrgNode({
            orgNodeId: "node-1",
            nodeType: "department",
            displayName: "Updated",
            ownerUserIds: ["user-2"],
            active: false,
        }),
    ];
    const result = mergeOrgNodes(existing, incoming);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.displayName, "Updated");
    assert.deepStrictEqual(result[0]?.ownerUserIds, ["user-2"]);
    assert.equal(result[0]?.active, false);
});
test("mergeOrgNodes handles empty existing", () => {
    const result = mergeOrgNodes([], [
        createOrgNode({ orgNodeId: "node-1", nodeType: "team" }),
    ]);
    assert.equal(result.length, 1);
});
test("mergeOrgNodes handles empty incoming", () => {
    const existing = [
        createOrgNode({ orgNodeId: "node-1", nodeType: "department" }),
    ];
    const result = mergeOrgNodes(existing, []);
    assert.equal(result.length, 1);
});
test("mergeOrgNodes handles both empty", () => {
    const result = mergeOrgNodes([], []);
    assert.deepStrictEqual(result, []);
});
// ─────────────────────────────────────────────────────────────────────────────
// buildOrgChart Tests
// ─────────────────────────────────────────────────────────────────────────────
test("buildOrgChart creates chart with root node", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1" }),
    ];
    const chart = buildOrgChart(nodes, "scim");
    assert.equal(chart.root.orgNodeId, "company-1");
    assert.equal(chart.nodes.length, 2);
    assert.equal(chart.syncSource, "scim");
    assert.ok(chart.lastSyncedAt.length > 0);
});
test("buildOrgChart sets correct sync sources", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
    ];
    const scimChart = buildOrgChart(nodes, "scim");
    assert.equal(scimChart.syncSource, "scim");
    const manualChart = buildOrgChart(nodes, "manual");
    assert.equal(manualChart.syncSource, "manual");
    const hrApiChart = buildOrgChart(nodes, "hr_api");
    assert.equal(hrApiChart.syncSource, "hr_api");
});
test("buildOrgChart throws when no root node", () => {
    const nodes = [
        createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "nonexistent" }),
    ];
    assert.throws(() => buildOrgChart(nodes, "scim"), /no root node/);
});
test("buildOrgChart uses last node as root when multiple have null parent", () => {
    // When multiple nodes have null parent, the last one in the array becomes root
    const nodes = [
        createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createOrgNode({ orgNodeId: "company-2", nodeType: "company", parentOrgNodeId: null }),
    ];
    const chart = buildOrgChart(nodes, "manual");
    // The first one found with null parent is used as root
    assert.ok(chart.root.orgNodeId.startsWith("company"));
});
// ─────────────────────────────────────────────────────────────────────────────
// diffOrgCharts Tests
// ─────────────────────────────────────────────────────────────────────────────
test("diffOrgCharts detects new nodes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1" }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, ["dept-1"]);
});
test("diffOrgCharts detects displayName changes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", displayName: "Old Name", parentOrgNodeId: null }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", displayName: "New Name", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", displayName: "New Name", parentOrgNodeId: null }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, ["company-1"]);
});
test("diffOrgCharts detects parentOrgNodeId changes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1" }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "division-1" }), // Moved
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, ["dept-1"]);
});
test("diffOrgCharts detects ownerUserIds changes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", ownerUserIds: ["user-1"] }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", ownerUserIds: ["user-2"] }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, ["dept-1"]);
});
test("diffOrgCharts detects active status changes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", active: true }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", active: false }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, ["dept-1"]);
});
test("diffOrgCharts returns empty when no changes", () => {
    const node = createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null });
    const before = {
        root: node,
        nodes: [node],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: node,
        nodes: [node],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, []);
});
test("diffOrgCharts ignores changes in metadata field", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", metadata: { key: "old" } }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", metadata: { key: "new" } }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, []);
});
test("diffOrgCharts ignores costCenter changes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", costCenter: "CC-old" }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", costCenter: "CC-new" }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed, []);
});
test("diffOrgCharts detects multiple changes", () => {
    const before = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1" }),
            createOrgNode({ orgNodeId: "dept-2", nodeType: "department", parentOrgNodeId: "company-1" }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-20T00:00:00.000Z",
    };
    const after = {
        root: createOrgNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        nodes: [
            createOrgNode({ orgNodeId: "company-1", nodeType: "company", displayName: "Renamed" }),
            createOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1" }),
            createOrgNode({ orgNodeId: "dept-2", nodeType: "department", parentOrgNodeId: "company-1", displayName: "New Dept 2" }),
            createOrgNode({ orgNodeId: "dept-3", nodeType: "department", parentOrgNodeId: "company-1" }),
        ],
        syncSource: "scim",
        lastSyncedAt: "2026-04-21T00:00:00.000Z",
    };
    const changed = diffOrgCharts(before, after);
    assert.deepStrictEqual(changed.sort(), ["company-1", "dept-2", "dept-3"]);
});
//# sourceMappingURL=org-sync.test.js.map