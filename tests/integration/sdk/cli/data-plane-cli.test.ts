import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = process.cwd();

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "sdk", "cli", "data-plane.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  return JSON.parse(stdout) as T;
}

test("data-plane CLI creates records and exports tenant-aware summary", () => {
  const workspace = createTempWorkspace("aa-data-plane-cli-");
  const dbPath = join(workspace, "data-plane-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const tenantCli = join(repoRoot, "dist", "src", "sdk", "cli", "tenant-platform.js");
    const runTenantCli = (env: NodeJS.ProcessEnv): void => {
      execFileSync(process.execPath, [tenantCli], {
        cwd: repoRoot,
        env: {
          ...process.env,
          ...env,
          AA_DB_PATH: dbPath,
        },
        encoding: "utf8",
      });
    };

    runTenantCli({
      AA_TENANT_ACTION: "create_organization",
      AA_ORGANIZATION_ID: "org-cli",
      AA_DISPLAY_NAME: "CLI Org",
    });
    runTenantCli({
      AA_TENANT_ACTION: "create_workspace",
      AA_WORKSPACE_ID: "ws-cli",
      AA_OWNER_ID: "user-cli",
      AA_DISPLAY_NAME: "CLI Workspace",
      AA_PLAN_ID: "enterprise",
      AA_ORGANIZATION_ID: "org-cli",
    });
    runTenantCli({
      AA_TENANT_ACTION: "create_tenant",
      AA_TENANT_ID: "tenant-cli",
      AA_ORGANIZATION_ID: "org-cli",
      AA_STORAGE_SCOPE: "tenant-cli.storage",
      AA_IDENTITY_SCOPE: "tenant-cli.identity",
      AA_POLICY_SCOPE: "tenant-cli.policy",
      AA_ARTIFACT_SCOPE: "tenant-cli.artifact",
    });
    for (const [id, plane] of [
      ["ns-cli-analytics", "analytics"],
      ["ns-cli-archive", "memory_archive"],
      ["ns-cli-replay", "replay"],
      ["ns-cli-txn", "transactional"],
    ] as const) {
      runTenantCli({
        AA_TENANT_ACTION: "create_namespace",
        AA_NAMESPACE_ID: id,
        AA_PLANE: plane,
        AA_WORKSPACE_ID: "ws-cli",
        AA_TENANT_ID: "tenant-cli",
        AA_RETENTION_POLICY: `${plane}_policy`,
        AA_ENCRYPTION_POLICY: "kms:tenant-cli",
      });
    }

    runCli({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "create_analytics_fact",
      AA_NAMESPACE_ID: "ns-cli-analytics",
      AA_FACT_ID: "fact-cli",
      AA_METRIC_NAME: "task_latency_p95",
      AA_DIMENSIONS_JSON: JSON.stringify({ division: "ops" }),
      AA_VALUE: "123",
      AA_WINDOW_START: "2026-04-08T00:00:00.000Z",
      AA_WINDOW_END: "2026-04-08T23:59:59.000Z",
      AA_SOURCE_REF: "task:cli",
    });
    runCli({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "create_archive_bundle",
      AA_NAMESPACE_ID: "ns-cli-archive",
      AA_BUNDLE_ID: "bundle-cli",
      AA_BUNDLE_TYPE: "handover_bundle",
      AA_SOURCE_REFS_JSON: JSON.stringify(["artifact:one"]),
      AA_SUMMARY_REF: "artifact:summary",
    });
    runCli({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "create_replay_dataset",
      AA_NAMESPACE_ID: "ns-cli-replay",
      AA_DATASET_ID: "dataset-cli",
      AA_DATASET_TYPE: "golden",
      AA_SAMPLE_REFS_JSON: JSON.stringify(["sample:1"]),
      AA_TRUTH_REFS_JSON: JSON.stringify(["truth:1"]),
      AA_VERSION: "v1",
    });
    runCli({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "start_movement_job",
      AA_JOB_ID: "move-cli",
      AA_SOURCE_NAMESPACE_ID: "ns-cli-txn",
      AA_TARGET_NAMESPACE_ID: "ns-cli-analytics",
      AA_MOVEMENT_TYPE: "analytics_etl",
      AA_INPUT_REFS_JSON: JSON.stringify(["task:1"]),
    });
    runCli({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "complete_movement_job",
      AA_JOB_ID: "move-cli",
      AA_REPORT_JSON: JSON.stringify({ movedFacts: 1 }),
    });

    const summary = runCli<{
      tenantId: string | null;
      totals: { analyticsFacts: number; archiveBundles: number; replayDatasets: number; movementJobs: number };
      movementJobsByStatus: { completed: number };
    }>({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "summary",
      AA_TENANT_ID: "tenant-cli",
    });
    assert.equal(summary.tenantId, "tenant-cli");
    assert.equal(summary.totals.analyticsFacts, 1);
    assert.equal(summary.totals.archiveBundles, 1);
    assert.equal(summary.totals.replayDatasets, 1);
    assert.equal(summary.totals.movementJobs, 1);
    assert.equal(summary.movementJobsByStatus.completed, 1);

    const exported = runCli<{
      jsonArtifact: { kind: string };
      markdownArtifact: { kind: string };
      summary: { totals: { movementJobs: number } };
    }>({
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "export",
      AA_TENANT_ID: "tenant-cli",
      AA_ARTIFACT_ROOT: join(workspace, "artifacts"),
    });
    assert.equal(exported.summary.totals.movementJobs, 1);
    assert.equal(exported.jsonArtifact.kind, "data_plane_summary");
    assert.equal(exported.markdownArtifact.kind, "data_plane_summary_markdown");
  } finally {
    cleanupPath(workspace);
  }
});

test("data-plane CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("data-plane.js", {
    AA_DB_PATH: "/tmp/data-plane-postgres.db",
    AA_DATA_PLANE_ACTION: "summary",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});

test("data-plane CLI fail-closes on malformed JSON env", () => {
  const failure = runBuiltCliExpectFailure("data-plane.js", {
    AA_DB_PATH: "/tmp/data-plane-invalid.db",
    AA_DATA_PLANE_ACTION: "create_archive_bundle",
    AA_NAMESPACE_ID: "ns-cli",
    AA_BUNDLE_TYPE: "handover_bundle",
    AA_SOURCE_REFS_JSON: "{\"bad\":true}",
    AA_SUMMARY_REF: "artifact:summary",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /invalid_env:AA_SOURCE_REFS_JSON/);
});
