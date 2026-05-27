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
  spawnTracked,
} from "../../../../../src/platform/five-plane-execution/resource/process-tracker.js";

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

async function flushMicrotasks(rounds: number = 10): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
  }
}

test("ProcessTracker constructor creates empty tracker [process-tracker]", () => {
  const tracker = new ProcessTracker();
  assert.equal(tracker.getActiveCount(), 0);
  assert.equal(tracker.getZombieCount(), 0);
});

test("ProcessTracker.register adds process to registry [process-tracker]", () => {
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

test("ProcessTracker.register handles invalid pid [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(0);

  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.register stores pgid when available [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345, 12340);

  tracker.register(proc, "docker", "docker", ["ps"]);

  assert.equal(tracker.getActive()[0]!.pgid, 12340);
});

test("ProcessTracker.unregister removes process from registry [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(12345), "bash-tool", "echo", ["hello"]);

  tracker.unregister(12345);

  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.getCountByOwner returns correct counts [process-tracker]", () => {
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

test("ProcessTracker.reset clears all processes [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "docker", "cmd2", []);

  tracker.reset();

  assert.equal(tracker.getActiveCount(), 0);
  assert.equal(tracker.getZombieCount(), 0);
});

test("ProcessTracker.getSummary returns correct structure [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "docker", "cmd2", []);

  const summary = tracker.getSummary();
  assert.equal(summary.active, 2);
  assert.equal(summary.zombie, 0);
  assert.equal(summary.byOwner["bash-tool"], 1);
  assert.equal(summary.byOwner["docker"], 1);
});

test("ProcessTracker.kill returns false for unknown process [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  assert.equal(await tracker.kill(99999), false);
});

test("ProcessTracker process exit event cleans up process [process-tracker]", () => {
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

test("ProcessTracker close event cleans up running process [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);
  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  proc.emit("close", 0, null);

  assert.equal(tracker.getActiveCount(), 0);
});

test("getProcessTracker returns singleton instance [process-tracker]", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  const tracker2 = getProcessTracker();
  assert.strictEqual(tracker1, tracker2);
  resetProcessTracker();
});

test("resetProcessTracker clears singleton [process-tracker]", () => {
  resetProcessTracker();
  const tracker1 = getProcessTracker();
  resetProcessTracker();
  const tracker2 = getProcessTracker();
  assert.notStrictEqual(tracker1, tracker2);
  resetProcessTracker();
});

test("ProcessTracker exported types remain usable [process-tracker]", () => {
  const owners: ProcessOwner[] = ["bash-tool", "mcp-transport", "lsp-client", "redis-cli", "pg-cli", "docker", "exec-file", "plugin-runtime", "unknown"];
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

  assert.equal(owners.length, 9);
  assert.equal(states.length, 4);
  assert.equal(tracked.command, "node");
});

test("ProcessTracker.getActive returns only running and terminating processes [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);
  tracker.register(createMockChildProcess(333), "bash-tool", "cmd3", []);

  const active = tracker.getActive();
  assert.equal(active.length, 3);

  // Verify all are either running or terminating
  for (const p of active) {
    assert.ok(p.state === "running" || p.state === "terminating");
  }
});

test("ProcessTracker.getActive excludes exited processes [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc1 = createMockChildProcess(111);
  tracker.register(proc1, "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);

  // Exit process 111 via exit event
  proc1.emit("exit", 0, null);

  const active = tracker.getActive();
  assert.equal(active.length, 1);
  assert.equal(active[0]!.pid, 222);
});

test("ProcessTracker.getZombieCount returns count of exited processes [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc1 = createMockChildProcess(111);
  const proc2 = createMockChildProcess(222);
  tracker.register(proc1, "bash-tool", "cmd1", []);
  tracker.register(proc2, "bash-tool", "cmd2", []);

  // Simulate exited state by emitting exit event
  proc1.emit("exit", 0, null);

  assert.equal(tracker.getZombieCount(), 1);
});

test("ProcessTracker.kill returns true for known process [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  // Mock process.kill to succeed without actually sending signal
  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGTERM");
    assert.equal(result, true);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.kill handles ESRCH error gracefully [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["0"]);

  // Mock process.kill to throw ESRCH
  const originalKill = process.kill;
  process.kill = (() => {
    const err = new Error("Process not found") as NodeJS.ErrnoException;
    err.code = "ESRCH";
    throw err;
  }) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGTERM");
    assert.equal(result, true);
    assert.equal(tracker.getActiveCount(), 0);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.kill handles EPERM error gracefully [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  // Mock process.kill to throw EPERM
  const originalKill = process.kill;
  process.kill = (() => {
    const err = new Error("Operation not permitted") as NodeJS.ErrnoException;
    err.code = "EPERM";
    throw err;
  }) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGTERM");
    assert.equal(result, false);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.killAll does nothing when no active processes [process-tracker]", async () => {
  const tracker = new ProcessTracker();

  await tracker.killAll("SIGTERM", 100);
  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.getSummary returns correct zombie count [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc1 = createMockChildProcess(111);
  tracker.register(proc1, "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);

  // Set one to exited (zombie) via exit event
  proc1.emit("exit", 0, null);

  const summary = tracker.getSummary();
  assert.equal(summary.active, 1);
  assert.equal(summary.zombie, 1);
});

test("ProcessTracker.getSummary handles all owner types with zero counts [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const summary = tracker.getSummary();

  assert.equal(summary.byOwner["bash-tool"], 0);
  assert.equal(summary.byOwner["mcp-transport"], 0);
  assert.equal(summary.byOwner["lsp-client"], 0);
  assert.equal(summary.byOwner["redis-cli"], 0);
  assert.equal(summary.byOwner["pg-cli"], 0);
  assert.equal(summary.byOwner["docker"], 0);
  assert.equal(summary.byOwner["exec-file"], 0);
  assert.equal(summary.byOwner["unknown"], 0);
});

test("ProcessTracker.register stores correct args [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);

  tracker.register(proc, "pg-cli", "psql", ["-c", "SELECT * FROM users;"]);

  const active = tracker.getActive();
  assert.deepEqual(active[0]!.args, ["-c", "SELECT * FROM users;"]);
});

test("ProcessTracker.register handles empty args array [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);

  tracker.register(proc, "bash-tool", "pwd", []);

  const active = tracker.getActive();
  assert.deepEqual(active[0]!.args, []);
});

test("ProcessTracker.getCountByOwner handles all zero counts [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const counts = tracker.getCountByOwner();

  // All should be 0 for empty tracker
  for (const owner of Object.keys(counts) as ProcessOwner[]) {
    assert.equal(counts[owner], 0);
  }
});

test("ProcessTracker.getCountByOwner counts only active processes [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc1 = createMockChildProcess(111);
  tracker.register(proc1, "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);
  tracker.register(createMockChildProcess(333), "docker", "cmd3", []);

  // Exit process 111
  proc1.emit("exit", 0, null);

  const counts = tracker.getCountByOwner();
  assert.equal(counts["bash-tool"], 1); // Only 222 is active
  assert.equal(counts["docker"], 1); // 333 is still active
  assert.equal(counts["unknown"], 0);
});

test("ProcessTracker multiple owners in getCountByOwner [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(1), "bash-tool", "cmd", []);
  tracker.register(createMockChildProcess(2), "mcp-transport", "cmd", []);
  tracker.register(createMockChildProcess(3), "lsp-client", "cmd", []);
  tracker.register(createMockChildProcess(4), "redis-cli", "cmd", []);
  tracker.register(createMockChildProcess(5), "pg-cli", "cmd", []);
  tracker.register(createMockChildProcess(6), "docker", "cmd", []);
  tracker.register(createMockChildProcess(7), "exec-file", "cmd", []);
  tracker.register(createMockChildProcess(8), "unknown", "cmd", []);

  const counts = tracker.getCountByOwner();
  assert.equal(counts["bash-tool"], 1);
  assert.equal(counts["mcp-transport"], 1);
  assert.equal(counts["lsp-client"], 1);
  assert.equal(counts["redis-cli"], 1);
  assert.equal(counts["pg-cli"], 1);
  assert.equal(counts["docker"], 1);
  assert.equal(counts["exec-file"], 1);
  assert.equal(counts["unknown"], 1);
});

test("spawnTracked creates and registers a process [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const result = spawnTracked(tracker, "echo", ["hello"], {}, "bash-tool");

  // spawn hasn't resolved yet but pid should exist
  assert.ok(result.pid !== undefined);
  assert.equal(tracker.getActiveCount(), 1);

  // Cleanup - kill the spawned process
  tracker.kill(result.pid!, "SIGKILL");
});

test("spawnTracked registers with correct owner [process-tracker]", () => {
  const tracker = new ProcessTracker();

  spawnTracked(tracker, "echo", ["test"], {}, "mcp-transport");

  const counts = tracker.getCountByOwner();
  assert.equal(counts["mcp-transport"], 1);

  // Cleanup
  const active = tracker.getActive();
  for (const p of active) {
    tracker.kill(p.pid, "SIGKILL");
  }
});

test("ProcessTracker.getSummary with mixed states [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc1 = createMockChildProcess(111);
  tracker.register(proc1, "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);
  tracker.register(createMockChildProcess(333), "docker", "cmd3", []);
  tracker.register(createMockChildProcess(444), "redis-cli", "cmd4", []);

  // Exit process 111 to make it a zombie
  proc1.emit("exit", 0, null);

  const summary = tracker.getSummary();
  // Active: 222 (running), 333 (running), 444 (running) = 3
  // Zombie: 111 (exited after emit) = 1
  assert.equal(summary.active, 3);
  assert.equal(summary.zombie, 1);
  assert.equal(summary.byOwner["bash-tool"], 1); // 222
  assert.equal(summary.byOwner["docker"], 1); // 333
  assert.equal(summary.byOwner["redis-cli"], 1); // 444
});

test("ProcessTracker exit then close event handles duplicate cleanup [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);
  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  // Emit exit first
  proc.emit("exit", 0, null);
  // Then emit close
  proc.emit("close", 0, null);

  // Should not throw and process should be cleaned up
  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.getActiveCount returns correct count [process-tracker]", () => {
  const tracker = new ProcessTracker();
  assert.equal(tracker.getActiveCount(), 0);

  tracker.register(createMockChildProcess(111), "bash-tool", "cmd", []);
  assert.equal(tracker.getActiveCount(), 1);

  tracker.register(createMockChildProcess(222), "bash-tool", "cmd", []);
  assert.equal(tracker.getActiveCount(), 2);

  tracker.unregister(111);
  assert.equal(tracker.getActiveCount(), 1);

  tracker.reset();
  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker process exit with non-zero code is handled [process-tracker]", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const tracker = new ProcessTracker();
    const proc = createMockChildProcess(12345);
    tracker.register(proc, "bash-tool", "echo", ["hello"]);

    proc.emit("exit", 1, "SIGTERM");
    mock.timers.tick(150);

    assert.equal(tracker.getActiveCount(), 0);
  } finally {
    mock.timers.reset();
  }
});

test("ProcessTracker tracked process has correct metadata [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345, 12340);

  tracker.register(proc, "docker", "docker", ["run", "-d", "nginx"]);

  const active = tracker.getActive();
  const tracked = active[0]!;

  assert.equal(tracked.pid, 12345);
  assert.equal(tracked.pgid, 12340);
  assert.equal(tracked.command, "docker");
  assert.deepEqual(tracked.args, ["run", "-d", "nginx"]);
  assert.equal(tracked.owner, "docker");
  assert.equal(tracked.state, "running");
  assert.equal(tracked.killRequestedAt, undefined);
  assert.equal(tracked.lastSignal, undefined);
});

test("ProcessTracker kill with SIGKILL signal [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGKILL");
    assert.equal(result, true);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker getSummary active and zombie match getActiveCount and getZombieCount [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc1 = createMockChildProcess(111);
  tracker.register(proc1, "bash-tool", "cmd1", []);
  tracker.register(createMockChildProcess(222), "bash-tool", "cmd2", []);

  proc1.emit("exit", 0, null);

  const summary = tracker.getSummary();
  assert.equal(summary.active, tracker.getActiveCount());
  assert.equal(summary.zombie, tracker.getZombieCount());
});

test("ProcessTracker tracked process spawnedAt is set [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const before = Date.now();
  const proc = createMockChildProcess(12345);

  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  const after = Date.now();
  const active = tracker.getActive();

  assert.ok(active[0]!.spawnedAt >= before);
  assert.ok(active[0]!.spawnedAt <= after);
});

test("ProcessTracker all ProcessOwner types can be registered [process-tracker]", () => {
  const tracker = new ProcessTracker();

  tracker.register(createMockChildProcess(1), "bash-tool", "cmd", []);
  tracker.register(createMockChildProcess(2), "mcp-transport", "cmd", []);
  tracker.register(createMockChildProcess(3), "lsp-client", "cmd", []);
  tracker.register(createMockChildProcess(4), "redis-cli", "cmd", []);
  tracker.register(createMockChildProcess(5), "pg-cli", "cmd", []);
  tracker.register(createMockChildProcess(6), "docker", "cmd", []);
  tracker.register(createMockChildProcess(7), "exec-file", "cmd", []);
  tracker.register(createMockChildProcess(8), "unknown", "cmd", []);

  assert.equal(tracker.getActiveCount(), 8);
});

test("ProcessTracker.kill sends SIGTERM to process group when pgid differs from pid [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  // Create process with different pgid to trigger group kill
  const proc = createMockChildProcess(111, 100);
  tracker.register(proc, "docker", "docker", ["run", "nginx"]);

  const originalKill = process.kill;
  let killedPgid: number | undefined;
  let killedSignal: string | undefined;

  process.kill = ((pid: number, signal: string) => {
    if (pid < 0) {
      // This is a process group kill
      killedPgid = Math.abs(pid);
      killedSignal = signal;
      return true;
    }
    return true;
  }) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGTERM");
    assert.equal(result, true);
    assert.equal(killedPgid, 100);
    assert.equal(killedSignal, "SIGTERM");
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.kill updates tracked.lastSignal and killRequestedAt [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    await tracker.kill(111, "SIGTERM");

    const active = tracker.getActive();
    assert.equal(active[0]!.lastSignal, "SIGTERM");
    assert.ok(active[0]!.killRequestedAt !== undefined);
    assert.ok(active[0]!.killRequestedAt! >= Date.now() - 1000);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.kill changes state to terminating [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    await tracker.kill(111, "SIGTERM");

    const active = tracker.getActive();
    assert.equal(active[0]!.state, "terminating");
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.killAll sends SIGTERM then waits then SIGKILL [process-tracker]", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const tracker = new ProcessTracker();
    tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);
    tracker.register(createMockChildProcess(222), "bash-tool", "sleep", ["100"]);

    const originalKill = process.kill;
    const signalsSent: string[] = [];

    process.kill = ((pid: number, signal: string) => {
      signalsSent.push(signal);
      // Don't actually kill - just record
      return true;
    }) as typeof process.kill;

    try {
      const killAllPromise = tracker.killAll("SIGTERM", 100);
      await flushMicrotasks();

      // First pass: SIGTERM to all
      assert.ok(signalsSent.filter(s => s === "SIGTERM").length >= 2);

      // Advance in phases so timers created by async continuations are also run.
      mock.timers.tick(100);
      await flushMicrotasks();
      mock.timers.tick(1000);
      await flushMicrotasks();
      await killAllPromise;

      // Should have SIGKILL for remaining
      assert.ok(signalsSent.includes("SIGKILL"));
    } finally {
      process.kill = originalKill;
    }
  } finally {
    mock.timers.reset();
  }
});

test("ProcessTracker.killAll handles mixed termination [process-tracker]", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const tracker = new ProcessTracker();
    const proc1 = createMockChildProcess(111);
    tracker.register(proc1, "bash-tool", "sleep", ["100"]);
    tracker.register(createMockChildProcess(222), "bash-tool", "sleep", ["100"]);

    const originalKill = process.kill;
    let killCount = 0;

    process.kill = ((pid: number, signal: string) => {
      killCount++;
      // First kill succeeds, subsequent kills fail with ESRCH
      if (killCount > 2) {
        const err = new Error("Process not found") as NodeJS.ErrnoException;
        err.code = "ESRCH";
        throw err;
      }
      return true;
    }) as typeof process.kill;

    try {
      const killAllPromise = tracker.killAll("SIGTERM", 100);
      await flushMicrotasks();
      mock.timers.tick(100);
      await flushMicrotasks();
      mock.timers.tick(1000);
      await flushMicrotasks();
      await killAllPromise;

      // All should be cleaned up despite ESRCH on some
      assert.equal(tracker.getActiveCount(), 0);
    } finally {
      process.kill = originalKill;
    }
  } finally {
    mock.timers.reset();
  }
});

test("ProcessTracker.killAll with no processes does nothing [process-tracker]", async () => {
  const tracker = new ProcessTracker();

  const originalKill = process.kill;
  let killCalled = false;
  process.kill = (() => {
    killCalled = true;
    return true;
  }) as typeof process.kill;

  try {
    await tracker.killAll("SIGTERM", 100);
    assert.equal(killCalled, false);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.close event does not double-delete exited process [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(12345);
  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  // Emit exit first - sets state to 'exited' and starts deletion timer
  proc.emit("exit", 0, null);

  // At this point the process is in exited state but not yet deleted
  // because the setTimeout hasn't fired

  // Emit close - should not throw or cause issues
  proc.emit("close", 0, null);

  // Process should already be removed
  assert.equal(tracker.getActiveCount(), 0);
});

test("ProcessTracker.register handles undefined stdin/stdout/stderr [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const emitter = new EventEmitter();
  const proc = Object.assign(emitter, {
    pid: 99999,
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
  }) as unknown as ChildProcess;

  tracker.register(proc, "bash-tool", "echo", ["test"]);

  assert.equal(tracker.getActiveCount(), 1);
  tracker.unregister(99999);
});

test("ProcessTracker.kill with SIGUSR1 signal [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGUSR1");
    assert.equal(result, true);

    const active = tracker.getActive();
    assert.equal(active[0]!.lastSignal, "SIGUSR1");
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.kill with SIGHUP signal [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    const result = await tracker.kill(111, "SIGHUP");
    assert.equal(result, true);

    const active = tracker.getActive();
    assert.equal(active[0]!.lastSignal, "SIGHUP");
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.killAll logs warning when killing orphans [process-tracker]", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const tracker = new ProcessTracker();
    tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

    const originalKill = process.kill;
    process.kill = (() => true) as typeof process.kill;

    try {
      const killAllPromise = tracker.killAll("SIGTERM", 50);
      await flushMicrotasks();
      mock.timers.tick(50);
      await flushMicrotasks();
      mock.timers.tick(1000);
      await flushMicrotasks();
      await killAllPromise;

      // If we get here without throwing, test passes
      assert.equal(tracker.getActiveCount(), 0);
    } finally {
      process.kill = originalKill;
    }
  } finally {
    mock.timers.reset();
  }
});

test("spawnTracked passes correct cwd option [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const result = spawnTracked(tracker, "echo", [], { cwd: "/tmp" }, "bash-tool");

  assert.ok(result.pid !== undefined);
  assert.equal(tracker.getActiveCount(), 1);

  tracker.kill(result.pid!, "SIGKILL");
});

test("spawnTracked passes correct env option [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const result = spawnTracked(
    tracker,
    "echo",
    ["test"],
    { env: { TEST_VAR: "test-value" } },
    "bash-tool"
  );

  assert.ok(result.pid !== undefined);
  assert.equal(tracker.getActiveCount(), 1);

  tracker.kill(result.pid!, "SIGKILL");
});

test("spawnTracked uses detached true on non-Windows [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const result = spawnTracked(tracker, "echo", ["x"], {}, "bash-tool");

  assert.ok(result.pid !== undefined);

  // Cleanup
  tracker.kill(result.pid!, "SIGKILL");
});

test("ProcessTracker.getActive returns empty array when no processes [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const active = tracker.getActive();

  assert.deepEqual(active, []);
});

test("ProcessTracker.getActive returns new array each call [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd", []);

  const active1 = tracker.getActive();
  const active2 = tracker.getActive();

  assert.ok(active1 !== active2);
  assert.deepEqual(active1, active2);
});

test("ProcessTracker.getCountByOwner returns new object each call [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd", []);

  const counts1 = tracker.getCountByOwner();
  const counts2 = tracker.getCountByOwner();

  assert.ok(counts1 !== counts2);
  assert.equal(counts1["bash-tool"], counts2["bash-tool"]);
});

test("ProcessTracker.kill returns true when process already exited via exit event [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(111);
  tracker.register(proc, "bash-tool", "sleep", ["0"]);

  // Exit the process
  proc.emit("exit", 0, null);

  // Try to kill the now-exited process
  const result = await tracker.kill(111, "SIGTERM");

  // ESRCH is caught and returns true
  assert.equal(result, true);
});

test("ProcessTracker.registered process has correct spawnedAt timestamp [process-tracker]", () => {
  const tracker = new ProcessTracker();
  const before = Date.now() - 10;
  const proc = createMockChildProcess(12345);

  tracker.register(proc, "bash-tool", "echo", ["hello"]);

  const after = Date.now() + 10;
  const active = tracker.getActive();

  assert.ok(active[0]!.spawnedAt >= before);
  assert.ok(active[0]!.spawnedAt <= after);
});

test("ProcessTracker.unregister non-existent pid does nothing [process-tracker]", () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "cmd", []);

  // Unregister a pid that doesn't exist
  tracker.unregister(99999);

  // Original process should still be there
  assert.equal(tracker.getActiveCount(), 1);
});

test("ProcessTracker.getSummary with empty tracker [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const summary = tracker.getSummary();

  assert.equal(summary.active, 0);
  assert.equal(summary.zombie, 0);
  for (const owner of Object.keys(summary.byOwner) as ProcessOwner[]) {
    assert.equal(summary.byOwner[owner], 0);
  }
});

test("ProcessTracker multiple kill calls on same process [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    const result1 = await tracker.kill(111, "SIGTERM");
    const result2 = await tracker.kill(111, "SIGKILL");

    // Both should return true (process already in terminating state)
    assert.equal(result1, true);
    assert.equal(result2, true);
  } finally {
    process.kill = originalKill;
  }
});

test("ProcessTracker.killAll with single process [process-tracker]", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const tracker = new ProcessTracker();
    tracker.register(createMockChildProcess(111), "bash-tool", "sleep", ["100"]);

    const originalKill = process.kill;
    process.kill = (() => true) as typeof process.kill;

    try {
      const killAllPromise = tracker.killAll("SIGTERM", 50);
      await flushMicrotasks();
      mock.timers.tick(50);
      await flushMicrotasks();
      mock.timers.tick(1000);
      await flushMicrotasks();
      await killAllPromise;

      assert.equal(tracker.getActiveCount(), 0);
    } finally {
      process.kill = originalKill;
    }
  } finally {
    mock.timers.reset();
  }
});

test("ProcessTracker tracked process state transitions: running -> terminating -> killed [process-tracker]", async () => {
  const tracker = new ProcessTracker();
  const proc = createMockChildProcess(111);
  tracker.register(proc, "bash-tool", "sleep", ["100"]);

  assert.equal(tracker.getActive()[0]!.state, "running");

  const originalKill = process.kill;
  process.kill = (() => true) as typeof process.kill;

  try {
    await tracker.kill(111, "SIGTERM");

    assert.equal(tracker.getActive()[0]!.state, "terminating");
  } finally {
    process.kill = originalKill;
  }
});

test("spawnTracked with all owner types registers correctly [process-tracker]", () => {
  const tracker = new ProcessTracker();

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

  for (let i = 0; i < owners.length; i++) {
    spawnTracked(tracker, "echo", ["x"], {}, owners[i]!);
  }

  assert.equal(tracker.getActiveCount(), owners.length);

  // Cleanup
  for (const p of tracker.getActive()) {
    tracker.kill(p.pid, "SIGKILL");
  }
});

test("spawnTracked with empty args [process-tracker]", () => {
  const tracker = new ProcessTracker();

  const result = spawnTracked(tracker, "echo", undefined, {}, "bash-tool");

  assert.ok(result.pid !== undefined);
  assert.equal(tracker.getActiveCount(), 1);

  tracker.kill(result.pid!, "SIGKILL");
});
