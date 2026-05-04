import test from "node:test";
import assert from "node:assert/strict";

import {
  DualChannelStepOutputSchema,
  FeedbackSignalSchema,
  ImprovementCandidateSchema,
  PlanSchema,
  RolloutRecordSchema,
  TaskSituationSchema,
  UnifiedAssessmentSchema,
} from "../../../../../src/platform/orchestration/oapeflir/types/index.js";

test("agent-loop phase-1 schemas accept valid minimal payloads", () => {
  assert.doesNotThrow(() => TaskSituationSchema.parse({
    taskId: "task_1",
    timestamp: 1,
    objective: "fix foo",
    currentPhase: "planning",
    userIntent: {
      raw: "fix foo",
      normalized: "fix foo",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 1,
      relevantFiles: [{ path: "src/foo.ts" }],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["src/foo.ts"],
    metrics: {},
  }));

  assert.doesNotThrow(() => UnifiedAssessmentSchema.parse({
    taskId: "task_1",
    timestamp: 2,
    situationRef: "task_situation:task_1:1",
    phase: "pre-execution",
    complexity: "simple",
    risk: "low",
    riskAssessment: {
      level: "low",
      factors: [],
    },
    routingDecision: {
      division: "coding",
      workflow: "single-step",
      rationale: "small task",
    },
    resourceAllocation: {
      modelClass: "small",
      maxTokens: 1000,
      timeoutMs: 1000,
    },
    approvalPolicy: {
      required: false,
      level: "none",
    },
    executionMode: "auto",
    suggestedActions: [],
  }));

  assert.doesNotThrow(() => PlanSchema.parse({
    planId: "plan_1",
    taskId: "task_1",
    version: 1,
    assessmentRef: "assessment:task_1:2",
    strategy: "linear",
    steps: [
      {
        stepId: "step_1",
        action: "read",
        inputs: {},
        dependencies: [],
        status: "pending",
        timeout: 1000,
        retryPolicy: {
          maxRetries: 0,
          backoffMs: 0,
        },
      },
    ],
    createdAt: 3,
  }));

  assert.doesNotThrow(() => DualChannelStepOutputSchema.parse({
    stepId: "step_1",
    planRef: "plan_1",
    harnessRunId: "harness_1",
    nodeRunId: "node_run_1",
    userFacingResult: {
      summary: "done",
      artifacts: [],
    },
    systemTelemetry: {
      durationMs: 10,
      tokensUsed: 20,
      modelId: "demo",
      retryCount: 0,
      validationPassed: true,
    },
    trustScore: {
      score: 0.9,
      band: "trusted",
      reasons: [],
    },
  }));

  assert.doesNotThrow(() => FeedbackSignalSchema.parse({
    signalId: "sig_1",
    harnessRunId: "harness_1",
    nodeRunId: "node_run_1",
    taskId: "task_1",
    source: "execution",
    category: "success",
    severity: "info",
    payload: {},
    stepOutputRefs: [],
    timestamp: 4,
    trustScore: {
      overallScore: 0.95,
      sourceCredibility: 0.9,
      historicalAccuracy: 0.92,
      attackSurface: 0.1,
    },
  }));

  assert.doesNotThrow(() => ImprovementCandidateSchema.parse({
    candidateId: "candidate_1",
    taskId: "task_1",
    sourceSignalRefs: ["sig_1"],
    changeScope: "policy",
    description: "tighten policy",
    expectedBenefit: "less drift",
    status: "approved",
    createdAt: 5,
  }));

  assert.doesNotThrow(() => RolloutRecordSchema.parse({
    recordId: "rollout_1",
    candidateId: "candidate_1",
    level: "shadow",
    previousLevel: "suggest",
    transitionedAt: 6,
    evidence: ["sig_1"],
  }));
});

test("agent-loop phase-1 schemas reject invalid payloads", () => {
  assert.throws(() => TaskSituationSchema.parse({
    taskId: "task_1",
    timestamp: "bad",
  }));
  assert.throws(() => UnifiedAssessmentSchema.parse({
    taskId: "task_1",
    timestamp: 1,
    situationRef: "task_situation:task_1:1",
    phase: "pre-execution",
    complexity: "bad",
  }));
  assert.throws(() => PlanSchema.parse({
    planId: "plan_1",
    taskId: "task_1",
    version: 0,
    assessmentRef: "assessment:task_1:1",
    strategy: "linear",
    steps: [],
    createdAt: 1,
  }));
  assert.throws(() => FeedbackSignalSchema.parse({
    signalId: "sig_1",
    taskId: "task_1",
    source: "execution",
    category: "warning",
    severity: "info",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1,
  }));
  assert.throws(() => RolloutRecordSchema.parse({
    recordId: "rollout_1",
    candidateId: "candidate_1",
    level: "canary",
    transitionedAt: 1,
    evidence: [],
  }));
});

test("PlanSchema accepts graph-native fields alongside legacy steps", () => {
  const plan = PlanSchema.parse({
    planId: "plan_graph_1",
    taskId: "task_graph_1",
    version: 1,
    assessmentRef: "assessment:task_graph_1:1",
    strategy: "goal_driven",
    steps: [
      {
        stepId: "step_1",
        action: "read",
        timeout: 1000,
      },
    ],
    nodes: [
      {
        nodeId: "node_1",
        nodeType: "tool",
        inputRefs: [],
        riskClass: "high",
        budgetIntent: {
          amount: 3,
          currency: "USD",
          resourceKinds: ["compute"],
        },
        sideEffectProfile: {
          mayCommitExternalEffect: true,
          reversible: false,
        },
        timeoutMs: 1000,
      },
    ],
    edges: [
      {
        edgeId: "edge_1",
        fromNodeId: "node_1",
        toNodeId: "node_1",
        condition: { type: "always" },
        dependencyType: "soft",
      },
    ],
    entryNodeIds: ["node_1"],
    graphConstraints: {
      joinStrategy: "all",
    },
    createdAt: 3,
  });

  assert.equal(plan.nodes[0]?.nodeId, "node_1");
  assert.equal(plan.edges[0]?.dependencyType, "soft");
  assert.deepEqual(plan.entryNodeIds, ["node_1"]);
  assert.deepEqual(plan.graphConstraints, { joinStrategy: "all" });
});

test("TaskSituationSchema accepts blockers with various severities", () => {
  assert.doesNotThrow(() => TaskSituationSchema.parse({
    taskId: "task_blockers",
    timestamp: 1,
    objective: "task with blockers",
    currentPhase: "planning",
    userIntent: {
      raw: "test",
      normalized: "test",
      confidence: 0.9,
    },
    blockers: [
      { description: "low blocker", severity: "low" },
      { description: "medium blocker", severity: "medium" },
      { description: "high blocker", severity: "high" },
      { description: "critical blocker", severity: "critical" },
    ],
    codebaseSnapshot: {
      rootPath: process.cwd(),
      fileCount: 1,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: [],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  }));
});

test("UnifiedAssessmentSchema accepts all execution modes", () => {
  for (const mode of ["auto", "supervised", "manual"] as const) {
    assert.doesNotThrow(() => UnifiedAssessmentSchema.parse({
      taskId: "task_mode",
      timestamp: 1,
      situationRef: "task_situation:task_mode:1",
      phase: "pre-execution",
      complexity: "simple",
      risk: "low",
      riskAssessment: {
        level: "low",
        factors: [],
      },
      routingDecision: {
        division: "coding",
        workflow: "test",
        rationale: "test",
      },
      resourceAllocation: {
        modelClass: "small",
        maxTokens: 1000,
        timeoutMs: 1000,
      },
      approvalPolicy: {
        required: false,
        level: "none",
      },
      executionMode: mode,
      suggestedActions: [],
    }));
  }
});
