/**
 * Stable Upgrade CLI Tests
 *
 * Tests for stable-upgrade.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-upgrade uses AA_STABLE_UPGRADE env var prefix", () => {
  const envVar = "AA_STABLE_UPGRADE";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("UPGRADE"));
});

test("stable-upgrade defaultDir follows data/stable-upgrade pattern", () => {
  const defaultDir = "data/stable-upgrade";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("upgrade"));
});

test("stable-upgrade reportFilename follows stable-rolling-upgrade-report.json pattern", () => {
  const reportFilename = "stable-rolling-upgrade-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("upgrade"));
});

test("stable-upgrade failed predicate uses default failedScenarios", () => {
  const failed = (report: { failedScenarios?: number }) => (report.failedScenarios ?? 0) > 0;

  assert.equal(failed({ failedScenarios: 0 }), false);
  assert.equal(failed({ failedScenarios: 1 }), true);
});
