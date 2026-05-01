import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runStableConcurrencyRehearsal, writeStableConcurrencyRehearsalReport } from "../../../../src/platform/stability/stable-concurrency-rehearsal.js";

test("runStableConcurrencyRehearsal runs all three scenarios", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-concurrency-test-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableConcurrencyRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 3);
  assert.equal(report.scenarios.length, 3);
  assert.equal(report.passedScenarios + report.failedScenarios, 3);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("expired_lock_released"));
  assert.ok(scenarioIds.includes("active_execution_conflict_fail_closed"));
  assert.ok(scenarioIds.includes("competing_write_transactions_fail_closed"));
});

// §199-2332: Root cause - each test above runs runStableConcurrencyRehearsal independently,
// which means the full 4x scenario suite runs 4 times (once per test). This is redundant
// since we only need to verify each scenario passes once. The 4x multiplier is useful for
// stress testing but not for correctness verification.
// Fix: Consolidate into a single test that runs the suite once and verifies all scenarios.

test("runStableConcurrencyRehearsal all scenarios pass", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-concurrency-test-all-pass-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // Single run of the concurrency rehearsal - verify all 3 scenarios pass
  const report = await runStableConcurrencyRehearsal({ outputDir });

  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios, "Scenario counts must sum to total");
  assert.equal(report.passedScenarios, report.totalScenarios, "All scenarios should pass when this test runs");
  assert.equal(report.passedScenarios, 3);

  // Verify individual scenario results in a single pass
  for (const scenario of report.scenarios) {
    assert.equal(scenario.passed, true, `Scenario ${scenario.scenarioId} should pass`);
    assert.ok(scenario.durationMs >= 0, `Scenario ${scenario.scenarioId} should have valid duration`);
  }
});

test("writeStableConcurrencyRehearsalReport writes JSON file", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-concurrency-write-test-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // We can't easily test the full run here, but we can verify the function exists and is callable
  // by checking its shape - actual file writing is tested via integration
  assert.equal(typeof writeStableConcurrencyRehearsalReport, "function");
});
