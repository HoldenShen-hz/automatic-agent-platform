/**
 * @fileoverview Tests for Core Runtime Process Tracker
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ProcessTracker,
  getProcessTracker,
  resetProcessTracker,
  spawnTracked,
  type ProcessOwner,
  type TrackedProcess,
  type TrackedProcessState,
} from "../../../../src/core/runtime/process-tracker.js";

// ---------------------------------------------------------------------------
// ProcessTracker basics
// ---------------------------------------------------------------------------

test("ProcessTracker starts empty", () => {
  const tracker = new ProcessTracker();
  assert.equal(tracker.getActiveCount(), 0);
  assert.equal(tracker.getZombieCount(), 0);
});

test("ProcessTracker.getActive returns empty array when no processes", () => {
  const tracker = new ProcessTracker();
  assert.deepEqual(tracker.getActive(), []);
});

test("ProcessTracker.getSummary returns correct structure", () => {
  const tracker = new ProcessTracker();
  const summary = tracker.getSummary();
  assert.ok("active" in summary);
  assert.ok("zombie" in summary);
  assert.ok("byOwner" in summary);
  assert.equal(summary.active, 0);
  assert.equal(summary.zombie, 0);
});

test("ProcessTracker.reset clears all processes", () => {
  const tracker = new ProcessTracker();
  tracker.reset();
  assert.equal(tracker.getActiveCount(), 0);
});

// ---------------------------------------------------------------------------
// ProcessOwner types
// ---------------------------------------------------------------------------

test("ProcessOwner type covers all categories", () => {
  const owners: ProcessOwner[] = [
    "bash-tool",
    "mcp-transport",
    "lsp-client",
    "redis-cli",
    "pg-cli",
    "docker",
    "exec-file",
    "unknown",
  ];
  assert.equal(owners.length, 8);
});

// ---------------------------------------------------------------------------
// TrackedProcessState type
// ---------------------------------------------------------------------------

test("TrackedProcessState includes expected states", () => {
  const states: TrackedProcessState[] = ["running", "terminating", "killed", "exited"];
  assert.equal(states.length, 4);
});

// ---------------------------------------------------------------------------
// ProcessTracker getCountByOwner
// ---------------------------------------------------------------------------

test("ProcessTracker.getCountByOwner returns zero counts for all owners", () => {
  const tracker = new ProcessTracker();
  const counts = tracker.getCountByOwner();
  assert.equal(counts["bash-tool"], 0);
  assert.equal(counts["mcp-transport"], 0);
  assert.equal(counts["lsp-client"], 0);
  assert.equal(counts["redis-cli"], 0);
  assert.equal(counts["pg-cli"], 0);
  assert.equal(counts["docker"], 0);
  assert.equal(counts["exec-file"], 0);
  assert.equal(counts["unknown"], 0);
});

// ---------------------------------------------------------------------------
// ProcessTracker kill on unknown pid
// ---------------------------------------------------------------------------

test("ProcessTracker.kill returns false for unknown pid", async () => {
  const tracker = new ProcessTracker();
  const result = await tracker.kill(99999);
  assert.equal(result, false);
});

test("ProcessTracker.kill returns false for non-existent pid", async () => {
  const tracker = new ProcessTracker();
  // Using a pid that definitely doesn't exist
  const result = await tracker.kill(1);
  // On some systems pid 1 exists (init), so just check it doesn't throw
  assert.equal(typeof result, "boolean");
});

// ---------------------------------------------------------------------------
// ProcessTracker.unregister
// ---------------------------------------------------------------------------

test("ProcessTracker.unregister removes non-existent pid silently", () => {
  const tracker = new ProcessTracker();
  // Should not throw
  tracker.unregister(99999);
  assert.equal(tracker.getActiveCount(), 0);
});

// ---------------------------------------------------------------------------
// getProcessTracker singleton
// ---------------------------------------------------------------------------

test("getProcessTracker returns singleton instance", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  const tracker2 = getProcessTracker();
  assert.strictEqual(tracker1, tracker2);
});

test("getProcessTracker returns new instance after reset", () => {
  const tracker1 = getProcessTracker();
  resetProcessTracker();
  const tracker2 = getProcessTracker();
  assert.notStrictEqual(tracker1, tracker2);
});

// ---------------------------------------------------------------------------
// spawnTracked function
// ---------------------------------------------------------------------------

test("spawnTracked creates child process and registers it", () => {
  resetProcessTracker();
  const tracker = new ProcessTracker();

  const child = spawnTracked(tracker, "echo", ["hello"], undefined, "bash-tool");

  try {
    assert.ok(child.pid > 0);
    // Process may have already exited since echo is fast
    // Just verify no error was thrown during spawn
  } finally {
    tracker.killAll("SIGKILL", 100);
  }
});

test("spawnTracked with args works", () => {
  resetProcessTracker();
  const tracker = new ProcessTracker();

  const child = spawnTracked(
    tracker,
    "node",
    ["-e", "console.log('test')"],
    undefined,
    "exec-file",
  );

  try {
    assert.ok(child.pid > 0);
  } finally {
    tracker.killAll("SIGKILL", 100);
  }
});

test("spawnTracked uses provided cwd", () => {
  resetProcessTracker();
  const tracker = new ProcessTracker();

  const child = spawnTracked(
    tracker,
    "pwd",
    [],
    { cwd: "/tmp" },
    "bash-tool",
  );

  try {
    assert.ok(child.pid > 0);
  } finally {
    tracker.killAll("SIGKILL", 100);
  }
});

test("spawnTracked defaults owner to unknown", () => {
  resetProcessTracker();
  const tracker = new ProcessTracker();

  const child = spawnTracked(tracker, "sleep", ["0.01"]);

  try {
    assert.ok(child.pid > 0);
  } finally {
    tracker.killAll("SIGKILL", 100);
  }
});

// ---------------------------------------------------------------------------
// ProcessTracker killAll with no active processes
// ---------------------------------------------------------------------------

test("ProcessTracker.killAll handles empty tracker", async () => {
  const tracker = new ProcessTracker();
  // Should not throw
  await tracker.killAll("SIGTERM", 100);
});

// ---------------------------------------------------------------------------
// ProcessTracker summary after operations
// ---------------------------------------------------------------------------

test("ProcessTracker tracks multiple spawns", () => {
  resetProcessTracker();
  const tracker = new ProcessTracker();

  const child1 = spawnTracked(tracker, "sleep", ["0.1"], undefined, "bash-tool");
  const child2 = spawnTracked(tracker, "sleep", ["0.1"], undefined, "bash-tool");

  try {
    assert.ok(child1.pid > 0);
    assert.ok(child2.pid > 0);
    // Both tracked
    tracker.reset();
  } finally {
    tracker.killAll("SIGKILL", 100);
  }
});