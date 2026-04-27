import assert from "node:assert/strict";
import test from "node:test";
import { DrDrillGate, type DrDrillEvidence, type DrDrillDecision } from "../../../../src/platform/stability/dr-drill-gate.js";

test("DrDrillGate.evaluate returns passed true when all evidence is valid", () => {
  const gate = new DrDrillGate();
  const evidence: DrDrillEvidence = {
    drillId: "drill-001",
    regionPair: "us-east-1->us-west-1",
    failoverCompleted: true,
    quorumPreserved: true,
    tombstoneReplayBoundaryPreserved: true,
    recoveryTimeMs: 5000,
    maxRecoveryTimeMs: 30000,
  };

  const decision = gate.evaluate(evidence);

  assert.equal(decision.passed, true);
  assert.equal(decision.slaEligible, true);
  assert.deepEqual(decision.reasonCodes, []);
});

test("DrDrillGate.evaluate returns passed false when failover not completed", () => {
  const gate = new DrDrillGate();
  const evidence: DrDrillEvidence = {
    drillId: "drill-002",
    regionPair: "us-east-1->us-west-1",
    failoverCompleted: false,
    quorumPreserved: true,
    tombstoneReplayBoundaryPreserved: true,
    recoveryTimeMs: 5000,
    maxRecoveryTimeMs: 30000,
  };

  const decision = gate.evaluate(evidence);

  assert.equal(decision.passed, false);
  assert.equal(decision.slaEligible, false);
  assert.ok(decision.reasonCodes.includes("dr.failover_not_completed"));
});

test("DrDrillGate.evaluate returns passed false when quorum not preserved", () => {
  const gate = new DrDrillGate();
  const evidence: DrDrillEvidence = {
    drillId: "drill-003",
    regionPair: "us-east-1->us-west-1",
    failoverCompleted: true,
    quorumPreserved: false,
    tombstoneReplayBoundaryPreserved: true,
    recoveryTimeMs: 5000,
    maxRecoveryTimeMs: 30000,
  };

  const decision = gate.evaluate(evidence);

  assert.equal(decision.passed, false);
  assert.ok(decision.reasonCodes.includes("dr.quorum_not_preserved"));
});

test("DrDrillGate.evaluate returns passed false when tombstone replay boundary failed", () => {
  const gate = new DrDrillGate();
  const evidence: DrDrillEvidence = {
    drillId: "drill-004",
    regionPair: "us-east-1->us-west-1",
    failoverCompleted: true,
    quorumPreserved: true,
    tombstoneReplayBoundaryPreserved: false,
    recoveryTimeMs: 5000,
    maxRecoveryTimeMs: 30000,
  };

  const decision = gate.evaluate(evidence);

  assert.equal(decision.passed, false);
  assert.ok(decision.reasonCodes.includes("dr.tombstone_replay_boundary_failed"));
});

test("DrDrillGate.evaluate returns passed false when RTO exceeded", () => {
  const gate = new DrDrillGate();
  const evidence: DrDrillEvidence = {
    drillId: "drill-005",
    regionPair: "us-east-1->us-west-1",
    failoverCompleted: true,
    quorumPreserved: true,
    tombstoneReplayBoundaryPreserved: true,
    recoveryTimeMs: 60000,
    maxRecoveryTimeMs: 30000,
  };

  const decision = gate.evaluate(evidence);

  assert.equal(decision.passed, false);
  assert.ok(decision.reasonCodes.includes("dr.rto_exceeded"));
});

test("DrDrillGate.evaluate returns multiple reason codes when multiple issues", () => {
  const gate = new DrDrillGate();
  const evidence: DrDrillEvidence = {
    drillId: "drill-006",
    regionPair: "us-east-1->us-west-1",
    failoverCompleted: false,
    quorumPreserved: false,
    tombstoneReplayBoundaryPreserved: false,
    recoveryTimeMs: 120000,
    maxRecoveryTimeMs: 30000,
  };

  const decision = gate.evaluate(evidence);

  assert.equal(decision.passed, false);
  assert.equal(decision.slaEligible, false);
  assert.equal(decision.reasonCodes.length, 4);
  assert.ok(decision.reasonCodes.includes("dr.failover_not_completed"));
  assert.ok(decision.reasonCodes.includes("dr.quorum_not_preserved"));
  assert.ok(decision.reasonCodes.includes("dr.tombstone_replay_boundary_failed"));
  assert.ok(decision.reasonCodes.includes("dr.rto_exceeded"));
});

test("DrDrillGate is instantiable", () => {
  const gate = new DrDrillGate();
  assert.equal(typeof gate.evaluate, "function");
});