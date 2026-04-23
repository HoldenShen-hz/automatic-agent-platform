import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { DomainEvalFrameworkService } from "../../../../src/domains/domain-eval-framework-service.js";
import type { DomainEvalFramework, DomainEvaluator } from "../../../../src/domains/eval-framework/index.js";

test("integration: DomainEvalFrameworkService registers framework and assesses quality", () => {
  const service = new DomainEvalFrameworkService();

  const framework: DomainEvalFramework = {
    frameworkId: newId("fw"),
    domainId: "eval-domain",
    fewShotExamples: ["example1", "example2"],
    evaluators: [
      {
        evaluatorId: "eval1",
        metric: "accuracy",
        threshold: 0.85,
        blocking: true,
      },
      {
        evaluatorId: "eval2",
        metric: "latency_ms",
        threshold: 0.90,
        blocking: false,
      },
    ],
    onlineMetrics: ["throughput", "error_rate"],
    releaseGates: {
      minFewShotCount: 5,
      minRegressionCaseCount: 20,
      requirePromptInjectionCoverage: true,
    },
  };

  service.register(framework);

  const retrieved = service.getFramework("eval-domain");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.frameworkId, framework.frameworkId);

  const assessment = service.assessQuality("eval-domain", {
    accuracy: 0.88,
    latency_ms: 0.92,
  });

  assert.equal(assessment.frameworkId, framework.frameworkId);
  assert.equal(assessment.domainId, "eval-domain");
  assert.equal(assessment.overallPassed, true);
  assert.equal(assessment.axisResults.length >= 2, true);
});

test("integration: DomainEvalFrameworkService manages quality axes", () => {
  const service = new DomainEvalFrameworkService();

  service.registerQualityAxis("axis-domain", {
    axisId: "axis1",
    name: "precision",
    description: "Model precision score",
    weight: 0.4,
    unit: "percentage",
    targetValue: 0.90,
    criticalThreshold: 0.85,
  });

  service.registerQualityAxis("axis-domain", {
    axisId: "axis2",
    name: "recall",
    description: "Model recall score",
    weight: 0.6,
    unit: "percentage",
    targetValue: 0.85,
  });

  const axes = service.getQualityAxes("axis-domain");
  assert.equal(axes.length, 2);
  assert.equal(axes[0]!.axisId, "axis1");
  assert.equal(axes[1]!.axisId, "axis2");
});

test("integration: DomainEvalFrameworkService manages automated checks", () => {
  const service = new DomainEvalFrameworkService();

  service.registerAutomatedCheck("check-domain", {
    checkId: "check1",
    name: "Runtime Check",
    metric: "runtime_ms",
    threshold: 100,
    enabled: true,
    executionMode: "realtime",
  });

  const checks = service.getAutomatedChecks("check-domain");
  assert.equal(checks.length, 1);
  assert.equal(checks[0]!.name, "Runtime Check");
});

test("integration: DomainEvalFrameworkService manages human rubrics", () => {
  const service = new DomainEvalFrameworkService();

  service.registerRubric("rubric-domain", {
    rubricId: "rubric1",
    name: "Code Review Rubric",
    version: "1.0.0",
    criteria: [
      {
        criterionId: "c1",
        name: "Correctness",
        description: "Code produces correct results",
        scoreRange: { min: 1, max: 5 },
        weight: 0.5,
      },
      {
        criterionId: "c2",
        name: "Readability",
        description: "Code is well-documented",
        scoreRange: { min: 1, max: 5 },
        weight: 0.5,
      },
    ],
    instructions: "Evaluate code quality",
  });

  service.registerRubric("rubric-domain", {
    rubricId: "rubric2",
    name: "Code Review Rubric",
    version: "1.1.0",
    criteria: [
      {
        criterionId: "c1",
        name: "Correctness",
        description: "Code produces correct results",
        scoreRange: { min: 1, max: 5 },
        weight: 0.4,
      },
      {
        criterionId: "c2",
        name: "Readability",
        description: "Code is well-documented",
        scoreRange: { min: 1, max: 5 },
        weight: 0.3,
      },
      {
        criterionId: "c3",
        name: "Performance",
        description: "Code is efficient",
        scoreRange: { min: 1, max: 5 },
        weight: 0.3,
      },
    ],
    instructions: "Evaluate code quality v1.1",
  });

  const rubrics = service.getRubrics("rubric-domain");
  assert.equal(rubrics.length, 2);

  const latest = service.getLatestRubric("rubric-domain");
  assert.notEqual(latest, null);
  assert.equal(latest!.version, "1.1.0");
});

test("integration: DomainEvalFrameworkService manages regression datasets", () => {
  const service = new DomainEvalFrameworkService();

  const dataset = service.createRegressionDataset("reg-domain", "Test Dataset", [
    {
      caseId: "case1",
      name: "Happy Path",
      domainId: "reg-domain",
      input: { task: "test" },
      expectedOutput: { result: "success" },
      expectedClass: "pass",
      metadata: {},
    },
    {
      caseId: "case2",
      name: "Edge Case",
      domainId: "reg-domain",
      input: { task: "edge" },
      expectedOutput: { result: "success" },
      expectedClass: "pass",
      metadata: {},
    },
  ]);

  assert.equal(dataset.datasetId.startsWith("regression_dataset_"), true);
  assert.equal(dataset.cases.length, 2);

  const added = service.addRegressionCase(dataset.datasetId, {
    caseId: "case3",
    name: "Error Case",
    domainId: "reg-domain",
    input: { task: "error" },
    expectedOutput: { result: "failure" },
    expectedClass: "fail",
    metadata: {},
  });
  assert.equal(added, true);

  const updated = service.getRegressionDataset(dataset.datasetId);
  assert.equal(updated!.cases.length, 3);

  const removed = service.removeRegressionCase(dataset.datasetId, "case1");
  assert.equal(removed, true);
  assert.equal(service.getRegressionDataset(dataset.datasetId)!.cases.length, 2);

  const byDomain = service.getRegressionDatasetsByDomain("reg-domain");
  assert.equal(byDomain.length >= 1, true);
});

test("integration: DomainEvalFrameworkService assessment with missing metrics", () => {
  const service = new DomainEvalFrameworkService();

  const framework: DomainEvalFramework = {
    frameworkId: newId("fw"),
    domainId: "partial-metrics",
    fewShotExamples: [],
    evaluators: [
      {
        evaluatorId: "eval1",
        metric: "accuracy",
        threshold: 0.85,
        blocking: true,
      },
    ],
    onlineMetrics: [],
    releaseGates: {},
  };

  service.register(framework);

  const assessment = service.assessQuality("partial-metrics", {
    accuracy: 0.80,
  });

  assert.equal(assessment.overallPassed, false);
  assert.equal(assessment.axisResults[0]!.passed, false);
  assert.equal(assessment.axisResults[0]!.delta, -0.05);
});

test("integration: DomainEvalFrameworkService throws for missing framework", () => {
  const service = new DomainEvalFrameworkService();

  assert.throws(
    () => {
      service.assessQuality("nonexistent", { accuracy: 0.9 });
    },
    (err: unknown) => String(err).includes("domain_eval.framework_not_found"),
  );
});
