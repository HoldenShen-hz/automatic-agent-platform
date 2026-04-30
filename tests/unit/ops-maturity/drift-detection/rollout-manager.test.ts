import assert from "node:assert/strict";
import test from "node:test";

import { SimpleRolloutManager, type RolloutMetrics } from "../../../../src/ops-maturity/drift-detection/rollout-manager.js";
import type { ImprovementProposal } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";

/**
 * Issue #2106: Rollback is in-memory only, doesn't actually revert
 */
function createProposal(id: string): ImprovementProposal {
  return {
    id,
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "test",
    patch: "test patch",
    rationale: "test rationale",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("SimpleRolloutManager: rollback marks status in-memory only (issue #2106)", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");

  await manager.start(proposal, "canary", 5);

  // Perform rollback - only updates in-memory record
  await manager.rollback("prop_1", "Testing rollback");

  const record = await manager.getRollout("prop_1");
  assert.equal(record!.status, "rolled_back");
  // Note: The rollback only updates the status in memory
  // It doesn't actually revert any external state or configuration
  // This is the bug - rollback should trigger actual reversion
});

test("SimpleRolloutManager: rollback preserves failure reason", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");

  await manager.start(proposal, "canary", 5);

  await manager.rollback("prop_1", "Explicit rollback reason");

  const record = await manager.getRollout("prop_1");
  assert.equal(record!.failureReason, "Explicit rollback reason");
  assert.ok(record!.completedAt !== null);
});

test("SimpleRolloutManager: updateMetrics triggers rollback_pending on threshold breach", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_1");

  await manager.start(proposal, "canary", 5);

  // Update with bad metrics that breach thresholds
  const badMetrics: RolloutMetrics = {
    successRate: 0.80, // Below default 0.95
    errorRate: 0.10,   // Above default 0.05
    latencyMs: 3000,   // Above default 2000ms
    costUsd: 0.15,     // Above default 0.10
  };

  await manager.updateMetrics("prop_1", badMetrics);

  const record = await manager.getRollout("prop_1");
  assert.equal(record!.status, "rollback_pending");
  assert.ok(record!.failureReason !== undefined);
  assert.ok(record!.failureReason!.includes("Metric threshold breach"));
});

test("SimpleRolloutManager: start creates new rollout record", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_new");

  const record = await manager.start(proposal, "shadow", 0);

  assert.equal(record.proposalId, "prop_new");
  assert.equal(record.stage, "shadow");
  assert.equal(record.status, "running");
});

test("SimpleRolloutManager: complete marks rollout as succeeded", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_complete");

  await manager.start(proposal, "stable", 100);
  await manager.complete("prop_complete");

  const record = await manager.getRollout("prop_complete");
  assert.equal(record!.status, "succeeded");
});

test("SimpleRolloutManager: fail marks rollout as failed with reason", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createProposal("prop_fail");

  await manager.start(proposal, "canary", 5);
  await manager.fail("prop_fail", "Health check failure");

  const record = await manager.getRollout("prop_fail");
  assert.equal(record!.status, "failed");
  assert.equal(record!.failureReason, "Health check failure");
});

test("SimpleRolloutManager: getActiveRollouts filters correctly", async () => {
  const manager = new SimpleRolloutManager();

  await manager.start(createProposal("prop_1"), "shadow", 0);
  await manager.start(createProposal("prop_2"), "canary", 5);
  await manager.start(createProposal("prop_3"), "partial", 25);

  // Complete one
  await manager.complete("prop_2");

  // Fail one
  await manager.start(createProposal("prop_4"), "stable", 100);
  await manager.fail("prop_4", "Failed");

  const active = await manager.getActiveRollouts();
  assert.equal(active.length, 2); // prop_1 and prop_3

  // Also include rollback_pending
  await manager.start(createProposal("prop_5"), "canary", 5);
  const badMetrics: RolloutMetrics = { successRate: 0.5, errorRate: 0.5, latencyMs: 5000, costUsd: 1.0 };
  await manager.updateMetrics("prop_5", badMetrics);

  const activeWithPending = await manager.getActiveRollouts();
  assert.ok(activeWithPending.some((r) => r.proposalId === "prop_5"));
});

test("SimpleRolloutManager: getStagePercentage returns correct values", () => {
  const manager = new SimpleRolloutManager();

  assert.equal(manager.getStagePercentage("shadow"), 0);
  assert.equal(manager.getStagePercentage("canary"), 5);
  assert.equal(manager.getStagePercentage("partial"), 25);
  assert.equal(manager.getStagePercentage("stable"), 100);
});

test("SimpleRolloutManager: getDefaultStageSequence returns correct order", () => {
  const manager = new SimpleRolloutManager();
  const sequence = manager.getDefaultStageSequence();

  assert.deepEqual(sequence, ["shadow", "canary", "partial", "stable"]);
});