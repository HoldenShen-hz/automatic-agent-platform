import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const scriptPath = resolve(repoRoot, "scripts/assurance/run-full-assurance.mjs");
const reportPath = resolve(repoRoot, "artifacts/assurance/assurance-full-report.json");
const staticAuditJsonPath = resolve(repoRoot, "artifacts/assurance/static-audit-report.json");
const staticAuditMdPath = resolve(repoRoot, "artifacts/assurance/static-audit-report.md");
const staticAuditJsonlPath = resolve(repoRoot, "artifacts/assurance/static-audit-findings.jsonl");

type AssuranceStep = {
  id: string;
  required: boolean;
  ok?: boolean;
};

type AssuranceReport = {
  status: "pass" | "fail";
  mode: string;
  executedSteps: AssuranceStep[];
  notYetIntegratedAudits: unknown[];
};

test("run-full-assurance emits a report and executes the current required baseline audits", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(existsSync(reportPath), true);
  assert.equal(existsSync(staticAuditJsonPath), true);
  assert.equal(existsSync(staticAuditMdPath), true);
  assert.equal(existsSync(staticAuditJsonlPath), true);

  const payload = JSON.parse(readFileSync(reportPath, "utf8")) as AssuranceReport;
  assert.deepEqual(
    payload.executedSteps.filter((entry: AssuranceStep) => entry.required).map((entry: AssuranceStep) => entry.id),
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
  assert.equal(payload.mode, "full");
  assert.equal(Array.isArray(payload.notYetIntegratedAudits), true);
  assert.equal(payload.notYetIntegratedAudits.length, 0);
  const failedRequiredSteps = payload.executedSteps
    .filter((entry: AssuranceStep) => entry.required && entry.ok !== true)
    .map((entry: AssuranceStep) => entry.id);
  const expectedStatus = failedRequiredSteps.length === 0 ? "pass" : "fail";
  assert.equal(payload.status, expectedStatus);
  assert.equal(result.status, expectedStatus === "pass" ? 0 : 1);

  const staticAuditPayload = JSON.parse(readFileSync(staticAuditJsonPath, "utf8"));
  assert.equal(staticAuditPayload.status, "pass");
  assert.equal(staticAuditPayload.auditCount > 0, true);
  assert.equal(Array.isArray(staticAuditPayload.findings), true);
});
