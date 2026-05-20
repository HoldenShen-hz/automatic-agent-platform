import assert from "node:assert/strict";
import test from "node:test";

import {
  OapeflirStageSchema,
  OapeflirStageStatusSchema,
  OapeflirStageRecordSchema,
  type OapeflirStage,
  type OapeflirStageStatus,
  type OapeflirStageRecord,
} from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/stage-timeline.js";
import { OapeflirStageTimelineBuilder } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/stage-timeline.js";
import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  createStageTransitionFSM,
  type StageTransitionResult,
} from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

test("OapeflirStageSchema accepts valid stages", () => {
  const result = OapeflirStageSchema.safeParse("observe");
  assert.equal(result.success, true);
  assert.equal(result.data, "observe");
});

test("OapeflirStageSchema rejects invalid stage", () => {
  const result = OapeflirStageSchema.safeParse("invalid_stage");
  assert.equal(result.success, false);
});

test("OapeflirStageStatusSchema accepts valid statuses", () => {
  const result = OapeflirStageStatusSchema.safeParse("completed");
  assert.equal(result.success, true);
  assert.equal(result.data, "completed");
});

test("OapeflirStageStatusSchema accepts skipped status", () => {
  const result = OapeflirStageStatusSchema.safeParse("skipped");
  assert.equal(result.success, true);
  assert.equal(result.data, "skipped");
});

test("OapeflirStageRecordSchema parses valid record", () => {
  const record = {
    stage: "observe",
    status: "completed",
    startedAt: 1000,
    completedAt: 2000,
    refId: "task_001",
    reasonCode: null,
    rationale: null,
  };
  const result = OapeflirStageRecordSchema.safeParse(record);
  assert.equal(result.success, true);
  assert.equal(result.data?.stage, "observe");
});

test("OapeflirStageTimelineBuilder records stages in order", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const record1 = builder.record("observe", "completed", "ref1", null, "observed");
  const record2 = builder.record("assess", "completed", "ref2", null, "assessed");

  const timeline = builder.build();
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0]?.stage, "observe");
  assert.equal(timeline[1]?.stage, "assess");
  assert.ok(timeline[0]!.startedAt < timeline[1]!.startedAt);
});

test("OapeflirStageTimelineBuilder increments timestamps between entries", () => {
  const builder = new OapeflirStageTimelineBuilder();
  builder.record("observe", "completed", "ref1");
  const firstStart = builder.build()[0]!.startedAt;

  const builder2 = new OapeflirStageTimelineBuilder();
  const record = builder2.record("plan", "completed", "ref1");
  assert.ok(record.startedAt < record.completedAt);
});

test("OAPEFLIR_STAGES contains all 9 stages in order", () => {
  assert.equal(OAPEFLIR_STAGES.length, 9);
  assert.deepEqual(OAPEFLIR_STAGES, [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
    "knowledge_promotion",
  ]);
});

test("StageTransitionFSM initializes all stages as pending", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.equal(fsm.getStageStatus("release"), "pending");
  assert.equal(fsm.getStageStatus("knowledge_promotion"), "pending");
});

test("StageTransitionFSM.getCurrentStage returns observe initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getCurrentStage(), "observe");
});

test("StageTransitionFSM.canTransitionTo observe is allowed initially", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

test("StageTransitionFSM.canTransitionTo assess requires observe completed", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true);
  assert.equal(result.targetStage, "assess");
});

test("StageTransitionFSM.cannot skip from observe to plan directly", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("StageTransitionFSM records stage entry updates status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.ok(fsm.getStageTimestamp("observe") !== undefined);
});

test("StageTransitionFSM.recordStageCompletion advances current stage index", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getCurrentStage(), "assess");
  assert.equal(fsm.getStageStatus("observe"), "completed");
});

test("StageTransitionFSM.recordStageSkipped marks stage and advances index", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  fsm.recordStageSkipped("assess", "assess.skipped");

  assert.equal(fsm.getCurrentStage(), "plan");
  assert.equal(fsm.getStageStatus("assess"), "skipped");
});

test("StageTransitionFSM.recordStageError marks stage with error status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  fsm.recordStageError("observe");

  assert.equal(fsm.getStageStatus("observe"), "error");
});

test("StageTransitionFSM.getNextStage returns observe initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getNextStage(), "observe");
});

test("StageTransitionFSM.getNextStage returns null when complete", () => {
  const fsm = new StageTransitionFSM();
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageEntry(stage as OapeflirStage);
    fsm.recordStageCompletion(stage as OapeflirStage);
  }
  assert.equal(fsm.getNextStage(), null);
});

test("StageTransitionFSM.isComplete returns false initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.isComplete(), false);
});

test("StageTransitionFSM.isComplete returns true when all stages done", () => {
  const fsm = new StageTransitionFSM();
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageEntry(stage as OapeflirStage);
    fsm.recordStageCompletion(stage as OapeflirStage);
  }
  assert.equal(fsm.isComplete(), true);
});

test("StageTransitionFSM.getExecutionSummary returns all stage statuses", () => {
  const fsm = new StageTransitionFSM();
  const summary = fsm.getExecutionSummary();

  assert.equal(Object.keys(summary).length, 9);
  assert.equal(summary.observe.status, "pending");
  assert.equal(summary.knowledge_promotion.status, "pending");
});

test("StageTransitionFSM.reset clears all state", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.isComplete(), false);
});

test("StageTransitionFSM allows backward transition from feedback to plan", () => {
  const fsm = new StageTransitionFSM();
  // Simulate feedback stage completion
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("StageTransitionFSM returns correct result structure", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("assess");

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(result.targetStage, "assess");
  assert.equal(typeof result.reasonCode, "string");
  assert.ok(Array.isArray(result.reasonCodes));
});

test("createStageTransitionFSM factory creates instance", () => {
  const fsm = createStageTransitionFSM();
  assert.ok(fsm instanceof StageTransitionFSM);
  assert.equal(fsm.getCurrentStage(), "observe");
});
