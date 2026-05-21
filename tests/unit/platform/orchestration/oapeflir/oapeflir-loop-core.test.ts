import assert from "node:assert/strict";
import test from "node:test";

import type {
  OapeflirLoopInput,
  OapeflirLoopResult,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/dual-channel-step-output.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { UnifiedAssessment } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";
import type { UnifiedObservation } from "../../../../../src/shared/observability/observation-aggregator.js";
import type { FeedbackSignal } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";
import type { RolloutRecord } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import type { OapeflirStageRecord } from "../../../../../src/platform/five-plane-orchestration/oapeflir/stage-timeline.js";
import type { ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import type { EffectivePolicySnapshot } from "../../../../../src/platform/five-plane-orchestration/oapeflir/assessment-service.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-model.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { EvaluationReport } from "../../../../../src/prompt-engine/eval/execution-outcome-evaluator.js";
import type { PostExecutionQualityGateDecision } from "../../../../../src/prompt-engine/eval/post-execution-quality-gate.js";
import type { ReplanningDecision } from "../../../../../src/platform/five-plane-orchestration/planner/replanning-service.js";
import type { GraphPatch } from "../../../../../src/contracts/executable-contracts/index.js";
import type { HarnessDecision } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import type { PlanGraphBundle } from "../../../../../src/contracts/executable-contracts/index.js";

test("OapeflirLoopInput interface accepts valid input structure", () => {
  const validInput: OapeflirLoopInput = {
    taskId: "task_123",
    objective: "Complete the task",
    workflow: {
      workflow: {
        workflowId: "wf_123",
        divisionId: "coding",
        steps: [],
      },
      executionSteps: [
        {
          stepId: "step_1",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_1",
          outputKey: "result",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
      ],
      planReason: "workflow.single_step",
      dependencyEdges: [],
    },
  };

  assert.equal(validInput.taskId, "task_123");
  assert.equal(validInput.objective, "Complete the task");
  assert.ok(validInput.workflow != null);
});

test("OapeflirLoopInput interface accepts optional fields", () => {
  const inputWithOptionals: OapeflirLoopInput = {
    taskId: "task_opt",
    objective: "Task with optionals",
    workflow: {
      workflow: { workflowId: "wf_opt", divisionId: "coding", steps: [] },
      executionSteps: [],
      planReason: "test",
      dependencyEdges: [],
    },
    feedbackSignals: [
      {
        signalId: "sig_1",
        taskId: "task_opt",
        source: "user",
        category: "success",
        severity: "info",
        payload: { summary: "Success" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    blockerSummaries: ["Blocker 1", "Blocker 2"],
    fileRefs: ["file1.ts", "file2.ts"],
    stepOutputs: [],
    constraintPack: {
      policyIds: ["policy_1"],
      approvalMode: "none",
      autonomyMode: "full_auto",
      tool_policy: { allowedTools: [] },
      sandboxRequirement: { sandboxMode: "none", timeoutMs: 300000 },
      approvalRequirement: {
        requiredForRiskClass: [],
        approverRoles: [],
        escalationTimeoutMs: 60000,
      },
    } as ConstraintPack,
    effectivePolicy: {
      policyId: "policy_test",
      rules: [],
      scope: { type: "task", taskId: "task_opt" },
    } as EffectivePolicySnapshot,
  };

  assert.equal(inputWithOptionals.feedbackSignals?.length, 1);
  assert.equal(inputWithOptionals.blockerSummaries?.length, 2);
  assert.equal(inputWithOptionals.fileRefs?.length, 2);
  assert.equal(inputWithOptionals.stepOutputs?.length, 0);
  assert.equal(inputWithOptionals.constraintPack?.policyIds.length, 1);
});

test("OapeflirLoopResult interface has correct structure", () => {
  const mockResult: OapeflirLoopResult = {
    observation: {
      observedAt: Date.now(),
      task: {
        taskId: "task_result",
        timestamp: Date.now(),
        objective: "Test",
        currentPhase: "planning",
        userIntent: { raw: "Test", normalized: "Test", confidence: 0.8 },
        blockers: [],
        relevantMemory: [],
        fileRefs: [],
        metrics: {},
      },
      system: { healthStatus: "ok" },
      eventFlow: { events: [] },
      goalDecomposition: { goals: [] },
      memory: { relevantMemories: [] },
    },
    assessment: {
      taskId: "task_result",
      timestamp: Date.now(),
      situationRef: "assessment:test",
      phase: "pre-execution",
      complexity: "moderate",
      risk: "medium",
      riskAssessment: { level: "medium", factors: [] },
      routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
      resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
      approvalPolicy: { required: false, level: "none" },
      executionMode: "auto",
      suggestedActions: [],
    },
    plan: {
      planId: "plan_result",
      taskId: "task_result",
      version: 1,
      assessmentRef: "assessment:ref",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    },
    planGraphBundle: {
      planGraphBundleId: "bundle_result",
      harnessRunId: "harness:result",
      graphVersion: 1,
      createdAt: new Date().toISOString(),
      graph: {
        graphId: "graph_result",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash",
      },
      schedulerPolicy: { policyId: "scheduler:default", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:ref",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
    },
    stepOutputs: [],
    feedback: {
      feedbackId: "feedback_result",
      taskId: "task_result",
      collectedAt: Date.now(),
      signals: [],
      metadata: { source: "test" },
    },
    learningSignals: [],
    learningObjects: [],
    rolloutRecord: null,
    timeline: [],
    outcome: {
      score: 0.85,
      issues: [],
      confidence: 0.9,
    },
    evaluationReport: {
      score: 0.85,
      verdict: "accept",
      confidence: 0.9,
    },
    qualityGate: {
      accepted: true,
      reasonCodes: [],
      releaseStage: "auto",
    },
    replanDecision: {
      shouldReplan: false,
      reason: "no_replan_needed",
      trigger: "planning.no_replan_required",
    },
    graphPatch: null,
    harnessDecision: null,
  };

  assert.equal(mockResult.observation.task.taskId, "task_result");
  assert.equal(mockResult.assessment.taskId, "task_result");
  assert.equal(mockResult.plan.planId, "plan_result");
  assert.equal(mockResult.stepOutputs.length, 0);
  assert.equal(mockResult.feedback.feedbackId, "feedback_result");
  assert.equal(mockResult.rolloutRecord, null);
  assert.equal(mockResult.outcome.score, 0.85);
  assert.equal(mockResult.qualityGate.accepted, true);
  assert.equal(mockResult.replanDecision.shouldReplan, false);
});

test("OapeflirLoopResult interface accepts full rolloutRecord", () => {
  const resultWithRollout: OapeflirLoopResult = {
    observation: {
      observedAt: Date.now(),
      task: {
        taskId: "task_rollout",
        timestamp: Date.now(),
        objective: "Test",
        currentPhase: "planning",
        userIntent: { raw: "Test", normalized: "Test", confidence: 0.8 },
        blockers: [],
        relevantMemory: [],
        fileRefs: [],
        metrics: {},
      },
      system: { healthStatus: "ok" },
      eventFlow: { events: [] },
      goalDecomposition: { goals: [] },
      memory: { relevantMemories: [] },
    },
    assessment: {
      taskId: "task_rollout",
      timestamp: Date.now(),
      situationRef: "assessment:test",
      phase: "pre-execution",
      complexity: "moderate",
      risk: "medium",
      riskAssessment: { level: "medium", factors: [] },
      routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
      resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
      approvalPolicy: { required: false, level: "none" },
      executionMode: "auto",
      suggestedActions: [],
    },
    plan: {
      planId: "plan_rollout",
      taskId: "task_rollout",
      version: 1,
      assessmentRef: "assessment:ref",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    },
    planGraphBundle: {
      planGraphBundleId: "bundle_rollout",
      harnessRunId: "harness:rollout",
      graphVersion: 1,
      createdAt: new Date().toISOString(),
      graph: {
        graphId: "graph_rollout",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash",
      },
      schedulerPolicy: { policyId: "scheduler:default", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:ref",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
    },
    stepOutputs: [],
    feedback: {
      feedbackId: "feedback_rollout",
      taskId: "task_rollout",
      collectedAt: Date.now(),
      signals: [],
      metadata: { source: "test" },
    },
    learningSignals: [],
    learningObjects: [],
    rolloutRecord: {
      recordId: "rollout_123",
      candidateId: "candidate_123",
      status: "active",
      version: 1,
      strategyKind: "L1_evaluate",
      target: "planning_policy",
      startedAt: Date.now(),
      updatedAt: Date.now(),
      lane: "shadow",
    },
    timeline: [],
    outcome: {
      score: 0.95,
      issues: [],
      confidence: 0.95,
    },
    evaluationReport: {
      score: 0.95,
      verdict: "accept",
      confidence: 0.95,
    },
    qualityGate: {
      accepted: true,
      reasonCodes: [],
      releaseStage: "auto",
    },
    replanDecision: {
      shouldReplan: false,
      reason: "no_replan_needed",
      trigger: "planning.no_replan_required",
    },
    graphPatch: null,
    harnessDecision: null,
  };

  assert.ok(resultWithRollout.rolloutRecord != null);
  assert.equal(resultWithRollout.rolloutRecord.recordId, "rollout_123");
  assert.equal(resultWithRollout.rolloutRecord.status, "active");
});

test("OapeflirLoopResult interface accepts harnessDecision", () => {
  const resultWithHarness: OapeflirLoopResult = {
    observation: {
      observedAt: Date.now(),
      task: {
        taskId: "task_harness",
        timestamp: Date.now(),
        objective: "Test",
        currentPhase: "planning",
        userIntent: { raw: "Test", normalized: "Test", confidence: 0.8 },
        blockers: [],
        relevantMemory: [],
        fileRefs: [],
        metrics: {},
      },
      system: { healthStatus: "ok" },
      eventFlow: { events: [] },
      goalDecomposition: { goals: [] },
      memory: { relevantMemories: [] },
    },
    assessment: {
      taskId: "task_harness",
      timestamp: Date.now(),
      situationRef: "assessment:test",
      phase: "pre-execution",
      complexity: "moderate",
      risk: "medium",
      riskAssessment: { level: "medium", factors: [] },
      routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
      resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
      approvalPolicy: { required: false, level: "none" },
      executionMode: "auto",
      suggestedActions: [],
    },
    plan: {
      planId: "plan_harness",
      taskId: "task_harness",
      version: 1,
      assessmentRef: "assessment:ref",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    },
    planGraphBundle: {
      planGraphBundleId: "bundle_harness",
      harnessRunId: "harness:harness",
      graphVersion: 1,
      createdAt: new Date().toISOString(),
      graph: {
        graphId: "graph_harness",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash",
      },
      schedulerPolicy: { policyId: "scheduler:default", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:ref",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
    },
    stepOutputs: [],
    feedback: {
      feedbackId: "feedback_harness",
      taskId: "task_harness",
      collectedAt: Date.now(),
      signals: [],
      metadata: { source: "test" },
    },
    learningSignals: [],
    learningObjects: [],
    rolloutRecord: null,
    timeline: [],
    outcome: {
      score: 0.9,
      issues: [],
      confidence: 0.9,
    },
    evaluationReport: {
      score: 0.9,
      verdict: "accept",
      confidence: 0.9,
    },
    qualityGate: {
      accepted: true,
      reasonCodes: [],
      releaseStage: "auto",
    },
    replanDecision: {
      shouldReplan: false,
      reason: "no_replan_needed",
      trigger: "planning.no_replan_required",
    },
    graphPatch: null,
    harnessDecision: {
      decisionId: "decision_123",
      harnessDecisionId: "harness_decision_123",
      decisionKind: "approve",
      reasonCode: "oapeflir.accept_decision",
      action: "accept",
      reasonCodes: ["oapeflir.accept_decision", "harness.loop_continue"],
      confidence: 0.95,
      createdAt: new Date().toISOString(),
    },
  };

  assert.ok(resultWithHarness.harnessDecision != null);
  assert.equal(resultWithHarness.harnessDecision.decisionKind, "approve");
  assert.equal(resultWithHarness.harnessDecision.action, "accept");
});

test("OapeflirLoopInput workflow field is required", () => {
  // This test documents that workflow is required in OapeflirLoopInput
  // When workflow is missing, produceStageRationale should be called instead
  const minimalInput: OapeflirLoopInput = {
    taskId: "task_minimal",
    objective: "Minimal task",
    workflow: {
      workflow: { workflowId: "wf_minimal", divisionId: "coding", steps: [] },
      executionSteps: [],
      planReason: "minimal",
      dependencyEdges: [],
    },
  };

  // The key difference is that without workflow, run() will call produceStageRationale
  // This is tested elsewhere but the type system enforces workflow presence
  assert.ok(minimalInput.workflow != null);
});

test("OapeflirLoopResult with graphPatch indicates replanning occurred", () => {
  const resultWithPatch: OapeflirLoopResult = {
    observation: {
      observedAt: Date.now(),
      task: {
        taskId: "task_patch",
        timestamp: Date.now(),
        objective: "Test",
        currentPhase: "planning",
        userIntent: { raw: "Test", normalized: "Test", confidence: 0.8 },
        blockers: [],
        relevantMemory: [],
        fileRefs: [],
        metrics: {},
      },
      system: { healthStatus: "ok" },
      eventFlow: { events: [] },
      goalDecomposition: { goals: [] },
      memory: { relevantMemories: [] },
    },
    assessment: {
      taskId: "task_patch",
      timestamp: Date.now(),
      situationRef: "assessment:test",
      phase: "pre-execution",
      complexity: "moderate",
      risk: "medium",
      riskAssessment: { level: "medium", factors: [] },
      routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
      resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
      approvalPolicy: { required: false, level: "none" },
      executionMode: "auto",
      suggestedActions: [],
    },
    plan: {
      planId: "plan_patch",
      taskId: "task_patch",
      version: 2,
      assessmentRef: "assessment:ref",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
      parentVersion: 1,
    },
    planGraphBundle: {
      planGraphBundleId: "bundle_patch",
      harnessRunId: "harness:patch",
      graphVersion: 2,
      createdAt: new Date().toISOString(),
      graph: {
        graphId: "graph_patch",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash",
      },
      schedulerPolicy: { policyId: "scheduler:default", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:ref",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
    },
    stepOutputs: [],
    feedback: {
      feedbackId: "feedback_patch",
      taskId: "task_patch",
      collectedAt: Date.now(),
      signals: [],
      metadata: { source: "test" },
    },
    learningSignals: [],
    learningObjects: [],
    rolloutRecord: null,
    timeline: [],
    outcome: {
      score: 0.7,
      issues: ["replanned"],
      confidence: 0.8,
    },
    evaluationReport: {
      score: 0.7,
      verdict: "repair",
      confidence: 0.8,
    },
    qualityGate: {
      accepted: false,
      reasonCodes: ["quality_gate_failed"],
      releaseStage: "repair",
    },
    replanDecision: {
      shouldReplan: true,
      reason: "quality_gate_replan",
      trigger: "planning.quality_gate_replan",
    },
    graphPatch: {
      harnessRunId: "oapeflir_run:task_patch",
      baseGraphVersion: 1,
      newGraphVersion: 2,
      operations: [],
      affectedExecutedNodes: [],
      affectedSideEffects: [],
      compatibilityClass: "safe_append",
      policyProofRef: { artifactId: "policy:task_patch", uri: "policy://task_patch" },
      auditRef: { artifactId: "audit:task_patch", uri: "audit://task_patch" },
    },
    harnessDecision: null,
  };

  assert.ok(resultWithPatch.graphPatch != null);
  assert.equal(resultWithPatch.graphPatch.newGraphVersion, 2);
  assert.equal(resultWithPatch.replanDecision.shouldReplan, true);
  assert.equal(resultWithPatch.plan.parentVersion, 1);
});
