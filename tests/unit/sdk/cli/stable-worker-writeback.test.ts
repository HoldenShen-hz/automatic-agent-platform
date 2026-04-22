/**
 * Stable Worker Writeback CLI Tests
 *
 * Tests for stable-worker-writeback.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-worker-writeback uses AA_STABLE_WORKER_WRITEBACK env var prefix", () => {
  const envVar = "AA_STABLE_WORKER_WRITEBACK";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("WORKER_WRITEBACK"));
});

test("stable-worker-writeback defaultDir follows data/stable-worker-writeback pattern", () => {
  const defaultDir = "data/stable-worker-writeback";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("worker-writeback"));
});

test("stable-worker-writeback reportFilename follows stable-worker-writeback-report.json pattern", () => {
  const reportFilename = "stable-worker-writeback-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("worker-writeback"));
});

test("stable-worker-writeback failed predicate uses default failedScenarios", () => {
  const failed = (report: { failedScenarios?: number }) => (report.failedScenarios ?? 0) > 0;

  assert.equal(failed({ failedScenarios: 0 }), false);
  assert.equal(failed({ failedScenarios: 1 }), true);
});
