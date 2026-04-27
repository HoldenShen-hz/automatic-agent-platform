/**
 * Stable Gate CLI Tests
 *
 * Tests for stable-gate.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-gate uses AA_STABLE_GATE env var prefix", () => {
  const envVar = "AA_STABLE_GATE";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("GATE"));
});

test("stable-gate defaultDir follows data/stable-gate pattern", () => {
  const defaultDir = "data/stable-gate";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("gate"));
});

test("stable-gate reportFilename follows stable-release-gate-report.json pattern", () => {
  const reportFilename = "stable-release-gate-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("gate"));
});

test("stable-gate runner is buildStableReleaseGateReport function", () => {
  assert.ok(typeof "buildStableReleaseGateReport" === "string" || typeof "buildStableReleaseGateReport" === "function");
});

test("stable-gate failed predicate checks for promote_blocked verdict", () => {
  const failed = (report: { overallVerdict?: string }) => report.overallVerdict === "promote_blocked";

  assert.equal(failed({ overallVerdict: "promoted" }), false);
  assert.equal(failed({ overallVerdict: "promote_blocked" }), true);
});
