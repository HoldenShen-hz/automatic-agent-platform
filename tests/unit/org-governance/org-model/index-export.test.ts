/**
 * Unit tests for org-model index exports
 *
 * @see src/org-governance/org-model/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import all exports to verify they are available
import * as OrgModelExports from "../../../../src/org-governance/org-model/index.js";

test("org-model index exports OrgNodeTypeSchema", () => {
  assert.ok(OrgModelExports.OrgNodeTypeSchema, "OrgNodeTypeSchema should be exported");
  assert.equal(typeof OrgModelExports.OrgNodeTypeSchema, "object");
});

test("org-model index exports OrgNodeSchema", () => {
  assert.ok(OrgModelExports.OrgNodeSchema, "OrgNodeSchema should be exported");
  assert.equal(typeof OrgModelExports.OrgNodeSchema, "object");
});

test("org-model index exports isLeafOrgNode function", () => {
  assert.ok(OrgModelExports.isLeafOrgNode, "isLeafOrgNode should be exported");
  assert.equal(typeof OrgModelExports.isLeafOrgNode, "function");
});

test("org-model index exports getPlatformMapping function", () => {
  assert.ok(OrgModelExports.getPlatformMapping, "getPlatformMapping should be exported");
  assert.equal(typeof OrgModelExports.getPlatformMapping, "function");
});

test("org-model index exports validateHierarchyDepth function", () => {
  assert.ok(OrgModelExports.validateHierarchyDepth, "validateHierarchyDepth should be exported");
  assert.equal(typeof OrgModelExports.validateHierarchyDepth, "function");
});

test("org-model index exports createCrossOrgCollaborator function", () => {
  assert.ok(OrgModelExports.createCrossOrgCollaborator, "createCrossOrgCollaborator should be exported");
  assert.equal(typeof OrgModelExports.createCrossOrgCollaborator, "function");
});

test("org-model index exports OrgSyncRecordSchema", () => {
  assert.ok(OrgModelExports.OrgSyncRecordSchema, "OrgSyncRecordSchema should be exported");
  assert.equal(typeof OrgModelExports.OrgSyncRecordSchema, "object");
});

test("org-model index exports hierarchy functions", () => {
  assert.ok(OrgModelExports.validateOrgHierarchy, "validateOrgHierarchy should be exported");
  assert.ok(OrgModelExports.listAncestorNodeIds, "listAncestorNodeIds should be exported");
  assert.ok(OrgModelExports.listDescendantNodeIds, "listDescendantNodeIds should be exported");
  assert.ok(OrgModelExports.findRootNode, "findRootNode should be exported");
  assert.ok(OrgModelExports.getNodesAtLevel, "getNodesAtLevel should be exported");
  assert.ok(OrgModelExports.getNodeDepth, "getNodeDepth should be exported");
  assert.ok(OrgModelExports.findLowestCommonAncestor, "findLowestCommonAncestor should be exported");
  assert.ok(OrgModelExports.buildReportingChain, "buildReportingChain should be exported");
  assert.ok(OrgModelExports.detectOrgChangeEvents, "detectOrgChangeEvents should be exported");
  assert.equal(typeof OrgModelExports.validateOrgHierarchy, "function");
  assert.equal(typeof OrgModelExports.listAncestorNodeIds, "function");
  assert.equal(typeof OrgModelExports.listDescendantNodeIds, "function");
  assert.equal(typeof OrgModelExports.findRootNode, "function");
  assert.equal(typeof OrgModelExports.getNodesAtLevel, "function");
  assert.equal(typeof OrgModelExports.getNodeDepth, "function");
  assert.equal(typeof OrgModelExports.findLowestCommonAncestor, "function");
  assert.equal(typeof OrgModelExports.buildReportingChain, "function");
  assert.equal(typeof OrgModelExports.detectOrgChangeEvents, "function");
});

test("org-model index exports sync functions", () => {
  assert.ok(OrgModelExports.mergeOrgNodes, "mergeOrgNodes should be exported");
  assert.ok(OrgModelExports.buildOrgChart, "buildOrgChart should be exported");
  assert.ok(OrgModelExports.diffOrgCharts, "diffOrgCharts should be exported");
  assert.equal(typeof OrgModelExports.mergeOrgNodes, "function");
  assert.equal(typeof OrgModelExports.buildOrgChart, "function");
  assert.equal(typeof OrgModelExports.diffOrgCharts, "function");
});

test("org-model index exports HrRoleGovernanceService", () => {
  assert.ok(OrgModelExports.HrRoleGovernanceService, "HrRoleGovernanceService should be exported");
});

test("isLeafOrgNode works via exported function", () => {
  const node = {
    orgNodeId: "member-1",
    displayName: "John Doe",
    nodeType: "member" as const,
    parentOrgNodeId: "team-1",
    ownerUserIds: ["user-1"],
    metadata: {},
    active: true,
    costCenter: "CC001",
  };
  assert.equal(OrgModelExports.isLeafOrgNode(node), true);
});

test("getPlatformMapping returns correct mapping via exported function", () => {
  assert.equal(OrgModelExports.getPlatformMapping("company"), "platform");
  assert.equal(OrgModelExports.getPlatformMapping("division"), "tenant_group");
  assert.equal(OrgModelExports.getPlatformMapping("department"), "tenant");
  assert.equal(OrgModelExports.getPlatformMapping("team"), "domain/pack_group");
  assert.equal(OrgModelExports.getPlatformMapping("member"), "principal");
});

test("OrgNodeTypeSchema parses valid types", () => {
  const types = ["company", "division", "department", "team", "member"];
  for (const type of types) {
    const result = OrgModelExports.OrgNodeTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Type ${type} should be valid`);
  }
});

test("OrgNodeTypeSchema rejects invalid type", () => {
  const result = OrgModelExports.OrgNodeTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("OrgSyncRecordSchema parses valid record", () => {
  const result = OrgModelExports.OrgSyncRecordSchema.safeParse({
    syncId: "sync-1",
    providerId: "provider-1",
    changedNodeIds: ["node-1"],
    completedAt: "2026-04-26T10:00:00Z",
  });
  assert.equal(result.success, true);
});

test("OrgSyncRecordSchema rejects missing fields", () => {
  const result = OrgModelExports.OrgSyncRecordSchema.safeParse({
    syncId: "",
    providerId: "provider-1",
    completedAt: "2026-04-26T10:00:00Z",
  });
  assert.equal(result.success, false);
});
