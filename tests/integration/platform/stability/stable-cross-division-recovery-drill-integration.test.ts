import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableCrossDivisionRecoveryDrill,
  writeStableCrossDivisionRecoveryDrillReport,
  type StableCrossDivisionRecoveryDrillReport,
} from "../../../../src/platform/stability/stable-cross-division-recovery-drill.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("runStableCrossDivisionRecoveryDrill runs both cross_division_overview and cross_division_replay_matrix scenarios", async () => {
  const workspace = createTempWorkspace("aa-cross-division-recovery-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });

    assert.equal(report.totalScenarios, 2);
    assert.equal(report.scenarios.length, 2);
    assert.ok(report.startedAt);
    assert.ok(report.finishedAt);
    assert.equal(report.outputDir, workspace);

    const scenarioIds = report.scenarios.map((s) => s.scenarioId);
    assert.ok(scenarioIds.includes("cross_division_overview"));
    assert.ok(scenarioIds.includes("cross_division_replay_matrix"));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableCrossDivisionRecoveryDrill cross_division_overview scenario passes and validates division partitioning", async () => {
  const workspace = createTempWorkspace("aa-cross-division-overview-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });
    const overviewScenario = report.scenarios.find((s) => s.scenarioId === "cross_division_overview");
    assert.ok(overviewScenario);
    assert.equal(overviewScenario.passed, true);
    assert.ok(overviewScenario.durationMs >= 0);
    assert.ok(overviewScenario.summary.length > 0);

    // Details capture stale, blocked, and overview data
    const details = overviewScenario.details as {
      staleExecutionIds: string[];
      blockedExecutionIds: string[];
      overview: Array<{
        divisionId: string;
        activeCandidateCount: number;
        blockedApprovalCount: number;
        staleExecutionCount: number;
      }>;
    };

    // Validate stale execution detection
    assert.ok(Array.isArray(details.staleExecutionIds));
    assert.ok(details.staleExecutionIds.includes("exec-general-stale-drill"));

    // Validate blocked execution detection
    assert.ok(Array.isArray(details.blockedExecutionIds));
    assert.ok(details.blockedExecutionIds.includes("exec-engineering-blocked-drill"));

    // Validate division overview partitioning
    assert.ok(Array.isArray(details.overview));
    assert.equal(details.overview.length, 2);

    // Engineering ops: 1 blocked, 1 dead letter, 0 stale
    const engineeringOverview = details.overview.find((o) => o.divisionId === "engineering_ops");
    assert.ok(engineeringOverview);
    assert.equal(engineeringOverview.activeCandidateCount, 1);
    assert.equal(engineeringOverview.blockedApprovalCount, 1);
    assert.equal(engineeringOverview.staleExecutionCount, 0);

    // General ops: 1 stale, 0 blocked
    const generalOverview = details.overview.find((o) => o.divisionId === "general_ops");
    assert.ok(generalOverview);
    assert.equal(generalOverview.activeCandidateCount, 1);
    assert.equal(generalOverview.blockedApprovalCount, 0);
    assert.equal(generalOverview.staleExecutionCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableCrossDivisionRecoveryDrill cross_division_replay_matrix scenario passes and validates replay outcomes", async () => {
  const workspace = createTempWorkspace("aa-cross-division-replay-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });
    const replayScenario = report.scenarios.find((s) => s.scenarioId === "cross_division_replay_matrix");
    assert.ok(replayScenario);
    assert.equal(replayScenario.passed, true);
    assert.ok(replayScenario.durationMs >= 0);
    assert.ok(replayScenario.summary.length > 0);

    // Details capture replay reports for stale, blocked, and dead letter paths
    const details = replayScenario.details as {
      reports: Array<{
        taskId: string;
        divisionId: string;
        outcome: string;
        executionOutcomes: Array<{
          executionId: string;
          finalOutcome: string | null;
          suggestedAction: string;
        }>;
      }>;
    };

    assert.ok(Array.isArray(details.reports));
    assert.equal(details.reports.length, 3);

    // General stale drill: repair_pending with resume_same_worker
    const generalReport = details.reports.find((r) => r.taskId === "task-general-stale-drill");
    assert.ok(generalReport);
    assert.equal(generalReport.outcome, "repair_pending");
    assert.ok(generalReport.executionOutcomes.length > 0);
    assert.equal(generalReport.executionOutcomes[0]?.suggestedAction, "resume_same_worker");

    // Engineering blocked drill: manual_handoff with escalate_takeover
    const blockedReport = details.reports.find((r) => r.taskId === "task-engineering-blocked-drill");
    assert.ok(blockedReport);
    assert.equal(blockedReport.outcome, "manual_handoff");
    assert.ok(blockedReport.executionOutcomes.length > 0);
    assert.equal(blockedReport.executionOutcomes[0]?.suggestedAction, "escalate_takeover");

    // Engineering dead letter drill: dead_lettered
    const deadLetterReport = details.reports.find((r) => r.taskId === "task-engineering-dead-letter-drill");
    assert.ok(deadLetterReport);
    assert.equal(deadLetterReport.outcome, "dead_lettered");
    assert.ok(deadLetterReport.executionOutcomes.length > 0);
    assert.equal(deadLetterReport.executionOutcomes[0]?.finalOutcome, "dead_lettered");
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableCrossDivisionRecoveryDrill passedScenarios and failedScenarios counts are correct", async () => {
  const workspace = createTempWorkspace("aa-cross-division-counts-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });

    assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
    assert.equal(report.passedScenarios, 2);
    assert.equal(report.failedScenarios, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("writeStableCrossDivisionRecoveryDrillReport persists report correctly", async () => {
  const workspace = createTempWorkspace("aa-cross-division-persist-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });
    const reportPath = join(workspace, "persisted-report.json");
    writeStableCrossDivisionRecoveryDrillReport(reportPath, report);

    // Verify file was created
    assert.equal(existsSync(reportPath), true);

    // Verify content matches original report
    const saved = JSON.parse(readFileSync(reportPath, "utf8")) as StableCrossDivisionRecoveryDrillReport;
    assert.equal(saved.totalScenarios, report.totalScenarios);
    assert.equal(saved.passedScenarios, report.passedScenarios);
    assert.equal(saved.failedScenarios, report.failedScenarios);
    assert.equal(saved.startedAt, report.startedAt);
    assert.equal(saved.finishedAt, report.finishedAt);
    assert.equal(saved.outputDir, report.outputDir);
    assert.equal(saved.scenarios.length, report.scenarios.length);

    // Verify scenario details are preserved
    for (let i = 0; i < saved.scenarios.length; i++) {
      assert.equal(saved.scenarios[i]?.scenarioId, report.scenarios[i]?.scenarioId);
      assert.equal(saved.scenarios[i]?.passed, report.scenarios[i]?.passed);
      assert.equal(saved.scenarios[i]?.durationMs, report.scenarios[i]?.durationMs);
      assert.equal(saved.scenarios[i]?.summary, report.scenarios[i]?.summary);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableCrossDivisionRecoveryDrill all scenarios have required fields", async () => {
  const workspace = createTempWorkspace("aa-cross-division-fields-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });

    for (const scenario of report.scenarios) {
      assert.ok(typeof scenario.scenarioId === "string");
      assert.ok(typeof scenario.passed === "boolean");
      assert.ok(typeof scenario.durationMs === "number");
      assert.ok(typeof scenario.summary === "string");
      assert.ok(typeof scenario.details === "object");
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableCrossDivisionRecoveryDrill dead letter execution has dead_lettered timeline event", async () => {
  const workspace = createTempWorkspace("aa-cross-division-dead-letter-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir: workspace });
    const replayScenario = report.scenarios.find((s) => s.scenarioId === "cross_division_replay_matrix");
    assert.ok(replayScenario);

    // The details contain reports with executions that have timelines
    const details = replayScenario.details as {
      reports: Array<{
        taskId: string;
        outcome: string;
        executions: Array<{
          executionId: string;
          timeline: Array<{ eventType: string }>;
        }>;
      }>;
    };

    const deadLetterReport = details.reports.find((r) => r.taskId === "task-engineering-dead-letter-drill");
    assert.ok(deadLetterReport);

    const deadLetterExecution = deadLetterReport.executions[0];
    assert.ok(deadLetterExecution);
    assert.ok(Array.isArray(deadLetterExecution.timeline));
    assert.ok(deadLetterExecution.timeline.some((e) => e.eventType === "recovery:dead_lettered"));
  } finally {
    cleanupPath(workspace);
  }
});
