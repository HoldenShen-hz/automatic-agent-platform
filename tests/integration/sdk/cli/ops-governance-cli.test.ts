import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = process.cwd();

function seedOpsDb(workspace: string): { dbPath: string; taskId: string } {
  const dbPath = join(workspace, "ops-governance-cli.db");
  const script = `
    import { runSingleTaskExecution } from ${JSON.stringify(new URL("../../../../src/platform/execution/execution-engine/single-task-execution.js", import.meta.url).href)};
    await runSingleTaskExecution({
      dbPath: ${JSON.stringify(dbPath)},
      title: "Ops governance CLI task",
      request: "Seed ops-governance CLI evidence.",
    });
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: repoRoot,
    stdio: "pipe",
  });
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const taskId = store.listTasks(10)[0]?.id;
  if (!taskId) {
    throw new Error("ops_governance.cli.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const approvals = new ApprovalService(db, store);
  approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "ops_cli",
    reason: "Seed approval for ops governance CLI report.",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: { surface: "ops-cli" },
    timeoutPolicy: "reject",
  });
  store.upsertWorkerSnapshot({
    workerId: "worker-cli-ops",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-cli-ops",
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
  return { dbPath, taskId };
}

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "sdk", "cli", "ops-governance.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as T;
}

test("ops-governance CLI summarizes and exports industrial ops package", () => {
  const workspace = createTempWorkspace("aa-ops-governance-cli-");
  try {
    const { dbPath, taskId } = seedOpsDb(workspace);
    const artifactRoot = join(workspace, "ops-artifacts");

    const summary = runCli<{
      summary: { overallStatus: string; runbookCount: number };
      incident: { taskId: string; recommendedRunbookIds: string[] } | null;
    }>({
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "prod",
      AA_OPS_TASK_ID: taskId,
    });

    assert.equal(summary.summary.runbookCount, 8);
    assert.ok(summary.incident);
    assert.equal(summary.incident?.taskId, taskId);
    assert.ok(summary.incident?.recommendedRunbookIds.length);

    const exported = runCli<{
      jsonArtifact: { artifactId: string; uri: string };
      markdownArtifact: { artifactId: string; uri: string };
    }>({
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "prod",
      AA_OPS_TASK_ID: taskId,
      AA_OPS_ACTION: "export",
      AA_OPS_ARTIFACT_ROOT: artifactRoot,
    });

    assert.ok(exported.jsonArtifact.artifactId);
    assert.match(exported.jsonArtifact.uri, /ops-governance-prod\.json$/);
    assert.ok(exported.markdownArtifact.artifactId);
    assert.match(exported.markdownArtifact.uri, /ops-governance-prod\.md$/);
  } finally {
    cleanupPath(workspace);
  }
});

test("ops-governance CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("ops-governance.js", {
    AA_DB_PATH: "/tmp/ops-governance-postgres.db",
    AA_ENVIRONMENT: "prod",
    AA_OPS_ACTION: "summary",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
