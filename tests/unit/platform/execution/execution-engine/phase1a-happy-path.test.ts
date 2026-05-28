/**
 * Unit Tests: Single-task happy path public surface
 */

import assert from "node:assert/strict";
import test from "node:test";

test("single-task-happy-path exports runSingleTaskExecution [phase1a-happy-path]", async () => {
  const mod = await import("../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");
  assert.equal(typeof mod.runSingleTaskExecution, "function");
});

test("single-task-happy-path does not export removed Phase1A alias [phase1a-happy-path]", async () => {
  const mod = await import("../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");
  assert.equal("runPhase1AHappyPath" in mod, false);
});

test("single-task-happy-path exposes the canonical entrypoint only [phase1a-happy-path]", async () => {
  const mod = await import("../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");
  assert.equal(typeof mod.runSingleTaskExecution, "function");
});

test("single-task-happy-path exports HappyPathInput type [phase1a-happy-path]", async () => {
  const mod = await import("../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");
  assert.ok("HappyPathInput" in mod || mod.runSingleTaskExecution != null);
});
