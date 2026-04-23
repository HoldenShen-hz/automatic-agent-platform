import assert from "node:assert/strict";
import test from "node:test";

import { ReplayRepairControlService } from "../../../../../src/platform/control-plane/replay-repair-control/index.js";

test("buildStartupConsistencyReport sets open_for_traffic when no P0 findings and no recoverable", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "migration_version",
        severity: "info",
        entityRef: "db:migration",
        summary: "migration current",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  assert.equal(report.status, "open_for_traffic");
  assert.equal(report.counts.p0, 0);
  assert.equal(report.counts.info, 1);
});

test("buildStartupConsistencyReport sets repair_required when findings are recoverable but no P0", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "execution:1",
        summary: "heartbeat expired",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  assert.equal(report.status, "repair_required");
});

test("buildStartupConsistencyReport sets fail_closed when P0 findings exist", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "execution_owner_conflict",
        severity: "p0",
        entityRef: "task:1",
        summary: "two active executions",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  assert.equal(report.status, "fail_closed");
  assert.equal(report.counts.p0, 1);
});

test("buildStartupConsistencyReport counts multiple severity levels correctly", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "migration_version", severity: "info", entityRef: "db:1", summary: "a", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
      { checkId: "workflow_alignment", severity: "p2", entityRef: "wf:1", summary: "b", recoverable: true, suggestedRepairAction: "requeue_execution" },
      { checkId: "step_index", severity: "p1", entityRef: "step:1", summary: "c", recoverable: true, suggestedRepairAction: "rebuild_ack" },
      { checkId: "stale_execution", severity: "p0", entityRef: "exec:1", summary: "d", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
    ],
  });

  assert.equal(report.counts.info, 1);
  assert.equal(report.counts.p2, 1);
  assert.equal(report.counts.p1, 1);
  assert.equal(report.counts.p0, 1);
});

test("buildStartupConsistencyReport uses custom reportId and generatedAt when provided", () => {
  const service = new ReplayRepairControlService();
  const customReportId = "custom_report_123";
  const customGeneratedAt = "2026-04-23T10:00:00.000Z";
  const report = service.buildStartupConsistencyReport({
    reportId: customReportId,
    generatedAt: customGeneratedAt,
    findings: [],
  });

  assert.equal(report.reportId, customReportId);
  assert.equal(report.generatedAt, customGeneratedAt);
});

test("buildStartupConsistencyReport generates random reportId and current timestamp when not provided", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({ findings: [] });

  assert.ok(report.reportId.startsWith("startup_report_"));
  assert.ok(report.generatedAt.includes("T"));
});

test("listRecoveryCandidates excludes non-recoverable non-P0 findings", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "migration_version",
        severity: "info",
        entityRef: "db:migration",
        summary: "migration current",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
      {
        checkId: "workflow_alignment",
        severity: "p2",
        entityRef: "wf:1",
        summary: "misaligned",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 0);
});

test("listRecoveryCandidates includes recoverable findings", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "execution:1",
        summary: "heartbeat expired",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  const candidate = candidates[0]!;
  assert.equal(candidate.entityRef, "execution:1");
  assert.equal(candidate.suggestedRepairAction, "requeue_execution");
});

test("listRecoveryCandidates includes P0 findings even when not recoverable", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "execution_owner_conflict",
        severity: "p0",
        entityRef: "task:1",
        summary: "two active executions",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  const candidate = candidates[0]!;
  assert.equal(candidate.entityRef, "task:1");
  assert.equal(candidate.disposition, "manual_handoff");
});

test("listRecoveryCandidates sets requiresManualApproval for P0 or manual_intervention_required", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "exec:1",
        summary: "stale",
        recoverable: true,
        suggestedRepairAction: "manual_intervention_required",
      },
      {
        checkId: "orphan_session",
        severity: "p1",
        entityRef: "sess:1",
        summary: "orphan",
        recoverable: true,
        suggestedRepairAction: "close_orphan_session",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 2);
  const manualApprovalCandidate = candidates.find(c => c.entityRef === "exec:1");
  const autoCandidate = candidates.find(c => c.entityRef === "sess:1");

  assert.strictEqual(manualApprovalCandidate?.requiresManualApproval, true);
  assert.strictEqual(autoCandidate?.requiresManualApproval, false);
});

test("listRecoveryCandidates sets disposition based on action type", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "exec:requeue",
        summary: "stale",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
      {
        checkId: "tier1_ack_backlog",
        severity: "p2",
        entityRef: "event:resume",
        summary: "backlog",
        recoverable: true,
        suggestedRepairAction: "rebuild_ack",
      },
      {
        checkId: "orphan_session",
        severity: "p2",
        entityRef: "sess:orphan",
        summary: "orphan",
        recoverable: true,
        suggestedRepairAction: "close_orphan_session",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const requeueCandidate = candidates.find(c => c.entityRef === "exec:requeue");
  const ackCandidate = candidates.find(c => c.entityRef === "event:resume");
  const orphanCandidate = candidates.find(c => c.entityRef === "sess:orphan");

  assert.strictEqual(requeueCandidate?.disposition, "retry");
  assert.strictEqual(ackCandidate?.disposition, "resume");
  assert.strictEqual(orphanCandidate?.disposition, "resume");
});

test("planRepairActions creates planned status for auto-repairable candidates", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "execution:1",
        summary: "heartbeat expired",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.equal(actions.length, 1);
  const action = actions[0]!;
  assert.equal(action.status, "planned");
  assert.equal(action.actionType, "requeue_execution");
  assert.equal(action.reasonCode, "repair.auto_plan_ready");
});

test("planRepairActions creates blocked status for manual approval candidates", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "execution_owner_conflict",
        severity: "p0",
        entityRef: "task:1",
        summary: "two active executions",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.equal(actions.length, 1);
  const action = actions[0]!;
  assert.equal(action.status, "blocked");
  assert.equal(action.reasonCode, "repair.manual_approval_required");
});

test("planRepairActions generates unique action IDs", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "stale_execution", severity: "p1", entityRef: "exec:1", summary: "a", recoverable: true, suggestedRepairAction: "requeue_execution" },
      { checkId: "stale_file_lock", severity: "p2", entityRef: "lock:1", summary: "b", recoverable: true, suggestedRepairAction: "release_stale_lock" },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.notEqual(actions[0]!.actionId, actions[1]!.actionId);
});

test("planRepairActions includes candidateId linking action to candidate", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "execution:1",
        summary: "heartbeat expired",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.equal(actions[0]!.candidateId, candidates[0]!.candidateId);
});

test("assertCanOpenForTraffic does not throw for open_for_traffic status", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "migration_version",
        severity: "info",
        entityRef: "db:migration",
        summary: "migration current",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  assert.doesNotThrow(() => service.assertCanOpenForTraffic(report));
});

test("assertCanOpenForTraffic does not throw for repair_required status", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "execution:1",
        summary: "heartbeat expired",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  assert.doesNotThrow(() => service.assertCanOpenForTraffic(report));
});

test("assertCanOpenForTraffic throws ValidationError for fail_closed status", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "execution_owner_conflict",
        severity: "p0",
        entityRef: "task:1",
        summary: "two active executions",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  assert.throws(
    () => service.assertCanOpenForTraffic(report),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "replay_repair.fail_closed",
  );
});

test("runRecoveryDrill throws ValidationError for empty scenario", () => {
  const service = new ReplayRepairControlService();

  assert.throws(
    () => service.runRecoveryDrill({ scenario: "", findings: [] }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "replay_repair.scenario_required",
  );
});

test("runRecoveryDrill throws ValidationError for whitespace-only scenario", () => {
  const service = new ReplayRepairControlService();

  assert.throws(
    () => service.runRecoveryDrill({ scenario: "   ", findings: [] }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "replay_repair.scenario_required",
  );
});

test("runRecoveryDrill returns passed status when all assertions pass", () => {
  const service = new ReplayRepairControlService();
  const result = service.runRecoveryDrill({
    scenario: "no issues found",
    findings: [],
  });

  assert.equal(result.status, "passed");
  assert.equal(result.candidateCount, 0);
  assert.ok(result.drillId.startsWith("recovery_drill_"));
});

test("runRecoveryDrill returns passed status with single P0 requiring manual handoff", () => {
  const service = new ReplayRepairControlService();
  const result = service.runRecoveryDrill({
    scenario: "single P0 conflict",
    findings: [
      {
        checkId: "execution_owner_conflict",
        severity: "p0",
        entityRef: "task:1",
        summary: "two active executions",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  assert.equal(result.status, "passed");
  assert.equal(result.candidateCount, 1);
  assert.equal(result.assertions.length, 3);
});

test("runRecoveryDrill returns repair actions for all candidates", () => {
  const service = new ReplayRepairControlService();
  const result = service.runRecoveryDrill({
    scenario: "multiple issues",
    findings: [
      { checkId: "stale_execution", severity: "p1", entityRef: "exec:1", summary: "a", recoverable: true, suggestedRepairAction: "requeue_execution" },
      { checkId: "orphan_session", severity: "p2", entityRef: "sess:1", summary: "b", recoverable: true, suggestedRepairAction: "close_orphan_session" },
    ],
  });

  assert.equal(result.candidateCount, 2);
  assert.equal(result.repairActions.length, 2);
  assert.ok(result.repairActions.some(a => a.actionType === "requeue_execution"));
  assert.ok(result.repairActions.some(a => a.actionType === "close_orphan_session"));
});

test("runRecoveryDrill sets completedAt timestamp", () => {
  const service = new ReplayRepairControlService();
  const before = new Date().toISOString();
  const result = service.runRecoveryDrill({ scenario: "timing test", findings: [] });
  const after = new Date().toISOString();

  assert.ok(result.completedAt >= before);
  assert.ok(result.completedAt <= after);
});

test("runRecoveryDrill validates non-recoverable P0 requires manual handoff assertion", () => {
  const service = new ReplayRepairControlService();
  const result = service.runRecoveryDrill({
    scenario: "P0 with auto repair action",
    findings: [
      {
        checkId: "stale_execution",
        severity: "p0",
        entityRef: "exec:bad",
        summary: "bad",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  const assertion = result.assertions.find(a => a.assertion === "non-recoverable P0 findings require manual handoff");
  assert.strictEqual(assertion?.passed, false);
  assert.equal(result.status, "failed");
});

test("all severity types are counted correctly in report", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "migration_version", severity: "info", entityRef: "1", summary: "a", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
      { checkId: "workflow_alignment", severity: "p2", entityRef: "2", summary: "b", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
      { checkId: "step_index", severity: "p1", entityRef: "3", summary: "c", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
      { checkId: "stale_execution", severity: "p0", entityRef: "4", summary: "d", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
    ],
  });

  assert.deepEqual(report.counts, { info: 1, p2: 1, p1: 1, p0: 1 });
});

test("empty findings list produces zero counts", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({ findings: [] });

  assert.deepEqual(report.counts, { info: 0, p2: 0, p1: 0, p0: 0 });
  assert.equal(report.status, "open_for_traffic");
});

test("inferDisposition returns manual_handoff for non-recoverable", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "execution_owner_conflict",
        severity: "p0",
        entityRef: "task:1",
        summary: "conflict",
        recoverable: false,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  assert.strictEqual(candidates[0]!.disposition, "manual_handoff");
});

test("inferDisposition returns manual_handoff for manual_intervention_required action", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "exec:1",
        summary: "recoverable but manual action",
        recoverable: true,
        suggestedRepairAction: "manual_intervention_required",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  assert.strictEqual(candidates[0]!.disposition, "manual_handoff");
});

test("inferDisposition returns retry for requeue_execution action", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "stale_execution",
        severity: "p1",
        entityRef: "exec:1",
        summary: "requeue",
        recoverable: true,
        suggestedRepairAction: "requeue_execution",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  assert.strictEqual(candidates[0]!.disposition, "retry");
});

test("inferDisposition returns resume for rebuild_ack action", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "tier1_ack_backlog",
        severity: "p2",
        entityRef: "event:1",
        summary: "ack backlog",
        recoverable: true,
        suggestedRepairAction: "rebuild_ack",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  assert.strictEqual(candidates[0]!.disposition, "resume");
});

test("inferDisposition returns resume for close_orphan_session action", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      {
        checkId: "orphan_session",
        severity: "p2",
        entityRef: "sess:1",
        summary: "orphan",
        recoverable: true,
        suggestedRepairAction: "close_orphan_session",
      },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 1);
  assert.strictEqual(candidates[0]!.disposition, "resume");
});

test("candidates have unique IDs generated", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "stale_execution", severity: "p1", entityRef: "exec:1", summary: "a", recoverable: true, suggestedRepairAction: "requeue_execution" },
      { checkId: "orphan_session", severity: "p2", entityRef: "sess:1", summary: "b", recoverable: true, suggestedRepairAction: "close_orphan_session" },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  assert.equal(candidates.length, 2);
  assert.notEqual(candidates[0]!.candidateId, candidates[1]!.candidateId);
});

test("findings are preserved in report", () => {
  const service = new ReplayRepairControlService();
  const findings = [
    { checkId: "stale_execution" as const, severity: "p1" as const, entityRef: "exec:1", summary: "stale", recoverable: true, suggestedRepairAction: "requeue_execution" as const },
  ];
  const report = service.buildStartupConsistencyReport({ findings });

  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.entityRef, "exec:1");
});

test("report status is determined by P0 before recoverability", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "stale_execution", severity: "p0", entityRef: "exec:1", summary: "p0", recoverable: true, suggestedRepairAction: "requeue_execution" },
    ],
  });

  assert.equal(report.status, "fail_closed");
});

test("runRecoveryDrill includes scenario in result", () => {
  const service = new ReplayRepairControlService();
  const result = service.runRecoveryDrill({
    scenario: "my_test_scenario",
    findings: [],
  });

  assert.equal(result.scenario, "my_test_scenario");
});

test("runRecoveryDrill creates repair action for each candidate", () => {
  const service = new ReplayRepairControlService();
  const result = service.runRecoveryDrill({
    scenario: "full drill",
    findings: [
      { checkId: "stale_execution", severity: "p1", entityRef: "exec:1", summary: "a", recoverable: true, suggestedRepairAction: "requeue_execution" },
      { checkId: "orphan_session", severity: "p2", entityRef: "sess:1", summary: "b", recoverable: true, suggestedRepairAction: "close_orphan_session" },
      { checkId: "stale_file_lock", severity: "p2", entityRef: "lock:1", summary: "c", recoverable: true, suggestedRepairAction: "release_stale_lock" },
    ],
  });

  assert.equal(result.candidateCount, 3);
  assert.equal(result.repairActions.length, 3);
  assert.ok(result.repairActions.every(a => a.candidateId !== undefined));
});

test("assertCanOpenForTraffic error includes reportId and counts", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "stale_execution", severity: "p0", entityRef: "exec:1", summary: "p0", recoverable: false, suggestedRepairAction: "manual_intervention_required" },
    ],
  });

  try {
    service.assertCanOpenForTraffic(report);
    assert.fail("should have thrown");
  } catch (error) {
    const err = error as Error;
    assert.ok("code" in err);
    assert.equal((err as Record<string, unknown>).code, "replay_repair.fail_closed");
  }
});

test("planRepairActions preserves entityRef from candidate", () => {
  const service = new ReplayRepairControlService();
  const report = service.buildStartupConsistencyReport({
    findings: [
      { checkId: "stale_execution", severity: "p1", entityRef: "specific_exec_ref", summary: "test", recoverable: true, suggestedRepairAction: "requeue_execution" },
    ],
  });

  const candidates = service.listRecoveryCandidates(report);
  const actions = service.planRepairActions(candidates);

  assert.equal(actions[0]!.entityRef, "specific_exec_ref");
});

test("buildStartupConsistencyReport creates defensive copy of findings", () => {
  const service = new ReplayRepairControlService();
  const findings = [
    { checkId: "stale_execution" as const, severity: "p1" as const, entityRef: "exec:1", summary: "stale", recoverable: true, suggestedRepairAction: "requeue_execution" as const },
  ];
  const report = service.buildStartupConsistencyReport({ findings });

  assert.notStrictEqual(report.findings, findings);
  assert.deepEqual(report.findings, findings);
});