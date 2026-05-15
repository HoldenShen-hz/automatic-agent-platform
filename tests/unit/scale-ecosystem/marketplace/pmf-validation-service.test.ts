import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { PmfValidationService } from "../../../../src/scale-ecosystem/marketplace/pmf-validation-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { PMF_EVALUATED_AT, seedPmfValidationDataset } from "../../../helpers/pmf.js";

test("pmf validation service builds a passing report for the seeded baseline dataset", () => {
  const workspace = createTempWorkspace("aa-pmf-unit-");
  const dbPath = join(workspace, "pmf.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedPmfValidationDataset(db, store);

    const service = new PmfValidationService(db, store, {
      rootDir: join(workspace, "artifacts"),
    });
    const report = service.buildReport({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "phase3_default",
      divisionId: "general_ops",
      windowDays: 14,
    });

    assert.equal(report.verdict, "pass");
    assert.equal(report.metrics.taskCount, 5);
    assert.equal(report.metrics.sessionCount, 3);
    assert.equal(report.metrics.successfulTaskCount, 4);
    assert.equal(report.metrics.approvalCount, 3);
    assert.equal(report.metrics.resolvedApprovalCount, 3);
    assert.equal(report.metrics.repeatUsageRatePct, 25);
    assert.equal(report.metrics.averageSuccessfulTaskCostUsd, 1.02);
    assert.ok(report.metrics.p95StepDurationMs != null);
    assert.ok(report.runtimeSummary.taskMetrics.total >= 6);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("pmf validation service persists history and fails when thresholds are not met", () => {
  const workspace = createTempWorkspace("aa-pmf-thresholds-");
  const dbPath = join(workspace, "pmf-thresholds.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedPmfValidationDataset(db, store);

    const service = new PmfValidationService(db, store, {
      rootDir: join(workspace, "artifacts"),
    });
    const result = service.runValidation({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "strict_profile",
      thresholds: {
        minTaskSuccessRatePct: 90,
      },
    });

    assert.equal(result.report.verdict, "fail");
    assert.equal(result.record.profileName, "strict_profile");

    const latest = service.getLatest("strict_profile");
    assert.ok(latest);
    assert.equal(latest?.id, result.record.id);

    const history = service.listHistory(5);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.id, result.record.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("pmf validation service rejects malformed run options", () => {
  const workspace = createTempWorkspace("aa-pmf-invalid-");
  const dbPath = join(workspace, "pmf-invalid.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new PmfValidationService(db, store, {
      rootDir: join(workspace, "artifacts"),
    });

    assert.throws(
      () => service.buildReport({ profileName: "bad profile" }),
      /pmf\.invalid_profile_name/,
    );
    assert.throws(
      () => service.buildReport({ divisionId: "../bad-scope" }),
      /pmf\.invalid_division_id/,
    );
    assert.throws(
      () => service.buildReport({ windowDays: 0 }),
      /pmf\.invalid_window_days/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
