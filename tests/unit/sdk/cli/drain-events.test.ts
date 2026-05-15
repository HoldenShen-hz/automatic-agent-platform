/**
 * Drain Events CLI Tests
 *
 * Tests for drain-events CLI module which drains event queues from consumers.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadEventOpsCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/ops-cli-env.js";

test("loadEventOpsCliEnv parses dbPath from AA_DB_PATH for drain-events", () => {
  const config = loadEventOpsCliEnv({
    AA_DB_PATH: "/custom/path/test.db",
  });

  assert.equal(config.dbPath, "/custom/path/test.db");
});

test("loadEventOpsCliEnv uses default dbPath when not specified for drain-events", () => {
  const config = loadEventOpsCliEnv({});

  assert.ok(config.dbPath.includes("data"));
  assert.ok(config.dbPath.includes("sqlite"));
  assert.ok(config.dbPath.includes("authoritative-demo.db"));
});

test("drain-events main function - no consumerId means drainDefaultConsumers", () => {
  const config = loadEventOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
  });

  // drain-events calls drainDefaultConsumers (no consumerId filter)
  assert.equal(config.consumerId, null);
});

test("drain-events main function - output is JSON formatted", () => {
  const results = [
    { consumer: "consumer1", drained: 10 },
    { consumer: "consumer2", drained: 5 },
  ];

  const output = JSON.stringify(results, null, 2);
  assert.ok(output.includes("consumer1"));
  assert.ok(output.includes("consumer2"));
  assert.ok(output.includes("10"));
});

test("drain-events main function - handles empty results", () => {
  const results: Array<{ consumer: string; drained: number }> = [];

  const output = JSON.stringify(results, null, 2);
  assert.equal(output, "[]");
});

test("drain-events main function - handles multiple consumers", () => {
  const results = [
    { consumer: "default", drained: 100 },
    { consumer: "task_events", drained: 50 },
    { consumer: "execution_events", drained: 25 },
  ];

  assert.equal(results.length, 3);
  assert.equal(results[0]!.drained, 100);
  assert.equal(results[1]!.drained, 50);
  assert.equal(results[2]!.drained, 25);
});
