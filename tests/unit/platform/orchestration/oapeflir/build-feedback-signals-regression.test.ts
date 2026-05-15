import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/dual-channel-step-output.js";

/**
 * R19-08 Regression Tests: buildFeedbackSignals derives category from step validation status
 *
 * Issue: buildFeedbackSignals all step hardcoded category:"success" - failed step
 * produces虚假正向反馈
 *
 * Fix: Derive feedback category from step output's validationPassed field.
 * Keep this test at the helper level so it does not depend on loop replan convergence.
 */
function buildStepOutputs(): DualChannelStepOutput[] {
  return [
    {
      stepId: "step_succeed",
      planRef: "plan_feedback",
      userFacingResult: {
        summary: "Executed step_succeed",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 25,
        tokensUsed: 10,
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      },
    },
    {
      stepId: "step_fail",
      planRef: "plan_feedback",
      userFacingResult: {
        summary: "Executed step_fail",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 25,
        tokensUsed: 10,
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: false,
      },
    },
  ];
}

test("R19-08: buildFeedbackSignals derives failure category when step validation fails", () => {
  const service = new OapeflirLoopService();
  const result = (service as unknown as {
    buildFeedbackSignals: (taskId: string, stepOutputs: DualChannelStepOutput[]) => Array<{
      category: string;
      stepOutputRefs: string[];
    }>;
  }).buildFeedbackSignals("task_feedback_category", buildStepOutputs());

  const failSignal = result.find(
    (s: { stepOutputRefs: string[] }) => s.stepOutputRefs.includes("step_fail")
  );
  assert.ok(failSignal, "Should have feedback signal for failed step");

  // R19-08 fix: Failed step should have category "failure", not hardcoded "success"
  assert.equal(
    failSignal!.category,
    "failure",
    "Failed step should have category 'failure' not 'success'"
  );

  const succeedSignal = result.find(
    (s: { stepOutputRefs: string[] }) => s.stepOutputRefs.includes("step_succeed")
  );
  assert.ok(succeedSignal, "Should have feedback signal for succeeded step");
  assert.equal(
    succeedSignal!.category,
    "success",
    "Succeeded step should have category 'success'"
  );
});

test("R19-08: buildFeedbackSignals severity is error when validation fails", () => {
  const service = new OapeflirLoopService();
  const failSignal = (service as unknown as {
    buildFeedbackSignals: (taskId: string, stepOutputs: DualChannelStepOutput[]) => Array<{
      severity: string;
    }>;
  }).buildFeedbackSignals("task_feedback_severity", [
    {
      stepId: "step_fail_validation",
      planRef: "plan_feedback",
      userFacingResult: {
        summary: "Executed step_fail_validation",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 25,
        tokensUsed: 10,
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: false,
      },
    },
  ])[0];
  assert.equal(
    failSignal?.severity,
    "error",
    "Failed step should have severity 'error' not 'info'"
  );
});
