import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "evolution.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  return JSON.parse(stdout) as T;
}

function runCliExpectFailure(env: NodeJS.ProcessEnv): { stderr: string; status: number } {
  try {
    execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "evolution.js")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected_cli_failure:evolution.js");
  } catch (error) {
    if (error instanceof Error && error.message === "expected_cli_failure:evolution.js") {
      throw error;
    }
    const failure = error as { stderr?: string; status?: number };
    return {
      stderr: failure.stderr ?? "",
      status: failure.status ?? 1,
    };
  }
}

test("evolution CLI proposes, applies, and resolves budget policies", () => {
  const workspace = createTempWorkspace("aa-evolution-cli-");
  const dbPath = join(workspace, "evolution-cli.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-evolution-cli",
      executionId: "exec-evolution-cli",
    });

    const proposed = runCli<{
      proposal: { id: string; approvalId: string | null; status: string };
      approval: { approvalId: string };
    }>({
      AA_DB_PATH: dbPath,
      AA_EVOLUTION_ACTION: "propose_budget",
      AA_TASK_ID: "task-evolution-cli",
      AA_EXECUTION_ID: "exec-evolution-cli",
      AA_SOURCE_AGENT_ID: "supervisor-1",
      AA_SCOPE_TYPE: "division",
      AA_SCOPE_REF: "general_ops",
      AA_CURRENT_POLICY_MAX_TASK_COST_USD: "5",
      AA_CURRENT_POLICY_MAX_DAILY_COST_USD: "50",
      AA_CURRENT_POLICY_MAX_MONTHLY_COST_USD: "500",
      AA_CURRENT_POLICY_WARN_AT_RATIO: "0.8",
      AA_CURRENT_POLICY_MODE: "supervised",
      AA_OBSERVED_AVERAGE_COST_USD: "6.5",
      AA_SAMPLE_SIZE: "5",
      AA_SUCCESS_RATE: "0.9",
      AA_PROPOSAL_REASON: "cli budget uplift",
    });

    assert.equal(proposed.proposal.status, "pending_approval");

    const approvalService = new ApprovalService(db, store);
    approvalService.applyDecision({
      approvalId: proposed.approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-cli",
      respondedAt: "2026-04-08T16:00:00.000Z",
    });

    const applied = runCli<{
      proposal: { id: string; status: string };
      activePolicy: { status: string; valueJson: string } | null;
    }>({
      AA_DB_PATH: dbPath,
      AA_EVOLUTION_ACTION: "apply",
      AA_PROPOSAL_ID: proposed.proposal.id,
      AA_APPLIED_BY: "operator-cli",
    });

    assert.equal(applied.proposal.status, "applied");
    assert.equal(applied.activePolicy?.status, "active");

    const resolved = runCli<{ policy: { maxTaskCostUsd: number }; sourceProposalId: string | null }>({
      AA_DB_PATH: dbPath,
      AA_EVOLUTION_ACTION: "resolve_budget",
      AA_SCOPE_TYPE: "division",
      AA_SCOPE_REF: "general_ops",
      AA_BASE_POLICY_MAX_TASK_COST_USD: "5",
      AA_BASE_POLICY_MAX_DAILY_COST_USD: "50",
      AA_BASE_POLICY_MAX_MONTHLY_COST_USD: "500",
      AA_BASE_POLICY_WARN_AT_RATIO: "0.8",
      AA_BASE_POLICY_MODE: "supervised",
    });

    assert.ok(resolved.sourceProposalId);
    assert.ok(resolved.policy.maxTaskCostUsd > 5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("evolution CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runCliExpectFailure({
    AA_EVOLUTION_ACTION: "list",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
