/**
 * Integration tests for process-guard helper
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createProcessGuard, withProcessGuard } from "../../helpers/process-guard.js";

test("createProcessGuard capture records baseline", () => {
  const guard = createProcessGuard();
  guard.capture();
  assert.equal(typeof guard.assertNoLeaks, "function");
});

test("createProcessGuard assertNoLeaks passes with no leaks", () => {
  const guard = createProcessGuard();
  guard.capture();
  assert.doesNotThrow(() => guard.assertNoLeaks());
});

test("withProcessGuard runs function and checks for leaks", async () => {
  let executed = false;
  const wrapped = withProcessGuard(async () => {
    executed = true;
  });

  await assert.doesNotReject(() => wrapped());
  assert.equal(executed, true);
});

test("withProcessGuard handles synchronous function", async () => {
  let callCount = 0;
  const wrapped = withProcessGuard(() => {
    callCount += 1;
  });

  await assert.doesNotReject(() => wrapped());
  assert.equal(callCount, 1);
});
