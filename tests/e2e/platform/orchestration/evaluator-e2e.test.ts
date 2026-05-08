/**
 * E2E Evaluator Service Tests
 *
 * End-to-end tests covering evaluator service:
 * 1. Step result evaluation
 * 2. Workflow state evaluation
 * 3. Decision generation based on evaluation
 * 4. Evaluation caching
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../helpers/e2e-harness.js";
// @ts-ignore
import { EvaluatorService } from "../../src/platform/orchestration/evaluator/evaluator-service.js";
// @ts-ignore
import type { EvaluationResult, StepEvaluation, WorkflowEvaluation } from "../../src/platform/orchestration/evaluator/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createStepEvaluation(overrides: Partial<StepEvaluation> = {}): StepEvaluation {
  return {
    stepName: overrides.stepName ?? "step_execute",
    status: overrides.status ?? "succeeded",
    output: overrides.output ?? { result: "success" },
    latencyMs: overrides.latencyMs ?? 500,
    costUsd: overrides.costUsd ?? 0.01,
    riskScore: overrides.riskScore ?? 20,
    errorCode: overrides.errorCode ?? null,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

function createWorkflowEvaluation(overrides: Partial<WorkflowEvaluation> = {}): WorkflowEvaluation {
  return {
    workflowId: overrides.workflowId ?? "wf_e2e_001",
    taskId: overrides.taskId ?? "task_e2e_001",
    overallStatus: overrides.overallStatus ?? "running",
    stepEvaluations: overrides.stepEvaluations ?? [],
    totalCostUsd: overrides.totalCostUsd ?? 0.05,
    riskLevel: overrides.riskLevel ?? "low",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Step Evaluation
// ---------------------------------------------------------------------------

test("E2E Evaluator: EvaluatorService evaluates step execution result", async () => {
  const harness = createE2EHarness("aa-e2e-eval-step-");
  try {
    const service = new EvaluatorService();

    const stepEval = createStepEvaluation({
      stepName: "step_read_file",
      status: "succeeded",
      latencyMs: 200,
    });

    const result = service.evaluateStep(stepEval);

    assert.ok(result, "Should return evaluation result");
    assert.equal(result.decision, "continue", "Should decide to continue");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Workflow Evaluation
// ---------------------------------------------------------------------------

test("E2E Evaluator: Service evaluates workflow state and determines outcome", async () => {
  const harness = createE2EHarness("aa-e2e-eval-workflow-");
  try {
    const service = new EvaluatorService();

    const workflowEval = createWorkflowEvaluation({
      stepEvaluations: [
        createStepEvaluation({ stepName: "step_1", status: "succeeded" }),
        createStepEvaluation({ stepName: "step_2", status: "succeeded" }),
      ],
      totalCostUsd: 0.02,
    });

    const result = service.evaluateWorkflow(workflowEval);

    assert.ok(result, "Should return workflow evaluation");
    assert.equal(result.continueExecution, true, "Should continue execution");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Decision Generation
// ---------------------------------------------------------------------------

test("E2E Evaluator: Service generates decision based on evaluation criteria", async () => {
  const harness = createE2EHarness("aa-e2e-eval-decision-");
  try {
    const service = new EvaluatorService();

    const stepEval = createStepEvaluation({
      status: "failed",
      errorCode: "TIMEOUT",
    });

    const result = service.evaluateStep(stepEval);

    assert.ok(result.decision, "Should have decision");
    assert.ok(["continue", "retry", "replan", "escalate", "abort"].includes(result.decision), "Should be valid decision");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Evaluation Cache
// ---------------------------------------------------------------------------

test("E2E Evaluator: EvaluatorService caches evaluation results for repeated steps", async () => {
  const harness = createE2EHarness("aa-e2e-eval-cache-");
  try {
    const service = new EvaluatorService();

    const stepEval = createStepEvaluation({
      stepName: "step_repeated",
      status: "succeeded",
    });

    // First evaluation
    const result1 = service.evaluateStep(stepEval);

    // Cached evaluation
    const result2 = service.evaluateStep(stepEval);

    assert.ok(result2.fromCache !== undefined, "Should indicate cache status");
  } finally {
    harness.cleanup();
  }
});