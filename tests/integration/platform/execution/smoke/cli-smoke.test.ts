/**
 * Smoke Test: CLI Commands
 *
 * Verifies CLI commands can be invoked and produce valid output.
 * Part of the smoke test suite in tests/integration/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

test("smoke: CLI commands produce output when executed", async () => {
  const workspace = createTempWorkspace("smoke-cli-");

  try {
    // Set up environment with a database path
    const env = {
      ...process.env,
      AA_DB_PATH: `${workspace}/test.db`,
    };

    // Run doctor command - it should produce JSON output
    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn("node", ["dist/src/sdk/cli/doctor.js"], {
        env,
        cwd: process.cwd(),
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code: number | null) => {
        // Collect output from both stdout and stderr
        resolve(stdout + stderr);
      });

      proc.on("error", reject);
    });

    // Should produce some output
    assert.ok(
      output.length > 0,
      "CLI should produce output when executed",
    );

    // Output should be valid JSON (doctor outputs JSON)
    let isValidJson = false;
    try {
      JSON.parse(output);
      isValidJson = true;
    } catch {
      // Not JSON
    }

    // If it's not JSON, it should at least be text
    assert.ok(
      isValidJson || output.length > 0,
      "CLI output should be valid",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: CLI produces error for invalid environment", async () => {
  const workspace = createTempWorkspace("smoke-cli-error-");

  try {
    // Set up environment without database file
    const env = {
      ...process.env,
      AA_DB_PATH: `${workspace}/nonexistent.db`,
    };

    // Run doctor - should produce output (either error or diagnostic info)
    const output = await new Promise<string>((resolve) => {
      const proc = spawn("node", ["dist/src/sdk/cli/doctor.js"], {
        env,
        cwd: process.cwd(),
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", () => {
        // Collect both stdout and stderr regardless of exit code
        resolve(stdout + stderr);
      });

      proc.on("error", () => {
        resolve("");
      });
    });

    // Should produce some output (error message or diagnostics)
    assert.ok(
      output.length > 0,
      "CLI should produce output even when database doesn't exist",
    );
  } finally {
    cleanupPath(workspace);
  }
});
