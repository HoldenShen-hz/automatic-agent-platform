import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import { createPlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";

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

  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
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

function createSingleStepWorkflow(taskId: string) {
  const stepId = `step_${taskId}`;
  const stepDefinition = {
    stepId,
    divisionId: "coding",
    roleId: "writer",
    title: "Write implementation change",
    executor: "agent_writer",
    inputKeys: [],
    inputs: {
      riskClass: "medium",
      budget: {
        amount: 2,
        currency: "USD",
      },
    },
    outputKey: "result",
    outputSchemaPath: null,
    dependsOnStepIds: [],
    dependencyTypes: {},
    timeoutMs: 1000,
    maxAttempts: 1,
    retryPolicy: {
      maxRetries: 0,
      backoffMs: 0,
    },
    tools: ["read"],
    sandboxMode: "workspace-write",
    nodeType: "tool",
    riskClass: "medium",
    budgetIntent: {
      amount: 2,
      currency: "USD",
      resourceKinds: ["compute"],
    },
    sideEffectProfile: {
      mayCommitExternalEffect: false,
      reversible: true,
    },
  };

  return {
    workflow: {
      workflowId: `wf_${taskId}`,
      divisionId: "coding",
      steps: [stepDefinition],
    },
    executionSteps: [{ ...stepDefinition, agentId: "agent_writer" }],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };
}

test("OapeflirLoopService packages feedback-stage decision input with budget and risk state", async () => {
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });
  const planGraphBundle = createPlanGraphBundle({
    harnessRunId: "hrun-review",
    graph: {
      graphId: "graph-review",
      nodes: [{
        nodeId: "node-1",
        nodeType: "execute",
        inputRefs: [],
        outputSchemaRef: "schema://output",
        riskClass: "medium",
        budgetIntent: { amount: 4, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: true, reversible: false },
        retryPolicyRef: "retry://default",
        timeoutMs: 1000,
      }],
      edges: [],
      entryNodeIds: ["node-1"],
      terminalNodeIds: ["node-1"],
      joinStrategy: "all",
      graphHash: "graph-review-hash",
    },
    schedulerPolicy: { policyId: "scheduler-review", strategy: "deterministic_fifo" },
    budgetPlanRef: "budget://review",
    riskProfile: { riskClass: "medium", reasons: ["review"] },
  });
  const stepOutputs: DualChannelStepOutput[] = [{
    stepId: "step-review",
    planRef: "plan-review",
    status: "succeeded",
    userFacingResult: {
      summary: "step succeeded",
      artifacts: ["artifact:step-review"],
    },
    systemTelemetry: {
      durationMs: 25,
      tokensUsed: 10,
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: true,
    },
  }];
  const decisionInputBundle = (service as any).buildDecisionInputBundle({
    taskId: "task_review_decision_bundle",
    harnessRunId: "hrun-review",
    planGraphBundle,
    assessment: { risk: "medium" },
    feedback: {
      feedbackId: "feedback-review",
      taskId: "task_review_decision_bundle",
      planId: "plan-review",
      signals: [{
        signalId: "signal-review",
        taskId: "task_review_decision_bundle",
        source: "execution",
        category: "success",
        severity: "info",
        payload: { summary: "step succeeded" },
        stepOutputRefs: ["step-review"],
        timestamp: Date.now(),
      }],
    },
    qualityGate: { accepted: false, reasonCodes: ["quality_gate.replan_required"] },
    replanDecision: { shouldReplan: true },
    evaluationReport: {
      passed: false,
      score: 0.42,
      issues: ["quality_gate.replan_required"],
      recommendation: "replan",
      confidence: 0.88,
    },
    constraintPack: {
      policyIds: ["policy.review"],
      approvalMode: "supervised",
      autonomyMode: "semi_auto",
      toolPolicy: { allowedTools: ["read"] },
      riskPolicy: { maxRiskScore: 1, escalationThreshold: 0.7 },
      outputPolicy: { requiredEvidence: [], redactSensitiveData: false },
      budgetEnvelope: { maxSteps: 5, maxCost: 20, maxDurationMs: 60000 },
    },
    stepOutputs,
  });

  assert.ok(decisionInputBundle);
  assert.ok(decisionInputBundle.decisionInputBundleId.startsWith("dib_"));
  assert.equal(decisionInputBundle.bundleId, decisionInputBundle.decisionInputBundleId);
  assert.equal(decisionInputBundle.policy.policyIds[0], "policy.review");
  assert.equal(decisionInputBundle.budget.remainingSteps, 4);
  assert.equal(decisionInputBundle.risk.escalationThreshold, 0.7);
  assert.equal(decisionInputBundle.evaluator.score, 0.42);
  assert.equal(decisionInputBundle.decisionKind, "replan");
});

test("OapeflirLoopService exposes plan diagnostics on the loop result", async () => {
  const diagnosticBundle = createPlanGraphBundle({
    harnessRunId: "hrun-diagnostics",
    graph: {
      graphId: "graph-diagnostics",
      nodes: [{
        nodeId: "node-diagnostics-1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://diagnostics-output",
        riskClass: "high",
        budgetIntent: { amount: 7, currency: "USD", resourceKinds: ["compute"] },
        sideEffectProfile: { mayCommitExternalEffect: true, reversible: false },
        retryPolicyRef: "retry://diagnostics",
        timeoutMs: 1500,
      }],
      edges: [],
      entryNodeIds: ["node-diagnostics-1"],
      terminalNodeIds: ["node-diagnostics-1"],
      joinStrategy: "all",
      graphHash: "graph-diagnostics-hash",
    },
    schedulerPolicy: { policyId: "scheduler-diagnostics", strategy: "deterministic_fifo" },
    budgetPlanRef: "budget://diagnostics",
    riskProfile: { riskClass: "high", reasons: ["review-diagnostics"] },
    validationReport: {
      valid: true,
      findings: ["graph.normalized"],
      normalizedNodeIds: ["node-diagnostics-1"],
      riskPropagation: [{
        nodeId: "node-diagnostics-1",
        inheritedRiskClass: "high",
        reasons: ["external_side_effect"],
      }],
      worstPath: {
        pathNodeIds: ["node-diagnostics-1"],
        riskClass: "high",
        estimatedBudgetAmount: 7,
        timeoutMs: 1500,
      },
    },
  });
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
    planBuilder: {
      buildGraphBundle: () => diagnosticBundle,
    } as any,
  });

  const result = await service.produceStageRationale({
    taskId: "task_review_plan_diagnostics",
    objective: "Generate a graph-native plan and surface diagnostics.",
    workflow: createSingleStepWorkflow("task_review_plan_diagnostics"),
    stepOutputs: [{
      stepId: "node-diagnostics-1",
      planRef: diagnosticBundle.planGraphBundleId,
      status: "succeeded",
      userFacingResult: {
        summary: "diagnostic step completed",
        artifacts: ["artifact:diagnostics"],
      },
      systemTelemetry: {
        durationMs: 50,
        tokensUsed: 12,
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      },
    }],
  });

  assert.ok(result.normalizationReport);
  assert.equal(result.normalizationReport?.normalizedNodes, result.planGraphBundle.graph.nodes.length);
  assert.equal(result.normalizationReport?.normalizedEdges, result.planGraphBundle.graph.edges.length);
  assert.ok(result.validationReport);
  assert.equal(result.validationReport?.valid, true);
  assert.equal(result.validationReport?.findings[0]?.code, "validation.issue.0");
  assert.ok(result.riskPropagation);
  assert.equal(result.riskPropagation?.riskScore, 0.75);
  assert.deepEqual(result.riskPropagation?.criticalPathNodes, ["node-diagnostics-1"]);
  assert.ok(result.worstPath);
  assert.equal(result.worstPath?.pathLength, 1);
  assert.equal(result.worstPath?.estimatedDurationMs, 1500);
  assert.equal(result.worstPath?.budgetEstimate, 7);
});
