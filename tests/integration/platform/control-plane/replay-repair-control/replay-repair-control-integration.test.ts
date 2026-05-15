/**
 * Integration Test: Replay Repair Control Service
 *
 * Tests cross-component interactions and integration scenarios:
 * - Recovery drill orchestration across multiple findings
 * - Report generation with mixed severity findings
 * - Repair action planning for complex scenarios
 * - Startup consistency validation workflows
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReplayRepairControlService } from "../../../../../src/platform/five-plane-control-plane/replay-repair-control/index.js";
import type {
  StartupConsistencyFinding,
  ConsistencySeverity,
  StartupConsistencyCheckId,
  RepairActionType,
} from "../../../../../src/platform/five-plane-control-plane/replay-repair-control/index.js";

function createFinding(overrides: Partial<StartupConsistencyFinding> = {}): StartupConsistencyFinding {
  return {
    checkId: "migration_version",
    severity: "info",
    entityRef: "db:migration",
    summary: "migration current",
    recoverable: false,
    suggestedRepairAction: "manual_intervention_required",
    ...overrides,
  };
}

test("replay-repair-integration: complex recovery drill with multiple finding types", () => {
  const service = new ReplayRepairControlService();

  const findings: StartupConsistencyFinding[] = [
    createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:001", recoverable: true, suggestedRepairAction: "requeue_execution" }),
    createFinding({ checkId: "orphan_session", severity: "p2", entityRef: "sess:001", recoverable: true, suggestedRepairAction: "close_orphan_session" }),
    createFinding({ checkId: "stale_file_lock", severity: "p2", entityRef: "lock:001", recoverable: true, suggestedRepairAction: "release_stale_lock" }),
    createFinding({ checkId: "execution_owner_conflict", severity: "p0", entityRef: "task:001", recoverable: false, suggestedRepairAction: "manual_intervention_required" }),
  ];

  const result = service.runRecoveryDrill({ scenario: "multi-issue startup validation", findings });

  assert.strictEqual(result.candidateCount, 4);
  assert.strictEqual(result.repairActions.length, 4);
  assert.strictEqual(result.status, "passed");
});

test("replay-repair-integration: recovery candidate filtering based on severity and recoverability", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "migration_version", severity: "info", entityRef: "db:1", recoverable: false }),
      createFinding({ checkId: "workflow_alignment", severity: "p2", entityRef: "wf:1", recoverable: false, suggestedRepairAction: "manual_intervention_required" }),
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
      createFinding({ checkId: "execution_owner_conflict", severity: "p0", entityRef: "task:1", recoverable: false }),
    ],
  });

  const candidates = service.listRecoveryCandidates(report);

  assert.strictEqual(candidates.length, 2);
  const p1Candidate = candidates.find((c) => c.entityRef === "exec:1");
  const p0Candidate = candidates.find((c) => c.entityRef === "task:1");
  assert.ok(p1Candidate);
  assert.ok(p0Candidate);
  assert.strictEqual(p1Candidate!.disposition, "retry");
  assert.strictEqual(p0Candidate!.disposition, "manual_handoff");
});

test("replay-repair-integration: repair action status depends on manual approval requirement", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:auto", recoverable: true, suggestedRepairAction: "requeue_execution" }),
      createFinding({ checkId: "tier1_ack_backlog", severity: "p2", entityRef: "event:resume", recoverable: true, suggestedRepairAction: "rebuild_ack" }),
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.strictEqual(actions.length, 2);
  actions.forEach((action) => {
    assert.strictEqual(action.status, "planned");
    assert.strictEqual(action.reasonCode, "repair.auto_plan_ready");
  });
});

test("replay-repair-integration: P0 findings block open for traffic assertion", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "migration_version", severity: "info", entityRef: "db:1", recoverable: true }),
      createFinding({ checkId: "execution_owner_conflict", severity: "p0", entityRef: "task:001", recoverable: false }),
    ],
  });

  assert.throws(
    () => service.assertCanOpenForTraffic(report),
    (error: unknown) => error instanceof Error && "code" in error && (error as Record<string, unknown>).code === "replay_repair.fail_closed",
  );
});

test("replay-repair-integration: all-recoverable scenario allows open for traffic", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
      createFinding({ checkId: "orphan_session", severity: "p2", entityRef: "sess:1", recoverable: true, suggestedRepairAction: "close_orphan_session" }),
    ],
  });

  assert.doesNotThrow(() => service.assertCanOpenForTraffic(report));
});

test("replay-repair-integration: empty findings allow open for traffic", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({ findings: [] });

  assert.doesNotThrow(() => service.assertCanOpenForTraffic(report));
  assert.strictEqual(report.status, "open_for_traffic");
});

test("replay-repair-integration: multiple P0 findings still result in fail_closed", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "execution_owner_conflict", severity: "p0", entityRef: "task:001", recoverable: true }),
      createFinding({ checkId: "oapeflir_stage", severity: "p0", entityRef: "stage:001", recoverable: true }),
    ],
  });

  assert.strictEqual(report.status, "fail_closed");
  assert.strictEqual(report.counts.p0, 2);
});

test("replay-repair-integration: repair action creation links to candidate", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:specific", recoverable: true, suggestedRepairAction: "requeue_execution" }),
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.strictEqual(actions.length, 1);
  assert.strictEqual(actions[0]!.candidateId, candidates[0]!.candidateId);
  assert.strictEqual(actions[0]!.entityRef, "exec:specific");
});

test("replay-repair-integration: recovery drill validates all assertions", () => {
  const service = new ReplayRepairControlService();

  const result = service.runRecoveryDrill({
    scenario: "validation drill",
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
    ],
  });

  assert.ok(result.assertions.length >= 3);
  const terminalSuccessAssertion = result.assertions.find((a) => a.assertion.includes("terminal success"));
  const manualHandoffAssertion = result.assertions.find((a) => a.assertion.includes("non-recoverable P0"));
  const repairActionAssertion = result.assertions.find((a) => a.assertion.includes("recovery candidate"));

  assert.ok(terminalSuccessAssertion);
  assert.ok(manualHandoffAssertion);
  assert.ok(repairActionAssertion);
  assert.strictEqual(terminalSuccessAssertion!.passed, true);
});

test("replay-repair-integration: recovery drill fails when P0 has wrong disposition", () => {
  const service = new ReplayRepairControlService();

  const result = service.runRecoveryDrill({
    scenario: "P0 disposition failure drill",
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p0", entityRef: "exec:bad", recoverable: true, suggestedRepairAction: "requeue_execution" }),
    ],
  });

  const manualHandoffAssertion = result.assertions.find((a) => a.assertion.includes("non-recoverable P0"));
  assert.ok(manualHandoffAssertion);
  assert.strictEqual(manualHandoffAssertion!.passed, false);
  assert.strictEqual(result.status, "failed");
});

test("replay-repair-integration: empty scenario throws validation error", () => {
  const service = new ReplayRepairControlService();

  assert.throws(
    () => service.runRecoveryDrill({ scenario: "", findings: [] }),
    (error: unknown) => error instanceof Error && "code" in error && (error as Record<string, unknown>).code === "replay_repair.scenario_required",
  );

  assert.throws(
    () => service.runRecoveryDrill({ scenario: "   ", findings: [] }),
    (error: unknown) => error instanceof Error && "code" in error && (error as Record<string, unknown>).code === "replay_repair.scenario_required",
  );
});

test("replay-repair-integration: scenario is preserved in drill result", () => {
  const service = new ReplayRepairControlService();

  const result = service.runRecoveryDrill({
    scenario: "my-custom-scenario-123",
    findings: [],
  });

  assert.strictEqual(result.scenario, "my-custom-scenario-123");
});

test("replay-repair-integration: report generation with custom ID and timestamp", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    reportId: "custom_report_id_abc",
    generatedAt: "2026-04-15T12:00:00.000Z",
    findings: [],
  });

  assert.strictEqual(report.reportId, "custom_report_id_abc");
  assert.strictEqual(report.generatedAt, "2026-04-15T12:00:00.000Z");
});

test("replay-repair-integration: default report ID and timestamp when not provided", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({ findings: [] });

  assert.ok(report.reportId.startsWith("startup_report_"));
  assert.ok(report.generatedAt.includes("T"));
});

test("replay-repair-integration: findings count by severity", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ severity: "info" }),
      createFinding({ severity: "info" }),
      createFinding({ severity: "p2" }),
      createFinding({ severity: "p1" }),
      createFinding({ severity: "p1" }),
      createFinding({ severity: "p1" }),
      createFinding({ severity: "p0" }),
    ],
  });

  assert.deepStrictEqual(report.counts, { info: 2, p2: 1, p1: 3, p0: 1 });
});

test("replay-repair-integration: disposition inference for different action types", () => {
  const service = new ReplayRepairControlService();

  const requeueReport = service.buildStartupConsistencyReport({
    findings: [createFinding({ checkId: "stale_execution", suggestedRepairAction: "requeue_execution" })],
  });
  const requeueCandidates = service.listRecoveryCandidates(requeueReport);
  assert.strictEqual(requeueCandidates[0]!.disposition, "retry");

  const rebuildReport = service.buildStartupConsistencyReport({
    findings: [createFinding({ checkId: "tier1_ack_backlog", suggestedRepairAction: "rebuild_ack" })],
  });
  const rebuildCandidates = service.listRecoveryCandidates(rebuildReport);
  assert.strictEqual(rebuildCandidates[0]!.disposition, "resume");

  const closeReport = service.buildStartupConsistencyReport({
    findings: [createFinding({ checkId: "orphan_session", suggestedRepairAction: "close_orphan_session" })],
  });
  const closeCandidates = service.listRecoveryCandidates(closeReport);
  assert.strictEqual(closeCandidates[0]!.disposition, "resume");

  const manualReport = service.buildStartupConsistencyReport({
    findings: [createFinding({ suggestedRepairAction: "manual_intervention_required" })],
  });
  const manualCandidates = service.listRecoveryCandidates(manualReport);
  assert.strictEqual(manualCandidates[0]!.disposition, "manual_handoff");
});

test("replay-repair-integration: requires manual approval for P0 or manual intervention", () => {
  const service = new ReplayRepairControlService();

  const p0Report = service.buildStartupConsistencyReport({
    findings: [createFinding({ severity: "p0", recoverable: false })],
  });
  const p0Candidates = service.listRecoveryCandidates(p0Report);
  assert.strictEqual(p0Candidates[0]!.requiresManualApproval, true);

  const manualReport = service.buildStartupConsistencyReport({
    findings: [createFinding({ severity: "p1", suggestedRepairAction: "manual_intervention_required" })],
  });
  const manualCandidates = service.listRecoveryCandidates(manualReport);
  assert.strictEqual(manualCandidates[0]!.requiresManualApproval, true);

  const autoReport = service.buildStartupConsistencyReport({
    findings: [createFinding({ severity: "p1", recoverable: true, suggestedRepairAction: "requeue_execution" })],
  });
  const autoCandidates = service.listRecoveryCandidates(autoReport);
  assert.strictEqual(autoCandidates[0]!.requiresManualApproval, false);
});

test("replay-repair-integration: findings are defensively copied in report", () => {
  const service = new ReplayRepairControlService();

  const originalFindings = [
    createFinding({ entityRef: "exec:original" }),
  ];
  const report = service.buildStartupConsistencyReport({ findings: originalFindings });

  (report.findings as StartupConsistencyFinding[]).push(
    createFinding({ entityRef: "exec:modified" }),
  );

  assert.strictEqual(report.findings.length, 1);
  assert.strictEqual(report.findings[0]!.entityRef, "exec:original");
});

test("replay-repair-integration: unique action IDs generated for each repair action", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:2", recoverable: true, suggestedRepairAction: "requeue_execution" }),
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:3", recoverable: true, suggestedRepairAction: "requeue_execution" }),
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  const actionIds = actions.map((a) => a.actionId);
  const uniqueIds = new Set(actionIds);
  assert.strictEqual(uniqueIds.size, actionIds.length);
});

test("replay-repair-integration: candidate IDs are unique across multiple candidates", () => {
  const service = new ReplayRepairControlService();

  const report = service.buildStartupConsistencyReport({
    findings: [
      createFinding({ checkId: "stale_execution", severity: "p1", entityRef: "exec:1", recoverable: true, suggestedRepairAction: "requeue_execution" }),
      createFinding({ checkId: "orphan_session", severity: "p2", entityRef: "sess:1", recoverable: true, suggestedRepairAction: "close_orphan_session" }),
      createFinding({ checkId: "stale_file_lock", severity: "p2", entityRef: "lock:1", recoverable: true, suggestedRepairAction: "release_stale_lock" }),
    ],
  });

  const candidates = service.listRecoveryCandidates(report);

  const candidateIds = candidates.map((c) => c.candidateId);
  const uniqueIds = new Set(candidateIds);
  assert.strictEqual(uniqueIds.size, candidateIds.length);
});

test("replay-repair-integration: drill completedAt timestamp is valid ISO format", () => {
  const service = new ReplayRepairControlService();
  const before = new Date().toISOString();

  const result = service.runRecoveryDrill({ scenario: "timestamp validation", findings: [] });

  const after = new Date().toISOString();
  assert.ok(result.completedAt >= before);
  assert.ok(result.completedAt <= after);
});

test("replay-repair-integration: checkId is preserved in recovery candidates", () => {
  const service = new ReplayRepairControlService();

  const checkIds: StartupConsistencyCheckId[] = [
    "migration_version",
    "workflow_alignment",
    "step_index",
    "stale_execution",
    "orphan_session",
    "stale_file_lock",
    "tier1_ack_backlog",
    "execution_owner_conflict",
    "oapeflir_stage",
    "rollout_consistency",
  ];

  for (const checkId of checkIds) {
    const report = service.buildStartupConsistencyReport({
      findings: [createFinding({ checkId, severity: "p1", recoverable: true })],
    });
    const candidates = service.listRecoveryCandidates(report);
    assert.strictEqual(candidates[0]!.checkId, checkId);
  }
});

test("replay-repair-integration: severity is preserved in recovery candidates", () => {
  const service = new ReplayRepairControlService();

  const severities: ConsistencySeverity[] = ["info", "p2", "p1", "p0"];

  for (const severity of severities) {
    const report = service.buildStartupConsistencyReport({
      findings: [createFinding({ severity, recoverable: true })],
    });
    const candidates = service.listRecoveryCandidates(report);
    if (severity === "info") {
      assert.strictEqual(candidates.length, 0);
    } else {
      assert.strictEqual(candidates[0]!.severity, severity);
    }
  }
});

test("replay-repair-integration: suggested repair action is preserved in candidate", () => {
  const service = new ReplayRepairControlService();

  const actionTypes: RepairActionType[] = [
    "requeue_execution",
    "release_stale_lock",
    "rebuild_ack",
    "close_orphan_session",
    "manual_intervention_required",
  ];

  for (const actionType of actionTypes) {
    const report = service.buildStartupConsistencyReport({
      findings: [createFinding({ suggestedRepairAction: actionType, recoverable: true })],
    });
    const candidates = service.listRecoveryCandidates(report);
    assert.strictEqual(candidates[0]!.suggestedRepairAction, actionType);
  }
});