import test from "node:test";
import assert from "node:assert/strict";

import {
  RolloutLevelSchema,
  RolloutStatusSchema,
  RolloutRecordSchema,
  parseRolloutRecord,
} from "../../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

test("RolloutLevelSchema accepts valid levels", () => {
  const levels = ["off", "suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"] as const;
  for (const level of levels) {
    assert.equal(RolloutLevelSchema.parse(level), level);
  }
});

test("RolloutStatusSchema accepts valid statuses", () => {
  const statuses = ["draft", "pending_approval", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable", "rejected", "rolled_back", "paused"] as const;
  for (const status of statuses) {
    assert.equal(RolloutStatusSchema.parse(status), status);
  }
});

test("RolloutRecordSchema parses valid record", () => {
  const input = {
    recordId: "record_1",
    candidateId: "candidate_1",
    level: "shadow",
    previousLevel: "off",
    strategyVersionId: "strategy_1",
    status: "shadow",
    transitionedAt: 1234567890,
    approvedBy: "operator",
    guardrailReasonCodes: ["guard_1", "guard_2"],
    evidence: ["artifact:1"],
  };

  const result = RolloutRecordSchema.parse(input);
  assert.equal(result.recordId, "record_1");
  assert.equal(result.level, "shadow");
  assert.equal(result.status, "shadow");
});

test("RolloutRecordSchema applies defaults", () => {
  const input = {
    recordId: "record_2",
    candidateId: "candidate_2",
    level: "canary_5",
    transitionedAt: 1234567890,
  };

  const result = RolloutRecordSchema.parse(input);
  assert.equal(result.previousLevel, "off");
  assert.equal(result.strategyVersionId, null);
  assert.equal(result.status, "draft");
  assert.deepEqual(result.guardrailReasonCodes, []);
  assert.deepEqual(result.evidence, []);
});

test("parseRolloutRecord throws on invalid input", () => {
  assert.throws(() => {
    parseRolloutRecord({
      recordId: "",
      candidateId: "candidate_1",
      level: "invalid",
      transitionedAt: 0,
    });
  });
});

test("RolloutRecordSchema rejects invalid level", () => {
  assert.throws(() => {
    RolloutRecordSchema.parse({
      recordId: "record_3",
      candidateId: "candidate_3",
      level: "invalid_level",
      transitionedAt: 0,
    });
  });
});

test("RolloutRecordSchema rejects invalid status", () => {
  assert.throws(() => {
    RolloutRecordSchema.parse({
      recordId: "record_4",
      candidateId: "candidate_4",
      level: "stable",
      status: "invalid_status",
      transitionedAt: 0,
    });
  });
});
