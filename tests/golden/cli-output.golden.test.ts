/**
 * Golden Test: CLI Output Format Stability
 *
 * Verifies that CLI commands (inspect, doctor, dispatch-execution) produce
 * consistent output structure that can be used for backward compatibility.
 *
 * These tests spawn the actual CLI processes and verify their JSON output
 * format is stable.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { assertGolden } from "../helpers/golden.js";
import { createTempWorkspace, cleanupPath } from "../helpers/fs.js";

// Helper to run CLI commands and capture output
function runCliCommand(
  scriptName: string,
  env: Record<string, string> = {},
): { stdout: string; stderr: string; status: number } {
  const result = {
    stdout: "",
    stderr: "",
    status: 0,
  };

  // Use tsx to run the CLI directly from source
  const scriptPath = join(process.cwd(), "src", "sdk", "cli", scriptName);
  try {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", scriptPath],
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

// Helper to parse CLI JSON output, handling potential errors
function parseCliJson(output: string): { valid: boolean; data?: unknown; error?: string } {
  try {
    const data = JSON.parse(output);
    return { valid: true, data };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

test("golden: doctor CLI output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-doctor-");
  const dbPath = `${workspace}/doctor-test.db`;

  try {
    const result = runCliCommand("doctor.js", { AA_DB_PATH: dbPath });

    // Doctor should succeed (exit 0) with valid JSON output
    assert.equal(result.status, 0, `Doctor should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Doctor output should be valid JSON: ${parsed.error}`);

    // Verify output structure - doctor returns a comprehensive health report
    assertGolden("cli-doctor-output", {
      hasValidJson: parsed.valid,
      outputStructure: parsed.data ? Object.keys(parsed.data as object) : [],
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: dispatch-execution CLI output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-dispatch-");
  const dbPath = `${workspace}/dispatch-test.db`;

  try {
    // dispatch-execution requires AA_EXECUTION_ID
    const result = runCliCommand("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "test-dispatch-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // dispatch-execution should succeed with valid JSON
    assert.equal(result.status, 0, `Dispatch should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Dispatch output should be valid JSON: ${parsed.error}`);

    // Verify output structure
    assertGolden("cli-dispatch-execution-output", {
      hasValidJson: parsed.valid,
      outputStructure: parsed.data ? Object.keys(parsed.data as object) : [],
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI (task kind) output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-task-");
  const dbPath = `${workspace}/inspect-task-test.db`;

  try {
    // First create a task using dispatch-execution to have something to inspect
    const dispatchResult = runCliCommand("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "inspect-task-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    assert.equal(dispatchResult.status, 0, `Setup dispatch should succeed: ${dispatchResult.stderr}`);

    // Now inspect the task
    const result = runCliCommand("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "task",
      AA_TASK_ID: "inspect-task-exec-001",
    });

    assert.equal(result.status, 0, `Inspect should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect output should be valid JSON: ${parsed.error}`);

    // Verify output structure contains expected fields
    assertGolden("cli-inspect-task-output", {
      hasValidJson: parsed.valid,
      outputStructure: parsed.data ? Object.keys(parsed.data as object) : [],
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI (tasks list kind) output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-tasks-");
  const dbPath = `${workspace}/inspect-tasks-test.db`;

  try {
    // Create a task first
    runCliCommand("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "inspect-tasks-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // Now list tasks
    const result = runCliCommand("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "tasks",
    });

    assert.equal(result.status, 0, `Inspect tasks should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect tasks output should be valid JSON: ${parsed.error}`);

    // Verify output is an array
    assertGolden("cli-inspect-tasks-list-output", {
      hasValidJson: parsed.valid,
      isArray: Array.isArray(parsed.data),
      itemCount: Array.isArray(parsed.data) ? (parsed.data as unknown[]).length : 0,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI (execution kind) output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-exec-");
  const dbPath = `${workspace}/inspect-exec-test.db`;

  try {
    // Create an execution first
    runCliCommand("dispatch-execution.js", {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "inspect-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // Now inspect the execution
    const result = runCliCommand("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "execution",
      AA_EXECUTION_ID: "inspect-exec-001",
    });

    assert.equal(result.status, 0, `Inspect execution should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect execution output should be valid JSON: ${parsed.error}`);

    // Verify output structure contains expected fields
    assertGolden("cli-inspect-execution-output", {
      hasValidJson: parsed.valid,
      outputStructure: parsed.data ? Object.keys(parsed.data as object) : [],
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI (workers kind) output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-workers-");
  const dbPath = `${workspace}/inspect-workers-test.db`;

  try {
    // List workers (may be empty but should still be valid JSON)
    const result = runCliCommand("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "workers",
    });

    assert.equal(result.status, 0, `Inspect workers should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect workers output should be valid JSON: ${parsed.error}`);

    // Verify output is an array (may be empty)
    assertGolden("cli-inspect-workers-list-output", {
      hasValidJson: parsed.valid,
      isArray: Array.isArray(parsed.data),
      itemCount: Array.isArray(parsed.data) ? (parsed.data as unknown[]).length : 0,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI (workflows kind) output has valid JSON structure", () => {
  const workspace = createTempWorkspace("aa-cli-inspect-workflows-");
  const dbPath = `${workspace}/inspect-workflows-test.db`;

  try {
    // List workflows (may be empty but should still be valid JSON)
    const result = runCliCommand("inspect.js", {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "workflows",
    });

    assert.equal(result.status, 0, `Inspect workflows should succeed, got status ${result.status}: ${result.stderr}`);

    const parsed = parseCliJson(result.stdout);
    assert.ok(parsed.valid, `Inspect workflows output should be valid JSON: ${parsed.error}`);

    // Verify output is an array (may be empty)
    assertGolden("cli-inspect-workflows-list-output", {
      hasValidJson: parsed.valid,
      isArray: Array.isArray(parsed.data),
      itemCount: Array.isArray(parsed.data) ? (parsed.data as unknown[]).length : 0,
    });
  } finally {
    cleanupPath(workspace);
  }
});
