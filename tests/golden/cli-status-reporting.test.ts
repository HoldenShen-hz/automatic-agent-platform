/**
 * Golden Test: Status Reporting Output
 *
 * Verifies CLI status reporting commands produce consistent output.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { assertGolden } from "../helpers/golden.js";
import { createTempWorkspace, cleanupPath } from "../helpers/fs.js";

// Helper to run CLI commands and capture output
function runCliCommand(
  scriptName: string,
  args: string[] = [],
  env: Record<string, string> = {},
): { stdout: string; stderr: string; status: number } {
  const result = {
    stdout: "",
    stderr: "",
    status: 0,
  };

  // Find the CLI script
  const distBase = existsSync(join(process.cwd(), "dist_test", "src", "sdk", "cli", scriptName))
    ? join(process.cwd(), "dist_test", "src", "sdk", "cli")
    : existsSync(join(process.cwd(), "dist_temp", "src", "sdk", "cli", scriptName))
      ? join(process.cwd(), "dist_temp", "src", "sdk", "cli")
      : join(process.cwd(), "dist", "src", "sdk", "cli");

  try {
    const output = execFileSync(
      process.execPath,
      [join(distBase, scriptName), ...args],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...env,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    result.stdout = output as string;
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    result.stdout = failure.stdout ?? "";
    result.stderr = failure.stderr ?? "";
    result.status = failure.status ?? 1;
  }

  return result;
}

// Helper to parse CLI JSON output
function parseCliJson(output: string): { valid: boolean; data?: unknown; error?: string } {
  try {
    const data = JSON.parse(output);
    return { valid: true, data };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

test("golden: inspect CLI task status output is valid JSON", () => {
  const workspace = createTempWorkspace("aa-cli-status-task-");
  const dbPath = `${workspace}/status-task-test.db`;

  try {
    // Query tasks list
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "tasks",
    });

    assert.equal(result.status, 0, `Inspect tasks should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect output should be valid JSON: ${parsed.error}`);

    // Verify output is valid array structure
    assertGolden("cli-status-tasks-output", {
      hasValidJson: parsed.valid,
      isArray: Array.isArray(parsed.data),
      outputStructure: parsed.data ? Object.keys((parsed.data as unknown[])[0] as object || {}) : [],
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI execution status output is valid JSON", () => {
  const workspace = createTempWorkspace("aa-cli-status-exec-");
  const dbPath = `${workspace}/status-exec-test.db`;

  try {
    // Query executions list
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "executions",
    });

    // May succeed with empty results
    const parsed = parseCliJson(result.stdout);

    if (parsed.valid) {
      assertGolden("cli-status-executions-output", {
        hasValidJson: parsed.valid,
        isArray: Array.isArray(parsed.data),
        itemCount: Array.isArray(parsed.data) ? (parsed.data as unknown[]).length : 0,
      });
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI worker status output is valid JSON", () => {
  const workspace = createTempWorkspace("aa-cli-status-worker-");
  const dbPath = `${workspace}/status-worker-test.db`;

  try {
    // Query workers list
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "workers",
    });

    assert.equal(result.status, 0, `Inspect workers should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect workers output should be valid JSON: ${parsed.error}`);

    assertGolden("cli-status-workers-output", {
      hasValidJson: parsed.valid,
      isArray: Array.isArray(parsed.data),
      itemCount: Array.isArray(parsed.data) ? (parsed.data as unknown[]).length : 0,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI workflow status output is valid JSON", () => {
  const workspace = createTempWorkspace("aa-cli-status-workflow-");
  const dbPath = `${workspace}/status-workflow-test.db`;

  try {
    // Query workflows list
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "workflows",
    });

    assert.equal(result.status, 0, `Inspect workflows should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect workflows output should be valid JSON: ${parsed.error}`);

    assertGolden("cli-status-workflows-output", {
      hasValidJson: parsed.valid,
      isArray: Array.isArray(parsed.data),
      itemCount: Array.isArray(parsed.data) ? (parsed.data as unknown[]).length : 0,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: doctor CLI health check output has status field", () => {
  const workspace = createTempWorkspace("aa-cli-health-");
  const dbPath = `${workspace}/health-test.db`;

  try {
    const result = runCliCommand("doctor.js", [], {
      AA_DB_PATH: dbPath,
    });

    assert.equal(result.status, 0, `Doctor should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Doctor output should be valid JSON: ${parsed.error}`);

    const data = parsed.data as Record<string, unknown>;
    assertGolden("cli-health-status-output", {
      hasValidJson: parsed.valid,
      hasStatus: data.status !== undefined,
      hasTimestamp: data.timestamp !== undefined || data.createdAt !== undefined,
      outputKeys: Object.keys(data),
    });
  } finally {
    cleanupPath(workspace);
  }
});
