import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainEvalFrameworkService,
  type QualityAxis,
  type AutomatedCheck,
  type HumanEvalRubric,
  type RegressionCase,
  type RegressionDataset,
} from "../../../src/domains/domain-eval-framework-service.js";
import {
  type DomainEvalFramework,
  listBlockingEvaluators,
} from "../../../src/domains/eval-framework/index.js";

function createTestFramework(domainId: string): DomainEvalFramework {
  return {
    frameworkId: `fw_${domainId}`,
    domainId,
    fewShotExamples: [],
    evaluators: [
      { evaluatorId: "eval_latency", metric: "p99_latency_ms", threshold: 0.9, blocking: true },
      { evaluatorId: "eval_accuracy", metric: "accuracy", threshold: 0.85, blocking: false },
    ],
    onlineMetrics: ["p99_latency_ms", "accuracy", "throughput"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };
}

test("DomainEvalFrameworkService registers and retrieves framework", () => {
  const service = new DomainEvalFrameworkService();
  const framework = createTestFramework("test_domain");

  service.register(framework);

  const retrieved = service.getFramework("test_domain");
  assert.ok(retrieved);
  assert.equal(retrieved!.frameworkId, framework.frameworkId);
  assert.equal(retrieved!.domainId, "test_domain");
});

test("DomainEvalFrameworkService returns null for unregistered domain", () => {
  const service = new DomainEvalFrameworkService();
  const result = service.getFramework("nonexistent");
  assert.equal(result, null);
});

test("DomainEvalFrameworkService registers and retrieves quality axes", () => {
  const service = new DomainEvalFrameworkService();
  const axis: QualityAxis = {
    axisId: "axis_latency",
    name: "p99_latency_ms",
    description: "P99 response latency",
    weight: 0.4,
    unit: "latency",
    targetValue: 200,
    criticalThreshold: 500,
  };

  service.registerQualityAxis("test_domain", axis);

  const axes = service.getQualityAxes("test_domain");
  assert.equal(axes.length, 1);
  assert.equal(axes[0]!.axisId, "axis_latency");
  assert.equal(axes[0]!.targetValue, 200);
});

test("DomainEvalFrameworkService updates existing quality axis", () => {
  const service = new DomainEvalFrameworkService();
  const axis1: QualityAxis = {
    axisId: "axis_accuracy",
    name: "accuracy",
    description: "Model accuracy",
    weight: 0.5,
    unit: "percentage",
    targetValue: 0.9,
  };
  const axis2: QualityAxis = { ...axis1, targetValue: 0.95, weight: 0.6 };

  service.registerQualityAxis("test_domain", axis1);
  service.registerQualityAxis("test_domain", axis2);

  const axes = service.getQualityAxes("test_domain");
  assert.equal(axes.length, 1);
  assert.equal(axes[0]!.targetValue, 0.95);
  assert.equal(axes[0]!.weight, 0.6);
});

test("DomainEvalFrameworkService registers and retrieves automated checks", () => {
  const service = new DomainEvalFrameworkService();
  const check: AutomatedCheck = {
    checkId: "check_coverage",
    name: "Prompt injection coverage",
    metric: "coverage_ratio",
    threshold: 0.95,
    enabled: true,
    executionMode: "batch",
  };

  service.registerAutomatedCheck("test_domain", check);

  const checks = service.getAutomatedChecks("test_domain");
  assert.equal(checks.length, 1);
  assert.equal(checks[0]!.checkId, "check_coverage");
  assert.equal(checks[0]!.executionMode, "batch");
});

test("DomainEvalFrameworkService registers and retrieves rubrics", () => {
  const service = new DomainEvalFrameworkService();
  const rubric: HumanEvalRubric = {
    rubricId: "rubric_v1",
    name: "Response Quality Rubric",
    version: "1.0.0",
    criteria: [
      {
        criterionId: "criterion_relevance",
        name: "Relevance",
        description: "How relevant is the response",
        scoreRange: { min: 1, max: 5 },
        weight: 0.4,
      },
    ],
    instructions: "Evaluate responses on a 1-5 scale",
  };

  service.registerRubric("test_domain", rubric);

  const rubrics = service.getRubrics("test_domain");
  assert.equal(rubrics.length, 1);
  assert.equal(rubrics[0]!.rubricId, "rubric_v1");
});

test("DomainEvalFrameworkService getLatestRubric returns highest version", () => {
  const service = new DomainEvalFrameworkService();
  const rubric1: HumanEvalRubric = {
    rubricId: "rubric_v1",
    name: "Response Quality Rubric",
    version: "1.0.0",
    criteria: [],
    instructions: "Evaluate responses",
  };
  const rubric2: HumanEvalRubric = {
    rubricId: "rubric_v2",
    name: "Response Quality Rubric",
    version: "2.0.0",
    criteria: [],
    instructions: "Evaluate responses",
  };

  service.registerRubric("test_domain", rubric1);
  service.registerRubric("test_domain", rubric2);

  const latest = service.getLatestRubric("test_domain");
  assert.ok(latest);
  assert.equal(latest!.rubricId, "rubric_v2");
  assert.equal(latest!.version, "2.0.0");
});

test("DomainEvalFrameworkService getLatestRubric returns null for no rubrics", () => {
  const service = new DomainEvalFrameworkService();
  const result = service.getLatestRubric("nonexistent");
  assert.equal(result, null);
});

test("DomainEvalFrameworkService registers and retrieves regression datasets", () => {
  const service = new DomainEvalFrameworkService();
  const dataset: RegressionDataset = {
    datasetId: "ds_001",
    domainId: "test_domain",
    name: "Regression Test Set",
    version: "1.0.0",
    cases: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  service.registerRegressionDataset(dataset);

  const retrieved = service.getRegressionDataset("ds_001");
  assert.ok(retrieved);
  assert.equal(retrieved!.name, "Regression Test Set");
});

test("DomainEvalFrameworkService getRegressionDatasetsByDomain filters correctly", () => {
  const service = new DomainEvalFrameworkService();
  const dataset1: RegressionDataset = {
    datasetId: "ds_001",
    domainId: "domain_a",
    name: "Dataset A",
    version: "1.0.0",
    cases: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
  const dataset2: RegressionDataset = {
    datasetId: "ds_002",
    domainId: "domain_b",
    name: "Dataset B",
    version: "1.0.0",
    cases: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  service.registerRegressionDataset(dataset1);
  service.registerRegressionDataset(dataset2);

  const datasets = service.getRegressionDatasetsByDomain("domain_a");
  assert.equal(datasets.length, 1);
  assert.equal(datasets[0]!.domainId, "domain_a");
});

test("DomainEvalFrameworkService assessQuality calculates weighted score", () => {
  const service = new DomainEvalFrameworkService();
  const framework = createTestFramework("test_domain");
  service.register(framework);

  const axis: QualityAxis = {
    axisId: "axis_accuracy",
    name: "accuracy",
    description: "Model accuracy",
    weight: 0.5,
    unit: "percentage",
    targetValue: 0.9,
  };
  service.registerQualityAxis("test_domain", axis);

  const result = service.assessQuality("test_domain", {
    accuracy: 0.95,
    p99_latency_ms: 0.92,
  });

  assert.ok(result.assessmentId);
  assert.equal(result.domainId, "test_domain");
  assert.ok(result.overallScore >= 0);
  assert.ok(result.overallPassed === true || result.overallPassed === false);
});

test("DomainEvalFrameworkService assessQuality throws for unregistered domain", () => {
  const service = new DomainEvalFrameworkService();
  assert.throws(
    () => service.assessQuality("nonexistent", { accuracy: 0.9 }),
    /domain_eval\.framework_not_found/,
  );
});

test("DomainEvalFrameworkService createRegressionDataset generates dataset", () => {
  const service = new DomainEvalFrameworkService();
  const cases: RegressionCase[] = [
    {
      caseId: "case_001",
      name: "Basic query test",
      domainId: "test_domain",
      input: { query: "test" },
      expectedOutput: { result: "expected" },
      expectedClass: "success",
      metadata: {},
    },
  ];

  const dataset = service.createRegressionDataset("test_domain", "New Dataset", cases);

  assert.ok(dataset.datasetId);
  assert.equal(dataset.domainId, "test_domain");
  assert.equal(dataset.name, "New Dataset");
  assert.equal(dataset.cases.length, 1);
  assert.equal(dataset.version, "1.0.0");
});

test("DomainEvalFrameworkService addRegressionCase updates dataset", () => {
  const service = new DomainEvalFrameworkService();
  const cases: RegressionCase[] = [
    {
      caseId: "case_001",
      name: "Basic query test",
      domainId: "test_domain",
      input: { query: "test" },
      expectedOutput: { result: "expected" },
      expectedClass: "success",
      metadata: {},
    },
  ];
  const dataset = service.createRegressionDataset("test_domain", "Test Dataset", cases);

  const newCase: RegressionCase = {
    caseId: "case_002",
    name: "Second test",
    domainId: "test_domain",
    input: { query: "test2" },
    expectedOutput: { result: "expected2" },
    expectedClass: "success",
    metadata: {},
  };

  const result = service.addRegressionCase(dataset.datasetId, newCase);
  assert.equal(result, true);

  const updated = service.getRegressionDataset(dataset.datasetId);
  assert.equal(updated!.cases.length, 2);
});

test("DomainEvalFrameworkService addRegressionCase returns false for nonexistent dataset", () => {
  const service = new DomainEvalFrameworkService();
  const newCase: RegressionCase = {
    caseId: "case_001",
    name: "Test",
    domainId: "test_domain",
    input: {},
    expectedOutput: {},
    expectedClass: "success",
    metadata: {},
  };

  const result = service.addRegressionCase("nonexistent", newCase);
  assert.equal(result, false);
});

test("DomainEvalFrameworkService removeRegressionCase removes case", () => {
  const service = new DomainEvalFrameworkService();
  const cases: RegressionCase[] = [
    {
      caseId: "case_001",
      name: "First test",
      domainId: "test_domain",
      input: {},
      expectedOutput: {},
      expectedClass: "success",
      metadata: {},
    },
    {
      caseId: "case_002",
      name: "Second test",
      domainId: "test_domain",
      input: {},
      expectedOutput: {},
      expectedClass: "success",
      metadata: {},
    },
  ];
  const dataset = service.createRegressionDataset("test_domain", "Test Dataset", cases);

  const result = service.removeRegressionCase(dataset.datasetId, "case_001");
  assert.equal(result, true);

  const updated = service.getRegressionDataset(dataset.datasetId);
  assert.equal(updated!.cases.length, 1);
  assert.equal(updated!.cases[0]!.caseId, "case_002");
});

test("DomainEvalFrameworkService removeRegressionCase returns false for missing case", () => {
  const service = new DomainEvalFrameworkService();
  const dataset = service.createRegressionDataset("test_domain", "Test Dataset", []);

  const result = service.removeRegressionCase(dataset.datasetId, "nonexistent");
  assert.equal(result, false);
});

test("DomainEvalFrameworkService removeRegressionCase returns false for nonexistent dataset", () => {
  const service = new DomainEvalFrameworkService();
  const result = service.removeRegressionCase("nonexistent", "case_001");
  assert.equal(result, false);
});

test("listBlockingEvaluators filters blocking evaluators", () => {
  const framework: DomainEvalFramework = {
    frameworkId: "fw_test",
    domainId: "test_domain",
    fewShotExamples: [],
    evaluators: [
      { evaluatorId: "eval_1", metric: "m1", threshold: 0.8, blocking: true },
      { evaluatorId: "eval_2", metric: "m2", threshold: 0.9, blocking: false },
      { evaluatorId: "eval_3", metric: "m3", threshold: 0.85, blocking: true },
    ],
    onlineMetrics: [],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  const blocking = listBlockingEvaluators(framework);
  assert.equal(blocking.length, 2);
  assert.ok(blocking.every((e) => e.blocking === true));
});
