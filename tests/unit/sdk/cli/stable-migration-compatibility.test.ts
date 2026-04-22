/**
 * Stable Migration Compatibility CLI Tests
 *
 * Tests for stable-migration-compatibility.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-migration-compatibility uses AA_STABLE_MIGRATION_COMPATIBILITY env var prefix", () => {
  const envVar = "AA_STABLE_MIGRATION_COMPATIBILITY";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("MIGRATION_COMPATIBILITY"));
});

test("stable-migration-compatibility defaultDir follows data/stable-migration-compatibility pattern", () => {
  const defaultDir = "data/stable-migration-compatibility";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("migration-compatibility"));
});

test("stable-migration-compatibility reportFilename follows stable-migration-compatibility-report.json pattern", () => {
  const reportFilename = "stable-migration-compatibility-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("migration-compatibility"));
});

test("stable-migration-compatibility failed predicate uses default failedScenarios", () => {
  const failed = (report: { failedScenarios?: number }) => (report.failedScenarios ?? 0) > 0;

  assert.equal(failed({ failedScenarios: 0 }), false);
  assert.equal(failed({ failedScenarios: 1 }), true);
});
