import assert from "node:assert/strict";
import test from "node:test";

import {
  ReplayRepairControlService,
  type RecoveryCandidate,
  type StartupConsistencyFinding,
  type StartupConsistencyReport,
} from "../../../../src/platform/five-plane-control-plane/replay-repair-control/index.js";

function createService() {
  return new ReplayRepairControlService();
}

test("ReplayRepairControlService builds startup reports with current status transitions", () => {
  const service = createService();

  const open = service.buildStartupConsistencyReport({
    findings: [],
    generatedAt: "2026-04-29T00:00:00.000Z",
  });
  const repair = service.buildStartupConsistencyReport({
    findings: [{
      checkId: "stale_execution",
      severity: "p2",
      entityRef: "exec_123",
      summary: "Execution stalled",
      recoverable: true,
      suggestedRepairAction: "requeue_execution",
    }],
  });
  const failClosed = service.buildStartupConsistencyReport({
    findings: [{
      checkId: "migration_version",
      severity: "p0",
      entityRef: "db_schema",
      summary: "Migration mismatch",
      recoverable: false,
      suggestedRepairAction: "manual_intervention_required",
    }],
  });

  assert.equal(open.status, "open_for_traffic");
  assert.deepEqual(open.counts, { info: 0, p2: 0, p1: 0, p0: 0 });
  assert.equal(repair.status, "repair_required");
  assert.equal(repair.counts.p2, 1);
  assert.equal(failClosed.status, "fail_closed");
  assert.equal(failClosed.counts.p0, 1);
});

test("ReplayRepairControlService lists recovery candidates with current dispositions", () => {
  const service = createService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p2",
        entityRef: "exec_123",
        summary: "Execution stalled",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
      {
        checkId: "tier1_ack_backlog",
        severity: "p1",
        entityRef: "ack_456",
        summary: "Ack backlog",
        recoverable: true,
        suggestedRepairAction: "rebuild_ack",
      },
      {
        checkId: "migration_version",
        severity: "p0",
        entityRef: "db_schema",
        summary: "Migration mismatch",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);

  assert.equal(candidates.length, 3);
  assert.equal(candidates[0]?.disposition, "retry");
  assert.equal(candidates[1]?.disposition, "resume");
  assert.equal(candidates[2]?.disposition, "manual_handoff");
  assert.equal(candidates[2]?.requiresManualApproval, true);
});

test("ReplayRepairControlService plans blocked vs automatic repair actions", () => {
  const service = createService();
  const candidates: RecoveryCandidate[] = [
    {
      candidateId: "candidate_retry",
      entityRef: "exec_123",
      checkId: "stale_execution",
      severity: "p2",
      suggestedRepairAction: "requeue_execution",
      disposition: "retry",
      requiresManualApproval: false,
    },
    {
      candidateId: "candidate_manual",
      entityRef: "db_schema",
      checkId: "migration_version",
      severity: "p0",
      suggestedRepairAction: "manual_intervention_required",
      disposition: "manual_handoff",
      requiresManualApproval: true,
    },
  ];

  const actions = service.planRepairActions(candidates);

  assert.equal(actions.length, 2);
  assert.equal(actions[0]?.status, "planned");
  assert.equal(actions[1]?.status, "blocked");
  assert.equal(actions[1]?.reasonCode, "repair.manual_approval_required");
});

test("ReplayRepairControlService enforces traffic-open guard and recovery drills", () => {
  const service = createService();
  const openReport: StartupConsistencyReport = {
    reportId: "report_open",
    generatedAt: "2026-04-29T00:00:00.000Z",
    status: "open_for_traffic",
    findings: [],
    counts: { info: 0, p2: 0, p1: 0, p0: 0 },
  };
  const failClosedReport: StartupConsistencyReport = {
    reportId: "report_closed",
    generatedAt: "2026-04-29T00:00:00.000Z",
    status: "fail_closed",
    findings: [{
      checkId: "migration_version",
      severity: "p0",
      entityRef: "db_schema",
      summary: "Migration mismatch",
      recoverable: false,
      suggestedRepairAction: "manual_intervention_required",
    }],
    counts: { info: 0, p2: 0, p1: 0, p0: 1 },
  };
  const drill = service.runRecoveryDrill({
    scenario: "stale_execution_recovery",
    findings: [{
      checkId: "stale_execution",
      severity: "p2",
      entityRef: "exec_123",
      summary: "Execution stalled",
      recoverable: true,
      suggestedRepairAction: "requeue_execution",
    }],
  });

  assert.doesNotThrow(() => service.assertCanOpenForTraffic(openReport));
  assert.throws(() => service.assertCanOpenForTraffic(failClosedReport), /P0 findings/);
  assert.equal(drill.status, "passed");
  assert.equal(drill.candidateCount, 1);
  assert.ok(drill.assertions.every((assertion) => assertion.passed));
});
