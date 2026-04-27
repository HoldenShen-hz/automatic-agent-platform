import assert from "node:assert/strict";
import test from "node:test";

// OAPEFLIR barrel test - main entry point for OAPEFLIR module
import {
  // Shared types
  TaskPhaseSchema,
  BlockerSchema,
  RelevantFileSchema,
  CodebaseSnapshotSchema,
  EnvironmentContextSchema,
  HistoricalContextSchema,
  UserIntentSchema,
  RetryPolicySchema,
  type TaskPhase,
  type Blocker,
  type RelevantFile,
  type CodebaseSnapshot,
  type EnvironmentContext,
  type HistoricalContext,
  type UserIntent,
  type RetryPolicy,
  // TaskSituation
  TaskSituationSchema,
  parseTaskSituation,
  createTaskSituationRef,
  type TaskSituation,
  // UnifiedAssessment
  UnifiedAssessmentSchema,
  parseUnifiedAssessment,
  createAssessmentRef,
  AssessmentPhaseSchema,
  AssessmentComplexitySchema,
  AssessmentRiskSchema,
  ApprovalLevelSchema,
  ExecutionModeSchema,
  type UnifiedAssessment,
  type AssessmentPhase,
  type AssessmentComplexity,
  type AssessmentRisk,
  type ApprovalLevel,
  type ExecutionMode,
  // Plan
  PlanSchema,
  PlanStepSchema,
  parsePlan,
  PlanStrategySchema,
  PlanStepStatusSchema,
  type Plan,
  type PlanStrategy,
  type PlanStep,
  type PlanStepStatus,
} from "../../../../../src/platform/orchestration/oapeflir/index.js";

test("TaskPhaseSchema is exported", () => {
  assert.ok(TaskPhaseSchema !== undefined);
});

test("BlockerSchema is exported", () => {
  assert.ok(BlockerSchema !== undefined);
});

test("RelevantFileSchema is exported", () => {
  assert.ok(RelevantFileSchema !== undefined);
});

test("CodebaseSnapshotSchema is exported", () => {
  assert.ok(CodebaseSnapshotSchema !== undefined);
});

test("EnvironmentContextSchema is exported", () => {
  assert.ok(EnvironmentContextSchema !== undefined);
});

test("HistoricalContextSchema is exported", () => {
  assert.ok(HistoricalContextSchema !== undefined);
});

test("UserIntentSchema is exported", () => {
  assert.ok(UserIntentSchema !== undefined);
});

test("RetryPolicySchema is exported", () => {
  assert.ok(RetryPolicySchema !== undefined);
});

test("TaskSituationSchema is exported", () => {
  assert.ok(TaskSituationSchema !== undefined);
});

test("parseTaskSituation is exported as function", () => {
  assert.equal(typeof parseTaskSituation, "function");
});

test("createTaskSituationRef is exported as function", () => {
  assert.equal(typeof createTaskSituationRef, "function");
});

test("UnifiedAssessmentSchema is exported", () => {
  assert.ok(UnifiedAssessmentSchema !== undefined);
});

test("parseUnifiedAssessment is exported as function", () => {
  assert.equal(typeof parseUnifiedAssessment, "function");
});

test("createAssessmentRef is exported as function", () => {
  assert.equal(typeof createAssessmentRef, "function");
});

test("PlanSchema is exported", () => {
  assert.ok(PlanSchema !== undefined);
});

test("PlanStepSchema is exported", () => {
  assert.ok(PlanStepSchema !== undefined);
});

test("parsePlan is exported as function", () => {
  assert.equal(typeof parsePlan, "function");
});

test("PlanStrategySchema is exported", () => {
  assert.ok(PlanStrategySchema !== undefined);
});

test("PlanStepStatusSchema is exported", () => {
  assert.ok(PlanStepStatusSchema !== undefined);
});

test("TaskPhase type works correctly", () => {
  const phase: TaskPhase = "executing";
  assert.equal(phase, "executing");
});

test("AssessmentPhase type works correctly", () => {
  const phase: AssessmentPhase = "planning";
  assert.equal(phase, "planning");
});

test("AssessmentComplexity type works correctly", () => {
  const complexity: AssessmentComplexity = "medium";
  assert.equal(complexity, "medium");
});

test("AssessmentRisk type works correctly", () => {
  const risk: AssessmentRisk = "low";
  assert.equal(risk, "low");
});

test("ApprovalLevel type works correctly", () => {
  const level: ApprovalLevel = "manual";
  assert.equal(level, "manual");
});

test("ExecutionMode type works correctly", () => {
  const mode: ExecutionMode = "auto";
  assert.equal(mode, "auto");
});

test("PlanStrategy type works correctly", () => {
  const strategy: PlanStrategy = "sequential";
  assert.equal(strategy, "sequential");
});

test("PlanStepStatus type works correctly", () => {
  const status: PlanStepStatus = "pending";
  assert.equal(status, "pending");
});