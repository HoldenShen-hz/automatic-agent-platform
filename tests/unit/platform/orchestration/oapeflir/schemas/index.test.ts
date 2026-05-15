import test from "node:test";
import assert from "node:assert/strict";

// Re-export all Zod schemas and parse functions for stage boundary validation
import * as schemasModule from "../../../../../../src/platform/five-plane-orchestration/oapeflir/schemas/index.js";
import * as validatorsModule from "../../../../../../src/platform/five-plane-orchestration/oapeflir/schemas/validators.js";

test("schemas module exports TaskPhaseSchema", () => {
  assert.ok("TaskPhaseSchema" in schemasModule);
});

test("schemas module exports BlockerSchema", () => {
  assert.ok("BlockerSchema" in schemasModule);
});

test("schemas module exports RelevantFileSchema", () => {
  assert.ok("RelevantFileSchema" in schemasModule);
});

test("schemas module exports CodebaseSnapshotSchema", () => {
  assert.ok("CodebaseSnapshotSchema" in schemasModule);
});

test("schemas module exports EnvironmentContextSchema", () => {
  assert.ok("EnvironmentContextSchema" in schemasModule);
});

test("schemas module exports HistoricalContextSchema", () => {
  assert.ok("HistoricalContextSchema" in schemasModule);
});

test("schemas module exports UserIntentSchema", () => {
  assert.ok("UserIntentSchema" in schemasModule);
});

test("schemas module exports RetryPolicySchema", () => {
  assert.ok("RetryPolicySchema" in schemasModule);
});

test("schemas module exports TaskSituationSchema", () => {
  assert.ok("TaskSituationSchema" in schemasModule);
});

test("schemas module exports parseTaskSituation function", () => {
  assert.ok("parseTaskSituation" in schemasModule);
});

test("schemas module exports createTaskSituationRef function", () => {
  assert.ok("createTaskSituationRef" in schemasModule);
});

test("schemas module exports UnifiedAssessmentSchema", () => {
  assert.ok("UnifiedAssessmentSchema" in schemasModule);
});

test("schemas module exports parseUnifiedAssessment function", () => {
  assert.ok("parseUnifiedAssessment" in schemasModule);
});

test("schemas module exports createAssessmentRef function", () => {
  assert.ok("createAssessmentRef" in schemasModule);
});

test("schemas module exports AssessmentPhaseSchema", () => {
  assert.ok("AssessmentPhaseSchema" in schemasModule);
});

test("schemas module exports AssessmentComplexitySchema", () => {
  assert.ok("AssessmentComplexitySchema" in schemasModule);
});

test("schemas module exports AssessmentRiskSchema", () => {
  assert.ok("AssessmentRiskSchema" in schemasModule);
});

test("schemas module exports ApprovalLevelSchema", () => {
  assert.ok("ApprovalLevelSchema" in schemasModule);
});

test("schemas module exports ExecutionModeSchema", () => {
  assert.ok("ExecutionModeSchema" in schemasModule);
});

test("schemas module exports PlanSchema", () => {
  assert.ok("PlanSchema" in schemasModule);
});

test("schemas module exports PlanStepSchema", () => {
  assert.ok("PlanStepSchema" in schemasModule);
});

test("schemas module exports parsePlan function", () => {
  assert.ok("parsePlan" in schemasModule);
});

test("schemas module exports PlanStrategySchema", () => {
  assert.ok("PlanStrategySchema" in schemasModule);
});

test("schemas module exports PlanStepStatusSchema", () => {
  assert.ok("PlanStepStatusSchema" in schemasModule);
});

test("schemas module exports DualChannelStepOutputSchema", () => {
  assert.ok("DualChannelStepOutputSchema" in schemasModule);
});

test("schemas module exports parseDualChannelStepOutput function", () => {
  assert.ok("parseDualChannelStepOutput" in schemasModule);
});

test("schemas module exports FeedbackSignalSchema", () => {
  assert.ok("FeedbackSignalSchema" in schemasModule);
});

test("schemas module exports parseFeedbackSignal function", () => {
  assert.ok("parseFeedbackSignal" in schemasModule);
});

test("schemas module exports FeedbackSourceSchema", () => {
  assert.ok("FeedbackSourceSchema" in schemasModule);
});

test("schemas module exports FeedbackCategorySchema", () => {
  assert.ok("FeedbackCategorySchema" in schemasModule);
});

test("schemas module exports FeedbackSeveritySchema", () => {
  assert.ok("FeedbackSeveritySchema" in schemasModule);
});

test("schemas module exports ImprovementCandidateSchema", () => {
  assert.ok("ImprovementCandidateSchema" in schemasModule);
});

test("schemas module exports parseImprovementCandidate function", () => {
  assert.ok("parseImprovementCandidate" in schemasModule);
});

test("schemas module exports ImprovementChangeScopeSchema", () => {
  assert.ok("ImprovementChangeScopeSchema" in schemasModule);
});

test("schemas module exports ImprovementCandidateStatusSchema", () => {
  assert.ok("ImprovementCandidateStatusSchema" in schemasModule);
});

test("schemas module exports RolloutRecordSchema", () => {
  assert.ok("RolloutRecordSchema" in schemasModule);
});

test("schemas module exports parseRolloutRecord function", () => {
  assert.ok("parseRolloutRecord" in schemasModule);
});

test("schemas module exports RolloutLevelSchema", () => {
  assert.ok("RolloutLevelSchema" in schemasModule);
});

test("schemas module exports RolloutStatusSchema", () => {
  assert.ok("RolloutStatusSchema" in schemasModule);
});

test("validators module exports validateTaskSituation", () => {
  assert.ok("validateTaskSituation" in validatorsModule);
});

test("validators module exports validateUnifiedAssessment", () => {
  assert.ok("validateUnifiedAssessment" in validatorsModule);
});

test("validators module exports validatePlan", () => {
  assert.ok("validatePlan" in validatorsModule);
});

test("validators module exports validateStepOutputs", () => {
  assert.ok("validateStepOutputs" in validatorsModule);
});

test("validators module exports validateFeedbackSignals", () => {
  assert.ok("validateFeedbackSignals" in validatorsModule);
});

test("validators module exports validateImprovementCandidates", () => {
  assert.ok("validateImprovementCandidates" in validatorsModule);
});

test("validators module exports validateLearningObjects", () => {
  assert.ok("validateLearningObjects" in validatorsModule);
});

test("validators module exports validateRolloutRecord", () => {
  assert.ok("validateRolloutRecord" in validatorsModule);
});

test("validators module exports validateLearningSignalsArray", () => {
  assert.ok("validateLearningSignalsArray" in validatorsModule);
});

test("validators module exports BOUNDARY_STRATEGY", () => {
  assert.ok("BOUNDARY_STRATEGY" in validatorsModule);
});

test("BOUNDARY_STRATEGY contains all expected boundaries", () => {
  const strategy = validatorsModule.BOUNDARY_STRATEGY;
  assert.ok("O→A" in strategy);
  assert.ok("A→P" in strategy);
  assert.ok("P→E" in strategy);
  assert.ok("E→F" in strategy);
  assert.ok("F→L" in strategy);
  assert.ok("L→I" in strategy);
  assert.ok("I→R" in strategy);
});

test("BOUNDARY_STRATEGY has correct values", () => {
  const strategy = validatorsModule.BOUNDARY_STRATEGY;
  assert.equal(strategy["O→A"], "degrade");
  assert.equal(strategy["A→P"], "default");
  assert.equal(strategy["P→E"], "abort");
  assert.equal(strategy["E→F"], "skip");
  assert.equal(strategy["F→L"], "skip");
  assert.equal(strategy["L→I"], "skip");
  assert.equal(strategy["I→R"], "skip");
});