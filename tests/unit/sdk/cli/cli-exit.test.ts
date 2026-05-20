import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_EXIT_FAILURE,
  CLI_EXIT_SUCCESS,
  normalizeCliExitCode,
  runCliMain,
} from "../../../../src/sdk/cli/cli-exit.js";

test("normalizeCliExitCode maps booleans to canonical process exit codes", () => {
  assert.equal(normalizeCliExitCode(true), CLI_EXIT_SUCCESS);
  assert.equal(normalizeCliExitCode(false), CLI_EXIT_FAILURE);
});

test("normalizeCliExitCode keeps explicit numeric exit codes", () => {
  assert.equal(normalizeCliExitCode(0), CLI_EXIT_SUCCESS);
  assert.equal(normalizeCliExitCode(1), CLI_EXIT_FAILURE);
  assert.equal(normalizeCliExitCode(7), 7);
});

test("runCliMain sets success exit code when main returns 0", async () => {
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    await runCliMain(() => CLI_EXIT_SUCCESS);
    assert.equal(process.exitCode, CLI_EXIT_SUCCESS);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test("runCliMain sets failure exit code when main returns false", async () => {
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    await runCliMain(() => false);
    assert.equal(process.exitCode, CLI_EXIT_FAILURE);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test("runCliMain preserves pre-set exit codes when main returns void", async () => {
  const originalExitCode = process.exitCode;
  process.exitCode = 141;

  try {
    await runCliMain(() => undefined);
    assert.equal(process.exitCode, 141);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test("runCliMain reports errors through callback and sets failure exit code", async () => {
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  let observedError: unknown = null;

  try {
    await runCliMain(
      () => {
        throw new Error("cli exploded");
      },
      {
        onError: (error) => {
          observedError = error;
        },
      },
    );
    assert.equal(process.exitCode, CLI_EXIT_FAILURE);
    assert.ok(observedError instanceof Error);
    assert.equal((observedError as Error).message, "cli exploded");
  } finally {
    process.exitCode = originalExitCode;
  }
});
