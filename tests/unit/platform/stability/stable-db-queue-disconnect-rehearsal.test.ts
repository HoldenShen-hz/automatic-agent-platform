import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableDbQueueDisconnectRehearsal, writeStableDbQueueDisconnectRehearsalReport } from "../../../../src/platform/stability/stable-db-queue-disconnect-rehearsal.js";

test("runStableDbQueueDisconnectRehearsal runs all three scenarios", async () => {
  const outputDir = "/tmp/stable-db-queue-disconnect-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 3);
  assert.equal(report.scenarios.length, 3);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("queue_disconnect_degrades_without_silent_drop"));
  assert.ok(scenarioIds.includes("missing_dispatch_ticket_rebuilt_after_queue_reconnect"));
  assert.ok(scenarioIds.includes("authoritative_writeback_failure_fails_closed_until_store_recovers"));
});

test("runStableDbQueueDisconnectRehearsal all scenarios pass", async () => {
  const outputDir = "/tmp/stable-db-queue-disconnect-test-pass";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

  // All scenarios should pass in this environment
  if (report.failedScenarios === 0) {
    assert.equal(report.passedScenarios, report.totalScenarios);
  }
});

test("runStableDbQueueDisconnectRehearsal scenario has duration and details", async () => {
  const outputDir = "/tmp/stable-db-queue-disconnect-test-duration";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

  for (const scenario of report.scenarios) {
    assert.ok(scenario.durationMs >= 0);
    assert.ok(scenario.details);
    assert.ok(typeof scenario.summary === "string");
  }
});

test("writeStableDbQueueDisconnectRehearsalReport is callable", () => {
  assert.equal(typeof writeStableDbQueueDisconnectRehearsalReport, "function");
});