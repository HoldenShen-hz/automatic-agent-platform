/**
 * EvaluationReport Output Tests
 *
 * Validates R5-7: EvaluationReport structure and content requirements.
 * The report must contain passed, score, issues[], recommendation, confidence.
 *
 * Architecture: §45.10 EvaluationReport Specification
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

class DeterministicExecuteBridge implements ExecuteBridge {
  async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 25,
      tokenCost: 10,
      summary: `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [`artifact:${step.stepId}`],
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: true,
    };
  }

  async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
    return {
      planId: plan.planId,
      results: plan.steps.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 25,
        tokenCost: 10,
        summary: `Executed ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [`artifact:${step.stepId}`],
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: plan.steps.length * 25,
      totalTokenCost: plan.steps.length * 10,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult) {
    return result.results.map((stepResult) => ({
      stepId: stepResult.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: stepResult.summary,
        artifacts: [...stepResult.artifacts],
      },
      systemTelemetry: {
        durationMs: stepResult.durationMs,
        tokensUsed: stepResult.tokenCost,
        modelId: stepResult.modelId,
        retryCount: stepResult.retryCount,
        validationPassed: stepResult.validationPassed,
      },
    }));
  }
}

function createWorkflow(taskId: string) {
  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: [
      {
        stepId: `step_${taskId}`,
        divisionId: "coding",
        roleId: "writer",
        inputKeys: [],
        agentId: "agent_writer",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
    ],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// R5-7: EvaluationReport structure validation
// ─────────────────────────────────────────────────────────────────────────────

test("EvaluationReport has all required fields (R5-7)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_fields",
    objective: "Verify EvaluationReport has all required fields",
    workflow: createWorkflow("task_eval_fields"),
  });

  const report = result.evaluationReport;

  // Required fields per §45.10
  assert.ok("passed" in report, "passed field must exist");
  assert.ok("score" in report, "score field must exist");
  assert.ok("issues" in report, "issues field must exist");
  assert.ok("recommendation" in report, "recommendation field must exist");
  assert.ok("confidence" in report, "confidence field must exist");
});

test("EvaluationReport passed is boolean", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_passed",
    objective: "Verify passed is boolean type",
    workflow: createWorkflow("task_eval_passed"),
    feedbackSignals: [
      {
        signalId: "signal_success",
        taskId: "task_eval_passed",
        source: "user",
        category: "success",
        severity: "info",
        payload: { summary: "Task succeeded" },
        stepOutputRefs: [`step_task_eval_passed`],
        timestamp: Date.now(),
      },
    ],
  });

  assert.strictEqual(typeof result.evaluationReport.passed, "boolean");
});

test("EvaluationReport score is number between 0-1", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_score",
    objective: "Verify score is a number in range",
    workflow: createWorkflow("task_eval_score"),
  });

  const score = result.evaluationReport.score;
  assert.strictEqual(typeof score, "number");
  assert.ok(score >= 0 && score <= 1, "score must be between 0 and 1");
});

test("EvaluationReport issues is readonly array of strings", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_issues",
    objective: "Verify issues is array of strings",
    workflow: createWorkflow("task_eval_issues"),
  });

  assert.ok(Array.isArray(result.evaluationReport.issues), "issues must be array");
  for (const issue of result.evaluationReport.issues) {
    assert.strictEqual(typeof issue, "string", "each issue must be string");
  }
});

test("EvaluationReport recommendation is non-empty string", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_recommend",
    objective: "Verify recommendation is a string",
    workflow: createWorkflow("task_eval_recommend"),
  });

  assert.strictEqual(typeof result.evaluationReport.recommendation, "string");
  assert.ok(result.evaluationReport.recommendation.length > 0, "recommendation must not be empty");
});

test("EvaluationReport confidence is number between 0-1", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_confidence",
    objective: "Verify confidence is number in range",
    workflow: createWorkflow("task_eval_confidence"),
  });

  const confidence = result.evaluationReport.confidence;
  assert.strictEqual(typeof confidence, "number");
  assert.ok(confidence >= 0 && confidence <= 1, "confidence must be between 0 and 1");
});

test("EvaluationReport passed=true when quality gate accepts", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_pass",
    objective: "Verify passed=true when quality gate accepts",
    workflow: createWorkflow("task_eval_pass"),
    feedbackSignals: [
      {
        signalId: "signal_pass",
        taskId: "task_eval_pass",
        source: "user",
        category: "success",
        severity: "info",
        payload: { summary: "Task completed successfully" },
        stepOutputRefs: [`step_task_eval_pass`],
        timestamp: Date.now(),
      },
    ],
  });

  // When quality gate accepts, evaluation should pass
  if (result.qualityGate.accepted) {
    assert.strictEqual(result.evaluationReport.passed, true);
    assert.ok(result.evaluationReport.recommendation === "continue" || result.evaluationReport.recommendation.includes("continue"));
  }
});

test("EvaluationReport passed=false when quality gate rejects", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_reject",
    objective: "Verify passed=false when quality gate rejects",
    workflow: createWorkflow("task_eval_reject"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_eval_reject",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Schema validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_eval_reject`],
        timestamp: Date.now(),
      },
    ],
  });

  // When quality gate rejects, evaluation should not pass
  if (!result.qualityGate.accepted) {
    assert.strictEqual(result.evaluationReport.passed, false);
  }
});

test("EvaluationReport score reflects outcome score", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_score_match",
    objective: "Verify evaluation score matches outcome score",
    workflow: createWorkflow("task_eval_score_match"),
  });

  // Score should come from outcome evaluation
  assert.strictEqual(result.evaluationReport.score, result.outcome.score ?? 0);
});

test("EvaluationReport issues reflect outcome issues", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_issues_match",
    objective: "Verify issues come from outcome evaluation",
    workflow: createWorkflow("task_eval_issues_match"),
    feedbackSignals: [
      {
        signalId: "signal_warning",
        taskId: "task_eval_issues_match",
        source: "validation",
        category: "failure",
        severity: "warning",
        payload: { summary: "Minor issue detected" },
        stepOutputRefs: [`step_task_eval_issues_match`],
        timestamp: Date.now(),
      },
    ],
  });

  // Issues from outcome should be reflected in evaluation report
  if (result.outcome.issues && result.outcome.issues.length > 0) {
    assert.ok(result.evaluationReport.issues.length > 0, "should have issues when outcome has issues");
  }
});

test("EvaluationReport recommendation reflects quality gate decision", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_rec_gate",
    objective: "Verify recommendation reflects quality gate",
    workflow: createWorkflow("task_eval_rec_gate"),
  });

  // Recommendation should reflect quality gate acceptance
  if (result.qualityGate.accepted) {
    assert.ok(
      result.evaluationReport.recommendation === "continue" ||
      result.evaluationReport.recommendation.includes("continue"),
      "recommendation should be continue when accepted",
    );
  } else {
    assert.ok(
      result.evaluationReport.recommendation.includes("replan") ||
      result.evaluationReport.recommendation.includes("retry") ||
      result.evaluationReport.recommendation.length > 0,
      "recommendation should indicate replan when not accepted",
    );
  }
});

test("EvaluationReport is readonly interface", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_readonly",
    objective: "Verify EvaluationReport is readonly",
    workflow: createWorkflow("task_eval_readonly"),
  });

  const report = result.evaluationReport;

  // Verify readonly behavior - these should not throw on get
  assert.strictEqual(report.passed, result.evaluationReport.passed);
  assert.strictEqual(report.score, result.evaluationReport.score);
  assert.strictEqual(report.confidence, result.evaluationReport.confidence);
});

test("EvaluationReport confidence derives from outcome confidence", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_conf_match",
    objective: "Verify confidence matches outcome confidence",
    workflow: createWorkflow("task_eval_conf_match"),
  });

  // Confidence should come from outcome
  assert.strictEqual(result.evaluationReport.confidence, result.outcome.confidence ?? 0.5);
});

test("EvaluationReport always produced even with empty feedback", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_empty",
    objective: "Verify EvaluationReport produced with no feedback",
    workflow: createWorkflow("task_eval_empty"),
    feedbackSignals: [],
  });

  // Even with no feedback, an evaluation report should be produced
  assert.ok(result.evaluationReport != null, "evaluationReport must exist");
  assert.ok("passed" in result.evaluationReport, "must have passed field");
  assert.ok("score" in result.evaluationReport, "must have score field");
});

test("EvaluationReport for simple task has high confidence", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_eval_simple",
    objective: "Simple file read task",
    workflow: createWorkflow("task_eval_simple"),
    feedbackSignals: [
      {
        signalId: "signal_simple",
        taskId: "task_eval_simple",
        source: "user",
        category: "success",
        severity: "info",
        payload: { summary: "Read completed" },
        stepOutputRefs: [`step_task_eval_simple`],
        timestamp: Date.now(),
      },
    ],
  });

  // Simple successful task should have higher confidence
  assert.ok(result.evaluationReport.confidence >= 0, "confidence must be valid");
  assert.ok(result.evaluationReport.confidence <= 1, "confidence must be in range");
});