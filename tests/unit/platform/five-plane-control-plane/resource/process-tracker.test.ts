import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { ChildProcess } from "node:child_process";

import {
  ProcessTracker,
  getProcessTracker,
  resetProcessTracker,
  type ProcessOwner,
} from "../../../../../src/platform/five-plane-execution/resource/process-tracker.js";

function createMockChildProcess(
  pid: number,
  pgid?: number,
): ChildProcess {
  const emitter = new EventEmitter() as EventEmitter & {
    pid?: number;
    pgid?: number;
    once: ChildProcess["once"];
  };
  emitter.pid = pid;
  emitter.pgid = pgid;
  return emitter as unknown as ChildProcess;
}

test("register tracks process metadata and owner counts", () => {
  const tracker = new ProcessTracker();
  const child = createMockChildProcess(12345, 12000);

  tracker.register(child, "docker", "docker", ["ps"]);

  const [active] = tracker.getActive();
  assert.ok(active);
  assert.equal(active.pid, 12345);
  assert.equal(active.owner, "docker");
  assert.equal(active.command, "docker");
  assert.deepEqual(active.args, ["ps"]);
  assert.equal(tracker.getCountByOwner().docker, 1);
});

test("register ignores invalid pid values", () => {
  const tracker = new ProcessTracker();

  tracker.register(createMockChildProcess(0), "bash-tool", "sleep");

  assert.equal(tracker.getActiveCount(), 0);
});

test("exit event marks process exited before delayed cleanup", async () => {
  const tracker = new ProcessTracker();
  const child = createMockChildProcess(12345) as unknown as EventEmitter;

  tracker.register(child as unknown as ChildProcess, "bash-tool", "sleep", ["10"]);
  child.emit("exit", 0, null);

  assert.equal(tracker.getZombieCount(), 1);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(tracker.getActiveCount(), 0);
});

test("kill uses process group when pgid differs from pid", async () => {
  const tracker = new ProcessTracker();
  const child = createMockChildProcess(12345, 12000);
  const originalKill = process.kill;
  const calls: Array<{ pid: number; signal?: string | number }> = [];
  process.kill = ((pid: number, signal?: string | number) => {
    calls.push({ pid, signal });
    return true;
  }) as typeof process.kill;

  try {
    tracker.register(child, "bash-tool", "sleep");
    const killed = await tracker.kill(12345, "SIGTERM");

    assert.equal(killed, true);
    assert.deepEqual(calls, [{ pid: -12000, signal: "SIGTERM" }]);
  } finally {
    process.kill = originalKill;
  }
});

test("killAll escalates to SIGKILL for processes still active after grace period", async () => {
  const tracker = new ProcessTracker();
  const originalKill = process.kill;
  const calls: Array<{ pid: number; signal?: string | number }> = [];
  process.kill = ((pid: number, signal?: string | number) => {
    calls.push({ pid, signal });
    return true;
  }) as typeof process.kill;

  try {
    tracker.register(createMockChildProcess(111), "bash-tool", "sleep");
    tracker.register(createMockChildProcess(222), "mcp-transport", "node");

    await tracker.killAll("SIGTERM", 0);

    assert.deepEqual(calls, [
      { pid: 111, signal: "SIGTERM" },
      { pid: 222, signal: "SIGTERM" },
      { pid: 111, signal: "SIGKILL" },
      { pid: 222, signal: "SIGKILL" },
    ]);
  } finally {
    process.kill = originalKill;
  }
});

test("singleton helpers return stable instance and reset clears it", () => {
  resetProcessTracker();
  const first = getProcessTracker();
  const second = getProcessTracker();
  assert.equal(first, second);

  resetProcessTracker();
  const third = getProcessTracker();
  assert.notEqual(first, third);
});

test("summary reports active, zombie, and byOwner counts", () => {
  const tracker = new ProcessTracker();
  const child = createMockChildProcess(333) as unknown as EventEmitter;

  tracker.register(child as unknown as ChildProcess, "plugin-runtime", "node", ["worker.js"]);
  child.emit("exit", 0, null);

  const summary = tracker.getSummary();
  assert.equal(summary.active, 0);
  assert.equal(summary.zombie, 1);
  assert.equal(summary.byOwner["plugin-runtime"], 0);
});
