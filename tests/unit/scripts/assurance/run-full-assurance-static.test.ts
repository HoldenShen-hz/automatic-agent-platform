import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssuranceFullReport,
  notYetIntegratedAudits,
  steps,
} from "../../../../scripts/assurance/run-full-assurance.mjs";

test("run-full-assurance keeps the methodology-required baseline steps wired", () => {
  assert.deepEqual(
    steps.filter((entry) => entry.required).map((entry) => entry.id),
    [
      "inventory",
      "review_import",
      "public_entrypoints",
      "historical_promises",
      "assumptions",
      "leadership_claims",
      "docs_sync",
      "static_audit",
      "eval_oracle_pipeline",
      "issue_ledger",
      "test_to_issue",
      "historical_regression_map",
      "assurance_verify_test_coverage",
      "completeness_matrix",
      "coverage_scorecard",
    ],
  );

  assert.equal(
    steps.find((entry) => entry.id === "review_import")?.command,
    "npm",
  );
  assert.deepEqual(
    steps.find((entry) => entry.id === "review_import")?.args,
    ["run", "assurance:review-import:check"],
  );
  assert.deepEqual(notYetIntegratedAudits, []);
});

test("run-full-assurance report builder fail-closes on failed required steps", () => {
  const report = buildAssuranceFullReport([
    { id: "inventory", required: true, ok: true },
    { id: "review_import", required: true, ok: false },
    { id: "fix_verification", required: false, ok: false },
  ]);

  assert.equal(report.mode, "full");
  assert.equal(report.status, "fail");
  assert.equal(Array.isArray(report.executedSteps), true);
  assert.equal(report.notYetIntegratedAudits.length, 0);
});
