import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
  type StableDbWritabilityRehearsalReport,
} from "../../../../src/platform/stability/stable-db-writability-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("runStableDbWritabilityRehearsal runs all three scenarios and produces report", async () => {
  const workspace = createTempWorkspace("aa-db-writability-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });

    assert.equal(report.totalScenarios, 3);
    assert.equal(report.scenarios.length, 3);
    assert.ok(report.startedAt);
    assert.ok(report.finishedAt);
    assert.equal(report.outputDir, workspace);

    const scenarioIds = report.scenarios.map((s) => s.scenarioId);
    assert.ok(scenarioIds.includes("health_and_doctor_fail_close_when_db_is_not_writable"));
    assert.ok(scenarioIds.includes("multi_step_admission_rejects_new_work_in_read_only_mode"));
    assert.ok(scenarioIds.includes("dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode"));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal health_and_doctor_fail_close_when_db_is_not_writable scenario passes", async () => {
  const workspace = createTempWorkspace("aa-db-writability-health-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });
    const healthScenario = report.scenarios.find(
      (s) => s.scenarioId === "health_and_doctor_fail_close_when_db_is_not_writable",
    );
    assert.ok(healthScenario);
    assert.equal(healthScenario.passed, true);
    assert.ok(healthScenario.durationMs >= 0);
    assert.ok(healthScenario.summary.length > 0);

    // Details capture health and doctor reports
    const details = healthScenario.details as {
      healthReport: {
        dbWritable: boolean;
        status: string;
        degradationMode: string;
        findings: string[];
      };
      doctorStatus: string;
      dbCheck: {
        checkId: string;
        status: string;
        findings: string[];
      } | null;
    };

    assert.equal(details.healthReport.dbWritable, false);
    assert.equal(details.healthReport.status, "unhealthy");
    assert.equal(details.healthReport.degradationMode, "read_only_operations_only");
    assert.ok(details.healthReport.findings.includes("db_not_writable"));
    assert.equal(details.doctorStatus, "fail_closed");
    assert.ok(details.dbCheck);
    assert.equal(details.dbCheck.status, "fail_closed");
    assert.ok(details.dbCheck.findings.includes("db_write_probe_failed"));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal multi_step_admission_rejects_new_work_in_read_only_mode scenario passes", async () => {
  const workspace = createTempWorkspace("aa-db-writability-admission-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });
    const admissionScenario = report.scenarios.find(
      (s) => s.scenarioId === "multi_step_admission_rejects_new_work_in_read_only_mode",
    );
    assert.ok(admissionScenario);
    assert.equal(admissionScenario.passed, true);
    assert.ok(admissionScenario.durationMs >= 0);
    assert.ok(admissionScenario.summary.length > 0);

    // Details capture multi-step admission rejection behavior
    const details = admissionScenario.details as {
      taskStatus: string;
      workflowStatus: string | null;
      sessionStatus: string | null;
      executionId: string | null;
      eventTypes: string[];
    };

    assert.equal(details.taskStatus, "cancelled");
    assert.equal(details.workflowStatus, "cancelled");
    assert.equal(details.sessionStatus, "cancelled");
    assert.equal(details.executionId, null);
    assert.ok(details.eventTypes.includes("admission:rejected"));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode scenario passes", async () => {
  const workspace = createTempWorkspace("aa-db-writability-dispatch-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });
    const dispatchScenario = report.scenarios.find(
      (s) => s.scenarioId === "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode",
    );
    assert.ok(dispatchScenario);
    assert.equal(dispatchScenario.passed, true);
    assert.ok(dispatchScenario.durationMs >= 0);
    assert.ok(dispatchScenario.summary.length > 0);

    // Details capture dispatch blocking behavior
    const details = dispatchScenario.details as {
      created: { ticket: { id: string } };
      decision: {
        outcome: string;
        reasonCode: string | null;
        trace: { reasonCode: string } | null;
      };
      ticket: { status: string } | null | undefined;
      eventTypes: string[];
      decisionPayload: { outcome: string; reasonCode: string | null } | null;
    };

    assert.equal(details.decision.outcome, "blocked");
    assert.equal(details.decision.reasonCode, "backpressure.read_only_mode");
    assert.equal(details.ticket?.status, "pending");
    assert.equal(details.decision.trace?.reasonCode, "backpressure.read_only_mode");
    assert.equal(details.decisionPayload?.outcome, "blocked");
    assert.equal(details.decisionPayload?.reasonCode, "backpressure.read_only_mode");
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal reports pass/fail counts correctly", async () => {
  const workspace = createTempWorkspace("aa-db-writability-counts-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });

    assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
    assert.equal(report.passedScenarios, 3);
    assert.equal(report.failedScenarios, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal persisted report matches original report", async () => {
  const workspace = createTempWorkspace("aa-db-writability-persist-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "persisted-report.json");
    writeStableDbWritabilityRehearsalReport(reportPath, report);

    // Verify file was created
    assert.equal(existsSync(reportPath), true);

    // Verify content matches original report
    const saved = JSON.parse(readFileSync(reportPath, "utf8")) as StableDbWritabilityRehearsalReport;
    assert.equal(saved.totalScenarios, report.totalScenarios);
    assert.equal(saved.passedScenarios, report.passedScenarios);
    assert.equal(saved.failedScenarios, report.failedScenarios);
    assert.equal(saved.startedAt, report.startedAt);
    assert.equal(saved.finishedAt, report.finishedAt);
    assert.equal(saved.outputDir, report.outputDir);
    assert.equal(saved.scenarios.length, report.scenarios.length);

    // Verify all scenario details are preserved
    for (let i = 0; i < saved.scenarios.length; i++) {
      assert.equal(saved.scenarios[i].scenarioId, report.scenarios[i].scenarioId);
      assert.equal(saved.scenarios[i].passed, report.scenarios[i].passed);
      assert.equal(saved.scenarios[i].durationMs, report.scenarios[i].durationMs);
      assert.equal(saved.scenarios[i].summary, report.scenarios[i].summary);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal each scenario has all required fields", async () => {
  const workspace = createTempWorkspace("aa-db-writability-fields-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });

    for (const scenario of report.scenarios) {
      assert.ok(typeof scenario.scenarioId === "string");
      assert.ok(typeof scenario.passed === "boolean");
      assert.ok(typeof scenario.durationMs === "number");
      assert.ok(typeof scenario.summary === "string");
      assert.ok(typeof scenario.details === "object");
      assert.ok(scenario.details !== null);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableDbWritabilityRehearsal multi-step scenario validates no execution was created", async () => {
  const workspace = createTempWorkspace("aa-db-writability-no-exec-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });
    const admissionScenario = report.scenarios.find(
      (s) => s.scenarioId === "multi_step_admission_rejects_new_work_in_read_only_mode",
    );
    assert.ok(admissionScenario);

    const details = admissionScenario.details as {
      executionId: string | null;
      stepOutputs: unknown[];
      streamFrames: unknown[];
    };

    assert.equal(details.executionId, null);
    assert.ok(Array.isArray(details.stepOutputs));
    assert.equal(details.stepOutputs.length, 0);
    assert.ok(Array.isArray(details.streamFrames));
    assert.equal(details.streamFrames.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});
