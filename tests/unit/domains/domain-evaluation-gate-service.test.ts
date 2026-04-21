import assert from "node:assert/strict";
import test from "node:test";

import type { DomainEvalFramework } from "../../../src/domains/eval-framework/index.js";
import { DomainEvaluationGateService } from "../../../src/domains/eval-framework/domain-evaluation-gate-service.js";

const FRAMEWORK: DomainEvalFramework = {
  frameworkId: "eval_coding",
  domainId: "coding",
  fewShotExamples: [],
  evaluators: [
    { evaluatorId: "tests_pass", metric: "pass_rate", threshold: 0.95, blocking: true },
    { evaluatorId: "latency", metric: "latency_score", threshold: 0.8, blocking: false },
  ],
  onlineMetrics: ["latency_score", "approval_match"],
  releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
};

test("DomainEvaluationGateService promotes suites that satisfy blocking evaluators", () => {
  const service = new DomainEvaluationGateService();
  const report = service.evaluateSuite(FRAMEWORK, {
    suiteId: "suite_pre_release",
    domainId: "coding",
    releaseType: "pre_release",
    executionMode: "supervised",
    storageMode: "sqlite",
    cases: [
      { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" },
      { caseId: "case_2", metric: "latency_score", score: 0.82, expectedClass: "coding" },
    ],
  });

  assert.equal(report.overallPass, true);
  assert.equal(report.releaseDecision, "promote");
  assert.deepEqual(report.blockingFailures, []);
  assert.deepEqual(report.missingOnlineMetrics, ["approval_match"]);
});

test("DomainEvaluationGateService holds release when a blocking evaluator falls below threshold", () => {
  const service = new DomainEvaluationGateService();
  const report = service.evaluateSuite(FRAMEWORK, {
    suiteId: "suite_bad",
    domainId: "coding",
    releaseType: "pre_release",
    executionMode: "supervised",
    storageMode: "sqlite",
    cases: [
      { caseId: "case_1", metric: "pass_rate", score: 0.8, expectedClass: "coding" },
      { caseId: "case_2", metric: "latency_score", score: 0.92, expectedClass: "coding" },
    ],
  });

  assert.equal(report.overallPass, false);
  assert.equal(report.releaseDecision, "hold");
  assert.deepEqual(report.blockingFailures, ["tests_pass"]);
});
