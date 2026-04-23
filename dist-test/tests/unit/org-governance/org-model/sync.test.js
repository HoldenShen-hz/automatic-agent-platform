/**
 * Unit tests for org-model sync functions
 *
 * @see src/org-governance/org-model/sync/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OrgSyncRecordSchema, mergeOrgNodes, buildOrgChart, diffOrgCharts, } from "../../../../src/org-governance/org-model/sync/index.js";
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
// Helper to create an OrgChart (requires valid root in nodes)
function createOrgChart(nodes, syncSource = "manual") {
    const root = nodes.find((n) => n.parentOrgNodeId === null);
    if (!root) {
        throw new Error("Cannot create OrgChart: no root node found");
    }
    return {
        root,
        nodes,
        syncSource,
        lastSyncedAt: new Date().toISOString(),
    };
}
// Helper to create an OrgChart with explicit root (for edge cases)
function createOrgChartWithRoot(root, nodes, syncSource = "manual") {
    return {
        root,
        nodes,
        syncSource,
        lastSyncedAt: new Date().toISOString(),
    };
}
test("OrgSyncRecordSchema parses valid sync record", () => {
    const record = {
        syncId: "sync-1",
        providerId: "provider-1",
        changedNodeIds: ["node-1", "node-2"],
        completedAt: "2026-04-23T10:00:00Z",
    };
    const result = OrgSyncRecordSchema.safeParse(record);
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.syncId, "sync-1");
        assert.equal(result.data.providerId, "provider-1");
        assert.deepEqual(result.data.changedNodeIds, ["node-1", "node-2"]);
    }
});
test("OrgSyncRecordSchema has correct defaults for changedNodeIds", () => {
    const record = {
        syncId: "sync-1",
        providerId: "provider-1",
        completedAt: "2026-04-23T10:00:00Z",
    };
    const result = OrgSyncRecordSchema.safeParse(record);
    assert.equal(result.success, true);
    if (result.success) {
        assert.deepEqual(result.data.changedNodeIds, []);
    }
});
test("OrgSyncRecordSchema requires non-empty syncId", () => {
    const result = OrgSyncRecordSchema.safeParse({
        syncId: "",
        providerId: "provider-1",
        completedAt: "2026-04-23T10:00:00Z",
    });
    assert.equal(result.success, false);
});
test("OrgSyncRecordSchema requires non-empty providerId", () => {
    const result = OrgSyncRecordSchema.safeParse({
        syncId: "sync-1",
        providerId: "",
        completedAt: "2026-04-23T10:00:00Z",
    });
    assert.equal(result.success, false);
});
test("OrgSyncRecordSchema requires non-empty completedAt", () => {
    const result = OrgSyncRecordSchema.safeParse({
        syncId: "sync-1",
        providerId: "provider-1",
        completedAt: "",
    });
    assert.equal(result.success, false);
});
test("mergeOrgNodes returns empty array for empty existing and incoming", () => {
    const result = mergeOrgNodes([], []);
    assert.deepEqual(result, []);
});
test("mergeOrgNodes returns all nodes from existing when incoming is empty", () => {
    const existing = [
        createNode({ orgNodeId: "node-1" }),
        createNode({ orgNodeId: "node-2" }),
    ];
    const result = mergeOrgNodes(existing, []);
    assert.equal(result.length, 2);
});
test("mergeOrgNodes returns all nodes from incoming when existing is empty", () => {
    const incoming = [
        createNode({ orgNodeId: "node-1" }),
        createNode({ orgNodeId: "node-2" }),
    ];
    const result = mergeOrgNodes([], incoming);
    assert.equal(result.length, 2);
});
test("mergeOrgNodes merges nodes with same ID by taking incoming", () => {
    const existing = [
        createNode({ orgNodeId: "node-1", displayName: "Old Name" }),
    ];
    const incoming = [
        createNode({ orgNodeId: "node-1", displayName: "New Name" }),
    ];
    const result = mergeOrgNodes(existing, incoming);
    assert.equal(result.length, 1);
    assert.equal(result[0].displayName, "New Name");
});
test("mergeOrgNodes combines unique nodes from both arrays", () => {
    const existing = [
        createNode({ orgNodeId: "node-1" }),
        createNode({ orgNodeId: "node-2" }),
    ];
    const incoming = [
        createNode({ orgNodeId: "node-3" }),
        createNode({ orgNodeId: "node-4" }),
    ];
    const result = mergeOrgNodes(existing, incoming);
    assert.equal(result.length, 4);
});
test("mergeOrgNodes handles overlapping nodes correctly", () => {
    const existing = [
        createNode({ orgNodeId: "node-1", displayName: "Existing 1" }),
        createNode({ orgNodeId: "node-2", displayName: "Existing 2" }),
        createNode({ orgNodeId: "node-3", displayName: "Existing 3" }),
    ];
    const incoming = [
        createNode({ orgNodeId: "node-2", displayName: "Updated 2" }),
        createNode({ orgNodeId: "node-4", displayName: "New 4" }),
    ];
    const result = mergeOrgNodes(existing, incoming);
    assert.equal(result.length, 4);
    const node1 = result.find((n) => n.orgNodeId === "node-1");
    assert.equal(node1?.displayName, "Existing 1");
    const node2 = result.find((n) => n.orgNodeId === "node-2");
    assert.equal(node2?.displayName, "Updated 2");
    const node3 = result.find((n) => n.orgNodeId === "node-3");
    assert.equal(node3?.displayName, "Existing 3");
    const node4 = result.find((n) => n.orgNodeId === "node-4");
    assert.equal(node4?.displayName, "New 4");
});
test("buildOrgChart creates valid org chart with root and nodes", () => {
    const nodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" }),
    ];
    const result = buildOrgChart(nodes, "scim");
    assert.equal(result.root.orgNodeId, "company-1");
    assert.equal(result.nodes.length, 2);
    assert.equal(result.syncSource, "scim");
    assert.ok(result.lastSyncedAt);
});
test("buildOrgChart throws error when no root node found", () => {
    const nodes = [
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "unknown" }),
    ];
    assert.throws(() => buildOrgChart(nodes, "manual"), /Cannot build OrgChart: no root node found/);
});
test("buildOrgChart throws error for empty nodes array", () => {
    assert.throws(() => buildOrgChart([], "hr_api"), /Cannot build OrgChart: no root node found/);
});
test("buildOrgChart sets lastSyncedAt to current ISO string", () => {
    const nodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
    ];
    const before = Date.now();
    const result = buildOrgChart(nodes, "manual");
    const after = Date.now();
    const syncedAt = Date.parse(result.lastSyncedAt);
    assert.ok(syncedAt >= before);
    assert.ok(syncedAt <= after);
});
test("diffOrgCharts returns empty array when charts are identical", () => {
    const nodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" }),
    ];
    const before = createOrgChart(nodes);
    const after = createOrgChart(nodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, []);
});
test("diffOrgCharts returns changed node IDs when displayName changes", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, displayName: "Old Name" }),
    ];
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, displayName: "New Name" }),
    ];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, ["company-1"]);
});
test("diffOrgCharts returns changed node IDs when parentOrgNodeId changes", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" }),
    ];
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "unknown" }),
    ];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, ["division-1"]);
});
test("diffOrgCharts returns changed node IDs when ownerUserIds changes", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, ownerUserIds: ["user-1"] }),
    ];
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, ownerUserIds: ["user-1", "user-2"] }),
    ];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, ["company-1"]);
});
test("diffOrgCharts returns changed node IDs when active changes", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, active: true }),
    ];
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, active: false }),
    ];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, ["company-1"]);
});
test("diffOrgCharts returns changed node IDs for new nodes", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
    ];
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" }),
    ];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, ["division-1"]);
});
test("diffOrgCharts returns multiple changed node IDs", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, displayName: "Old" }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1", active: true }),
    ];
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null, displayName: "New" }),
        createNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1", active: false }),
    ];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.equal(result.length, 2);
    assert.ok(result.includes("company-1"));
    assert.ok(result.includes("division-1"));
});
test("diffOrgCharts handles empty before chart", () => {
    const afterNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
    ];
    const root = afterNodes[0];
    const before = createOrgChartWithRoot(root, [], "manual");
    const after = createOrgChart(afterNodes);
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, ["company-1"]);
});
test("diffOrgCharts handles empty after chart", () => {
    const beforeNodes = [
        createNode({ orgNodeId: "company-1", nodeType: "company", parentOrgNodeId: null }),
    ];
    const root = beforeNodes[0];
    const before = createOrgChart(beforeNodes);
    const after = createOrgChartWithRoot(root, [], "manual");
    // diffOrgCharts only iterates over after.nodes, so with empty nodes it returns []
    // This is correct behavior - the root in after.root is not in after.nodes
    const result = diffOrgCharts(before, after);
    assert.deepEqual(result, []);
});
//# sourceMappingURL=sync.test.js.map