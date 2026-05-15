import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PmfValidationService } from "../../../../src/scale-ecosystem/marketplace/pmf-validation-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { PMF_EVALUATED_AT, seedPmfValidationDataset } from "../../../helpers/pmf.js";

test("pmf validation export persists report history and artifact evidence", () => {
  const workspace = createTempWorkspace("aa-pmf-export-");
  const dbPath = join(workspace, "pmf-export.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedPmfValidationDataset(db, store);

    const service = new PmfValidationService(db, store, {
      rootDir: artifactRoot,
    });
    const exported = service.exportValidation({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "phase3_export",
      divisionId: "general_ops",
    });

    assert.equal(exported.report.profileName, "phase3_export");
    assert.equal(store.listPmfValidationReports(10).length, 1);

    const taskArtifacts = store.listArtifactsByTask("pmf_validation");
    assert.equal(taskArtifacts.length, 2);
    assert.ok(existsSync(exported.jsonArtifact.uri));
    assert.ok(existsSync(exported.markdownArtifact.uri));
    assert.match(readFileSync(exported.jsonArtifact.uri, "utf8"), /"profileName": "phase3_export"/);
    assert.match(readFileSync(exported.markdownArtifact.uri, "utf8"), /# PMF Validation Report/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("pmf validation can scope metrics to a single division", () => {
  const workspace = createTempWorkspace("aa-pmf-division-");
  const dbPath = join(workspace, "pmf-division.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedPmfValidationDataset(db, store);

    const service = new PmfValidationService(db, store, {
      rootDir: join(workspace, "artifacts"),
    });

    const allReport = service.buildReport({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "all_divisions",
    });
    const scopedReport = service.buildReport({
      evaluatedAt: PMF_EVALUATED_AT,
      profileName: "general_only",
      divisionId: "general_ops",
    });

    assert.equal(allReport.metrics.taskCount, 6);
    assert.equal(scopedReport.metrics.taskCount, 5);
    assert.equal(allReport.metrics.sessionCount, 4);
    assert.equal(scopedReport.metrics.sessionCount, 3);
    assert.equal(allReport.metrics.divisionCount, 2);
    assert.equal(scopedReport.metrics.divisionCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
