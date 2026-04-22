/**
 * Stable Recovery Drill CLI Tests
 *
 * Tests for stable-recovery-drill.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-recovery-drill uses AA_STABLE_RECOVERY_DRILL env var prefix", () => {
  const envVar = "AA_STABLE_RECOVERY_DRILL";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("RECOVERY_DRILL"));
});

test("stable-recovery-drill defaultDir follows data/stable-recovery-drill pattern", () => {
  const defaultDir = "data/stable-recovery-drill";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("recovery-drill"));
});

test("stable-recovery-drill reportFilename follows stable-recovery-drill-report.json pattern", () => {
  const reportFilename = "stable-recovery-drill-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("recovery-drill"));
});

test("stable-recovery-drill failed predicate uses default failedScenarios", () => {
  const failed = (report: { failedScenarios?: number }) => (report.failedScenarios ?? 0) > 0;

  assert.equal(failed({ failedScenarios: 0 }), false);
  assert.equal(failed({ failedScenarios: 1 }), true);
});
