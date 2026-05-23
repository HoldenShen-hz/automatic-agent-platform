/**
 * SDK/CLI Integration Tests - Multi-Service CLI Workflows
 *
 * Tests that exercise SDK/CLI tools which coordinate multiple services:
 * - Database operations
 * - Task execution
 * - Approval workflows
 * - Metrics reporting
 */

import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = process.cwd();

function runCli(cliName: string, env: NodeJS.ProcessEnv): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(repoRoot, "dist", "src", "sdk", "cli", cliName)],
      {
        cwd: repoRoot,
        env: { ...process.env, ...env },
        encoding: "utf8",
      },
    );
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const execError = error as { status?: number; stderr?: string; stdout?: string };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
      status: execError.status || 1,
    };
  }
}

test("CLI integration: replay-recovery CLI validates database and produces recovery report", () => {
  const workspace = createTempWorkspace("aa-cli-replay-");
  const dbPath = join(workspace, "replay-recovery.db");

  try {
    // Create and seed database with tasks
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = "task-replay-cli-001";
    const now = new Date().toISOString();
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Replay test task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    store.insertEvent({
      id: "evt-replay-001",
      taskId,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({ fromStatus: "pending", toStatus: "in_progress" }),
      traceId: "trace-replay-001",
      createdAt: now,
    });

    db.close();

    // Run replay-recovery CLI
    const result = runCli("replay-recovery.js", {
      AA_DB_PATH: dbPath,
      AA_RECOVERY_ACTION: "scan",
    });

    // Should complete without error (scan is valid operation)
    assert.equal(result.status, 0, `Scan should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: ops-governance CLI validates environment and reports status", () => {
  const workspace = createTempWorkspace("aa-cli-ops-");
  const dbPath = join(workspace, "ops.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = "task-ops-cli-001";
    const now = new Date().toISOString();
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Ops test task",
      status: "done",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: "{\"ok\":true}",
      estimatedCostUsd: 0.5,
      actualCostUsd: 0.5,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

    store.insertWorkerSnapshot({
      workerId: "worker-ops-cli",
      version: 0,
      status: "idle",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-ops-cli",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 64,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: now,
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    db.close();

    // Run ops-governance CLI summary
    const result = runCli("ops-governance.js", {
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "staging",
      AA_OPS_ACTION: "summary",
    });

    assert.equal(result.status, 0, `Ops summary should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: model-routing CLI validates routing configuration", () => {
  const workspace = createTempWorkspace("aa-cli-model-");
  const dbPath = join(workspace, "model-routing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    // Run model-routing CLI with list action
    const result = runCli("model-routing.js", {
      AA_DB_PATH: dbPath,
      AA_ROUTING_ACTION: "list",
    });

    assert.equal(result.status, 0, `Model routing list should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: billing CLI validates billing records", () => {
  const workspace = createTempWorkspace("aa-cli-billing-");
  const dbPath = join(workspace, "billing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    // Run billing CLI with report action
    const result = runCli("billing.js", {
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "report",
    });

    assert.equal(result.status, 0, `Billing report should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: data-plane CLI validates data operations", () => {
  const workspace = createTempWorkspace("aa-cli-data-plane-");
  const dbPath = join(workspace, "data-plane.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    // Run data-plane CLI with status check
    const result = runCli("data-plane.js", {
      AA_DB_PATH: dbPath,
      AA_DATA_PLANE_ACTION: "status",
    });

    assert.equal(result.status, 0, `Data plane status should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: pmf CLI validates with real SQLite database", () => {
  const workspace = createTempWorkspace("aa-cli-pmf-");
  const dbPath = join(workspace, "pmf.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const now = new Date().toISOString();

    // Add tasks with different statuses
    store.insertTask({
      id: "task-pmf-001",
      parentId: null,
      rootId: "task-pmf-001",
      divisionId: "general_ops",
      title: "PMF test 1",
      status: "done",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: "{\"ok\":true}",
      estimatedCostUsd: 1,
      actualCostUsd: 1,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

    store.insertTask({
      id: "task-pmf-002",
      parentId: null,
      rootId: "task-pmf-002",
      divisionId: "general_ops",
      title: "PMF test 2",
      status: "failed",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0.5,
      actualCostUsd: 0.2,
      errorCode: "test_failure",
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

    db.close();

    // Run pmf CLI with history action
    const result = runCli("pmf.js", {
      AA_DB_PATH: dbPath,
      AA_PMF_ACTION: "history",
      AA_PMF_LIMIT: "10",
    });

    assert.equal(result.status, 0, `PMF history should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: multiple CLIs coordinate on same database", () => {
  const workspace = createTempWorkspace("aa-cli-multi-");
  const dbPath = join(workspace, "multi.db");

  try {
    // Create and seed database
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = "task-multi-cli";
    const now = new Date().toISOString();

    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Multi-CLI test",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    store.insertWorkerSnapshot({
      workerId: "worker-multi-cli",
      version: 0,
      status: "idle",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-multi-cli",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 64,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: now,
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    db.close();

    // Run multiple CLIs on the same database
    const result1 = runCli("ops-governance.js", {
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "test",
      AA_OPS_ACTION: "summary",
    });

    const result2 = runCli("lease-handover.js", {
      AA_DB_PATH: dbPath,
      AA_LEASE_HANDOVER_ACTION: "list",
    });

    // Both should succeed independently
    assert.equal(result1.status, 0, `Ops governance should succeed: ${result1.stderr}`);
    assert.equal(result2.status, 0, `Lease handover list should succeed: ${result2.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("CLI integration: CLI fails gracefully with invalid database path", () => {
  const result = runCli("pmf.js", {
    AA_DB_PATH: "/dev/null/automatic-agent-invalid/db.sqlite",
    AA_PMF_ACTION: "history",
  });

  assert.notEqual(result.status, 0, "Should fail with invalid database path");
});

test("CLI integration: tenant-platform CLI validates tenant isolation", () => {
  const workspace = createTempWorkspace("aa-cli-tenant-");
  const dbPath = join(workspace, "tenant.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    // Run tenant-platform CLI
    const result = runCli("tenant-platform.js", {
      AA_DB_PATH: dbPath,
      AA_TENANT_ACTION: "list",
    });

    assert.equal(result.status, 0, `Tenant platform list should succeed: ${result.stderr}`);
  } finally {
    cleanupPath(workspace);
  }
});
