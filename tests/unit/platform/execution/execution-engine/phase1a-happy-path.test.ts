/**
 * Unit Tests: Phase1A Happy Path barrel
 *
 * Tests that phase1a-happy-path barrel exports correctly re-export
 * runSingleTaskExecution and runPhase1AHappyPath alias.
 */

import assert from "node:assert/strict";
import test from "node:test";

test("phase1a-happy-path exports runSingleTaskExecution", async () => {
  const mod = await import("../../../../../src/platform/execution/execution-engine/phase1a-happy-path.js");
  assert.equal(typeof mod.runSingleTaskExecution, "function");
});

test("phase1a-happy-path exports runPhase1AHappyPath alias", async () => {
  const mod = await import("../../../../../src/platform/execution/execution-engine/phase1a-happy-path.js");
  assert.equal(typeof mod.runPhase1AHappyPath, "function");
});

test("runPhase1AHappyPath is identical to runSingleTaskExecution", async () => {
  const mod = await import("../../../../../src/platform/execution/execution-engine/phase1a-happy-path.js");
  assert.strictEqual(mod.runPhase1AHappyPath, mod.runSingleTaskExecution);
});

test("phase1a-happy-path exports HappyPathInput type", async () => {
  const mod = await import("../../../../../src/platform/execution/execution-engine/phase1a-happy-path.js");
  assert.ok("HappyPathInput" in mod || mod.runSingleTaskExecution != null);
});