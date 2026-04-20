import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableMigrationCompatibilityRehearsal,
  writeStableMigrationCompatibilityRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-migration-compatibility-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable migration compatibility rehearsal writes a passing PG portability report", async () => {
  const workspace = createTempWorkspace("aa-stable-migration-compat-");

  try {
    const report = await runStableMigrationCompatibilityRehearsal({
      outputDir: workspace,
    });
    const reportPath = join(workspace, "stable-migration-compatibility-report.json");
    writeStableMigrationCompatibilityRehearsalReport(reportPath, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "migration_plan_passes_pg_portability_rules"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "sqlite_migration_bootstrap_reaches_latest_schema"));
    assert.equal(existsSync(reportPath), true);
  } finally {
    cleanupPath(workspace);
  }
});
