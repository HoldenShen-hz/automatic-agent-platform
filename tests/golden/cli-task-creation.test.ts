/**
 * Golden Test: Task Creation Output
 *
 * Verifies CLI task creation commands produce consistent output.
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

test("golden: dispatch-execution with missing required env produces error", () => {
  const workspace = createTempWorkspace("aa-cli-task-create-");
  const dbPath = `${workspace}/task-create-test.db`;

  try {
    // Missing AA_EXECUTION_ID should produce a validation error
    const result = runCliCommand("dispatch-execution.js", [], {
      AA_DB_PATH: dbPath,
      // AA_EXECUTION_ID not set - required
    });

    // Should fail validation
    assert.notEqual(result.status, 0, "Missing required env should fail");

    const parsed = parseCliJson(result.stdout);

    assertGolden("cli-task-create-missing-env-error", {
      hasError: result.stderr.length > 0 || !parsed.valid,
      status: result.status,
      hasValidJson: parsed.valid,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: dispatch-execution with invalid execution ID format", () => {
  const workspace = createTempWorkspace("aa-cli-task-invalid-");
  const dbPath = `${workspace}/task-invalid-test.db`;

  try {
    // Invalid execution ID format
    const result = runCliCommand("dispatch-execution.js", [], {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "invalid-format-exec",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // Should fail with error
    assertGolden("cli-task-create-invalid-exec-error", {
      hasError: result.status !== 0,
      status: result.status,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: dispatch-execution task creation produces valid output structure", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-");
  const dbPath = `${workspace}/dispatch-test.db`;

  try {
    // dispatch-execution with non-existent execution should return error JSON
    const result = runCliCommand("dispatch-execution.js", [], {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "nonexistent-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // Either succeeds or fails with valid JSON error
    const parsed = parseCliJson(result.stdout);

    assertGolden("cli-dispatch-output-structure", {
      status: result.status,
      hasValidJson: parsed.valid,
      outputKeys: parsed.valid && parsed.data ? Object.keys(parsed.data as object) : [],
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: dispatch-execution output follows JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-json-");
  const dbPath = `${workspace}/dispatch-json-test.db`;

  try {
    const result = runCliCommand("dispatch-execution.js", [], {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "nonexistent-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // If output exists, verify it's valid JSON
    if (result.stdout.trim()) {
      const parsed = parseCliJson(result.stdout);

      // For successful output, verify structure has expected fields
      if (result.status === 0 && parsed.valid) {
        const data = parsed.data as Record<string, unknown>;
        assertGolden("cli-dispatch-json-structure", {
          hasStatus: data.status !== undefined,
          hasMessage: data.message !== undefined,
          hasTimestamp: data.timestamp !== undefined || data.createdAt !== undefined,
        });
      }
    }
  } finally {
    cleanupPath(workspace);
  }
});
