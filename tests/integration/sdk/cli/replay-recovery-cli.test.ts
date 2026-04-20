/**
 * Integration Test: Replay Recovery CLI
 *
 * Tests the replay recovery CLI command functionality.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

function runReplayRecoveryCli(env: NodeJS.ProcessEnv): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(repoRoot, "dist", "src", "cli", "replay-recovery.js")],
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

test("replay-recovery CLI requires database path", () => {
  const result = runReplayRecoveryCli({
    AA_DB_PATH: "",
  });

  assert.notEqual(result.status, 0, "Should fail without database path");
});

test("replay-recovery CLI shows help with --help flag", () => {
  const result = runReplayRecoveryCli({
    AA_DB_PATH: "/tmp/test.db",
    AA_REPLAY_RECOVERY_ACTION: "help",
  });

  assert.ok(
    result.stdout.includes("replay") || result.stderr.includes("replay"),
    "Help should mention replay",
  );
});

test("replay-recovery CLI validates task ID format", () => {
  const sandboxRoot = join(repoRoot, "data", "test-artifacts");
  mkdirSync(sandboxRoot, { recursive: true });
  const workspace = mkdtempSync(join(sandboxRoot, "aa-replay-recovery-cli-"));

  try {
    const dbPath = join(workspace, "replay-recovery.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const result = runReplayRecoveryCli({
      AA_DB_PATH: dbPath,
      AA_REPLAY_RECOVERY_ACTION: "replay",
      AA_REPLAY_TASK_ID: "invalid-id",
    });

    assert.notEqual(result.status, 0, "Should fail with invalid task ID format");
  } finally {
    cleanupPath(workspace);
  }
});

test("replay-recovery CLI handles non-existent database gracefully", () => {
  const result = runReplayRecoveryCli({
    AA_DB_PATH: "/tmp/non-existent-path/replay-recovery.db",
    AA_REPLAY_RECOVERY_ACTION: "status",
  });

  assert.notEqual(result.status, 0, "Should fail with non-existent database");
});

test("replay-recovery CLI validates action parameter", () => {
  const sandboxRoot = join(repoRoot, "data", "test-artifacts");
  mkdirSync(sandboxRoot, { recursive: true });
  const workspace = mkdtempSync(join(sandboxRoot, "aa-replay-recovery-cli-"));

  try {
    const dbPath = join(workspace, "replay-recovery.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    const result = runReplayRecoveryCli({
      AA_DB_PATH: dbPath,
      AA_REPLAY_RECOVERY_ACTION: "invalid-action",
    });

    assert.notEqual(result.status, 0, "Should fail with invalid action");
  } finally {
    cleanupPath(workspace);
  }
});
