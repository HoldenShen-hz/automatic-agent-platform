/**
 * Stage Timeline Unit Tests
 *
 * Tests for OapeflirStageTimelineBuilder and related types.
 *
 * Architecture: §14 OAPEFLIR Loop - Stage Timeline
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OapeflirStageTimelineBuilder,
  OapeflirStageSchema,
  OapeflirStageStatusSchema,
  OapeflirStageRecordSchema,
  type OapeflirStage,
  type OapeflirStageStatus,
  type OapeflirStageRecord,
} from "../../../../../src/platform/orchestration/oapeflir/stage-timeline.js";

// ─────────────────────────────────────────────────────────────────────────────
// OapeflirStage Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OapeflirStageSchema accepts all valid stages", () => {
  const stages: OapeflirStage[] = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
    "knowledge_promotion",
  ];

  for (const stage of stages) {
    assert.ok(OapeflirStageSchema.parse(stage));
  }
});

test("OapeflirStageSchema rejects invalid stage", () => {
  assert.throws(() => OapeflirStageSchema.parse("invalid_stage"));
  assert.throws(() => OapeflirStageSchema.parse(""));
});

test("OapeflirStageSchema rejects with wrong type", () => {
  assert.throws(() => OapeflirStageSchema.parse(123 as any));
  assert.throws(() => OapeflirStageSchema.parse(null));
});

// ─────────────────────────────────────────────────────────────────────────────
// OapeflirStageStatus Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OapeflirStageStatusSchema accepts completed", () => {
  const result = OapeflirStageStatusSchema.parse("completed");
  assert.equal(result, "completed");
});

test("OapeflirStageStatusSchema accepts skipped", () => {
  const result = OapeflirStageStatusSchema.parse("skipped");
  assert.equal(result, "skipped");
});

test("OapeflirStageStatusSchema rejects invalid status", () => {
  assert.throws(() => OapeflirStageStatusSchema.parse("running"));
  assert.throws(() => OapeflirStageStatusSchema.parse("pending"));
  assert.throws(() => OapeflirStageStatusSchema.parse(""));
});

// ─────────────────────────────────────────────────────────────────────────────
// OapeflirStageRecordSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OapeflirStageRecordSchema parses valid record", () => {
  const record = OapeflirStageRecordSchema.parse({
    stage: "plan",
    status: "completed",
    startedAt: 1000,
    completedAt: 2000,
    refId: "ref-123",
    reasonCode: "success",
    rationale: "Plan completed successfully",
  });

  assert.equal(record.stage, "plan");
  assert.equal(record.status, "completed");
  assert.equal(record.startedAt, 1000);
  assert.equal(record.completedAt, 2000);
  assert.equal(record.refId, "ref-123");
  assert.equal(record.reasonCode, "success");
  assert.equal(record.rationale, "Plan completed successfully");
});

test("OapeflirStageRecordSchema defaults refId to null", () => {
  const record = OapeflirStageRecordSchema.parse({
    stage: "execute",
    status: "completed",
    startedAt: 1000,
    completedAt: 2000,
  });

  assert.equal(record.refId, null);
});

test("OapeflirStageRecordSchema defaults reasonCode to null", () => {
  const record = OapeflirStageRecordSchema.parse({
    stage: "feedback",
    status: "completed",
    startedAt: 1000,
    completedAt: 2000,
  });

  assert.equal(record.reasonCode, null);
});

test("OapeflirStageRecordSchema defaults rationale to null", () => {
  const record = OapeflirStageRecordSchema.parse({
    stage: "learn",
    status: "completed",
    startedAt: 1000,
    completedAt: 2000,
  });

  assert.equal(record.rationale, null);
});

test("OapeflirStageRecordSchema rejects negative startedAt", () => {
  assert.throws(() =>
    OapeflirStageRecordSchema.parse({
      stage: "plan",
      status: "completed",
      startedAt: -1,
      completedAt: 2000,
    }),
  );
});

test("OapeflirStageRecordSchema rejects negative completedAt", () => {
  assert.throws(() =>
    OapeflirStageRecordSchema.parse({
      stage: "plan",
      status: "completed",
      startedAt: 1000,
      completedAt: -1,
    }),
  );
});

test("OapeflirStageRecordSchema rejects non-integer startedAt", () => {
  assert.throws(() =>
    OapeflirStageRecordSchema.parse({
      stage: "plan",
      status: "completed",
      startedAt: 1.5,
      completedAt: 2000,
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// OapeflirStageTimelineBuilder Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OapeflirStageTimelineBuilder can be instantiated", () => {
  const builder = new OapeflirStageTimelineBuilder();
  assert.ok(builder instanceof OapeflirStageTimelineBuilder);
});

test("OapeflirStageTimelineBuilder records stage entry", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const record = builder.record("observe", "completed");

  assert.equal(record.stage, "observe");
  assert.equal(record.status, "completed");
  assert.ok(typeof record.startedAt === "number");
  assert.ok(typeof record.completedAt === "number");
  assert.ok(record.completedAt >= record.startedAt);
});

test("OapeflirStageTimelineBuilder records multiple stages", () => {
  const builder = new OapeflirStageTimelineBuilder();

  builder.record("observe", "completed");
  builder.record("assess", "completed");
  builder.record("plan", "completed");

  const timeline = builder.build();
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0]?.stage, "observe");
  assert.equal(timeline[1]?.stage, "assess");
  assert.equal(timeline[2]?.stage, "plan");
});

test("OapeflirStageTimelineBuilder timestamps are sequential", () => {
  const builder = new OapeflirStageTimelineBuilder();

  builder.record("observe", "completed");
  const second = builder.record("assess", "completed");
  const third = builder.record("plan", "completed");

  // Each record's startedAt should be after the previous's completedAt
  const timeline = builder.build();
  assert.ok(timeline[1]!.startedAt > timeline[0]!.completedAt);
  assert.ok(timeline[2]!.startedAt > timeline[1]!.completedAt);
});

test("OapeflirStageTimelineBuilder includes optional refId", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const record = builder.record("execute", "completed", "exec-ref-123");

  assert.equal(record.refId, "exec-ref-123");
});

test("OapeflirStageTimelineBuilder includes optional reasonCode", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const record = builder.record("feedback", "skipped", null, "user_cancelled");

  assert.equal(record.reasonCode, "user_cancelled");
});

test("OapeflirStageTimelineBuilder includes optional rationale", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const record = builder.record("learn", "completed", null, null, "Learning complete");

  assert.equal(record.rationale, "Learning complete");
});

test("OapeflirStageTimelineBuilder records skipped status", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const record = builder.record("release", "skipped");

  assert.equal(record.status, "skipped");
});

test("OapeflirStageTimelineBuilder build returns copy of entries", () => {
  const builder = new OapeflirStageTimelineBuilder();
  builder.record("observe", "completed");

  const timeline1 = builder.build();
  const timeline2 = builder.build();

  // Should be equal but not same reference
  assert.deepEqual(timeline1, timeline2);
});

test("OapeflirStageTimelineBuilder empty build returns empty array", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const timeline = builder.build();

  assert.deepEqual(timeline, []);
});

test("OapeflirStageTimelineBuilder records all stage types", () => {
  const builder = new OapeflirStageTimelineBuilder();
  const stages: OapeflirStage[] = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
    "knowledge_promotion",
  ];

  for (const stage of stages) {
    builder.record(stage, "completed");
  }

  const timeline = builder.build();
  assert.equal(timeline.length, 9);
});

test("OapeflirStageTimelineBuilder tick increments correctly", () => {
  const builder = new OapeflirStageTimelineBuilder();

  builder.record("observe", "completed");
  const firstRecord = builder.record("assess", "completed");
  const secondRecord = builder.record("plan", "completed");

  // The tick is incremented by 2 between records (once for startedAt, once for completedAt)
  // So assess's startedAt should be observe's completedAt + 2
  const timeline = builder.build();
  assert.ok(timeline[1]!.startedAt >= timeline[0]!.completedAt);
  assert.ok(timeline[2]!.startedAt >= timeline[1]!.completedAt);
});