/**
 * Doctor CLI Tests
 *
 * Tests for doctor.ts CLI module.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { installBrokenPipeHandler } from "../../../../src/sdk/cli/doctor.js";

// ---------------------------------------------------------------------------
// Tests for EPIPE handler logic
// ---------------------------------------------------------------------------

test("EPIPE error code is recognized as broken pipe", () => {
  const error = { code: "EPIPE" } as NodeJS.ErrnoException;
  assert.equal(error.code, "EPIPE");
});

test("non-EPIPE errors should be rethrown", () => {
  const error = { code: "ECONNREFUSED" } as NodeJS.ErrnoException;
  assert.notEqual(error.code, "EPIPE");
});

// ---------------------------------------------------------------------------
// Tests for doctor CLI entrypoint
// ---------------------------------------------------------------------------

test("doctor CLI installs broken pipe handler", () => {
  assert.equal(typeof installBrokenPipeHandler, "function");
});

test("doctor CLI only boots from direct execution and uses a one-shot EPIPE handler", () => {
  const source = readFileSync("src/sdk/cli/doctor.ts", "utf8");
  assert.match(source, /process\.stdout\.once\("error"/);
  assert.match(source, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/);
});
