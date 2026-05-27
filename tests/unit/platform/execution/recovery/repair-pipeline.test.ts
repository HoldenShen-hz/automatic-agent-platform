import assert from "node:assert/strict";
import test from "node:test";

import {
  RepairPipeline,
  DEFAULT_PIPELINE_OPTIONS,
  type PipelineState,
  type PipelineStage,
  type PipelineOptions,
} from "../../../../../src/platform/five-plane-execution/recovery/repair-pipeline.js";
import { createTaskCard } from "../../../../../src/platform/five-plane-execution/recovery/task-card.js";
import type { ValidationReport, CheckResult } from "../../../../../src/platform/five-plane-execution/recovery/validation-report.js";
import type { ReviewReport } from "../../../../../src/platform/five-plane-execution/recovery/review-report.js";
import type { PatchBundle } from "../../../../../src/platform/five-plane-execution/recovery/patch-bundle.js";
import type { ReleaseRecord } from "../../../../../src/platform/five-plane-execution/recovery/release-record.js";

function createTestTaskCard() {
  return createTaskCard({
    taskId: "task-test-1",
    title: "Test Task",
    objective: "Complete test",
    riskLevel: "medium",
    maxRepairRounds: 3,
  });
}

function makeMockValidationReport(): ValidationReport {
  return {
    reportId: "v1",
    taskId: "task-1",
    bundleId: "b1",
    decision: "fail",
    checks: [] as CheckResult[],
    summary: "",
    createdAt: new Date().toISOString(),
  };
}

function makeMockReviewReport(): ReviewReport {
  return {
    reportId: "r1",
    taskId: "task-1",
    bundleId: "b1",
    reviewerAgentId: "agent-1",
    verdict: "reject",
    issues: [],
    comments: "",
    createdAt: new Date().toISOString(),
    durationMs: 100,
  };
}

function makeMockPatchBundle(): PatchBundle {
  return {
    bundleId: "bundle-1",
    taskId: "task-1",
    changedFiles: [],
    totalDiffLines: 0,
    authorAgentId: "agent-1",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

function makeMockReleaseRecord(): ReleaseRecord {
  return {
    recordId: "rel-1",
    taskId: "task-1",
    bundleId: "bundle-1",
    decision: "approved",
    approvals: [],
    createdAt: new Date().toISOString(),
  };
}

test("DEFAULT_PIPELINE_OPTIONS has expected values [repair-pipeline]", () => {
  assert.equal(DEFAULT_PIPELINE_OPTIONS.maxRepairRounds, 2);
  assert.equal(DEFAULT_PIPELINE_OPTIONS.maxModelEscalations, 1);
  assert.equal(DEFAULT_PIPELINE_OPTIONS.enableAutomaticRepair, true);
});

test("RepairPipeline initializes with plan stage [repair-pipeline]", () => {
  const card = createTestTaskCard();
  const pipeline = new RepairPipeline(card);

  const state = pipeline.getState();
  assert.equal(state.currentStage, "plan");
  assert.equal(state.repairRound, 0);
  assert.equal(state.escalated, false);
  assert.deepEqual(state.stageHistory, []);
  assert.ok(state.startedAt.length > 0);
  assert.ok(state.updatedAt.length > 0);
});

test("RepairPipeline.getTaskCard returns the task card [repair-pipeline]", () => {
  const card = createTestTaskCard();
  const pipeline = new RepairPipeline(card);

  assert.equal(pipeline.getTaskCard().taskId, "task-test-1");
});

test("RepairPipeline.isComplete returns false initially [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  assert.equal(pipeline.isComplete(), false);
});

test("RepairPipeline.isComplete returns true when completed [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.complete();
  assert.equal(pipeline.isComplete(), true);
});

test("RepairPipeline.isComplete returns true when failed [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.fail("test failure");
  assert.equal(pipeline.isComplete(), true);
});

test("RepairPipeline.hasEscalated returns false initially [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  assert.equal(pipeline.hasEscalated(), false);
});

test("RepairPipeline.transitionTo updates currentStage and stageHistory [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.transitionTo("build");

  const state = pipeline.getState();
  assert.equal(state.currentStage, "build");
  assert.deepEqual(state.stageHistory, ["build"]);
});

test("RepairPipeline.transitionTo accumulates stageHistory [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.transitionTo("build");
  pipeline.transitionTo("review");

  const state = pipeline.getState();
  assert.equal(state.currentStage, "review");
  assert.deepEqual(state.stageHistory, ["build", "review"]);
});

test("RepairPipeline.complete sets currentStage to completed [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.complete();

  const state = pipeline.getState();
  assert.equal(state.currentStage, "completed");
});

test("RepairPipeline.fail sets currentStage to failed [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.fail("intentional failure");

  const state = pipeline.getState();
  assert.equal(state.currentStage, "failed");
});

test("RepairPipeline.escalate sets escalated true and currentStage to escalated [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.escalate("test escalation");

  const state = pipeline.getState();
  assert.equal(state.escalated, true);
  assert.equal(state.currentStage, "escalated");
});

test("RepairPipeline.incrementRepairRound increments repairRound and sets stage to repair [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.incrementRepairRound();

  const state = pipeline.getState();
  assert.equal(state.repairRound, 1);
  assert.equal(state.currentStage, "repair");
});

test("RepairPipeline.shouldRepair returns true when auto repair enabled and budget available [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  assert.equal(pipeline.shouldRepair(), true);
});

test("RepairPipeline.shouldRepair returns false when repair budget exhausted [repair-pipeline]", () => {
  const card = createTaskCard({
    taskId: "task-test-2",
    title: "Test",
    objective: "Test",
    riskLevel: "medium",
    maxRepairRounds: 0,
  });
  const pipeline = new RepairPipeline(card);
  assert.equal(pipeline.shouldRepair(), false);
});

test("RepairPipeline.shouldRepair returns false when automatic repair disabled [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard(), { enableAutomaticRepair: false });
  assert.equal(pipeline.shouldRepair(), false);
});

test("RepairPipeline.shouldRepair respects maxRepairRounds option [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard(), { maxRepairRounds: 1 });
  pipeline.incrementRepairRound(); // repairRound becomes 1

  assert.equal(pipeline.shouldRepair(), false);
});

test("RepairPipeline.handleValidationFailure escalates L3 failure immediately [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const mockReport = makeMockValidationReport();

  const result = pipeline.handleValidationFailure("secret_exposure", mockReport);

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("L3"));
});

test("RepairPipeline.handleValidationFailure repairs L1 failure within budget [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const mockReport = makeMockValidationReport();

  const result = pipeline.handleValidationFailure("schema_error", mockReport);

  assert.equal(result.action, "repair");
  assert.ok(result.reason.includes("round 1"));
});

test("RepairPipeline.handleValidationFailure escalates when repair budget exhausted [repair-pipeline]", () => {
  const card = createTaskCard({
    taskId: "task-test-3",
    title: "Test",
    objective: "Test",
    riskLevel: "medium",
    maxRepairRounds: 1,
  });
  const pipeline = new RepairPipeline(card);
  pipeline.incrementRepairRound(); // Exhaust repair budget

  const mockReport = makeMockValidationReport();
  const result = pipeline.handleValidationFailure("schema_error", mockReport);

  assert.equal(result.action, "escalate");
  // When repair budget is exhausted, shouldEscalate returns true before shouldRepair check
  // so the reason reflects the failure level
  assert.ok(result.reason.includes("L1") || result.reason.includes("schema_error"));
});

test("RepairPipeline.handleReviewFailure works similarly to handleValidationFailure [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const mockReport = makeMockReviewReport();

  const result = pipeline.handleReviewFailure("lint_error", mockReport);

  assert.equal(result.action, "repair");
});

test("RepairPipeline.setPatchBundle updates state [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const bundle = makeMockPatchBundle();

  pipeline.setPatchBundle(bundle);

  const state = pipeline.getState();
  assert.equal(state.patchBundle?.bundleId, "bundle-1");
});

test("RepairPipeline.setReviewReport updates state [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const report = makeMockReviewReport();

  pipeline.setReviewReport(report);

  const state = pipeline.getState();
  assert.equal(state.reviewReport?.reportId, "r1");
});

test("RepairPipeline.setValidationReport updates state [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const report = makeMockValidationReport();

  pipeline.setValidationReport(report);

  const state = pipeline.getState();
  assert.equal(state.validationReport?.reportId, "v1");
});

test("RepairPipeline.setReleaseRecord updates state [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const record = makeMockReleaseRecord();

  pipeline.setReleaseRecord(record);

  const state = pipeline.getState();
  assert.equal(state.releaseRecord?.recordId, "rel-1");
});

test("PipelineStage type accepts all valid stages [repair-pipeline]", () => {
  const stages: PipelineStage[] = ["plan", "build", "review", "validate", "repair", "re_validate", "release", "escalated", "completed", "failed"];
  assert.equal(stages.length, 10);
});

test("RepairPipeline options override defaults [repair-pipeline]", () => {
  const customOptions: Partial<PipelineOptions> = {
    maxRepairRounds: 5,
    maxModelEscalations: 3,
    enableAutomaticRepair: false,
  };

  const pipeline = new RepairPipeline(createTestTaskCard(), customOptions);

  // shouldRepair should return false because enableAutomaticRepair is false
  assert.equal(pipeline.shouldRepair(), false);
});

test("RepairPipeline handles non-autoRepairable L2 failure with escalation [repair-pipeline]", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  const mockReport = makeMockValidationReport();

  // complex_repair_failure is L2 and not autoRepairable
  const result = pipeline.handleValidationFailure("complex_repair_failure", mockReport);

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("Non-repairable"));
});
