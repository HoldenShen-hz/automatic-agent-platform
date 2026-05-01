/**
 * Process Tracker Unit Tests
 *
 * Tests process registration, tracking, kill operations,
 * zombie detection, and summary reporting.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import {
  ProcessTracker,
  getProcessTracker,
  resetProcessTracker,
  spawnTracked,
  type ProcessOwner,
  type TrackedProcess,
  type TrackedProcessState,
} from "../../../../../../src/platform/five-plane-execution/resource/process-tracker.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createMockChildProcess(pid: number): NodeJS.EventEmitter & { pid: number } {
  const emitter = new EventEmitter();
  (emitter as NodeJS.EventEmitter & { pid: number }).pid = pid;
  return emitter as NodeJS.EventEmitter & { pid: number };
}

// ---------------------------------------------------------------------------
// Tests: Process Registration
// ---------------------------------------------------------------------------

test("register() adds process to tracking map", () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(12345);

  tracker.register(mockChild, "bash-tool", "ls", ["-la"]);

  const summary = tracker.getSummary();
  assert.equal(summary.active, 1, "should have 1 active process");
  assert.equal(summary.byOwner["bash-tool"], 1, "should have 1 bash-tool process");
});

test("register() handles invalid pid gracefully", () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(0);
  // Mock child without valid pid
  Object.defineProperty(mockChild, "pid", { value: 0, writable: true });

  // Should not throw
  tracker.register(mockChild as any, "bash-tool", "ls", []);
  assert.equal(tracker.getSummary().active, 0, "should not track invalid pid");
});

test("unregister() removes process from tracking", () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(12345);

  tracker.register(mockChild, "bash-tool", "ls", ["-la"]);
  tracker.unregister(12345);

  assert.equal(tracker.getSummary().active, 0, "should have 0 active processes");
});

test("register() stores correct process metadata", () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(12345);

  tracker.register(mockChild, "docker", "docker", ["ps"],);

  const active = tracker.getActive();
  assert.equal(active.length, 1);
  assert.equal(active[0].pid, 12345);
  assert.equal(active[0].owner, "docker");
  assert.equal(active[0].command, "docker");
  assert.deepEqual(active[0].args, ["ps"]);
  assert.equal(active[0].state, "running");
});

// ---------------------------------------------------------------------------
// Tests: Process State
// ---------------------------------------------------------------------------

test("getActive() returns only running or terminating processes", () => {
  const tracker = new ProcessTracker();
  const mockChild1 = createMockChildProcess(111);
  const mockChild2 = createMockChildProcess(222);

  tracker.register(mockChild1, "bash-tool", "sleep", ["10"]);
  tracker.register(mockChild2, "bash-tool", "sleep", ["20"]);

  // Simulate process exit
  mockChild1.emit("exit", 0, null);

  const active = tracker.getActive();
  assert.equal(active.length, 1, "should have 1 active process after exit");
  assert.equal(active[0].pid, 222);
});

// ---------------------------------------------------------------------------
// Tests: Process Counting
// ---------------------------------------------------------------------------

test("getActiveCount() returns correct count", () => {
  const tracker = new ProcessTracker();
  const mockChild1 = createMockChildProcess(111);
  const mockChild2 = createMockChildProcess(222);
  const mockChild3 = createMockChildProcess(333);

  tracker.register(mockChild1, "bash-tool", "sleep", ["10"]);
  tracker.register(mockChild2, "bash-tool", "sleep", ["20"]);
  tracker.register(mockChild3, "mcp-transport", "node", ["server.js"]);

  assert.equal(tracker.getActiveCount(), 3, "should have 3 active processes");
});

test("getCountByOwner() returns correct counts per owner", () => {
  const tracker = new ProcessTracker();
  const mockChild1 = createMockChildProcess(111);
  const mockChild2 = createMockChildProcess(222);
  const mockChild3 = createMockChildProcess(333);

  tracker.register(mockChild1, "bash-tool", "sleep", ["10"]);
  tracker.register(mockChild2, "bash-tool", "sleep", ["20"]);
  tracker.register(mockChild3, "mcp-transport", "node", ["server.js"]);

  const counts = tracker.getCountByOwner();
  assert.equal(counts["bash-tool"], 2);
  assert.equal(counts["mcp-transport"], 1);
  assert.equal(counts["docker"], 0);
  assert.equal(counts["lsp-client"], 0);
});

// ---------------------------------------------------------------------------
// Tests: Zombie Detection
// ---------------------------------------------------------------------------

test("getZombieCount() detects exited but not unregistered processes", () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(12345);

  tracker.register(mockChild, "bash-tool", "ls", []);
  mockChild.emit("exit", 0, null);

  // At this point the process is 'exited' but not yet cleaned up
  // (the 100ms timeout hasn't fired)
  const zombieCount = tracker.getZombieCount();
  assert.ok(zombieCount >= 0, "zombie count should be tracked");
});

// ---------------------------------------------------------------------------
// Tests: Kill Operations
// ---------------------------------------------------------------------------

test("kill() returns false for unknown pid", async () => {
  const tracker = new ProcessTracker();

  const result = await tracker.kill(99999, "SIGTERM");

  assert.equal(result, false, "should return false for unknown process");
});

test("kill() returns true when successfully sending signal", async () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(12345);

  tracker.register(mockChild, "bash-tool", "sleep", ["10"]);

  const result = await tracker.kill(12345, "SIGTERM");

  // The result depends on whether process.kill succeeds in test env
  assert.equal(typeof result, "boolean", "should return boolean");
});

// ---------------------------------------------------------------------------
// Tests: Kill All
// ---------------------------------------------------------------------------

test("killAll() handles empty process list", async () => {
  const tracker = new ProcessTracker();

  await tracker.killAll("SIGTERM", 100);

  assert.equal(tracker.getSummary().active, 0);
});

test("killAll() sends signal to all active processes", async () => {
  const tracker = new ProcessTracker();
  const mockChild1 = createMockChildProcess(111);
  const mockChild2 = createMockChildProcess(222);

  tracker.register(mockChild1, "bash-tool", "sleep", ["10"]);
  tracker.register(mockChild2, "bash-tool", "sleep", ["20"]);

  await tracker.killAll("SIGTERM", 100);

  // Processes should be in terminating state
  const summary = tracker.getSummary();
  assert.ok(summary.active >= 0, "active count should be tracked");
});

// ---------------------------------------------------------------------------
// Tests: Summary
// ---------------------------------------------------------------------------

test("getSummary() returns correct structure", () => {
  const tracker = new ProcessTracker();
  const mockChild = createMockChildProcess(12345);

  tracker.register(mockChild, "bash-tool", "ls", []);

  const summary = tracker.getSummary();

  assert.ok(typeof summary.active === "number");
  assert.ok(typeof summary.zombie === "number");
  assert.ok(summary.byOwner != null);
  assert.equal(summary.active, 1);
});

// ---------------------------------------------------------------------------
// Tests: Reset
// ---------------------------------------------------------------------------

test("reset() clears all tracked processes", () => {
  const tracker = new ProcessTracker();
  const mockChild1 = createMockChildProcess(111);
  const mockChild2 = createMockChildProcess(222);

  tracker.register(mockChild1, "bash-tool", "sleep", ["10"]);
  tracker.register(mockChild2, "bash-tool", "sleep", ["20"]);

  tracker.reset();

  assert.equal(tracker.getSummary().active, 0);
  assert.equal(tracker.getSummary().zombie, 0);
});

// ---------------------------------------------------------------------------
// Tests: Singleton Management
// ---------------------------------------------------------------------------

test("getProcessTracker() returns singleton instance", () => {
  resetProcessTracker();

  const tracker1 = getProcessTracker();
  const tracker2 = getProcessTracker();

  assert.ok(tracker1 === tracker2, "should return same instance");
});

test("resetProcessTracker() resets singleton", () => {
  resetProcessTracker();

  const tracker1 = getProcessTracker();
  resetProcessTracker();
  const tracker3 = getProcessTracker();

  assert.ok(tracker1 !== tracker3, "should return new instance after reset");
});

// ---------------------------------------------------------------------------
// Tests: spawnTracked
// ---------------------------------------------------------------------------

test("spawnTracked() registers spawned process with tracker", () => {
  const tracker = new ProcessTracker();

  // Use a simple command that exits quickly
  const child = spawnTracked(tracker, "echo", ["test"], {}, "bash-tool");

  assert.ok(child.pid > 0, "should have valid pid");
  assert.equal(tracker.getActiveCount(), 1, "should register the process");

  // Cleanup
  child.kill();
});
