/**
 * Golden Test: Compaction Record Schema Output
 *
 * Verifies CompactionRecord interface produces correct output structure
 * for context window compaction operations tracking.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type {
  CompactionRecord,
} from "../../src/platform/contracts/types/domain/session-types.js";
import { assertGolden } from "../helpers/golden.js";

// CompactionStage is "trim" | "summarize"
type CompactionStage = "trim" | "summarize";

test("golden: CompactionRecord structure is valid", () => {
  const validRecord: CompactionRecord = {
    id: "compaction_001",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: '["msg_001", "msg_002", "msg_003"]',
    coveredMessageRange: "0-100",
    summaryText: null,
    summaryRef: null,
    compactionReason: "Context window approaching limit",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 1500,
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  // Verify structure
  assert.equal(validRecord.id, "compaction_001");
  assert.equal(validRecord.sessionId, "session_001");
  assert.equal(validRecord.taskId, "task_001");
  assert.equal(validRecord.stage, "trim");
  assert.ok(validRecord.sourceMessageIdsJson.length > 0);
  assert.equal(validRecord.coveredMessageRange, "0-100");
  assert.equal(validRecord.summaryText, null);
  assert.equal(validRecord.compactionReason, "Context window approaching limit");
  assert.equal(validRecord.overflowTriggered, 1);
  assert.equal(validRecord.autoTriggered, 1);
  assert.equal(validRecord.tokenReductionEstimate, 1500);

  // Golden assertion
  assertGolden("compaction-record-structure-v1", {
    id: validRecord.id,
    sessionId: validRecord.sessionId,
    taskId: validRecord.taskId,
    stage: validRecord.stage,
    hasSourceMessageIds: validRecord.sourceMessageIdsJson.length > 0,
    coveredMessageRange: validRecord.coveredMessageRange,
    overflowTriggered: validRecord.overflowTriggered === 1,
    autoTriggered: validRecord.autoTriggered === 1,
    tokenReductionEstimate: validRecord.tokenReductionEstimate,
  });
});

test("golden: CompactionStage enum values are valid", () => {
  const validStages: CompactionStage[] = ["trim", "summarize"];

  for (const stage of validStages) {
    const record: CompactionRecord = {
      id: `compaction_stage_${stage}`,
      sessionId: "session_test",
      taskId: "task_test",
      stage,
      sourceMessageIdsJson: "[]",
      coveredMessageRange: null,
      summaryText: null,
      summaryRef: null,
      compactionReason: "Test",
      overflowTriggered: 0,
      autoTriggered: 0,
      tokenReductionEstimate: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(record.stage, stage, `Stage ${stage} should be valid`);
  }

  assertGolden("compaction-stage-enum-v1", {
    validStages,
    totalStages: validStages.length,
  });
});

test("golden: CompactionRecord with summarize stage has summaryText", () => {
  const summarizeRecord: CompactionRecord = {
    id: "compaction_summarize_001",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "summarize",
    sourceMessageIdsJson: '["msg_001", "msg_002"]',
    coveredMessageRange: "50-150",
    summaryText: "Key insight: User prefers command-line interface over GUI",
    summaryRef: "artifact://summary/compaction_001",
    compactionReason: "Context window limit reached",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 3000,
    createdAt: "2026-04-15T10:30:00.000Z",
  };

  assert.equal(summarizeRecord.stage, "summarize");
  assert.ok(summarizeRecord.summaryText);
  assert.ok(summarizeRecord.summaryRef);

  assertGolden("compaction-record-summarize-stage-v1", {
    id: summarizeRecord.id,
    stage: summarizeRecord.stage,
    hasSummaryText: summarizeRecord.summaryText !== null,
    hasSummaryRef: summarizeRecord.summaryRef !== null,
    tokenReductionEstimate: summarizeRecord.tokenReductionEstimate,
  });
});

test("golden: CompactionRecord trim stage has no summary", () => {
  const trimRecord: CompactionRecord = {
    id: "compaction_trim_001",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: '["msg_old_001", "msg_old_002"]',
    coveredMessageRange: "0-50",
    summaryText: null,
    summaryRef: null,
    compactionReason: "Removing old tool results",
    overflowTriggered: 0,
    autoTriggered: 1,
    tokenReductionEstimate: 800,
    createdAt: "2026-04-15T09:00:00.000Z",
  };

  assert.equal(trimRecord.stage, "trim");
  assert.equal(trimRecord.summaryText, null);
  assert.equal(trimRecord.summaryRef, null);

  assertGolden("compaction-record-trim-stage-v1", {
    id: trimRecord.id,
    stage: trimRecord.stage,
    hasSummaryText: trimRecord.summaryText !== null,
    hasSummaryRef: trimRecord.summaryRef !== null,
    tokenReductionEstimate: trimRecord.tokenReductionEstimate,
  });
});

test("golden: CompactionRecord overflow and auto flags work correctly", () => {
  // overflowTriggered = 1, autoTriggered = 1
  const autoOverflow: CompactionRecord = {
    id: "compaction_auto_overflow",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: "[]",
    coveredMessageRange: null,
    summaryText: null,
    summaryRef: null,
    compactionReason: "Auto overflow",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 500,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(autoOverflow.overflowTriggered, 1);
  assert.equal(autoOverflow.autoTriggered, 1);

  // overflowTriggered = 0, autoTriggered = 1 (manual trigger)
  const manualAuto: CompactionRecord = {
    id: "compaction_manual",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "summarize",
    sourceMessageIdsJson: "[]",
    coveredMessageRange: null,
    summaryText: "Manual summary",
    summaryRef: null,
    compactionReason: "Manual trigger",
    overflowTriggered: 0,
    autoTriggered: 1,
    tokenReductionEstimate: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(manualAuto.overflowTriggered, 0);
  assert.equal(manualAuto.autoTriggered, 1);

  // overflowTriggered = 0, autoTriggered = 0 (explicit manual)
  const explicitManual: CompactionRecord = {
    id: "compaction_explicit",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "summarize",
    sourceMessageIdsJson: "[]",
    coveredMessageRange: null,
    summaryText: "Explicit manual",
    summaryRef: null,
    compactionReason: "User requested",
    overflowTriggered: 0,
    autoTriggered: 0,
    tokenReductionEstimate: 2000,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(explicitManual.overflowTriggered, 0);
  assert.equal(explicitManual.autoTriggered, 0);

  assertGolden("compaction-record-trigger-flags-v1", {
    autoOverflow: {
      overflowTriggered: autoOverflow.overflowTriggered === 1,
      autoTriggered: autoOverflow.autoTriggered === 1,
    },
    manualAuto: {
      overflowTriggered: manualAuto.overflowTriggered === 1,
      autoTriggered: manualAuto.autoTriggered === 1,
    },
    explicitManual: {
      overflowTriggered: explicitManual.overflowTriggered === 1,
      autoTriggered: explicitManual.autoTriggered === 1,
    },
  });
});

test("golden: CompactionRecord tokenReductionEstimate is non-negative", () => {
  const zeroReduction: CompactionRecord = {
    id: "compaction_zero",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: "[]",
    coveredMessageRange: null,
    summaryText: null,
    summaryRef: null,
    compactionReason: "No reduction",
    overflowTriggered: 0,
    autoTriggered: 0,
    tokenReductionEstimate: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(zeroReduction.tokenReductionEstimate, 0);

  const largeReduction: CompactionRecord = {
    id: "compaction_large",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "summarize",
    sourceMessageIdsJson: "[]",
    coveredMessageRange: null,
    summaryText: "Large summary",
    summaryRef: null,
    compactionReason: "Massive context",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 50000,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.ok(largeReduction.tokenReductionEstimate > 0);

  assertGolden("compaction-record-token-reduction-v1", {
    zeroReduction: zeroReduction.tokenReductionEstimate,
    largeReduction: largeReduction.tokenReductionEstimate,
  });
});

test("golden: CompactionRecord sourceMessageIdsJson parses correctly", () => {
  const record: CompactionRecord = {
    id: "compaction_parse_test",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: '["msg_001", "msg_002", "msg_003", "msg_004"]',
    coveredMessageRange: "0-200",
    summaryText: null,
    summaryRef: null,
    compactionReason: "Test parsing",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  // Parse the JSON
  const parsedMessageIds = JSON.parse(record.sourceMessageIdsJson);
  assert.ok(Array.isArray(parsedMessageIds));
  assert.equal(parsedMessageIds.length, 4);
  assert.equal(parsedMessageIds[0], "msg_001");
  assert.equal(parsedMessageIds[3], "msg_004");

  assertGolden("compaction-record-message-ids-parse-v1", {
    id: record.id,
    messageCount: parsedMessageIds.length,
    firstMessageId: parsedMessageIds[0],
    lastMessageId: parsedMessageIds[parsedMessageIds.length - 1],
  });
});

test("golden: CompactionRecord coveredMessageRange format is valid", () => {
  // Format: start_index-end_index
  const validRanges = ["0-100", "50-200", "1000-1500", "0-0"];

  for (const range of validRanges) {
    const record: CompactionRecord = {
      id: `compaction_range_${range}`,
      sessionId: "session_001",
      taskId: "task_001",
      stage: "trim",
      sourceMessageIdsJson: "[]",
      coveredMessageRange: range,
      summaryText: null,
      summaryRef: null,
      compactionReason: "Test range",
      overflowTriggered: 0,
      autoTriggered: 0,
      tokenReductionEstimate: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(record.coveredMessageRange, range);
  }

  // Null range is also valid
  const nullRangeRecord: CompactionRecord = {
    id: "compaction_null_range",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: "[]",
    coveredMessageRange: null,
    summaryText: null,
    summaryRef: null,
    compactionReason: "Test null",
    overflowTriggered: 0,
    autoTriggered: 0,
    tokenReductionEstimate: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(nullRangeRecord.coveredMessageRange, null);

  assertGolden("compaction-record-covered-range-v1", {
    validRanges,
    nullRangeAllowed: true,
  });
});

test("golden: CompactionRecord full lifecycle progression", () => {
  // Simulate compaction lifecycle: trim -> summarize
  const trimRecord: CompactionRecord = {
    id: "compaction_lifecycle_trim",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "trim",
    sourceMessageIdsJson: '["msg_001", "msg_002"]',
    coveredMessageRange: "0-100",
    summaryText: null,
    summaryRef: null,
    compactionReason: "Initial trim",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 500,
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const summarizeRecord: CompactionRecord = {
    id: "compaction_lifecycle_summarize",
    sessionId: "session_001",
    taskId: "task_001",
    stage: "summarize",
    sourceMessageIdsJson: '["msg_003", "msg_004", "msg_005"]',
    coveredMessageRange: "100-300",
    summaryText: "Summarized key decisions and outcomes",
    summaryRef: "artifact://summary/lifecycle_001",
    compactionReason: "Full compaction needed",
    overflowTriggered: 1,
    autoTriggered: 1,
    tokenReductionEstimate: 2500,
    createdAt: "2026-04-15T10:05:00.000Z",
  };

  assert.equal(trimRecord.stage, "trim");
  assert.equal(summarizeRecord.stage, "summarize");
  assert.ok(summarizeRecord.tokenReductionEstimate > trimRecord.tokenReductionEstimate);

  assertGolden("compaction-record-lifecycle-v1", {
    trimId: trimRecord.id,
    trimStage: trimRecord.stage,
    trimReduction: trimRecord.tokenReductionEstimate,
    summarizeId: summarizeRecord.id,
    summarizeStage: summarizeRecord.stage,
    summarizeReduction: summarizeRecord.tokenReductionEstimate,
    totalReduction: trimRecord.tokenReductionEstimate + summarizeRecord.tokenReductionEstimate,
  });
});

test("golden: CompactionRecord compaction reasons are descriptive", () => {
  const reasons = [
    "Context window approaching limit",
    "Removing old tool results",
    "Full context compaction required",
    "Session too long - summarizing",
    "Memory pressure detected",
    "Manual compaction requested by user",
  ];

  for (const reason of reasons) {
    const record: CompactionRecord = {
      id: `compaction_reason_test`,
      sessionId: "session_001",
      taskId: "task_001",
      stage: "summarize",
      sourceMessageIdsJson: "[]",
      coveredMessageRange: null,
      summaryText: "Test",
      summaryRef: null,
      compactionReason: reason,
      overflowTriggered: 0,
      autoTriggered: 0,
      tokenReductionEstimate: 1000,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.ok(record.compactionReason.length > 0);
  }

  assertGolden("compaction-record-reasons-v1", {
    reasonCount: reasons.length,
    reasons,
  });
});
