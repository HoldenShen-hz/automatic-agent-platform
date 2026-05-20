/**
 * CLI Robustness Tests
 *
 * Tests CLI behavior under edge cases like broken pipes (EPIPE),
 * signals (SIGTERM), and non-zero exit codes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRYPOINT = join(process.cwd(), "dist", "src", "sdk", "cli", "doctor.js");

test("CLI exits with code 1 on missing required arguments", async () => {
  // Call doctor with no args - should exit with code 1
  const proc = spawn("node", [CLI_ENTRYPOINT], {
    env: { ...process.env, AA_DB_PATH: ":memory:" },
  });

  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  assert.equal(exitCode, 1, "Should exit with code 1 on missing arguments");
});

test("CLI handles SIGTERM gracefully", async () => {
  const proc = spawn("node", [CLI_ENTRYPOINT], {
    env: { ...process.env, AA_DB_PATH: ":memory:" },
  });

  // Send SIGTERM after a short delay
  setTimeout(() => proc.kill("SIGTERM"), 50);

  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 143));
  });

  // SIGTERM typically results in exit code 143 (128 + 15 for SIGTERM)
  assert.ok([143, 137, 0].includes(exitCode), `Should handle SIGTERM gracefully, got ${exitCode}`);
});

test("CLI handles SIGINT (Ctrl+C) gracefully", async () => {
  const proc = spawn("node", [CLI_ENTRYPOINT], {
    env: { ...process.env, AA_DB_PATH: ":memory:" },
  });

  // Send SIGINT after a short delay
  setTimeout(() => proc.kill("SIGINT"), 50);

  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 130));
  });

  // SIGINT typically results in exit code 130 (128 + 2 for SIGINT)
  assert.ok([130, 0].includes(exitCode), `Should handle SIGINT gracefully, got ${exitCode}`);
});

test("CLI handles broken pipe (EPIPE) gracefully", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "doctor-epipe-"));
  const dbPath = join(tempDir, "doctor.sqlite");

  try {
    const command =
      `set -o pipefail; AA_DB_PATH=${JSON.stringify(dbPath)} ` +
      `node ${JSON.stringify(CLI_ENTRYPOINT)} | :`;
    const proc = spawn("zsh", ["-lc", command], {
      env: process.env,
    });

    let stderr = "";
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const exitCode = await new Promise<number>((resolve) => {
      proc.on("close", (code) => resolve(code ?? 1));
    });

    assert.equal(exitCode, 141, `Should exit with SIGPIPE-compatible code on broken pipe, got ${exitCode}. stderr: ${stderr}`);
    assert.equal(stderr.includes("EPIPE"), false, `Should not print EPIPE stack traces. stderr: ${stderr}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CLI exits with code 1 on invalid database path", async () => {
  const proc = spawn("node", [CLI_ENTRYPOINT], {
    env: { ...process.env, AA_DB_PATH: "/nonexistent/path/to/db.sqlite" },
  });

  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  assert.equal(exitCode, 1, "Should exit with code 1 on invalid database path");
});
