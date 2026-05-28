/**
 * Golden Test: Rollout Record Schema Output
 *
 * Verifies rollout-record.ts schema produces correct output structure
 * for rollout level management, status tracking, and metrics collection.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  RolloutRecordSchema,
  RolloutLevelSchema,
  RolloutStatusSchema,
  parseRolloutRecord,
  type RolloutRecord,
  type RolloutLevel,
  type RolloutStatus,
} from "../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: RolloutRecord schema produces correct structure", () => {
  const transitionedAt = 1714500000;
  const validRecord = {
    recordId: "rollout_001",
    candidateId: "candidate_test_001",
    level: "L2_canary",
    previousLevel: "L0_off",
    fromLevel: "L0_off",
    toLevel: "L2_canary",
    strategyVersionId: "v1.2.3",
    status: "canary_5",
    transitionedAt,
    createdAt: new Date(transitionedAt * 1000).toISOString(),
    approvedBy: "admin@example.com",
    guardrailReasonCodes: ["GR_001", "GR_002"],
    evidence: ["evidence_1", "evidence_2"],
  };

  const parsed = RolloutRecordSchema.parse(validRecord);

  // Verify structure
  assert.equal(parsed.recordId, "rollout_001");
  assert.equal(parsed.candidateId, "candidate_test_001");
  assert.equal(parsed.level, "L2_canary");
  assert.equal(parsed.previousLevel, "L0_off");
  assert.equal(parsed.strategyVersionId, "v1.2.3");
  assert.equal(parsed.status, "canary_5");
  assert.ok(parsed.approvedBy);
  assert.deepEqual(parsed.guardrailReasonCodes, ["GR_001", "GR_002"]);
  assert.deepEqual(parsed.evidence, ["evidence_1", "evidence_2"]);

  // Golden assertion
  assertGolden("rollout-record-structure-v1", {
    recordId: parsed.recordId,
    candidateId: parsed.candidateId,
    level: parsed.level,
    previousLevel: parsed.previousLevel,
    status: parsed.status,
  });
});

test("golden: RolloutLevel enum values are valid", () => {
  const validLevels: RolloutLevel[] = [
    "L0_off",
    "L1_evaluate",
    "L2_canary",
    "L3_partial",
    "L4_stable",
    "L5_full",
  ];

  for (const level of validLevels) {
    const result = RolloutLevelSchema.safeParse(level);
    assert.equal(result.success, true, `Level ${level} should be valid`);
  }

  const invalidLevel = RolloutLevelSchema.safeParse("invalid_level");
  assert.equal(invalidLevel.success, false, "Invalid level should fail");

  assertGolden("rollout-level-enum-v1", {
    validLevels,
    totalLevels: validLevels.length,
  });
});

test("golden: RolloutStatus enum values are valid", () => {
  const validStatuses: RolloutStatus[] = [
    "candidate_created",
    "under_review",
    "approved",
    "evaluation_enabled",
    "canary_5",
    "partial_25",
    "stable_75",
    "stable_100",
    "released",
    "rejected",
    "rolled_back",
    "paused",
  ];

  for (const status of validStatuses) {
    const result = RolloutStatusSchema.safeParse(status);
    assert.equal(result.success, true, `Status ${status} should be valid`);
  }

  assertGolden("rollout-status-enum-v1", {
    validStatuses,
    totalStatuses: validStatuses.length,
  });
});

test("golden: parseRolloutRecord produces valid output", () => {
  const input = {
    recordId: "rollout_parse_test",
    candidateId: "candidate_abc",
    level: "L3_partial",
    fromLevel: "L2_canary",
    toLevel: "L3_partial",
    status: "partial_25",
    transitionedAt: 1714600000,
  };

  const parsed = parseRolloutRecord(input);

  assert.ok(parsed.recordId);
  assert.ok(parsed.candidateId);
  assert.equal(parsed.level, "L3_partial");
  assert.equal(parsed.status, "partial_25");

  assertGolden("parse-rollout-record-v1", {
    recordId: parsed.recordId,
    candidateId: parsed.candidateId,
    level: parsed.level,
    status: parsed.status,
  });
});

test("golden: RolloutRecord schema rejects invalid data", () => {
  // Missing required field
  const missingRecordId = {
    candidateId: "candidate_test",
    level: "L2_canary",
    fromLevel: "L0_off",
    toLevel: "L2_canary",
  };

  const result1 = RolloutRecordSchema.safeParse(missingRecordId);
  assert.equal(result1.success, false, "Missing recordId should fail");

  // Invalid level
  const invalidLevel = {
    recordId: "rollout_001",
    candidateId: "candidate_test",
    level: "invalid_level",
    fromLevel: "L0_off",
    toLevel: "invalid_level",
  };

  const result2 = RolloutRecordSchema.safeParse(invalidLevel);
  assert.equal(result2.success, false, "Invalid level should fail");

  // Invalid status
  const invalidStatus = {
    recordId: "rollout_002",
    candidateId: "candidate_test",
    level: "L2_canary",
    fromLevel: "L0_off",
    toLevel: "L2_canary",
    status: "invalid_status",
  };

  const result3 = RolloutRecordSchema.safeParse(invalidStatus);
  assert.equal(result3.success, false, "Invalid status should fail");

  assertGolden("rollout-record-rejects-invalid-v1", {
    missingRecordIdFails: !result1.success,
    invalidLevelFails: !result2.success,
    invalidStatusFails: !result3.success,
  });
});

test("golden: RolloutRecord with minimal required fields", () => {
  const transitionedAt = 1714000000;
  const minimalRecord = {
    recordId: "rollout_minimal",
    candidateId: "candidate_min",
    level: "L2_canary",
    fromLevel: "L0_off",
    toLevel: "L2_canary",
    transitionedAt,
    createdAt: new Date(transitionedAt * 1000).toISOString(),
  };

  const parsed = RolloutRecordSchema.parse(minimalRecord);

  assert.equal(parsed.recordId, "rollout_minimal");
  assert.equal(parsed.level, "L2_canary");
  assert.equal(parsed.previousLevel, "L0_off", "Should have default previousLevel");
  assert.equal(parsed.status, "candidate_created", "Should have default status");
  assert.deepEqual(parsed.guardrailReasonCodes, [], "Should have empty guardrailReasonCodes");
  assert.deepEqual(parsed.evidence, [], "Should have empty evidence");

  assertGolden("rollout-record-minimal-v1", {
    recordId: parsed.recordId,
    level: parsed.level,
    previousLevel: parsed.previousLevel,
    status: parsed.status,
    hasDefaultValues: true,
  });
});

test("golden: RolloutRecord full lifecycle progression", () => {
  // Simulate a full rollout lifecycle
  const stages = [
    { status: "under_review", level: "L0_off" },
    { status: "approved", level: "L1_evaluate" },
    { status: "evaluation_enabled", level: "L1_evaluate" },
    { status: "canary_5", level: "L2_canary" },
    { status: "partial_25", level: "L3_partial" },
    { status: "stable_75", level: "L4_stable" },
    { status: "stable_100", level: "L5_full" },
    { status: "released", level: "L5_full" },
  ];

  const records: RolloutRecord[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const record = parseRolloutRecord({
      recordId: `rollout_stage_${i}`,
      candidateId: "candidate_lifecycle_test",
      level: stage.level,
      status: stage.status,
      transitionedAt: 1714000000 + i * 1000,
    });
    records.push(record);
  }

  // Verify progression
  for (let i = 0; i < records.length; i++) {
    assert.ok(records[i].recordId.includes(`stage_${i}`), `Stage ${i} should have correct recordId`);
  }

  assertGolden("rollout-record-lifecycle-v1", {
    totalStages: stages.length,
    statuses: records.map((r) => r.status),
    levels: records.map((r) => r.level),
  });
});
