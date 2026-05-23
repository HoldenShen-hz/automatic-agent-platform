import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalDelegationSchema,
  resolveDelegatedApprover,
  type ApprovalDelegation,
} from "../../../../../src/org-governance/approval-routing/delegation/index.js";

function createDelegation(overrides: Partial<ApprovalDelegation> = {}): ApprovalDelegation {
  return {
    delegationId: overrides.delegationId ?? "del_1",
    approverId: overrides.approverId ?? "approver_1",
    delegateApproverId: overrides.delegateApproverId ?? "delegate_1",
    delegationType: overrides.delegationType ?? "temporary_cover",
    scopeNodeIds: overrides.scopeNodeIds ?? [],
    conflictOfInterestApproverIds: overrides.conflictOfInterestApproverIds ?? [],
    coiReviewStatus: overrides.coiReviewStatus ?? "passed",
    startsAt: overrides.startsAt ?? "2026-04-01T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-04-30T00:00:00.000Z",
    active: overrides.active ?? true,
  };
}

test("ApprovalDelegationSchema validates correct delegation", () => {
  const valid = {
    delegationId: "del_123",
    approverId: "approver_456",
    delegateApproverId: "delegate_789",
    delegationType: "temporary_cover",
    scopeNodeIds: ["node_1", "node_2"],
    conflictOfInterestApproverIds: [],
    coiReviewStatus: "passed",
    startsAt: "2026-04-01T00:00:00.000Z",
    expiresAt: "2026-04-30T00:00:00.000Z",
    active: true,
  };
  const result = ApprovalDelegationSchema.parse(valid);
  assert.equal(result.delegationId, "del_123");
  assert.equal(result.approverId, "approver_456");
  assert.equal(result.delegateApproverId, "delegate_789");
  assert.equal(result.delegationType, "temporary_cover");
  assert.deepEqual(result.scopeNodeIds, ["node_1", "node_2"]);
  assert.equal(result.active, true);
});

test("ApprovalDelegationSchema applies defaults", () => {
  const minimal = {
    delegationId: "del_min",
    approverId: "approver_min",
    delegateApproverId: "delegate_min",
    startsAt: "2026-04-01T00:00:00.000Z",
    expiresAt: "2026-04-30T00:00:00.000Z",
  };
  const result = ApprovalDelegationSchema.parse(minimal);
  assert.deepEqual(result.scopeNodeIds, []);
  assert.deepEqual(result.conflictOfInterestApproverIds, []);
  assert.equal(result.coiReviewStatus, "pending");
  assert.equal(result.active, true);
});

test("ApprovalDelegationSchema rejects empty delegationId", () => {
  assert.throws(() => {
    ApprovalDelegationSchema.parse({
      delegationId: "",
      approverId: "approver_456",
      delegateApproverId: "delegate_789",
      startsAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2026-04-30T00:00:00.000Z",
    });
  });
});

test("resolveDelegatedApprover returns original approver when no delegations exist", () => {
  const result = resolveDelegatedApprover([], "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "approver_1");
});

test("resolveDelegatedApprover returns original approver when delegation is inactive", () => {
  const delegations = [
    createDelegation({ active: false }),
  ];
  const result = resolveDelegatedApprover(delegations, "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "approver_1");
});

test("resolveDelegatedApprover returns delegate when delegation is active and valid", () => {
  const delegations = [
    createDelegation(),
  ];
  const result = resolveDelegatedApprover(delegations, "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "delegate_1");
});

test("resolveDelegatedApprover returns original when delegation has not started yet", () => {
  const delegations = [
    createDelegation({ startsAt: "2026-04-20T00:00:00.000Z" }),
  ];
  const result = resolveDelegatedApprover(delegations, "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "approver_1");
});

test("resolveDelegatedApprover returns original when delegation has expired", () => {
  const delegations = [
    createDelegation({ expiresAt: "2026-04-10T00:00:00.000Z" }),
  ];
  const result = resolveDelegatedApprover(delegations, "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "approver_1");
});

test("resolveDelegatedApprover respects scopeNodeIds when not empty", () => {
  const delegations = [
    createDelegation({ scopeNodeIds: ["node_target"] }),
  ];
  // Requesting for node in scope
  const resultInScope = resolveDelegatedApprover(delegations, "approver_1", "node_target", "2026-04-14T12:00:00.000Z");
  assert.equal(resultInScope, "delegate_1");
  // Requesting for node not in scope
  const resultNotInScope = resolveDelegatedApprover(delegations, "approver_1", "node_other", "2026-04-14T12:00:00.000Z");
  assert.equal(resultNotInScope, "approver_1");
});

test("resolveDelegatedApprover allows empty scopeNodeIds for all nodes", () => {
  const delegations = [
    createDelegation(),
  ];
  const result = resolveDelegatedApprover(delegations, "approver_1", "any_node", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "delegate_1");
});

test("resolveDelegatedApprover returns first matching delegation", () => {
  const delegations = [
    createDelegation({ delegateApproverId: "delegate_first" }),
    createDelegation({ delegationId: "del_2", delegateApproverId: "delegate_second" }),
  ];
  const result = resolveDelegatedApprover(delegations, "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "delegate_first");
});

test("resolveDelegatedApprover blocks peer delegation without COI clearance", () => {
  const delegations = [
    createDelegation({
      delegationId: "del_peer",
      delegateApproverId: "peer_1",
      delegationType: "peer_cover",
      conflictOfInterestApproverIds: ["peer_1"],
      coiReviewStatus: "failed",
    }),
  ];

  const result = resolveDelegatedApprover(delegations, "approver_1", "node_1", "2026-04-14T12:00:00.000Z");
  assert.equal(result, "approver_1");
});
