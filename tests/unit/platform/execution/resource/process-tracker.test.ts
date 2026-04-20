import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import test, { mock } from "node:test";

import {
  ProcessTracker,
  type ProcessOwner,
  type TrackedProcess,
  type TrackedProcessState,
  getProcessTracker,
  resetProcessTracker,
} from "../../../../../src/platform/execution/resource/process-tracker.js";

function createMockChildProcess(pid: number, pgid?: number): ChildProcess {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    pid,
    pgid,
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    stdio: undefined,
    killed: false,
    exitCode: undefined,
    signalCode: undefined,
    channel: undefined,
    spawnfile: "",
    spawnargs: [],
  }) as unknown as ChildProcess;
}

test("ProcessTracker constructor creates empty tracker", () => {
  const tracker = new ProcessTracker();
  assert.equal(tracker.getActiveCount(), 0);
  assert.equal(tracker.getZombieCount(), 0);
});

test("ProcessTracker.register adds process to registry", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);

  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  assert.equal(tracker.getActiveCount(), 1);
  const active = tracker.getActive();
  assert.equal(active.length, 1);
  assert.equal(active[0]!.pid, 12345);
  assert.equal(active[0]!.command, "echo");
  assert.equal(active[0]!.owner, "bash-tool");
  assert.equal(active[0]!.state, "running");
});

test("ProcessTracker.register handles invalid pid", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(0);

  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.register stores pgid when available", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345, 12340);

  tracker.register(proc, "docker", "docker", ["ps"]);

  assert.equal(tracker.getActive()[0]!.pgid, 12340);
});

test("ProcessTracker.unregister removes process from registry", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(12345), "bash-tool", "echo", ["hello"]);

  tracker.unregister(12345);

  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.getCountByOwner returns correct counts", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);
  tracker.register(createMockChildProcess(333), "docker", "cmd3", []);
  tracker.register(createMockChildProcess(444), "redis-cli", "cmd4", []);

  const counts = tracker.getCountByOwner();
  assert.equal(counts["bash-tool"], 2);
  assert.equal(counts["docker"], 1);
  assert.equal(counts["redis-cli"], 1);
  assert.equal(counts["mcp-transport"], 0);
});

test("ProcessTracker.reset clears all processes", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "docker", "cmd2", []);

  tracker.reset();

  assert.equal(tracker.getActiveCount(), 0);
  assert.equal(tracker.getZombieCount(), 0);
});

test("ProcessTracker.getSummary returns correct structure", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "docker", "cmd2", []);

  const summary = tracker.getSummary();
  assert.equal(summary.active, 2);
  assert.equal(summary.zombie, 0);
  assert.equal(summary.byOwner["bash-tool"], 1);
  assert.equal(summary.byOwner["docker"], 1);
});

test("ProcessTracker.kill returns false for unknown process", async () => {
  const tracker = new ProcessTracker();
  assert.equal(await tracker.kill(99999), false);
});

test("ProcessTracker process exit event cleans up process", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const tracker = new ProcessTracker();
    const proc = createMockChildProcess(12345);
    tracker.register(proc, "bash-tool", "echo", ["hello"]);

    proc.emit("exit", 0, null);
    mock.timers.tick(150);

    assert.equal(tracker.getActiveCount(), 0);
  } finally {
    mock.timers.reset();
  }
});

test("ProcessTracker close event cleans up running process", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);
  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  proc.emit("close", 0, null);

  assert.equal(tracker.getActiveCount(), 0);
});

test("getProcessTracker returns singleton instance", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  const tracker2 = getProcessTracker();
  assert.strictEqual(tracker1, tracker2);
  resetProcessTracker();
});

test("resetProcessTracker clears singleton", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  resetProcessTracker();
  const tracker2 = getProcessTracker();
  assert.notStrictEqual(tracker1, tracker2);
  resetProcessTracker();
});

test("ProcessTracker exported types remain usable", () => {
  const owners: ProcessOwner[] = ["bash-tool", "mcp-transport", "lsp-client", "redis-cli", "pg-cli", "docker", "exec-file", "unknown"];
  const states: TrackedProcessState[] = ["running", "terminating", "killed", "exited"];
  const tracked: TrackedProcess = {
    pid: 1,
    command: "node",
    args: ["--version"],
    spawnedAt: 0,
    owner: owners[0]!,
    pgid: undefined,
    state: states[0]!,
    killRequestedAt: undefined,
    lastSignal: undefined,
  };

  assert.equal(owners.length, 8);
  assert.equal(states.length, 4);
  assert.equal(tracked.command, "node");
});
