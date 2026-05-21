import assert from "node:assert/strict";
import test from "node:test";

import { DomainEvalFrameworkSchema, DomainEvaluatorSchema } from "../../../../src/domains/eval-framework/index.js";

// ── Extended Schema Validation Tests ─────────────────────────────────────────

test("DomainEvaluatorSchema rejects empty string evaluatorId", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "",
    metric: "accuracy",
    threshold: 0.9,
  });
  assert.equal(result.success, false);
});

test("DomainEvaluatorSchema rejects empty string metric", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "",
    threshold: 0.9,
  });
  assert.equal(result.success, false);
});

test("DomainEvaluatorSchema accepts threshold of 0", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: 0,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.threshold, 0);
});

test("DomainEvaluatorSchema accepts threshold of 1", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: 1,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.threshold, 1);
});

test("DomainEvaluatorSchema rejects threshold greater than 1", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: 1.01,
  });
  assert.equal(result.success, false);
});

test("DomainEvaluatorSchema rejects threshold less than 0", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: -0.01,
  });
  assert.equal(result.success, false);
});

test("DomainEvaluatorSchema accepts explicit blocking true", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: 0.9,
    blocking: true,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.blocking, true);
});

test("DomainEvaluatorSchema accepts explicit blocking false", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: 0.9,
    blocking: false,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.blocking, false);
});

test("DomainEvaluatorSchema rejects invalid blocking value", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_1",
    metric: "accuracy",
    threshold: 0.9,
    blocking: "yes",
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema accepts framework with empty evaluators array", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    evaluators: [],
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.evaluators, []);
});

test("DomainEvalFrameworkSchema accepts framework with all optional fields omitted", () => {
  const result = DomainEvalFrameworkSchema.parse({
    frameworkId: "fw_minimal",
    domainId: "test",
  });
  assert.equal(result.frameworkId, "fw_minimal");
  assert.equal(result.domainId, "test");
  assert.deepEqual(result.fewShotExamples, []);
  assert.deepEqual(result.evaluators, []);
  assert.deepEqual(result.onlineMetrics, []);
  assert.equal(result.releaseGates.minFewShotCount, 5);
  assert.equal(result.releaseGates.minRegressionCaseCount, 20);
  assert.equal(result.releaseGates.requirePromptInjectionCoverage, true);
});

test("DomainEvalFrameworkSchema rejects framework with empty frameworkId", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "",
    domainId: "coding",
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema rejects framework with empty domainId", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "",
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema rejects negative minFewShotCount", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    releaseGates: {
      minFewShotCount: -1,
      minRegressionCaseCount: 10,
      requirePromptInjectionCoverage: true,
    },
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema rejects non-integer minFewShotCount", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    releaseGates: {
      minFewShotCount: 2.5,
      minRegressionCaseCount: 10,
      requirePromptInjectionCoverage: true,
    },
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema rejects negative minRegressionCaseCount", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    releaseGates: {
      minFewShotCount: 5,
      minRegressionCaseCount: -1,
      requirePromptInjectionCoverage: true,
    },
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema accepts zero minRegressionCaseCount", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    releaseGates: {
      minFewShotCount: 0,
      minRegressionCaseCount: 0,
      requirePromptInjectionCoverage: false,
    },
  });
  assert.equal(result.success, true);
});

test("DomainEvalFrameworkSchema accepts empty fewShotExamples array", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    fewShotExamples: [],
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.fewShotExamples, []);
});

test("DomainEvalFrameworkSchema rejects fewShotExamples with empty string", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    fewShotExamples: ["valid example", ""],
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema accepts empty onlineMetrics array", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    onlineMetrics: [],
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.onlineMetrics, []);
});

test("DomainEvalFrameworkSchema accepts releaseGates with all fields", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    releaseGates: {
      minFewShotCount: 10,
      minRegressionCaseCount: 50,
      requirePromptInjectionCoverage: false,
    },
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.releaseGates.minFewShotCount, 10);
  assert.equal(result.data?.releaseGates.minRegressionCaseCount, 50);
  assert.equal(result.data?.releaseGates.requirePromptInjectionCoverage, false);
});

test("DomainEvalFrameworkSchema rejects evaluator with empty string evaluatorId", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    evaluators: [
      {
        evaluatorId: "",
        metric: "accuracy",
        threshold: 0.9,
      },
    ],
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema rejects evaluator with empty string metric", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    evaluators: [
      {
        evaluatorId: "eval_1",
        metric: "",
        threshold: 0.9,
      },
    ],
  });
  assert.equal(result.success, false);
});

test("DomainEvalFrameworkSchema accepts multiple evaluators", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_1",
    domainId: "coding",
    evaluators: [
      { evaluatorId: "eval_1", metric: "accuracy", threshold: 0.9, blocking: true },
      { evaluatorId: "eval_2", metric: "latency", threshold: 200, blocking: false },
      { evaluatorId: "eval_3", metric: "cost", threshold: 1.0, blocking: false },
    ],
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.evaluators.length, 3);
});

test("DomainEvalFrameworkSchema correctly infers DomainEvaluator type", () => {
  const result = DomainEvaluatorSchema.safeParse({
    evaluatorId: "eval_test",
    metric: "pass_rate",
    threshold: 0.85,
    blocking: true,
  });
  assert.equal(result.success, true);
  if (result.success) {
    const evaluator = result.data;
    assert.equal(evaluator.evaluatorId, "eval_test");
    assert.equal(evaluator.metric, "pass_rate");
    assert.equal(evaluator.threshold, 0.85);
    assert.equal(evaluator.blocking, true);
  }
});

test("DomainEvalFrameworkSchema correctly infers DomainEvalFramework type", () => {
  const result = DomainEvalFrameworkSchema.safeParse({
    frameworkId: "fw_type_test",
    domainId: "type_test_domain",
    evaluators: [
      { evaluatorId: "eval_1", metric: "accuracy", threshold: 0.9, blocking: true },
    ],
    fewShotExamples: ["example 1", "example 2"],
    onlineMetrics: ["accuracy"],
    releaseGates: {
      minFewShotCount: 2,
      minRegressionCaseCount: 10,
      requirePromptInjectionCoverage: true,
    },
  });
  assert.equal(result.success, true);
  if (result.success) {
    const framework = result.data;
    assert.equal(framework.frameworkId, "fw_type_test");
    assert.equal(framework.domainId, "type_test_domain");
    assert.equal(framework.evaluators.length, 1);
    assert.equal(framework.fewShotExamples.length, 2);
    assert.equal(framework.onlineMetrics.length, 1);
  }
});
