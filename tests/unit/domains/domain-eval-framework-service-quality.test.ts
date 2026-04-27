import assert from "node:assert/strict";
import test from "node:test";

import { DomainEvalFrameworkService } from "../../../src/domains/domain-eval-framework-service.js";

test("DomainEvalFrameworkService assessQuality throws for missing domain", () => {
  const service = new DomainEvalFrameworkService();

  assert.throws(
    () => service.assessQuality("nonexistent_domain", { accuracy: 0.9 }),
    /domain_eval\.framework_not_found/,
  );
});

test("DomainEvalFrameworkService assessQuality calculates overall score correctly", () => {
  const service = new DomainEvalFrameworkService();
  const framework = {
    frameworkId: "fw_test",
    domainId: "test_domain",
    fewShotExamples: ["example1", "example2", "example3", "example4", "example5"],
    evaluators: [
      { evaluatorId: "eval_accuracy", metric: "accuracy", threshold: 0.85, blocking: true },
    ],
    onlineMetrics: ["accuracy"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  service.register(framework);

  const result = service.assessQuality("test_domain", { accuracy: 0.95 });

  assert.ok(result.assessmentId);
  assert.equal(result.domainId, "test_domain");
  assert.equal(result.frameworkId, "fw_test");
  assert.ok(result.overallScore >= 0);
  assert.equal(typeof result.overallPassed, "boolean");
});

test("DomainEvalFrameworkService assessQuality reports failure when below threshold", () => {
  const service = new DomainEvalFrameworkService();
  const framework = {
    frameworkId: "fw_test_low",
    domainId: "test_domain_low",
    fewShotExamples: ["example1", "example2", "example3", "example4", "example5"],
    evaluators: [
      { evaluatorId: "eval_accuracy", metric: "accuracy", threshold: 0.95, blocking: true },
    ],
    onlineMetrics: ["accuracy"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  service.register(framework);

  const result = service.assessQuality("test_domain_low", { accuracy: 0.80 });

  assert.equal(result.overallPassed, false);
});

test("DomainEvalFrameworkService assessQuality includes axis results for evaluators", () => {
  const service = new DomainEvalFrameworkService();
  const framework = {
    frameworkId: "fw_multi",
    domainId: "test_multi",
    fewShotExamples: ["example1", "example2", "example3", "example4", "example5"],
    evaluators: [
      { evaluatorId: "eval_accuracy", metric: "accuracy", threshold: 0.85, blocking: true },
      { evaluatorId: "eval_latency", metric: "latency", threshold: 0.90, blocking: false },
    ],
    onlineMetrics: ["accuracy", "latency"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  service.register(framework);

  const result = service.assessQuality("test_multi", { accuracy: 0.95, latency: 0.85 });

  assert.ok(result.axisResults.length >= 2);

  const accuracyResult = result.axisResults.find((r) => r.name === "accuracy");
  const latencyResult = result.axisResults.find((r) => r.name === "latency");

  assert.ok(accuracyResult, "should have accuracy axis result");
  assert.ok(latencyResult, "should have latency axis result");
  assert.equal(accuracyResult?.passed, true);
  assert.equal(latencyResult?.passed, false); // 0.85 < 0.90 threshold
});

test("DomainEvalFrameworkService assessQuality evaluator results show blocking status via overallPassed", () => {
  const service = new DomainEvalFrameworkService();
  const framework = {
    frameworkId: "fw_blocking",
    domainId: "test_blocking",
    fewShotExamples: ["example1", "example2", "example3", "example4", "example5"],
    evaluators: [
      { evaluatorId: "eval_blocking", metric: "accuracy", threshold: 0.85, blocking: true },
      { evaluatorId: "eval_non_blocking", metric: "latency", threshold: 0.90, blocking: false },
    ],
    onlineMetrics: ["accuracy", "latency"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  service.register(framework);

  // When blocking evaluator fails, overallPassed should be false
  const result = service.assessQuality("test_blocking", { accuracy: 0.80, latency: 0.85 });

  assert.equal(result.overallPassed, false);

  const blockingResult = result.axisResults.find((r) => r.name === "accuracy");
  const nonBlockingResult = result.axisResults.find((r) => r.name === "latency");

  assert.ok(blockingResult);
  assert.ok(nonBlockingResult);
  assert.equal(blockingResult.passed, false); // 0.80 < 0.85 threshold
  assert.equal(nonBlockingResult.passed, false); // 0.85 < 0.90 threshold
});

test("DomainEvalFrameworkService assessQuality passes when all blocking evaluators pass", () => {
  const service = new DomainEvalFrameworkService();
  const framework = {
    frameworkId: "fw_pass",
    domainId: "test_pass",
    fewShotExamples: ["example1", "example2", "example3", "example4", "example5"],
    evaluators: [
      { evaluatorId: "eval_blocking", metric: "accuracy", threshold: 0.85, blocking: true },
      { evaluatorId: "eval_non_blocking", metric: "latency", threshold: 0.90, blocking: false },
    ],
    onlineMetrics: ["accuracy", "latency"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  service.register(framework);

  // When blocking evaluator passes, overallPassed should be true even if non-blocking fails
  const result = service.assessQuality("test_pass", { accuracy: 0.90, latency: 0.80 });

  assert.equal(result.overallPassed, true);
});
