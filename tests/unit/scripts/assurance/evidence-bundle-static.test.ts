import assert from "node:assert/strict";
import test from "node:test";

import { INCLUDED } from "../../../../scripts/assurance/create-release-evidence-bundle.mjs";

test("release evidence bundle keeps the methodology-required report manifest", () => {
  assert.deepEqual(INCLUDED, [
    "artifacts/release/rc-check-report.json",
    "artifacts/assurance/audit-coverage-scorecard.json",
    "artifacts/assurance/invariant-test-report.json",
    "artifacts/assurance/chaos-test-report.json",
    "artifacts/assurance/audit-tool-test-report.json",
    "artifacts/assurance/eval-oracle-report.json",
    "artifacts/assurance/redteam-report.json",
    "artifacts/assurance/golden-replay-report.json",
    "artifacts/assurance/review-ledger.normalized.jsonl",
    "artifacts/assurance/review-evidence-readiness-report.json",
    "artifacts/assurance/historical-promises.jsonl",
    "artifacts/assurance/assumptions.jsonl",
    "artifacts/assurance/issues.deduped.jsonl",
    "artifacts/assurance/test-to-issue-map.json",
    "artifacts/assurance/issue-to-test-map.json",
    "artifacts/assurance/test-coverage-report.json",
    "artifacts/assurance/historical-issue-regression-map.json",
    "artifacts/assurance/completeness-coverage-matrix.json",
    "artifacts/assurance/seeded-defect-report.json",
    "artifacts/assurance/assurance-full-report.json",
  ]);
});
