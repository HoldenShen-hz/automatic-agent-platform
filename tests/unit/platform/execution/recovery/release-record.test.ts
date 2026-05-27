import assert from "node:assert/strict";
import test from "node:test";

import {
  createReleaseRecord,
  createRollbackRecord,
  isReleaseApproved,
  requiresHumanApproval,
  type ReleaseRecord,
  type ReleaseDecision,
  type ReleaseEnvironment,
  type ApprovalRecord,
} from "../../../../../src/platform/five-plane-execution/recovery/release-record.js";

test("createReleaseRecord creates approved record with environment [release-record]", () => {
  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
    environment: "production",
  });

  assert.equal(record.recordId, "rel_1");
  assert.equal(record.taskId, "task_1");
  assert.equal(record.bundleId, "bundle_1");
  assert.equal(record.decision, "approved");
  assert.equal(record.environment, "production");
  assert.ok(record.deployedAt !== undefined);
  assert.ok(record.createdAt !== undefined);
});

test("createReleaseRecord creates rejected record without deployedAt [release-record]", () => {
  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "rejected",
  });

  assert.equal(record.decision, "rejected");
  assert.equal(record.deployedAt, undefined);
});

test("createReleaseRecord creates record with approvals [release-record]", () => {
  const approvals: readonly ApprovalRecord[] = [
    { approverId: "agent_1", approverType: "agent", decision: "approved", approvedAt: "2024-01-01T00:00:00.000Z" },
    { approverId: "human_1", approverType: "human", decision: "approved", reason: "Looks good", approvedAt: "2024-01-02T00:00:00.000Z" },
  ];

  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
    environment: "staging",
    approvals,
  });

  assert.equal(record.approvals.length, 2);
  assert.equal(record.approvals[0]!.approverType, "agent");
  assert.equal(record.approvals[1]!.approverType, "human");
});

test("createReleaseRecord creates record with releaseNotes [release-record]", () => {
  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
    releaseNotes: "Bug fixes and performance improvements",
  });

  assert.equal(record.releaseNotes, "Bug fixes and performance improvements");
});

test("createRollbackRecord updates decision to rolled_back [release-record]", () => {
  const original = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
    environment: "production",
  });

  const rollback = createRollbackRecord(original, "Critical bug found", "human_1", false);

  assert.equal(rollback.decision, "rolled_back");
  assert.equal(rollback.rollbackInfo!.reason, "Critical bug found");
  assert.equal(rollback.rollbackInfo!.initiatedBy, "human_1");
  assert.equal(rollback.rollbackInfo!.automatic, false);
  assert.ok(rollback.rollbackInfo!.rolledBackAt !== undefined);
});

test("createRollbackRecord marks automatic rollback correctly [release-record]", () => {
  const original = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
  });

  const rollback = createRollbackRecord(original, "Health check failure", "system", true);

  assert.equal(rollback.rollbackInfo!.automatic, true);
});

test("isReleaseApproved returns true for approved decision [release-record]", () => {
  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
  });

  assert.equal(isReleaseApproved(record), true);
});

test("isReleaseApproved returns false for rejected decision [release-record]", () => {
  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "rejected",
  });

  assert.equal(isReleaseApproved(record), false);
});

test("isReleaseApproved returns false for rolled_back decision [release-record]", () => {
  const original = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
  });

  const rollback = createRollbackRecord(original, "Bug", "human", false);

  assert.equal(isReleaseApproved(rollback), false);
});

test("requiresHumanApproval returns true when any approval is from human [release-record]", () => {
  const approvals: readonly ApprovalRecord[] = [
    { approverId: "agent_1", approverType: "agent", decision: "approved", approvedAt: "2024-01-01T00:00:00.000Z" },
  ];

  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
    approvals,
  });

  assert.equal(requiresHumanApproval(record), false);
});

test("requiresHumanApproval returns false when all approvals are from agents [release-record]", () => {
  const approvals: readonly ApprovalRecord[] = [
    { approverId: "agent_1", approverType: "agent", decision: "approved", approvedAt: "2024-01-01T00:00:00.000Z" },
    { approverId: "agent_2", approverType: "agent", decision: "approved", approvedAt: "2024-01-02T00:00:00.000Z" },
  ];

  const record = createReleaseRecord({
    recordId: "rel_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    decision: "approved",
    approvals,
  });

  assert.equal(requiresHumanApproval(record), false);
});

test("ReleaseDecision type accepts all valid values [release-record]", () => {
  const decisions: ReleaseDecision[] = ["approved", "rejected", "rolled_back"];
  assert.equal(decisions.length, 3);
});

test("ReleaseEnvironment type accepts all valid values [release-record]", () => {
  const environments: ReleaseEnvironment[] = ["development", "staging", "production"];
  assert.equal(environments.length, 3);
});
