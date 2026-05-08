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
  const validRecord = {
    recordId: "rollout_001",
    candidateId: "candidate_test_001",
    fromLevel: "canary_5",
    toLevel: "canary_20",
    previousLevel: "canary_5",
    strategyVersionId: "v1.2.3",
    status: "evaluation_enabled",
    triggeredBy: "scheduler",
    triggerReason: "Metrics threshold met",
    transitionedAt: 1714500000,
    approvedBy: "admin@example.com",
    guardrailReasonCodes: ["GR_001", "GR_002"],
    evidence: ["evidence_1", "evidence_2"],
    metrics: {
      errorRate: 0.02,
      latencyP99: 150,
      successRate: 0.98,
      sampleCount: 1000,
    },
    auditContext: {
      userId: "admin_001",
      reason: "Scheduled promotion",
      metadata: { environment: "staging" },
    },
  };

  const parsed = RolloutRecordSchema.parse(validRecord);

  // Verify structure
  assert.equal(parsed.recordId, "rollout_001");
  assert.equal(parsed.candidateId, "candidate_test_001");
  assert.equal(parsed.fromLevel, "canary_5");
  assert.equal(parsed.toLevel, "canary_20");
  assert.equal(parsed.previousLevel, "canary_5");
  assert.equal(parsed.strategyVersionId, "v1.2.3");
  assert.equal(parsed.status, "evaluation_enabled");
  assert.equal(parsed.triggeredBy, "scheduler");
  assert.ok(parsed.triggerReason);
  assert.ok(parsed.approvedBy);
  assert.deepEqual(parsed.guardrailReasonCodes, ["GR_001", "GR_002"]);
  assert.deepEqual(parsed.evidence, ["evidence_1", "evidence_2"]);

  // Golden assertion
  assertGolden("rollout-record-structure-v1", {
    recordId: parsed.recordId,
    candidateId: parsed.candidateId,
    fromLevel: parsed.fromLevel,
    toLevel: parsed.toLevel,
    previousLevel: parsed.previousLevel,
    status: parsed.status,
    triggeredBy: parsed.triggeredBy,
    hasMetrics: parsed.metrics !== null,
    metricsErrorRate: parsed.metrics?.errorRate,
    metricsSuccessRate: parsed.metrics?.successRate,
  });
});

test("golden: RolloutLevel enum values are valid", () => {
  // Phase 1 rollout levels using canary progression
  const validLevels: RolloutLevel[] = [
    "off",
    "evaluate_0",
    "canary_5",
    "canary_20",
    "canary_50",
    "stable_100",
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
  // Phase 1 rollout statuses using canary progression
  const validStatuses: RolloutStatus[] = [
    "candidate_created",
    "under_review",
    "draft",
    "pending_approval",
    "rejected",
    "evaluation_enabled",
    "canary_5",
    "canary_20",
    "canary_50",
    "stable_100",
    "released",
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
    fromLevel: "canary_20",
    toLevel: "canary_50",
    status: "canary_50",
    triggeredBy: "human",
    transitionedAt: 1714600000,
  };

  const parsed = parseRolloutRecord(input);

  assert.ok(parsed.recordId);
  assert.ok(parsed.candidateId);
  assert.equal(parsed.fromLevel, "canary_20");
  assert.equal(parsed.toLevel, "canary_50");
  assert.equal(parsed.status, "canary_50");
  assert.equal(parsed.triggeredBy, "human");

  assertGolden("parse-rollout-record-v1", {
    recordId: parsed.recordId,
    candidateId: parsed.candidateId,
    fromLevel: parsed.fromLevel,
    toLevel: parsed.toLevel,
    status: parsed.status,
  });
});

test("golden: RolloutRecord schema rejects invalid data", () => {
  // Missing required field
  const missingRecordId = {
    candidateId: "candidate_test",
    fromLevel: "canary_5",
    toLevel: "canary_20",
  };

  const result1 = RolloutRecordSchema.safeParse(missingRecordId);
  assert.equal(result1.success, false, "Missing recordId should fail");

  // Invalid fromLevel
  const invalidLevel = {
    recordId: "rollout_001",
    candidateId: "candidate_test",
    fromLevel: "invalid_level",
    toLevel: "canary_20",
  };

  const result2 = RolloutRecordSchema.safeParse(invalidLevel);
  assert.equal(result2.success, false, "Invalid fromLevel should fail");

  // Invalid status
  const invalidStatus = {
    recordId: "rollout_002",
    candidateId: "candidate_test",
    fromLevel: "canary_5",
    toLevel: "canary_20",
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
  const minimalRecord = {
    recordId: "rollout_minimal",
    candidateId: "candidate_min",
    fromLevel: "canary_5",
    toLevel: "canary_5",
    transitionedAt: 1714000000,
  };

  const parsed = RolloutRecordSchema.parse(minimalRecord);

  assert.equal(parsed.recordId, "rollout_minimal");
  assert.equal(parsed.previousLevel, "off", "Should have default previousLevel");
  assert.equal(parsed.status, "draft", "Should have default status");
  assert.equal(parsed.triggeredBy, "human", "Should have default triggeredBy");
  assert.deepEqual(parsed.guardrailReasonCodes, [], "Should have empty guardrailReasonCodes");
  assert.deepEqual(parsed.evidence, [], "Should have empty evidence");
  assert.equal(parsed.metrics, null, "Should have null metrics");
  // Compare auditContext fields individually to avoid deepEqual issues with empty objects
  assert.equal(parsed.auditContext.userId, undefined, "Should have no userId");
  assert.equal(parsed.auditContext.reason, undefined, "Should have no reason");
  assert.deepEqual(parsed.auditContext.metadata, {}, "Should have empty metadata");

  assertGolden("rollout-record-minimal-v1", {
    recordId: parsed.recordId,
    previousLevel: parsed.previousLevel,
    status: parsed.status,
    triggeredBy: parsed.triggeredBy,
    hasDefaultValues: true,
  });
});

test("golden: RolloutRecord full lifecycle progression", () => {
  // Simulate a full rollout lifecycle with Phase 1 canary progression
  const stages = [
    { status: "candidate_created", fromLevel: "off", toLevel: "evaluate_0" },
    { status: "evaluation_enabled", fromLevel: "evaluate_0", toLevel: "canary_5" },
    { status: "canary_5", fromLevel: "canary_5", toLevel: "canary_20" },
    { status: "canary_20", fromLevel: "canary_20", toLevel: "canary_50" },
    { status: "canary_50", fromLevel: "canary_50", toLevel: "stable_100" },
    { status: "released", fromLevel: "stable_100", toLevel: "stable_100" },
  ];

  const records: RolloutRecord[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const record = parseRolloutRecord({
      recordId: `rollout_stage_${i}`,
      candidateId: "candidate_lifecycle_test",
      fromLevel: stage.fromLevel,
      toLevel: stage.toLevel,
      status: stage.status,
      triggeredBy: "scheduler",
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
    levels: records.map((r) => r.toLevel),
  });
});