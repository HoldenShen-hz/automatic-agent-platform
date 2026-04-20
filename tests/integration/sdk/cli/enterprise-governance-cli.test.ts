import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

function writeDependencyFixtures(workspace: string): { manifestPath: string; lockfilePath: string } {
  const manifestPath = join(workspace, "package.enterprise.json");
  const lockfilePath = join(workspace, "package-lock.enterprise.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: "enterprise-governance-cli-fixture",
      version: "1.0.0",
      dependencies: {
        "demo-lib": "^1.0.0",
      },
    }, null, 2),
    "utf8",
  );
  writeFileSync(
    lockfilePath,
    JSON.stringify({
      name: "enterprise-governance-cli-fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": {
          name: "enterprise-governance-cli-fixture",
          version: "1.0.0",
          dependencies: {
            "demo-lib": "^1.0.0",
          },
        },
        "node_modules/demo-lib": {
          version: "1.0.0",
          resolved: "https://registry.npmjs.org/demo-lib/-/demo-lib-1.0.0.tgz",
          integrity: "sha512-demo",
          license: "MIT",
        },
      },
    }, null, 2),
    "utf8",
  );
  return { manifestPath, lockfilePath };
}

function seedOpsDb(workspace: string): { dbPath: string; taskId: string; manifestPath: string; lockfilePath: string } {
  const dbPath = join(workspace, "enterprise-governance-cli.db");
  const script = `
    import { runSingleTaskExecution } from ${JSON.stringify(new URL("../../../../src/platform/execution/execution-engine/single-task-execution.js", import.meta.url).href)};
    await runSingleTaskExecution({
      dbPath: ${JSON.stringify(dbPath)},
      title: "Enterprise governance CLI task",
      request: "Seed enterprise-governance CLI evidence.",
    });
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: repoRoot,
    stdio: "pipe",
  });
  const { manifestPath, lockfilePath } = writeDependencyFixtures(workspace);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const taskId = store.listTasks(10)[0]?.id;
  if (!taskId) {
    throw new Error("enterprise_governance.cli.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const approvals = new ApprovalService(db, store);
  approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "enterprise_governance_cli",
    reason: "Seed approval for enterprise governance CLI report.",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: { surface: "enterprise-governance-cli" },
    timeoutPolicy: "reject",
  });
  store.upsertWorkerSnapshot({
    workerId: "worker-cli-enterprise-governance",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-cli-enterprise-governance",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 12,
    memoryMb: 80,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: nowIso(),
    lastHeartbeatAt: nowIso(),
    updatedAt: nowIso(),
  });
  db.close();
  return { dbPath, taskId, manifestPath, lockfilePath };
}

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "cli", "enterprise-governance.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as T;
}

test("enterprise-governance CLI summarizes and exports aggregated enterprise governance evidence", () => {
  const workspace = createTempWorkspace("aa-enterprise-governance-cli-");
  try {
    const { dbPath, taskId, manifestPath, lockfilePath } = seedOpsDb(workspace);
    const artifactRoot = join(workspace, "enterprise-governance-artifacts");

    const summary = runCli<{
      status: string;
      schemaGate: { verdict: string };
      supplyChain: { verdict: string; packageCount: number };
      incidentHandoff: { activeIncidentId: string | null };
      apmExport: { datadog: { series: unknown[] } };
    }>({
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "prod",
      AA_ENTERPRISE_GOVERNANCE_TASK_ID: taskId,
      AA_DEPENDENCY_MANIFEST_PATH: manifestPath,
      AA_DEPENDENCY_LOCKFILE_PATH: lockfilePath,
    });

    assert.equal(summary.schemaGate.verdict, "pass");
    assert.equal(summary.supplyChain.verdict, "pass");
    assert.equal(summary.supplyChain.packageCount, 1);
    assert.ok(summary.incidentHandoff.activeIncidentId);
    assert.ok(summary.apmExport.datadog.series.length >= 4);

    const exported = runCli<{
      jsonArtifact: { artifactId: string; uri: string };
      markdownArtifact: { artifactId: string; uri: string };
      record: { reportId: string };
    }>({
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "prod",
      AA_ENTERPRISE_GOVERNANCE_TASK_ID: taskId,
      AA_ENTERPRISE_GOVERNANCE_ACTION: "export",
      AA_ENTERPRISE_GOVERNANCE_ARTIFACT_ROOT: artifactRoot,
      AA_DEPENDENCY_MANIFEST_PATH: manifestPath,
      AA_DEPENDENCY_LOCKFILE_PATH: lockfilePath,
    });

    assert.ok(exported.record.reportId);
    assert.match(exported.jsonArtifact.uri, /enterprise-governance-prod\.json$/);
    assert.match(exported.markdownArtifact.uri, /enterprise-governance-prod\.md$/);
  } finally {
    cleanupPath(workspace);
  }
});

test("enterprise-governance CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("enterprise-governance.js", {
    AA_DB_PATH: "/tmp/enterprise-governance-postgres.db",
    AA_ENVIRONMENT: "prod",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
