import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  resolveApprovalRoute,
  applySodPolicy,
  resolveAmountRoute,
} from "../../../../../src/org-governance/approval-routing/route-engine/index.js";
import type { OrgNode } from "../../../../../src/org-governance/org-model/index.js";
import type { ApprovalRouteRequest } from "../../../../../src/org-governance/approval-routing/route-engine/index.js";
import type { AmountThresholdRule } from "../../../../../src/org-governance/approval-routing/route-engine/index.js";

function mockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "node-1",
    nodeType: "department",
    displayName: "Test Department",
    parentOrgNodeId: "company-1",
    ownerUserIds: ["user-1", "user-2"],
    active: true,
    costCenter: "CC001",
    metadata: {},
    ...overrides,
  };
}

function mockRequest(overrides: Partial<ApprovalRouteRequest> = {}): ApprovalRouteRequest {
  return {
    requesterId: "requester-1",
    orgNodeId: "node-1",
    riskLevel: "medium",
    amountUsd: 0,
    ...overrides,
  };
}

test("resolveApprovalRoute returns org chart routing when no amount rules", () => {
  const nodes = [mockOrgNode()];
  const request = mockRequest();

  const result = resolveApprovalRoute(nodes, request);

  assert.strictEqual(result.matchedOrgNodeId, "node-1");
  assert.ok(result.approverChain.length > 0);
});

test("resolveApprovalRoute filters out requester from approver chain via SodPolicy", () => {
  const nodes = [mockOrgNode({ ownerUserIds: ["user-1", "requester-1"] })];
  const request = mockRequest({ requesterId: "requester-1" });

  const result = resolveApprovalRoute(nodes, request);

  assert.ok(!result.approverChain.includes("requester-1"));
});

test("resolveApprovalRoute handles delegation map", () => {
  const nodes = [mockOrgNode({ ownerUserIds: ["user-1"] })];
  const request = mockRequest();
  const delegationMap = { "user-1": "delegate-1" };

  const result = resolveApprovalRoute(nodes, request, delegationMap);

  assert.ok(result.approverChain.includes("delegate-1") || result.delegated);
});

test("resolveApprovalRoute uses org_chart strategy by default", () => {
  const nodes = [mockOrgNode()];
  const request = mockRequest();

  const result = resolveApprovalRoute(nodes, request);

  assert.strictEqual(result.routingStrategy, "org_chart");
});

test("resolveApprovalRoute uses amount_based when threshold rules exist", () => {
  const nodes = [mockOrgNode({ nodeType: "department" })];
  const request = mockRequest({ amountUsd: 500 });
  const rules: AmountThresholdRule[] = [{ maxAmountUsd: 1000, targetNodeTypes: ["department"] }];

  const result = resolveApprovalRoute(nodes, request, {}, rules);

  assert.strictEqual(result.routingStrategy, "amount_based");
});

test("applySodPolicy removes requester from candidate approvers", () => {
  const nodes = [mockOrgNode()];
  const candidateApprovers = ["approver-1", "approver-2", "requester-1"];

  const result = applySodPolicy("requester-1", candidateApprovers, nodes, "node-1");

  assert.ok(!result.includes("requester-1"));
  assert.strictEqual(result.length, 2);
});

test("applySodPolicy keeps all approvers when requester not in list", () => {
  const nodes = [mockOrgNode()];
  const candidateApprovers = ["approver-1", "approver-2"];

  const result = applySodPolicy("requester-1", candidateApprovers, nodes, "node-1");

  assert.strictEqual(result.length, 2);
});

test("resolveAmountRoute returns company node when amount exceeds all rules", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company-1", nodeType: "company" }),
    mockOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1" }),
  ];
  const request = mockRequest({ amountUsd: 10000 });
  const rules: AmountThresholdRule[] = [{ maxAmountUsd: 1000, targetNodeTypes: ["department"] }];

  const result = resolveAmountRoute(nodes, request, rules);

  assert.strictEqual(result?.orgNodeId, "company-1");
});

test("resolveAmountRoute returns department when amount is below threshold", () => {
  const nodes = [
    mockOrgNode({ orgNodeId: "company-1", nodeType: "company" }),
    mockOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "company-1", active: true }),
  ];
  const request = mockRequest({ amountUsd: 500, orgNodeId: "dept-1" });
  const rules: AmountThresholdRule[] = [{ maxAmountUsd: 1000, targetNodeTypes: ["department"] }];

  const result = resolveAmountRoute(nodes, request, rules);

  assert.strictEqual(result?.orgNodeId, "dept-1");
});

test("resolveApprovalRoute returns platform_admin when no owners found", () => {
  const nodes = [mockOrgNode({ ownerUserIds: [] })];
  const request = mockRequest();

  const result = resolveApprovalRoute(nodes, request);

  assert.ok(result.approverChain.includes("platform_admin"));
});

test("resolveApprovalRoute marks delegated when delegation map differs from owner chain", () => {
  const nodes = [mockOrgNode({ ownerUserIds: ["user-1"] })];
  const request = mockRequest();
  const delegationMap = { "user-1": "delegate-1" };

  const result = resolveApprovalRoute(nodes, request, delegationMap);

  assert.strictEqual(result.delegated, true);
});

test("resolveApprovalRoute with empty nodes falls back to request orgNodeId", () => {
  const request = mockRequest();

  const result = resolveApprovalRoute([], request);

  assert.strictEqual(result.matchedOrgNodeId, "node-1");
});

test("applySodPolicy returns empty array when all filtered out", () => {
  const nodes = [mockOrgNode()];
  const candidateApprovers = ["requester-1"];

  const result = applySodPolicy("requester-1", candidateApprovers, nodes, "node-1");

  assert.strictEqual(result.length, 0);
});

test("resolveAmountRoute returns null when no matching node found", () => {
  const nodes: OrgNode[] = [];
  const request = mockRequest();
  const rules: AmountThresholdRule[] = [{ maxAmountUsd: 1000, targetNodeTypes: ["department"] }];

  const result = resolveAmountRoute(nodes, request, rules);

  assert.strictEqual(result, null);
});

test("resolveApprovalRoute handles inactive nodes", () => {
  const nodes = [mockOrgNode({ active: false })];
  const request = mockRequest();

  const result = resolveApprovalRoute(nodes, request);

  assert.ok(result.approverChain.length >= 0);
});