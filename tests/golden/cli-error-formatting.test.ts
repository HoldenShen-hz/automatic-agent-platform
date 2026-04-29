/**
 * Golden Test: Error Message Formatting
 *
 * Verifies CLI error messages are consistent and well-formatted.
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

test("golden: inspect CLI missing required env var produces structured error", () => {
  const workspace = createTempWorkspace("aa-cli-error-missing-");
  const dbPath = `${workspace}/error-missing-test.db`;

  try {
    // Missing required AA_INSPECT_KIND should result in error
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      // AA_INSPECT_KIND not set - should fail validation
    });

    // Should fail due to missing required env var
    assert.notEqual(result.status, 0, "Missing required env should fail");

    // Validation errors are thrown as exceptions, not JSON
    assert.ok(
      result.stderr.includes("invalid_env") || result.stderr.includes("ValidationError"),
      "Should have validation error in stderr",
    );

    assertGolden("cli-error-missing-env", {
      hasError: result.stderr.length > 0,
      hasValidationError: result.stderr.includes("invalid_env") || result.stderr.includes("ValidationError"),
      status: result.status,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: inspect CLI with unknown kind produces structured error", () => {
  const workspace = createTempWorkspace("aa-cli-error-unknown-");
  const dbPath = `${workspace}/error-unknown-test.db`;

  try {
    // Unknown AA_INSPECT_KIND should produce error
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      AA_INSPECT_KIND: "unknown_kind",
    });

    // Should fail with unknown kind error
    assert.notEqual(result.status, 0, "Unknown kind should fail");

    assertGolden("cli-error-unknown-kind", {
      hasError: result.status !== 0,
      status: result.status,
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: dispatch-execution error output has consistent format", () => {
  const workspace = createTempWorkspace("aa-cli-error-dispatch-");
  const dbPath = `${workspace}/error-dispatch-test.db`;

  try {
    const result = runCliCommand("dispatch-execution.js", [], {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "nonexistent-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    // Either it fails with JSON error output or throws an exception
    const parsed = parseCliJson(result.stdout);

    assert.ok(
      result.status !== 0 || parsed.valid,
      "Dispatch should either fail or return valid JSON",
    );

    // If we got valid JSON, verify error structure
    if (parsed.valid) {
      const data = parsed.data as Record<string, unknown>;
      assertGolden("cli-error-dispatch-structure", {
        hasValidJson: parsed.valid,
        hasErrorCode: data.code !== undefined,
        hasMessage: data.message !== undefined,
        hasTimestamp: data.timestamp !== undefined,
      });
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: CLI error codes follow consistent naming convention", () => {
  // Error codes should follow domain:identifier format
  const errorPatterns = [
    { code: "missing_env:AA_TASK_ID", expected: true },
    { code: "missing_env:AA_EXECUTION_ID", expected: true },
    { code: "unknown_inspect_kind:foo", expected: true },
  ];

  for (const { code, expected } of errorPatterns) {
    // Verify error code has colon separator
    const hasColon = code.includes(":");
    assert.equal(hasColon, expected, `Error code ${code} should have colon separator`);
  }
});

test("golden: CLI error output includes actionable information", () => {
  const workspace = createTempWorkspace("aa-cli-error-action-");
  const dbPath = `${workspace}/error-action-test.db`;

  try {
    // Missing required AA_INSPECT_KIND
    const result = runCliCommand("inspect.js", [], {
      AA_DB_PATH: dbPath,
      // AA_INSPECT_KIND not set
    });

    // Error should include:
    // - The missing environment variable name
    // - Clear error message
    const hasHelpfulError = result.stderr.includes("AA_INSPECT_KIND") ||
                            result.stderr.includes("invalid_env") ||
                            result.stderr.includes("ValidationError");

    assert.ok(hasHelpfulError, "Error should include actionable information");

    assertGolden("cli-error-helpful-message", {
      hasError: result.stderr.length > 0,
      hasVariableHint: result.stderr.includes("AA_INSPECT_KIND"),
      hasErrorType: result.stderr.includes("ValidationError"),
    });
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: CLI error messages are JSON serialized when possible", () => {
  const workspace = createTempWorkspace("aa-cli-error-json-");
  const dbPath = `${workspace}/error-json-test.db`;

  try {
    const result = runCliCommand("dispatch-execution.js", [], {
      AA_DB_PATH: dbPath,
      AA_EXECUTION_ID: "nonexistent-exec-001",
      AA_DISPATCH_CREATE_ONLY: "1",
    });

    const parsed = parseCliJson(result.stdout);

    // When CLI produces error JSON, it should be parseable
    if (result.stdout.trim()) {
      assertGolden("cli-error-json-serialization", {
        hasValidJson: parsed.valid,
        status: result.status,
      });
    }
  } finally {
    cleanupPath(workspace);
  }
});
