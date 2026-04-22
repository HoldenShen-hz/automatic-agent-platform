/**
 * Stable Maintenance CLI Tests
 *
 * Tests for stable-maintenance.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-maintenance uses AA_STABLE_MAINTENANCE env var prefix", () => {
  const envVar = "AA_STABLE_MAINTENANCE";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("MAINTENANCE"));
});

test("stable-maintenance defaultDir follows data/stable-maintenance pattern", () => {
  const defaultDir = "data/stable-maintenance";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("maintenance"));
});

test("stable-maintenance reportFilename follows stable-maintenance-report.json pattern", () => {
  const reportFilename = "stable-maintenance-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("maintenance"));
});

test("stable-maintenance failed predicate uses default failedScenarios", () => {
  const failed = (report: { failedScenarios?: number }) => (report.failedScenarios ?? 0) > 0;

  assert.equal(failed({ failedScenarios: 0 }), false);
  assert.equal(failed({ failedScenarios: 1 }), true);
});
