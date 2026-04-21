import test from "node:test";
import assert from "node:assert/strict";
import { OapeflirStageTimelineBuilder, OapeflirStageSchema } from "../../../../../src/platform/orchestration/oapeflir/stage-timeline.js";
test("OapeflirStageTimelineBuilder records stages in order", () => {
    const builder = new OapeflirStageTimelineBuilder();
    builder.record("observe", "completed");
    builder.record("assess", "completed");
    builder.record("plan", "completed");
    builder.record("execute", "completed");
    const timeline = builder.build();
    assert.equal(timeline.length, 4);
    assert.equal(timeline[0].stage, "observe");
    assert.equal(timeline[1].stage, "assess");
    assert.equal(timeline[2].stage, "plan");
    assert.equal(timeline[3].stage, "execute");
});
test("OapeflirStageTimelineBuilder records status correctly", () => {
    const builder = new OapeflirStageTimelineBuilder();
    builder.record("observe", "completed");
    builder.record("assess", "skipped");
    const timeline = builder.build();
    assert.equal(timeline[0].status, "completed");
    assert.equal(timeline[1].status, "skipped");
});
test("OapeflirStageTimelineBuilder captures refId when provided", () => {
    const builder = new OapeflirStageTimelineBuilder();
    builder.record("plan", "completed", "plan_abc123", null);
    builder.record("execute", "completed", "exec_def456", "exec.success");
    const timeline = builder.build();
    assert.equal(timeline[0].refId, "plan_abc123");
    assert.equal(timeline[1].refId, "exec_def456");
});
test("OapeflirStageTimelineBuilder captures reasonCode when provided", () => {
    const builder = new OapeflirStageTimelineBuilder();
    builder.record("assess", "skipped", null, "assess.no_signals");
    builder.record("learn", "skipped", null, "learn.feedback_absent");
    const timeline = builder.build();
    assert.equal(timeline[0].reasonCode, "assess.no_signals");
    assert.equal(timeline[1].reasonCode, "learn.feedback_absent");
});
test("OapeflirStageTimelineBuilder defaults refId and reasonCode to null when omitted", () => {
    const builder = new OapeflirStageTimelineBuilder();
    builder.record("observe", "completed");
    const record = builder.build()[0];
    assert.equal(record.refId, null);
    assert.equal(record.reasonCode, null);
});
test("OapeflirStageTimelineBuilder increments timestamps for each stage", () => {
    const builder = new OapeflirStageTimelineBuilder();
    const r1 = builder.record("observe", "completed");
    const r2 = builder.record("assess", "completed");
    const r3 = builder.record("plan", "completed");
    assert.ok(r2.startedAt > r1.startedAt);
    assert.ok(r3.startedAt > r2.startedAt);
    assert.ok(r2.completedAt > r1.completedAt);
});
test("OapeflirStageTimelineBuilder returns a copy of entries", () => {
    const builder = new OapeflirStageTimelineBuilder();
    builder.record("observe", "completed");
    const timeline1 = builder.build();
    timeline1.push({});
    const timeline2 = builder.build();
    assert.equal(timeline2.length, 1);
});
test("OapeflirStageTimelineBuilder validates all 8 OAPEFLIR stages", () => {
    const builder = new OapeflirStageTimelineBuilder();
    const stages = ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"];
    for (const stage of stages) {
        builder.record(stage, "completed");
    }
    const timeline = builder.build();
    assert.equal(timeline.length, 8);
    assert.equal(timeline[7].stage, "release");
});
test("OapeflirStageSchema rejects invalid stage names", () => {
    assert.throws(() => {
        OapeflirStageSchema.parse("invalid_stage");
    });
});
test("OapeflirStageSchema accepts all valid stage names", () => {
    const stages = ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"];
    for (const stage of stages) {
        assert.equal(OapeflirStageSchema.parse(stage), stage);
    }
});
//# sourceMappingURL=stage-timeline.test.js.map