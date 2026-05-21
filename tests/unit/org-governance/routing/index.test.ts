import test from "node:test";
import assert from "node:assert/strict";

import { OrgRoutingService } from "../../../../src/org-governance/org-routing/index.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";

// Test fixtures
const makeOrgNode = (overrides: Partial<OrgNode> & { orgNodeId: string }): OrgNode => ({
  orgNodeId: "default",
  nodeType: "team" as const,
  displayName: "Default",
  parentOrgNodeId: null,
  ownerUserIds: [],
  active: true,
  costCenter: null,
  metadata: {},
  ...overrides,
});

const companyNode = makeOrgNode({
  orgNodeId: "company",
  nodeType: "company",
  displayName: "Acme Corp",
  costCenter: "CC-000",
});

const divisionNode = makeOrgNode({
  orgNodeId: "division",
  nodeType: "division",
  displayName: "Engineering",
  parentOrgNodeId: "company",
  costCenter: "CC-100",
});

const departmentNode = makeOrgNode({
  orgNodeId: "dept",
  nodeType: "department",
  displayName: "Platform",
  parentOrgNodeId: "division",
  costCenter: "CC-110",
});

const teamNode = makeOrgNode({
  orgNodeId: "team",
  nodeType: "team",
  displayName: "Runtime",
  parentOrgNodeId: "dept",
  costCenter: "CC-111",
});

const nodeWithLegalEntity = makeOrgNode({
  orgNodeId: "subsidiary",
  nodeType: "company",
  displayName: "Subsidiary Co",
  legalEntityBoundary: {
    boundaryId: "LE-001",
    legalEntityId: "LE-001",
    jurisdictionCountry: "US",
    dataResidencyRegion: "US",
    crossBorderTransferPolicy: "allow",
  },
});

const nodeWithDenyPolicy = makeOrgNode({
  orgNodeId: "restricted",
  nodeType: "company",
  displayName: "Restricted Entity",
  legalEntityBoundary: {
    boundaryId: "LE-002",
    legalEntityId: "LE-002",
    jurisdictionCountry: "DE",
    dataResidencyRegion: "EU",
    crossBorderTransferPolicy: "deny",
  },
});

test("OrgRoutingService.constructor initializes with empty nodes", () => {
  const service = new OrgRoutingService([]);
  assert.ok(service instanceof OrgRoutingService);
});

test("OrgRoutingService.constructor initializes with nodes and builds maps", () => {
  const nodes = [companyNode, divisionNode, departmentNode, teamNode];
  const service = new OrgRoutingService(nodes);
  assert.ok(service instanceof OrgRoutingService);
});

test("OrgRoutingService.resolveTenant returns unresolved when node not found", () => {
  const service = new OrgRoutingService([]);
  const result = service.resolveTenant("nonexistent");

  assert.equal(result.resolved, false);
  assert.equal(result.tenantId, null);
  assert.equal(result.tenantGroupId, null);
  assert.equal(result.requiresIsolation, true);
  assert.equal(result.legalEntityBoundaryId, null);
  assert.equal(result.crossBorderTransferAllowed, false);
});

test("OrgRoutingService.resolveTenant resolves node with legal entity boundary", () => {
  const service = new OrgRoutingService([nodeWithLegalEntity]);
  const result = service.resolveTenant("subsidiary");

  assert.equal(result.resolved, true);
  assert.equal(result.tenantId, "LE-001");
  assert.equal(result.tenantGroupId, null);
  assert.equal(result.requiresIsolation, true);
  assert.equal(result.legalEntityBoundaryId, "LE-001");
  assert.equal(result.dataResidencyRequirement, "US");
  assert.equal(result.crossBorderTransferAllowed, true);
});

test("OrgRoutingService.resolveTenant applies deny policy correctly", () => {
  const service = new OrgRoutingService([nodeWithDenyPolicy]);
  const result = service.resolveTenant("restricted");

  assert.equal(result.resolved, true);
  assert.equal(result.tenantId, "LE-002");
  assert.equal(result.crossBorderTransferAllowed, false);
});

test("OrgRoutingService.resolveTenant uses orgNodeId as tenant when no legal entity boundary", () => {
  const service = new OrgRoutingService([companyNode]);
  const result = service.resolveTenant("company");

  assert.equal(result.resolved, true);
  assert.equal(result.tenantId, "company");
  assert.equal(result.requiresIsolation, false);
  assert.equal(result.legalEntityBoundaryId, null);
});

test("OrgRoutingService.resolveTenant sets parentOrgNodeId as tenantGroupId", () => {
  const service = new OrgRoutingService([divisionNode, companyNode]);
  const result = service.resolveTenant("division");

  assert.equal(result.resolved, true);
  assert.equal(result.tenantGroupId, "company");
});

test("OrgRoutingService.resolveCostCenter returns default when node not found with empty array", () => {
  const service = new OrgRoutingService([]);
  const result = service.resolveCostCenter("nonexistent", 1000);

  // With no nodes, falls back to default cost center
  assert.equal(result.allocated, true);
  assert.equal(result.costCenterId, "CC_DEFAULT");
  assert.equal(result.allocationStrategy, "default");
});

test("OrgRoutingService.resolveCostCenter resolves direct cost center", () => {
  const service = new OrgRoutingService([teamNode]);
  const result = service.resolveCostCenter("team", 500);

  assert.equal(result.allocated, true);
  assert.equal(result.costCenterId, "CC-111");
  assert.equal(result.allocationStrategy, "direct");
  assert.ok(result.budgetAvailable > 0);
});

test("OrgRoutingService.resolveCostCenter respects requested budget", () => {
  const service = new OrgRoutingService([teamNode]);
  // Request a budget that exceeds default budget
  const result = service.resolveCostCenter("team", 2000000);

  assert.equal(result.allocated, false);
  assert.equal(result.costCenterId, "CC-111");
  assert.ok(result.reasonCodes.some(code => code.includes("budget_exceeded")));
});

test("OrgRoutingService.resolveCostCenter falls back to parent cost center", () => {
  const nodeWithoutCostCenter = makeOrgNode({
    orgNodeId: "child-team",
    nodeType: "team",
    displayName: "Child Team",
    parentOrgNodeId: "dept",
    costCenter: null,
  });

  const service = new OrgRoutingService([nodeWithoutCostCenter, departmentNode]);
  const result = service.resolveCostCenter("child-team");

  assert.equal(result.allocated, true);
  assert.equal(result.costCenterId, "CC-110");
  assert.equal(result.allocationStrategy, "parent");
});

test("OrgRoutingService.resolveCostCenter falls back to default cost center", () => {
  const nodeWithoutCostCenterOrParent = makeOrgNode({
    orgNodeId: "orphan",
    nodeType: "team",
    displayName: "Orphan",
    parentOrgNodeId: null,
    costCenter: null,
  });

  const service = new OrgRoutingService([nodeWithoutCostCenterOrParent]);
  const result = service.resolveCostCenter("orphan");

  assert.equal(result.allocated, true);
  assert.equal(result.costCenterId, "CC_DEFAULT");
  assert.equal(result.allocationStrategy, "default");
});

test("OrgRoutingService.routeRequest allows same-tenant requests", () => {
  const service = new OrgRoutingService([companyNode, divisionNode, departmentNode, teamNode]);
  const result = service.routeRequest({
    requesterOrgNodeId: "division",
    targetOrgNodeId: "department",
    requestedBudget: 1000,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.routedOrgNodeId, "department");
  // routingStrategy is "direct" since division has no legal entity boundary (requiresIsolation=false)
  // and cost center allocation is "direct", and department is not ancestor of division
  assert.equal(result.routingStrategy, "direct");
});

test("OrgRoutingService.routeRequest denies cross-border transfer when policy is deny", () => {
  const service = new OrgRoutingService([nodeWithDenyPolicy, companyNode]);
  const result = service.routeRequest({
    requesterOrgNodeId: "restricted",
    targetOrgNodeId: "company",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.routedOrgNodeId, null);
  assert.equal(result.routingStrategy, "tenant_isolated");
  assert.ok(result.reasonCodes.includes("org_routing.cross_border_transfer_denied"));
});

test("OrgRoutingService.routeRequest denies when budget exceeded", () => {
  const service = new OrgRoutingService([teamNode]);
  const result = service.routeRequest({
    requesterOrgNodeId: "company",
    targetOrgNodeId: "team",
    requestedBudget: 2000000,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.routedOrgNodeId, "team");
  assert.equal(result.routingStrategy, "cost_center_routed");
  assert.ok(result.reasonCodes.some(code => code.includes("budget_exceeded")));
});

test("OrgRoutingService.crossesTenantBoundary returns false for same tenant", () => {
  const service = new OrgRoutingService([companyNode, divisionNode]);
  const result = service.crossesTenantBoundary("company", "division");

  assert.equal(result, false);
});

test("OrgRoutingService.crossesTenantBoundary returns true for different legal entities", () => {
  const service = new OrgRoutingService([nodeWithLegalEntity, companyNode]);
  const result = service.crossesTenantBoundary("subsidiary", "company");

  assert.equal(result, true);
});

test("OrgRoutingService.crossesTenantBoundary returns false when source not resolved", () => {
  const service = new OrgRoutingService([]);
  const result = service.crossesTenantBoundary("nonexistent", "company");

  assert.equal(result, false);
});

test("OrgRoutingService.crossesTenantBoundary returns false when target not resolved", () => {
  const service = new OrgRoutingService([companyNode]);
  const result = service.crossesTenantBoundary("company", "nonexistent");

  assert.equal(result, false);
});

test("OrgRoutingService.getCostCenterForNode returns cost center when exists", () => {
  const service = new OrgRoutingService([teamNode]);
  const result = service.getCostCenterForNode("team");

  assert.equal(result, "CC-111");
});

test("OrgRoutingService.getCostCenterForNode returns null when node not found", () => {
  const service = new OrgRoutingService([]);
  const result = service.getCostCenterForNode("nonexistent");

  assert.equal(result, null);
});

test("OrgRoutingService.routeRequest includes tenant context in decision", () => {
  const service = new OrgRoutingService([nodeWithLegalEntity]);
  const result = service.routeRequest({
    requesterOrgNodeId: "subsidiary",
    targetOrgNodeId: "subsidiary",
  });

  assert.ok(result.tenantContext != null);
  assert.equal(result.tenantContext?.tenantId, "LE-001");
  assert.equal(result.tenantContext?.legalEntityId, "LE-001");
  assert.equal(result.tenantContext?.dataResidencyRegion, "US");
});

test("OrgRoutingService.routeRequest includes cost center context when allocated", () => {
  const service = new OrgRoutingService([teamNode]);
  const result = service.routeRequest({
    requesterOrgNodeId: "company",
    targetOrgNodeId: "team",
    requestedBudget: 1000,
  });

  assert.ok(result.costCenterContext != null);
  assert.equal(result.costCenterContext?.costCenterId, "CC-111");
  assert.equal(result.costCenterContext?.currency, "USD");
});

test("OrgRoutingService.routeRequest uses hierarchy_based strategy when target is ancestor", () => {
  const service = new OrgRoutingService([companyNode, divisionNode, departmentNode, teamNode]);
  // team -> department (parent is ancestor of team in its hierarchy path)
  const result = service.routeRequest({
    requesterOrgNodeId: "team",
    targetOrgNodeId: "department",
  });

  // department is parent of team, so this is hierarchy-based routing
  assert.equal(result.allowed, true);
  assert.equal(result.routingStrategy, "hierarchy_based");
});

test("OrgRoutingService.routeRequest uses direct strategy when no isolation or cost center routing", () => {
  const nodeWithoutLegalEntity = makeOrgNode({
    orgNodeId: "node-a",
    nodeType: "company",
    displayName: "Node A",
    legalEntityBoundary: null,
  });

  const service = new OrgRoutingService([nodeWithoutLegalEntity]);
  const result = service.routeRequest({
    requesterOrgNodeId: "node-a",
    targetOrgNodeId: "node-a",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.routingStrategy, "direct");
});

test("OrgRoutingService.resolveCostCenter traverses multiple parent levels", () => {
  const grandchildNode = makeOrgNode({
    orgNodeId: "grandchild",
    nodeType: "team",
    displayName: "Grandchild",
    parentOrgNodeId: "child",
    costCenter: null,
  });

  const childNode = makeOrgNode({
    orgNodeId: "child",
    nodeType: "department",
    displayName: "Child",
    parentOrgNodeId: "dept",
    costCenter: null,
  });

  const service = new OrgRoutingService([grandchildNode, childNode, departmentNode]);
  const result = service.resolveCostCenter("grandchild");

  assert.equal(result.allocated, true);
  assert.equal(result.costCenterId, "CC-110");
  assert.equal(result.allocationStrategy, "parent");
});

test("OrgRoutingService.routeRequest adds reason codes for routing strategy", () => {
  const service = new OrgRoutingService([companyNode, divisionNode]);
  const result = service.routeRequest({
    requesterOrgNodeId: "division",
    targetOrgNodeId: "company",
  });

  assert.ok(result.reasonCodes.length > 0);
  assert.ok(result.reasonCodes.some(code => code.includes("org_routing.strategy:")));
});

test("OrgRoutingService.routeRequest with zero requestedBudget still succeeds with cost center", () => {
  const service = new OrgRoutingService([teamNode]);
  const result = service.routeRequest({
    requesterOrgNodeId: "company",
    targetOrgNodeId: "team",
    requestedBudget: 0,
  });

  assert.equal(result.allowed, true);
  assert.ok(result.costCenterContext != null);
});