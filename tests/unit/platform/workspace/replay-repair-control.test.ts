/**
 * Unit Tests: Replay Repair Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ReplayRepairControlService,
  type StartupConsistencyFinding,
  type StartupConsistencyReport,
  type RecoveryCandidate,
  type RepairAction,
  type RecoveryDrillResult,
  type ConsistencySeverity,
  type RepairActionType,
  type RecoveryDisposition,
} from "../../../../src/platform/five-plane-control-plane/replay-repair-control/index.js";

// ============================================================================
// Replay Repair Control Service Tests
// ============================================================================

test("buildStartupConsistencyReport returns open_for_traffic with no findings", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    reportId: "report_001",
    findings: [],
    generatedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(report.status, "open_for_traffic");
  assert.equal(report.findings.length, 0);
  assert.deepStrictEqual(report.counts, { info: 0, p2: 0, p1: 0, p0: 0 });
});

test("buildStartupConsistencyReport returns repair_required with recoverable findings", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    {
      checkId: "stale_execution",
      severity: "p2",
      entityRef: "exec_123",
      summary: "Execution stalled for 5 minutes",
      recoverable: true,
      suggestedRepairAction: "requeue_execution",
    },
  ];

  const report = service.buildStartupConsistencyReport({ findings });

  assert.equal(report.status, "repair_required");
  assert.equal(report.findings.length, 1);
  assert.deepStrictEqual(report.counts, { info: 0, p2: 1, p1: 0, p0: 0 });
});

test("buildStartupConsistencyReport returns fail_closed with P0 findings", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    {
      checkId: "migration_version",
      severity: "p0",
      entityRef: "db_schema",
      summary: "Migration version mismatch",
      recoverable: false,
      suggestedRepairAction: "manual_intervention_required",
    },
  ];

  const report = service.buildStartupConsistencyReport({ findings });

  assert.equal(report.status, "fail_closed");
  assert.deepStrictEqual(report.counts, { info: 0, p2: 0, p1: 0, p0: 1 });
});

test("buildStartupConsistencyReport counts all severity levels", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "info_check", severity: "info", entityRef: "entity_1", summary: "Info", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "p2_check", severity: "p2", entityRef: "entity_2", summary: "P2", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "p1_check", severity: "p1", entityRef: "entity_3", summary: "P1", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "p0_check", severity: "p0", entityRef: "entity_4", summary: "P0", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });

  assert.deepStrictEqual(report.counts, { info: 1, p2: 1, p1: 1, p0: 1 });
});

test("listRecoveryCandidates returns candidates for recoverable findings", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "stale_execution", severity: "p2", entityRef: "exec_123", summary: "Stale", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "orphan_session", severity: "p1", entityRef: "session_456", summary: "Orphan", recoverable: true, suggestedRepairAction: "close_orphan_session" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });
  const candidates = service.listRecoveryCandidates(report);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].disposition, "retry");
  assert.equal(candidates[1].suggestedRepairAction, "close_orphan_session");
});

test("listRecoveryCandidates requires manual approval for P0", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "migration_version", severity: "p0", entityRef: "db", summary: "P0", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });
  const candidates = service.listRecoveryCandidates(report);

  assert.equal(candidates[0].requiresManualApproval, true);
  assert.equal(candidates[0].disposition, "manual_handoff");
});

test("planRepairActions creates planned actions for auto-repairable candidates", () => {
  const service = new ReplayRepairControlService();

  const candidates: RecoveryCandidate[] = [
    {
      candidateId: "cand_001",
      entityRef: "exec_123",
      checkId: "stale_execution",
      severity: "p2",
      suggestedRepairAction: "requeue_execution",
      disposition: "retry",
      requiresManualApproval: false,
    },
  ];

  const actions = service.planRepairActions(candidates);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].status, "planned");
  assert.equal(actions[0].actionType, "requeue_execution");
  assert.equal(actions[0].candidateId, "cand_001");
});

test("planRepairActions creates blocked actions for manual approval", () => {
  const service = new ReplayRepairControlService();

  const candidates: RecoveryCandidate[] = [
    {
      candidateId: "cand_002",
      entityRef: "db_schema",
      checkId: "migration_version",
      severity: "p0",
      suggestedRepairAction: "manual_intervention_required",
      disposition: "manual_handoff",
      requiresManualApproval: true,
    },
  ];

  const actions = service.planRepairActions(candidates);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].status, "blocked");
});

test("assertCanOpenForTraffic allows open_for_traffic", () => {
  const service = new ReplayRepairControlService();

  const report: StartupConsistencyReport = {
    reportId: "report_002",
    generatedAt: "2026-04-29T00:00:00.000Z",
    status: "open_for_traffic",
    findings: [],
    counts: { info: 0, p2: 0, p1: 0, p0: 0 },
  };

  assert.doesNotThrow(() => service.assertCanOpenForTraffic(report));
});

test("assertCanOpenForTraffic throws for fail_closed", () => {
  const service = new ReplayRepairControlService();

  const report: StartupConsistencyReport = {
    reportId: "report_003",
    generatedAt: "2026-04-29T00:00:00.000Z",
    status: "fail_closed",
    findings: [
      { checkId: "p0", severity: "p0", entityRef: "db", summary: "P0", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
    ],
    counts: { info: 0, p2: 0, p1: 0, p0: 1 },
  };

  assert.throws(
    () => service.assertCanOpenForTraffic(report),
    /fail_closed/,
  );
});

test("runRecoveryDrill passes with valid scenario", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "stale_execution", severity: "p2", entityRef: "exec_123", summary: "Stale", recoverable: true, suggestedRepairAction: "requeue_execution" },
  ];

  const result = service.runRecoveryDrill({
    scenario: "stale_execution_recovery",
    findings,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.scenario, "stale_execution_recovery");
  assert.equal(result.candidateCount, 1);
  assert.equal(result.repairActions.length, 1);
});

test("runRecoveryDrill throws for empty scenario", () => {
  const service = new ReplayRepairControlService();

  assert.throws(
    () => service.runRecoveryDrill({ scenario: "", findings: [] }),
    /scenario_required/,
  );
});

test("runRecoveryDrill runs assertions", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "stale_execution", severity: "p2", entityRef: "exec_123", summary: "Stale", recoverable: true, suggestedRepairAction: "requeue_execution" },
  ];

  const result = service.runRecoveryDrill({
    scenario: "test_scenario",
    findings,
  });

  assert.ok(result.assertions.length > 0);
  assert.ok(result.assertions.every((a) => typeof a.passed === "boolean"));
});

test("runRecoveryDrill validates P0 findings require manual handoff", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "migration_version", severity: "p0", entityRef: "db", summary: "P0", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
  ];

  const result = service.runRecoveryDrill({
    scenario: "p0_scenario",
    findings,
  });

  const p0Assertion = result.assertions.find((a) => a.assertion.includes("non-recoverable P0"));

  assert.ok(p0Assertion !== undefined);
  assert.equal(p0Assertion?.passed, true);
});
