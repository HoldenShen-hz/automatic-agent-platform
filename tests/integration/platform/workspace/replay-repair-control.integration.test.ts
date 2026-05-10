/**
 * Integration Tests: Replay Repair Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ReplayRepairControlService,
  type StartupConsistencyFinding,
  type RecoveryCandidate,
  type RepairAction,
  type RecoveryDrillResult,
} from "../../../../../src/platform/five-plane-control-plane/replay-repair-control/index.js";

// ============================================================================
// Replay Repair Control End-to-End Integration Tests
// ============================================================================

test("integration: full recovery drill workflow", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "stale_execution", severity: "p2", entityRef: "exec_001", summary: "Execution stalled", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "orphan_session", severity: "p1", entityRef: "session_002", summary: "Orphaned session", recoverable: true, suggestedRepairAction: "close_orphan_session" },
    { checkId: "tier1_ack_backlog", severity: "info", entityRef: "queue_003", summary: "Minor backlog", recoverable: true, suggestedRepairAction: "rebuild_ack" },
  ];

  const drill = service.runRecoveryDrill({
    scenario: "startup_consistency_check",
    findings,
  });

  assert.equal(drill.status, "passed");
  assert.equal(drill.candidateCount, 3);
  assert.equal(drill.repairActions.length, 3);

  const blockedActions = drill.repairActions.filter((a: RepairAction) => a.status === "blocked");
  const plannedActions = drill.repairActions.filter((a: RepairAction) => a.status === "planned");

  assert.equal(blockedActions.length, 0);
  assert.equal(plannedActions.length, 3);
});

test("integration: P0 findings block open_for_traffic", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "migration_version", severity: "p0", entityRef: "db_schema", summary: "Schema mismatch", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });
  assert.equal(report.status, "fail_closed");

  assert.throws(
    () => service.assertCanOpenForTraffic(report),
    /fail_closed/,
  );
});

test("integration: recovery candidates have correct dispositions", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "stale_execution", severity: "p2", entityRef: "exec_retry", summary: "Retryable", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "orphan_session", severity: "p1", entityRef: "session_close", summary: "Closable", recoverable: true, suggestedRepairAction: "close_orphan_session" },
    { checkId: "lock_held", severity: "p1", entityRef: "lock_001", summary: "Lock timeout", recoverable: true, suggestedRepairAction: "release_stale_lock" },
    { checkId: "unknown", severity: "p0", entityRef: "unknown_entity", summary: "Unknown issue", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });
  const candidates = service.listRecoveryCandidates(report);

  assert.equal(candidates.length, 4);

  const retryCandidates = candidates.filter((c: RecoveryCandidate) => c.disposition === "retry");
  const resumeCandidates = candidates.filter((c: RecoveryCandidate) => c.disposition === "resume");
  const manualCandidates = candidates.filter((c: RecoveryCandidate) => c.disposition === "manual_handoff");

  assert.ok(retryCandidates.length >= 1);
  assert.ok(resumeCandidates.length >= 1);
  assert.ok(manualCandidates.length >= 1);
});

test("integration: repair actions planned from candidates", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "stale_execution", severity: "p2", entityRef: "exec_001", summary: "Stale", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "orphan_session", severity: "p1", entityRef: "session_001", summary: "Orphan", recoverable: true, suggestedRepairAction: "close_orphan_session" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });
  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.equal(actions.length, 2);
  assert.ok(actions.every((a: RepairAction) => a.status === "planned" || a.status === "blocked"));
  assert.ok(actions.every((a: RepairAction) => a.actionId.length > 0));
});

test("integration: multiple severity levels counted correctly", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    { checkId: "info_1", severity: "info", entityRef: "e1", summary: "Info", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "info_2", severity: "info", entityRef: "e2", summary: "Info", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "p2_1", severity: "p2", entityRef: "e3", summary: "P2", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "p1_1", severity: "p1", entityRef: "e4", summary: "P1", recoverable: true, suggestedRepairAction: "requeue_execution" },
    { checkId: "p0_1", severity: "p0", entityRef: "e5", summary: "P0", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
  ];

  const report = service.buildStartupConsistencyReport({ findings });

  assert.deepStrictEqual(report.counts, { info: 2, p2: 1, p1: 1, p0: 1 });
  assert.equal(report.findings.length, 5);
});

test("integration: empty findings allows open_for_traffic", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    reportId: "report_empty",
    findings: [],
  });

  assert.equal(report.status, "open_for_traffic");
  assert.doesNotThrow(() => service.assertCanOpenForTraffic(report));
});
