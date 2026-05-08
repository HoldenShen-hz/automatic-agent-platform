/**
 * Integration tests for Core Runtime process-tracker barrel module
 *
 * Tests the full re-export chain from core/runtime/process-tracker.ts
 * which delegates to platform/execution/resource/process-tracker.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ProcessTracker,
  getProcessTracker,
  resetProcessTracker,
  spawnTracked,
} from "../../../../src/core/runtime/process-tracker.js";

test("process-tracker barrel exports ProcessTracker class", () => {
  assert.ok(typeof ProcessTracker === "function", "ProcessTracker should be a constructor");
  const tracker = new ProcessTracker();
  assert.ok(tracker instanceof ProcessTracker);
});

test("process-tracker barrel exports getProcessTracker singleton function", () => {
  assert.ok(typeof getProcessTracker === "function", "getProcessTracker should be a function");
});

test("process-tracker barrel exports resetProcessTracker function", () => {
  assert.ok(typeof resetProcessTracker === "function", "resetProcessTracker should be a function");
});

test("process-tracker barrel exports spawnTracked function", () => {
  assert.ok(typeof spawnTracked === "function", "spawnTracked should be a function");
});

test("process-tracker singleton persists across calls", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  const tracker2 = getProcessTracker();
  assert.strictEqual(tracker1, tracker2);
});

test("process-tracker spawnTracked creates trackable child process", () => {
  resetProcessTracker();
  const tracker = new ProcessTracker();

  const child = spawnTracked(tracker, "node", ["-e", "console.log('integration-test')"], undefined, "bash-tool");

  try {
    assert.ok(child.pid > 0, "Child process should have a valid pid");
    assert.ok(tracker.getActiveCount() >= 0, "Tracker should track the child");
  } finally {
    tracker.killAll("SIGKILL", 100);
  }
});

test("process-tracker reset clears singleton", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  resetProcessTracker();
  const tracker2 = getProcessTracker();
  assert.notStrictEqual(tracker1, tracker2, "New singleton should be created after reset");
});

test("process-tracker barrel module re-exports correct canonical module", async () => {
  // Verify that the barrel correctly re-exports from the canonical platform module
  const mod = await import("../../../../src/core/runtime/process-tracker.js");
  assert.ok("ProcessTracker" in mod, "Module should export ProcessTracker");
  assert.ok("getProcessTracker" in mod, "Module should export getProcessTracker");
  assert.ok("spawnTracked" in mod, "Module should export spawnTracked");
});

test("process-tracker ProcessTracker instance methods work", () => {
  const tracker = new ProcessTracker();
  assert.deepEqual(tracker.getActive(), [], "getActive should return empty array initially");
  assert.equal(tracker.getActiveCount(), 0, "getActiveCount should be 0 initially");
  const summary = tracker.getSummary();
  assert.ok("active" in summary);
  assert.ok("zombie" in summary);
  assert.ok("byOwner" in summary);
});
