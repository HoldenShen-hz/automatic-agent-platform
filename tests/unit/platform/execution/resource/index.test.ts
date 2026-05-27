import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for resource module
import type {
  ProcessOwner,
  TrackedProcessState,
  TrackedProcess,
} from "../../../../../src/platform/five-plane-execution/resource/index.js";

test("ProcessOwner type accepts valid values [index]", () => {
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

test("TrackedProcessState type accepts valid values [index]", () => {
  const states: TrackedProcessState[] = ["running", "terminating", "killed", "exited"];
  assert.equal(states.length, 4);
});

test("TrackedProcess structure is correct [index]", () => {
  const process: TrackedProcess = {
    pid: 1234,
    command: "node server.js",
    args: ["server.js"],
    spawnedAt: Date.now(),
    owner: "bash-tool",
    pgid: undefined,
    state: "running",
    killRequestedAt: undefined,
    lastSignal: undefined,
  };
  assert.equal(process.pid, 1234);
  assert.equal(process.owner, "bash-tool");
  assert.equal(process.state, "running");
  assert.equal(process.spawnedAt, process.spawnedAt);
  assert.equal(process.pgid, undefined);
});

test("TrackedProcess with pgid [index]", () => {
  const process: TrackedProcess = {
    pid: 5678,
    command: "docker",
    args: ["run", "-d", "nginx"],
    spawnedAt: Date.now(),
    owner: "docker",
    pgid: 5678,
    state: "running",
    killRequestedAt: undefined,
    lastSignal: undefined,
  };
  assert.equal(process.pid, 5678);
  assert.equal(process.pgid, 5678);
});

test("TrackedProcess in exited state [index]", () => {
  const process: TrackedProcess = {
    pid: 9999,
    command: "exit",
    args: ["0"],
    spawnedAt: Date.now() - 1000,
    owner: "bash-tool",
    pgid: undefined,
    state: "exited",
    killRequestedAt: undefined,
    lastSignal: undefined,
  };
  assert.equal(process.state, "exited");
});

test("TrackedProcess with kill requested [index]", () => {
  const now = Date.now();
  const process: TrackedProcess = {
    pid: 1111,
    command: "sleep",
    args: ["100"],
    spawnedAt: now - 5000,
    owner: "bash-tool",
    pgid: undefined,
    state: "terminating",
    killRequestedAt: now,
    lastSignal: "SIGTERM",
  };
  assert.equal(process.state, "terminating");
  assert.equal(process.killRequestedAt, now);
  assert.equal(process.lastSignal, "SIGTERM");
});
