import assert from "node:assert/strict";
import test from "node:test";
import type {
  ProcessOwner,
  TrackedProcess,
  TrackedProcessState,
} from "../../../src/core/runtime/process-tracker.js";

/**
 * Tests for src/core/runtime/process-tracker.ts
 * This file re-exports process tracker from five-plane-execution/resource/process-tracker.
 * Coverage: 0% (all statements/skipped)
 */
test("process-tracker re-exports ProcessTracker class", async () => {
  const mod = await import("../../../src/core/runtime/process-tracker.js");
  assert.ok("ProcessTracker" in mod, "should export ProcessTracker class");
});

test("process-tracker exports ProcessOwner type", () => {
  const owner: ProcessOwner = "bash-tool";
  assert.equal(owner, "bash-tool");
});

test("process-tracker exports TrackedProcessState type", () => {
  const state: TrackedProcessState = "running";
  assert.equal(state, "running");
});

test("process-tracker exports TrackedProcess interface", () => {
  const tracked: TrackedProcess = {
    pid: 1,
    command: "node",
    args: ["script.js"],
    spawnedAt: Date.now(),
    owner: "unknown",
    pgid: undefined,
    state: "running",
    killRequestedAt: undefined,
    lastSignal: undefined,
  };
  assert.equal(tracked.command, "node");
});

test("process-tracker exports getProcessTracker function", async () => {
  const mod = await import("../../../src/core/runtime/process-tracker.js");
  assert.ok("getProcessTracker" in mod, "should export getProcessTracker function");
});

test("process-tracker exports resetProcessTracker function", async () => {
  const mod = await import("../../../src/core/runtime/process-tracker.js");
  assert.ok("resetProcessTracker" in mod, "should export resetProcessTracker function");
});

test("process-tracker exports spawnTracked function", async () => {
  const mod = await import("../../../src/core/runtime/process-tracker.js");
  assert.ok("spawnTracked" in mod, "should export spawnTracked function");
});

test("ProcessTracker is instantiable", async () => {
  const mod = await import("../../../src/core/runtime/process-tracker.js");
  if ("ProcessTracker" in mod && typeof mod.ProcessTracker === "function") {
    // @ts-ignore - testing runtime behavior
    const tracker = new mod.ProcessTracker();
    assert.ok(typeof tracker.register === "function", "tracker should have register method");
    assert.ok(typeof tracker.unregister === "function", "tracker should have unregister method");
    assert.ok(typeof tracker.getActive === "function", "tracker should have getActive method");
    assert.ok(typeof tracker.kill === "function", "tracker should have kill method");
    assert.ok(typeof tracker.killAll === "function", "tracker should have killAll method");
    assert.ok(typeof tracker.reset === "function", "tracker should have reset method");
  }
});
