import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableWorkerHandshakeRehearsal, writeStableWorkerHandshakeRehearsalReport } from "../../../../src/platform/stability/stable-worker-handshake-rehearsal.js";

test("runStableWorkerHandshakeRehearsal runs all three scenarios", async () => {
  const outputDir = "/tmp/stable-worker-handshake-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerHandshakeRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 3);
  assert.equal(report.scenarios.length, 3);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("worker_claim_consumes_ticket"));
  assert.ok(scenarioIds.includes("worker_heartbeat_renews_lease"));
  assert.ok(scenarioIds.includes("stale_fencing_handshake_rejected"));
});

test("runStableWorkerHandshakeRehearsal worker_claim_consumes_ticket scenario passes", async () => {
  const outputDir = "/tmp/stable-worker-handshake-test-claim";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerHandshakeRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "worker_claim_consumes_ticket");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableWorkerHandshakeRehearsal worker_heartbeat_renews_lease scenario passes", async () => {
  const outputDir = "/tmp/stable-worker-handshake-test-heartbeat";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerHandshakeRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "worker_heartbeat_renews_lease");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableWorkerHandshakeRehearsal stale_fencing_handshake_rejected scenario passes", async () => {
  const outputDir = "/tmp/stable-worker-handshake-test-stale";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerHandshakeRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "stale_fencing_handshake_rejected");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("writeStableWorkerHandshakeRehearsalReport is callable", () => {
  assert.equal(typeof writeStableWorkerHandshakeRehearsalReport, "function");
});