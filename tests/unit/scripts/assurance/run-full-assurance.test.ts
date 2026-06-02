import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = "/Users/holden/Project/automatic_agent/automatic_agent_platform/scripts/assurance/run-full-assurance.mjs";
const reportPath = "/Users/holden/Project/automatic_agent/automatic_agent_platform/artifacts/assurance/assurance-full-report.json";

test("run-full-assurance emits a report and executes the current required baseline audits", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: "/Users/holden/Project/automatic_agent/automatic_agent_platform",
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0);
  assert.equal(existsSync(reportPath), true);

  const payload = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(payload.status, "pass");
  assert.deepEqual(
    payload.executedSteps.filter((entry) => entry.required).map((entry) => entry.id),
    [
      "inventory",
      "review_import",
      "public_entrypoints",
      "historical_promises",
      "leadership_claims",
      "docs_sync",
      "issue_ledger",
      "coverage_scorecard",
    ],
  );
  assert.equal(payload.mode, "full");
  assert.equal(Array.isArray(payload.notYetIntegratedAudits), true);
  assert.equal(payload.notYetIntegratedAudits.length, 0);
});
