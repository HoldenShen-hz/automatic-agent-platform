import test from "node:test";
import assert from "node:assert/strict";

import type {
  ExecutionAssessment,
  ExecutionOutcome,
  ExecutionDeviation,
  ExecutionError,
  CriterionResult,
  FailureMode,
} from "../../../../../../src/platform/orchestration/oapeflir/types/execution-assessment.js";

function createExecutionAssessment(overrides: Partial<ExecutionAssessment> = {}): ExecutionAssessment {
  return {
    assessmentId: "ea_1",
    taskId: "task_1",
    executionId: "exec_1",
    planVersion: 1,
    timestamp: Date.now(),
    outcome: "completed",
    qualityScore: 0.95,
    success: true,
    stepsExecuted: 3,
    stepsTotal: 3,
    stepsCompleted: true,
    durationMs: 1500,
    deviations: [],
    errors: [],
    criteriaResults: [],
    primaryFailureMode: null,
    confidence: 0.9,
    recommendations: [],
    ...overrides,
  };
}

function createExecutionDeviation(overrides: Partial<ExecutionDeviation> = {}): ExecutionDeviation {
  return {
    stepId: "step_1",
    deviationType: "skipped",
    description: "Step was skipped due to dependency failure",
    requiredRepair: true,
    ...overrides,
  };
}

function createExecutionError(overrides: Partial<ExecutionError> = {}): ExecutionError {
  return {
    stepId: "step_2",
    errorCode: "ERR_TIMEOUT",
    message: "Step execution timed out",
    severity: "error",
    recoverable: true,
    ...overrides,
  };
}

function createCriterionResult(overrides: Partial<CriterionResult> = {}): CriterionResult {
  return {
    criterion: {
      criterionId: "crit_1",
      description: "Output must be valid JSON",
      validationType: "output_schema" as const,
      targetPath: "output.data",
      expectedValue: {},
      required: true,
      severity: "critical" as const,
    },
    passed: true,
    actualValue: {},
    ...overrides,
  };
}

test("ExecutionAssessment has all required fields", () => {
  const assessment = createExecutionAssessment();
  assert.equal(assessment.assessmentId, "ea_1");
  assert.equal(assessment.taskId, "task_1");
  assert.equal(assessment.executionId, "exec_1");
  assert.equal(assessment.planVersion, 1);
  assert.equal(assessment.outcome, "completed");
  assert.equal(assessment.qualityScore, 0.95);
  assert.equal(assessment.success, true);
  assert.equal(assessment.stepsExecuted, 3);
  assert.equal(assessment.stepsTotal, 3);
  assert.equal(assessment.stepsCompleted, true);
  assert.equal(assessment.durationMs, 1500);
  assert.deepEqual(assessment.deviations, []);
  assert.deepEqual(assessment.errors, []);
  assert.deepEqual(assessment.criteriaResults, []);
  assert.equal(assessment.primaryFailureMode, null);
  assert.equal(assessment.confidence, 0.9);
  assert.deepEqual(assessment.recommendations, []);
});

test("ExecutionOutcome accepts all valid outcomes", () => {
  const outcomes: ExecutionOutcome[] = [
    "completed",
    "completed_with_deviations",
    "repairable",
    "failed",
    "escalated",
  ];

  for (const outcome of outcomes) {
    const assessment = createExecutionAssessment({ outcome });
    assert.equal(assessment.outcome, outcome);
  }
});

test("ExecutionAssessment captures failed execution", () => {
  const assessment = createExecutionAssessment({
    outcome: "failed",
    success: false,
    qualityScore: 0.2,
    primaryFailureMode: {
      failureModeId: "failure_1",
      category: "network",
      name: "Network timeout",
      description: "Tool execution failed",
      rootCauses: ["network_timeout"],
      contextBeforeFailure: ["tool_call"],
      errorCodePattern: "ERR_TIMEOUT",
      severity: "high",
      recoverable: true,
      tags: ["tool", "network"],
    },
  });

  assert.equal(assessment.outcome, "failed");
  assert.equal(assessment.success, false);
  assert.equal(assessment.qualityScore, 0.2);
  assert.ok(assessment.primaryFailureMode !== null);
  assert.equal(assessment.primaryFailureMode!.failureModeId, "failure_1");
});

test("ExecutionAssessment captures deviations", () => {
  const deviation = createExecutionDeviation({
    stepId: "step_skipped",
    deviationType: "skipped",
    description: "Step was skipped",
    requiredRepair: false,
  });

  const assessment = createExecutionAssessment({
    deviations: [deviation],
  });

  assert.equal(assessment.deviations.length, 1);
  assert.equal(assessment.deviations[0]!.stepId, "step_skipped");
  assert.equal(assessment.deviations[0]!.deviationType, "skipped");
});

test("ExecutionDeviation accepts all deviation types", () => {
  const types: ExecutionDeviation["deviationType"][] = ["skipped", "reordered", "modified", "added", "substituted"];

  for (const deviationType of types) {
    const deviation = createExecutionDeviation({ deviationType });
    assert.equal(deviation.deviationType, deviationType);
  }
});

test("ExecutionAssessment captures errors", () => {
  const error = createExecutionError({
    stepId: "step_failed",
    errorCode: "ERR_NOT_FOUND",
    message: "Resource not found",
    severity: "error",
    recoverable: false,
  });

  const assessment = createExecutionAssessment({
    errors: [error],
  });

  assert.equal(assessment.errors.length, 1);
  assert.equal(assessment.errors[0]!.stepId, "step_failed");
  assert.equal(assessment.errors[0]!.errorCode, "ERR_NOT_FOUND");
});

test("ExecutionError accepts all severity levels", () => {
  const severities: ExecutionError["severity"][] = ["warning", "error", "critical"];

  for (const severity of severities) {
    const error = createExecutionError({ severity });
    assert.equal(error.severity, severity);
  }
});

test("CriterionResult passes when criterion is met", () => {
  const result = createCriterionResult({
    passed: true,
    actualValue: { valid: true },
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.actualValue, { valid: true });
  assert.equal(result.failureReason, undefined);
});

test("CriterionResult fails with failureReason when criterion is not met", () => {
  const result = createCriterionResult({
    passed: false,
    actualValue: null,
    failureReason: "Output was null instead of expected object",
  });

  assert.equal(result.passed, false);
  assert.equal(result.actualValue, null);
  assert.equal(result.failureReason, "Output was null instead of expected object");
});

test("ExecutionAssessment with multiple criteria results", () => {
  const results: CriterionResult[] = [
    createCriterionResult({ passed: true }),
    createCriterionResult({ passed: false, failureReason: "Schema mismatch" }),
    createCriterionResult({ passed: true }),
  ];

  const assessment = createExecutionAssessment({
    criteriaResults: results,
  });

  assert.equal(assessment.criteriaResults.length, 3);
  assert.equal(assessment.criteriaResults.filter((r) => r.passed).length, 2);
  assert.equal(assessment.criteriaResults.filter((r) => !r.passed).length, 1);
});

test("ExecutionAssessment with recommendations", () => {
  const assessment = createExecutionAssessment({
    recommendations: [
      "retry_with_higher_timeout",
      "consider_alternative_tool",
      "request_approval_before_retry",
    ],
  });

  assert.equal(assessment.recommendations.length, 3);
  assert.ok(assessment.recommendations.includes("retry_with_higher_timeout"));
});

test("ExecutionAssessment completed_with_deviations outcome", () => {
  const assessment = createExecutionAssessment({
    outcome: "completed_with_deviations",
    success: true,
    deviations: [
      createExecutionDeviation({ deviationType: "modified", description: "Step output modified" }),
    ],
  });

  assert.equal(assessment.outcome, "completed_with_deviations");
  assert.equal(assessment.success, true);
  assert.equal(assessment.deviations.length, 1);
});

test("ExecutionAssessment repairable outcome", () => {
  const assessment = createExecutionAssessment({
    outcome: "repairable",
    success: false,
    qualityScore: 0.5,
  });

  assert.equal(assessment.outcome, "repairable");
  assert.equal(assessment.success, false);
});

test("ExecutionAssessment escalated outcome", () => {
  const assessment = createExecutionAssessment({
    outcome: "escalated",
    success: false,
    qualityScore: 0.0,
  });

  assert.equal(assessment.outcome, "escalated");
  assert.equal(assessment.success, false);
  assert.equal(assessment.qualityScore, 0.0);
});

test("ExecutionAssessment with escalation path", () => {
  const assessment = createExecutionAssessment({
    outcome: "escalated",
    errors: [
      createExecutionError({
        errorCode: "ERR_ESCALATION",
        message: "Human review required",
        severity: "critical",
        recoverable: false,
      }),
    ],
    recommendations: ["submit_for_human_review"],
  });

  assert.equal(assessment.outcome, "escalated");
  assert.equal(assessment.errors[0]!.severity, "critical");
  assert.ok(assessment.recommendations.includes("submit_for_human_review"));
});
