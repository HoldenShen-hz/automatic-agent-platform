import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { PMF_EVALUATED_AT, seedPmfValidationDataset } from "../../../helpers/pmf.js";

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "pmf.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as T;
}

test("pmf CLI can report, export, and inspect history", () => {
  const workspace = createTempWorkspace("aa-pmf-cli-");
  const dbPath = join(workspace, "pmf-cli.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedPmfValidationDataset(db, store);

    const report = runCli<{ reportId: string; verdict: string; metrics: { taskCount: number } }>({
      AA_DB_PATH: dbPath,
      AA_PMF_ACTION: "report",
      AA_PMF_PROFILE_NAME: "cli_report",
      AA_PMF_EVALUATED_AT: PMF_EVALUATED_AT,
      AA_PMF_DIVISION_ID: "general_ops",
    });
    assert.equal(report.verdict, "pass");
    assert.equal(report.metrics.taskCount, 5);

    const exported = runCli<{
      report: { reportId: string; profileName: string };
      jsonArtifact: { uri: string };
      markdownArtifact: { uri: string };
    }>({
      AA_DB_PATH: dbPath,
      AA_ARTIFACT_ROOT: artifactRoot,
      AA_PMF_ACTION: "export",
      AA_PMF_PROFILE_NAME: "cli_export",
      AA_PMF_EVALUATED_AT: PMF_EVALUATED_AT,
    });
    assert.equal(exported.report.profileName, "cli_export");
    assert.match(exported.jsonArtifact.uri, /pmf-validation-cli_export/);
    assert.match(exported.markdownArtifact.uri, /pmf-validation-cli_export/);

    const history = runCli<Array<{ profileName: string }>>({
      AA_DB_PATH: dbPath,
      AA_PMF_ACTION: "history",
      AA_PMF_LIMIT: "10",
    });
    assert.equal(history.length >= 1, true);
    assert.equal(history[0]?.profileName, "cli_export");

    const latest = runCli<{ profileName: string } | null>({
      AA_DB_PATH: dbPath,
      AA_PMF_ACTION: "latest",
      AA_PMF_PROFILE_NAME: "cli_export",
    });
    assert.equal(latest?.profileName, "cli_export");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("pmf CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("pmf.js", {
    AA_DB_PATH: "/tmp/pmf-postgres.db",
    AA_PMF_ACTION: "history",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
