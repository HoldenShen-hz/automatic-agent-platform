import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeOrgNodes,
  buildOrgChart,
  diffOrgCharts,
  OrgSyncRecordSchema,
} from "../../../src/org-governance/org-model/sync/index.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

test("mergeOrgNodes combines existing and incoming nodes", () => {
  const existing: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "node_2", nodeType: "division", displayName: "Tech", parentOrgNodeId: "node_1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];
  const incoming: OrgNode[] = [
    { orgNodeId: "node_3", nodeType: "department", displayName: "Eng", parentOrgNodeId: "node_2", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];

  const merged = mergeOrgNodes(existing, incoming);

  assert.strictEqual(merged.length, 3);
  assert.ok(merged.some((n) => n.orgNodeId === "node_1"));
  assert.ok(merged.some((n) => n.orgNodeId === "node_2"));
  assert.ok(merged.some((n) => n.orgNodeId === "node_3"));
});

test("mergeOrgNodes incoming overwrites existing with same id", () => {
  const existing: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme Old", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];
  const incoming: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme New", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];

  const merged = mergeOrgNodes(existing, incoming);

  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0]?.displayName, "Acme New");
});

test("buildOrgChart creates chart with root and nodes", () => {
  const nodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "node_2", nodeType: "division", displayName: "Tech", parentOrgNodeId: "node_1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];

  const chart = buildOrgChart(nodes, "hris_system");

  assert.strictEqual(chart.root.orgNodeId, "node_1");
  assert.strictEqual(chart.nodes.length, 2);
  assert.strictEqual(chart.syncSource, "hris_system");
  assert.ok(chart.lastSyncedAt.length > 0);
});

test("buildOrgChart throws when no root node", () => {
  const nodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "division", displayName: "Tech", parentOrgNodeId: "node_2", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];

  assert.throws(() => buildOrgChart(nodes, "hris_system"), { message: /no root node/ });
});

test("diffOrgCharts detects new nodes", () => {
  const beforeNodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];
  const afterNodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "node_2", nodeType: "division", displayName: "Tech", parentOrgNodeId: "node_1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];

  const before = buildOrgChart(beforeNodes, "hris");
  const after = buildOrgChart(afterNodes, "hris");

  const changed = diffOrgCharts(before, after);

  assert.deepStrictEqual(changed, ["node_2"]);
});

test("diffOrgCharts detects renamed nodes", () => {
  const beforeNodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];
  const afterNodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
  ];

  const before = buildOrgChart(beforeNodes, "hris");
  const after = buildOrgChart(afterNodes, "hris");

  const changed = diffOrgCharts(before, after);

  assert.deepStrictEqual(changed, ["node_1"]);
});

test("diffOrgCharts detects owner changes", () => {
  const beforeNodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: ["user_1"], active: true, costCenter: "", metadata: {} },
  ];
  const afterNodes: OrgNode[] = [
    { orgNodeId: "node_1", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: ["user_2"], active: true, costCenter: "", metadata: {} },
  ];

  const before = buildOrgChart(beforeNodes, "hris");
  const after = buildOrgChart(afterNodes, "hris");

  const changed = diffOrgCharts(before, after);

  assert.deepStrictEqual(changed, ["node_1"]);
});

test("OrgSyncRecordSchema validates correct record", () => {
  const record = OrgSyncRecordSchema.parse({
    syncId: "sync_1",
    providerId: "hris",
    changedNodeIds: ["node_1", "node_2"],
    completedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.strictEqual(record.syncId, "sync_1");
  assert.deepStrictEqual(record.changedNodeIds, ["node_1", "node_2"]);
});

test("OrgSyncRecordSchema applies defaults", () => {
  const record = OrgSyncRecordSchema.parse({
    syncId: "sync_1",
    providerId: "hris",
    completedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.deepStrictEqual(record.changedNodeIds, []);
});