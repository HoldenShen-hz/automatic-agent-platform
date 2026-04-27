import assert from "node:assert/strict";
import test from "node:test";

import {
  OrgSyncRecordSchema,
  mergeOrgNodes,
  buildOrgChart,
  diffOrgCharts,
} from "../../../../../src/org-governance/org-model/sync/index.js";

test("OrgSyncRecordSchema validates correct record", () => {
  const valid = {
    syncId: "sync_123",
    providerId: "provider_abc",
    changedNodeIds: ["node_1", "node_2"],
    completedAt: "2026-04-14T12:00:00.000Z",
  };
  const result = OrgSyncRecordSchema.parse(valid);
  assert.equal(result.syncId, "sync_123");
  assert.equal(result.providerId, "provider_abc");
  assert.deepEqual(result.changedNodeIds, ["node_1", "node_2"]);
});

test("OrgSyncRecordSchema applies defaults", () => {
  const minimal = {
    syncId: "sync_min",
    providerId: "provider_min",
    completedAt: "2026-04-14T12:00:00.000Z",
  };
  const result = OrgSyncRecordSchema.parse(minimal);
  assert.deepEqual(result.changedNodeIds, []);
});

test("OrgSyncRecordSchema rejects empty syncId", () => {
  assert.throws(() => {
    OrgSyncRecordSchema.parse({
      syncId: "",
      providerId: "provider",
      completedAt: "2026-04-14T12:00:00.000Z",
    });
  });
});

test("mergeOrgNodes combines two node arrays", () => {
  const existing = [
    { orgNodeId: "node_1", displayName: "Node 1", parentOrgNodeId: null, ownerUserIds: [], active: true },
    { orgNodeId: "node_2", displayName: "Node 2", parentOrgNodeId: "node_1", ownerUserIds: [], active: true },
  ];
  const incoming = [
    { orgNodeId: "node_3", displayName: "Node 3", parentOrgNodeId: "node_1", ownerUserIds: [], active: true },
  ];
  const result = mergeOrgNodes(existing, incoming);
  assert.equal(result.length, 3);
  assert.ok(result.some((n) => n.orgNodeId === "node_1"));
  assert.ok(result.some((n) => n.orgNodeId === "node_2"));
  assert.ok(result.some((n) => n.orgNodeId === "node_3"));
});

test("mergeOrgNodes overwrites existing nodes", () => {
  const existing = [
    { orgNodeId: "node_1", displayName: "Old Name", parentOrgNodeId: null, ownerUserIds: [], active: true },
  ];
  const incoming = [
    { orgNodeId: "node_1", displayName: "New Name", parentOrgNodeId: null, ownerUserIds: [], active: true },
  ];
  const result = mergeOrgNodes(existing, incoming);
  assert.equal(result.length, 1);
  assert.equal(result[0].displayName, "New Name");
});

test("mergeOrgNodes with empty existing returns incoming", () => {
  const result = mergeOrgNodes([], [
    { orgNodeId: "node_1", displayName: "Node 1", parentOrgNodeId: null, ownerUserIds: [], active: true },
  ]);
  assert.equal(result.length, 1);
});

test("mergeOrgNodes with empty incoming returns existing", () => {
  const existing = [
    { orgNodeId: "node_1", displayName: "Node 1", parentOrgNodeId: null, ownerUserIds: [], active: true },
  ];
  const result = mergeOrgNodes(existing, []);
  assert.equal(result.length, 1);
});

test("buildOrgChart creates valid chart with root", () => {
  const nodes = [
    { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: ["user_1"], active: true },
    { orgNodeId: "child", displayName: "Child", parentOrgNodeId: "root", ownerUserIds: ["user_2"], active: true },
  ];
  const result = buildOrgChart(nodes, "manual");
  assert.equal(result.root.orgNodeId, "root");
  assert.equal(result.nodes.length, 2);
  assert.equal(result.syncSource, "manual");
  assert.ok(result.lastSyncedAt);
});

test("buildOrgChart throws when no root found", () => {
  const nodes = [
    { orgNodeId: "child", displayName: "Child", parentOrgNodeId: "nonexistent", ownerUserIds: [], active: true },
  ];
  assert.throws(() => {
    buildOrgChart(nodes, "manual");
  }, /no root node found/);
});

test("diffOrgCharts detects new nodes", () => {
  const before = {
    root: { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:00:00.000Z",
  };
  const after = {
    root: { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true },
      { orgNodeId: "new", displayName: "New Node", parentOrgNodeId: "root", ownerUserIds: [], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:01:00.000Z",
  };
  const changed = diffOrgCharts(before, after);
  assert.deepEqual(changed, ["new"]);
});

test("diffOrgCharts detects name changes", () => {
  const before = {
    root: { orgNodeId: "root", displayName: "Old Name", parentOrgNodeId: null, ownerUserIds: [], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "Old Name", parentOrgNodeId: null, ownerUserIds: [], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:00:00.000Z",
  };
  const after = {
    root: { orgNodeId: "root", displayName: "New Name", parentOrgNodeId: null, ownerUserIds: [], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "New Name", parentOrgNodeId: null, ownerUserIds: [], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:01:00.000Z",
  };
  const changed = diffOrgCharts(before, after);
  assert.deepEqual(changed, ["root"]);
});

test("diffOrgCharts detects owner changes", () => {
  const before = {
    root: { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: ["user_1"], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: ["user_1"], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:00:00.000Z",
  };
  const after = {
    root: { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: ["user_2"], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: ["user_2"], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:01:00.000Z",
  };
  const changed = diffOrgCharts(before, after);
  assert.deepEqual(changed, ["root"]);
});

test("diffOrgCharts detects active status changes", () => {
  const before = {
    root: { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true },
    nodes: [
      { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:00:00.000Z",
  };
  const after = {
    root: { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: false },
    nodes: [
      { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: false },
    ],
    syncSource: "manual" as const,
    lastSyncedAt: "2026-04-14T12:01:00.000Z",
  };
  const changed = diffOrgCharts(before, after);
  assert.deepEqual(changed, ["root"]);
});

test("diffOrgCharts returns empty array when no changes", () => {
  const node = { orgNodeId: "root", displayName: "Root", parentOrgNodeId: null, ownerUserIds: [], active: true };
  const before = { root: node, nodes: [node], syncSource: "manual" as const, lastSyncedAt: "2026-04-14T12:00:00.000Z" };
  const after = { root: node, nodes: [node], syncSource: "manual" as const, lastSyncedAt: "2026-04-14T12:01:00.000Z" };
  const changed = diffOrgCharts(before, after);
  assert.deepEqual(changed, []);
});
