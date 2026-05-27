import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { createProcessGuard, withProcessGuard } from "../../../../helpers/process-guard.js";
import { waitForCondition } from "../../../../helpers/wait.js";
import { getProcessTracker, resetProcessTracker } from "../../../../../src/platform/five-plane-execution/resource/process-tracker.js";

describe("createProcessGuard", () => {
  beforeEach(() => {
    resetProcessTracker();
  });

  it("detects no leaks when no processes spawned", () => {
    const guard = createProcessGuard();
    guard.capture();
    // Should not throw
    guard.assertNoLeaks();
  });

  it("detects leaked process when not cleaned up", async () => {
    const guard = createProcessGuard();
    guard.capture();

    // Spawn a process without cleaning it up
    const tracker = getProcessTracker();
    const proc = spawn("sleep", ["60"], { detached: false });
    tracker.register(proc, "bash-tool", "sleep", ["60"]);

    // Assert should throw
    let threw = false;
    try {
      guard.assertNoLeaks();
    } catch (err) {
      threw = true;
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes("Process leak detected"));
    }

    // Cleanup
    try { proc.kill("SIGKILL"); } catch {}

    assert.ok(threw, "Expected assertNoLeaks to throw");
  });

  it("passes when process is cleaned up before assertion", async () => {
    const guard = createProcessGuard();
    guard.capture();

    const tracker = getProcessTracker();
    const proc = spawn("sleep", ["0.1"], { detached: false });
    tracker.register(proc, "bash-tool", "sleep", ["0.1"]);

    await waitForCondition(() => tracker.getActiveCount() === 0, {
      timeoutMs: 1_000,
      intervalMs: 20,
      description: "tracked process cleanup",
    });

    // Should not throw because process already exited
    guard.assertNoLeaks();
  });
});

describe("withProcessGuard", () => {
  beforeEach(() => {
    resetProcessTracker();
  });

  it("runs function and asserts no leaks", async () => {
    const wrapped = withProcessGuard(async () => {
      const tracker = getProcessTracker();
      const proc = spawn("sleep", ["0.1"], { detached: false });
      tracker.register(proc, "bash-tool", "sleep", ["0.1"]);
      await waitForCondition(() => tracker.getActiveCount() === 0, {
        timeoutMs: 1_000,
        intervalMs: 20,
        description: "wrapped tracked process cleanup",
      });
    });

    // Should not throw
    await wrapped();
  });

  it("throws when process leaks", async () => {
    const wrapped = withProcessGuard(async () => {
      const tracker = getProcessTracker();
      const proc = spawn("sleep", ["60"], { detached: false });
      tracker.register(proc, "bash-tool", "sleep", ["60"]);
      // Intentionally not cleaning up
    });

    let threw = false;
    try {
      await wrapped();
    } catch (err) {
      threw = true;
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes("Process leak detected"));
    }

    // Cleanup leaked process
    const tracker = getProcessTracker();
    const active = tracker.getActive();
    for (const p of active) {
      try { process.kill(p.pid, "SIGKILL"); } catch {}
    }

    assert.ok(threw, "Expected wrapped function to throw");
  });
});
