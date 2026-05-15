/**
 * Integration Test: Lease Handover CLI
 *
 * Tests the lease handover CLI command functionality.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

const repoRoot = process.cwd();

function runLeaseHandoverCli(env: NodeJS.ProcessEnv): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(repoRoot, "dist", "src", "sdk", "cli", "lease-handover.js")],
      {
        cwd: repoRoot,
        env: { ...process.env, ...env },
        encoding: "utf8",
      },
    );
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const execError = error as { status?: number; stderr?: string };
    return {
      stdout: "",
      stderr: execError.stderr || "",
      status: execError.status || 1,
    };
  }
}

test("lease-handover CLI requires database path", () => {
  const result = runLeaseHandoverCli({
    AA_DB_PATH: "",
  });

  assert.notEqual(result.status, 0, "Should fail without database path");
});

test("lease-handover CLI shows help with --help flag", () => {
  const result = runLeaseHandoverCli({
    AA_DB_PATH: "/tmp/test.db",
    AA_LEASE_HANDOVER_ACTION: "help",
  });

  assert.ok(result.stdout.includes("lease") || result.stderr.includes("lease"), "Help should mention lease");
});

test("lease-handover CLI validates execution ID format", () => {
  const sandboxRoot = join(repoRoot, "data", "test-artifacts");
  mkdirSync(sandboxRoot, { recursive: true });
  const workspace = mkdtempSync(join(sandboxRoot, "aa-lease-handover-cli-"));

  try {
    const dbPath = join(workspace, "lease-handover.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const result = runLeaseHandoverCli({
      AA_DB_PATH: dbPath,
      AA_LEASE_HANDOVER_ACTION: "handover",
      AA_LEASE_EXECUTION_ID: "invalid-id-format",
      AA_LEASE_NEW_WORKER_ID: "worker-2",
    });

    assert.notEqual(result.status, 0, "Should fail with invalid execution ID format");
  } finally {
    cleanupPath(workspace);
  }
});

test("lease-handover CLI validates new worker ID", () => {
  const sandboxRoot = join(repoRoot, "data", "test-artifacts");
  mkdirSync(sandboxRoot, { recursive: true });
  const workspace = mkdtempSync(join(sandboxRoot, "aa-lease-handover-cli-"));

  try {
    const dbPath = join(workspace, "lease-handover.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const result = runLeaseHandoverCli({
      AA_DB_PATH: dbPath,
      AA_LEASE_HANDOVER_ACTION: "handover",
      AA_LEASE_EXECUTION_ID: "exec-" + "x".repeat(32),
      AA_LEASE_NEW_WORKER_ID: "",
    });

    assert.notEqual(result.status, 0, "Should fail with empty worker ID");
  } finally {
    cleanupPath(workspace);
  }
});

test("lease-handover CLI handles non-existent database gracefully", () => {
  const result = runLeaseHandoverCli({
    AA_DB_PATH: "/tmp/non-existent-path/lease-handover.db",
    AA_LEASE_HANDOVER_ACTION: "list",
  });

  assert.notEqual(result.status, 0, "Should fail with non-existent database");
});
