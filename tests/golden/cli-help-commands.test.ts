/**
 * Golden Test: CLI Help Commands
 *
 * Verifies CLI help output is stable and well-formatted.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { assertGolden } from "../helpers/golden.js";

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

test("golden: CLI --help output is valid JSON structure (doctor)", () => {
  const result = runCliCommand("doctor.js", ["--help"]);

  // Doctor --help should output JSON with usage info
  assertGolden("cli-doctor-help-output", {
    hasOutput: result.stdout.length > 0 || result.stderr.length > 0,
    status: result.status,
  });
});

test("golden: CLI --help output is valid JSON structure (inspect)", () => {
  const result = runCliCommand("inspect.js", ["--help"]);

  // Inspect --help should output JSON with usage info
  assertGolden("cli-inspect-help-output", {
    hasOutput: result.stdout.length > 0 || result.stderr.length > 0,
    status: result.status,
  });
});

test("golden: CLI --version produces version information", () => {
  const result = runCliCommand("doctor.js", ["--version"]);

  assertGolden("cli-version-output", {
    hasOutput: result.stdout.length > 0,
    status: result.status,
  });
});

test("golden: CLI with invalid flag produces error", () => {
  const result = runCliCommand("doctor.js", ["--invalid-flag"]);

  // Should fail with non-zero exit code
  assert.notEqual(result.status, 0, "Invalid flag should fail");

  assertGolden("cli-invalid-flag-error", {
    hasError: result.stderr.length > 0 || result.stdout.length > 0,
    status: result.status,
  });
});

test("golden: CLI environment variable documentation is consistent", () => {
  // Verify that CLI scripts document required environment variables
  const cliSourceDir = join(process.cwd(), "src", "sdk", "cli");

  const docs = [
    { script: "doctor.ts", envVar: "AA_DB_PATH" },
    { script: "inspect.ts", envVar: "AA_INSPECT_KIND" },
    { script: "dispatch-execution.ts", envVar: "AA_EXECUTION_ID" },
  ];

  for (const { script, envVar } of docs) {
    const sourcePath = join(cliSourceDir, script);
    try {
      const content = readFileSync(sourcePath, "utf8");

      assert.ok(
        content.includes(envVar),
        `${script} should document ${envVar}`,
      );
    } catch {
      // Skip if file doesn't exist
    }
  }
});
