import test from "node:test";
import assert from "node:assert/strict";

import {
  TaskSituationSchema,
  parseTaskSituation,
  UnifiedAssessmentSchema,
  parseUnifiedAssessment,
  UnifiedPlanSchema,
  parseUnifiedPlan,
  FeedbackSignalSchema,
  ImprovementCandidateSchema,
  RolloutRecordSchema,
  DualChannelStepOutputSchema,
  FeedbackSchema,
  LearningSignalSchema,
  parseFeedback,
  type UnifiedObservation,
  type TaskSituation,
  type UnifiedAssessment,
  type PlanStep,
  type UnifiedPlan,
  type FeedbackSignal,
  type ImprovementCandidate,
  type RolloutRecord,
  type DualChannelStepOutput,
  type Feedback,
  type LearningSignal,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/dto.js";

test("dto exports TaskSituationSchema and parseTaskSituation", () => {
  assert.equal(typeof TaskSituationSchema, "object");
  assert.equal(typeof parseTaskSituation, "function");
});

test("dto exports UnifiedAssessmentSchema and parseUnifiedAssessment", () => {
  assert.equal(typeof UnifiedAssessmentSchema, "object");
  assert.equal(typeof parseUnifiedAssessment, "function");
});

test("dto exports UnifiedPlanSchema and parseUnifiedPlan", () => {
  assert.equal(typeof UnifiedPlanSchema, "object");
  assert.equal(typeof parseUnifiedPlan, "function");
});

test("dto exports FeedbackSignalSchema", () => {
  assert.equal(typeof FeedbackSignalSchema, "object");
});

test("dto exports ImprovementCandidateSchema", () => {
  assert.equal(typeof ImprovementCandidateSchema, "object");
});

test("dto exports RolloutRecordSchema", () => {
  assert.equal(typeof RolloutRecordSchema, "object");
});

test("dto exports DualChannelStepOutputSchema", () => {
  assert.equal(typeof DualChannelStepOutputSchema, "object");
});

test("dto exports FeedbackSchema and parseFeedback", () => {
  assert.equal(typeof FeedbackSchema, "object");
  assert.equal(typeof parseFeedback, "function");
});

test("dto exports LearningSignalSchema", () => {
  assert.equal(typeof LearningSignalSchema, "object");
});

test("dto type exports are all present", () => {
  const _obs: UnifiedObservation | undefined = undefined;
  const _task: TaskSituation | undefined = undefined;
  const _assess: UnifiedAssessment | undefined = undefined;
  const _plan: UnifiedPlan | undefined = undefined;
  const _step: PlanStep | undefined = undefined;
  const _signal: FeedbackSignal | undefined = undefined;
  const _candidate: ImprovementCandidate | undefined = undefined;
  const _rollout: RolloutRecord | undefined = undefined;
  const _output: DualChannelStepOutput | undefined = undefined;
  const _feedback: Feedback | undefined = undefined;
  const _learning: LearningSignal | undefined = undefined;
  assert.ok(true);
});

test("parseTaskSituation validates valid TaskSituation", () => {
  const validSituation = {
    taskId: "task_valid",
    timestamp: Date.now(),
    objective: "test objective",
    currentPhase: "planning" as const,
    userIntent: {
      raw: "test",
      normalized: "test",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/tmp",
      fileCount: 1,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "22.0.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: [],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const result = parseTaskSituation(validSituation);
  assert.equal(result.taskId, "task_valid");
  assert.equal(result.objective, "test objective");
});

test("parseUnifiedAssessment validates valid UnifiedAssessment", () => {
  const validAssessment = {
    taskId: "task_assess",
    timestamp: Date.now(),
    situationRef: "situation:task_assess:1",
    phase: "pre-execution" as const,
    complexity: "moderate" as const,
    risk: "medium" as const,
    riskAssessment: {
      level: "medium" as const,
      factors: [],
    },
    routingDecision: {
      division: "coding",
      workflow: "multi-step",
      rationale: "test",
    },
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: 5000,
      timeoutMs: 60000,
    },
    approvalPolicy: {
      required: false,
      level: "none" as const,
    },
    executionMode: "auto" as const,
    suggestedActions: [],
  };

  const result = parseUnifiedAssessment(validAssessment);
  assert.equal(result.taskId, "task_assess");
  assert.equal(result.complexity, "moderate");
});

test("parseFeedback validates valid FeedbackBatch", () => {
  const validFeedback = {
    feedbackId: "fb_1",
    taskId: "task_fb",
    executionId: null,
    planId: null,
    outcome: "completed",
    signals: [
      {
        signalId: "sig_1",
        taskId: "task_fb",
        source: "execution" as const,
        category: "success" as const,
        severity: "info" as const,
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  };

  const result = parseFeedback(validFeedback);
  assert.equal(result.feedbackId, "fb_1");
  assert.equal(result.signals.length, 1);
});

test("dto re-exports Feedback alias for FeedbackBatch", () => {
  const feedback: Feedback = {
    feedbackId: "fb_alias",
    taskId: "task_alias",
    executionId: null,
    planId: null,
    outcome: "partial",
    signals: [],
    emittedAt: Date.now(),
  };
  assert.equal(feedback.feedbackId, "fb_alias");
});
