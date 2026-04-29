/**
 * Integration tests for process-guard helper
 */

import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

import { createProcessGuard, withProcessGuard } from "../../helpers/process-guard.js";

test("createProcessGuard capture records baseline", () => {
  const guard = createProcessGuard();
  guard.capture();
  // Should not throw
});

test("createProcessGuard assertNoLeaks passes with no leaks", () => {
  const guard = createProcessGuard();
  guard.capture();
  guard.assertNoLeaks(); // Should not throw
});

test("withProcessGuard runs function and checks for leaks", async () => {
  const wrapped = withProcessGuard(async () => {
    // Do nothing - no process spawns
  });

  await wrapped(); // Should not throw
});

test("withProcessGuard handles synchronous function", () => {
  const wrapped = withProcessGuard(() => {
    // Do nothing - no process spawns
  });

  wrapped(); // Should not throw
});