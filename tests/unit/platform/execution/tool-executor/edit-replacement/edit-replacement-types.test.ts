import assert from "node:assert/strict";
import test from "node:test";

import type {
  EditReplacementAttemptLevel,
  EditReplacementAttempt,
  EditReplacementRequest,
  EditInstruction,
  EditBatchRequest,
  EditReplacementData,
  EditBatchItemResult,
  EditBatchData,
  EditReplacementMetadata,
  EditBatchMetadata,
  EditReplacementResult,
  EditBatchResult,
  MatchCandidate,
  MatchOutcome,
  StageEvaluation,
  PreparedEdit,
} from "../../../../../src/platform/execution/tool-executor/edit-replacement/edit-replacement-types.js";

test("EditReplacementAttemptLevel has correct values", () => {
  const levels: EditReplacementAttemptLevel[] = [
    "exact",
    "whitespace_normalized",
    "indentation_normalized",
    "fuzzy",
    "context_anchored",
  ];

  assert.equal(levels.length, 5);
});

test("EditReplacementAttempt structure", () => {
  const attempt: EditReplacementAttempt = {
    attemptLevel: "exact",
    matched: true,
    candidateCount: 1,
    similarityScore: 1.0,
    warningCodes: [],
    appliedRange: "0-10",
  };

  assert.equal(attempt.attemptLevel, "exact");
  assert.equal(attempt.matched, true);
  assert.equal(attempt.candidateCount, 1);
  assert.equal(attempt.similarityScore, 1.0);
  assert.deepEqual(attempt.warningCodes, []);
  assert.equal(attempt.appliedRange, "0-10");
});

test("EditReplacementRequest structure", () => {
  const request: EditReplacementRequest = {
    callId: "call-123",
    taskId: "task-456",
    executionId: "exec-789",
    traceId: "trace-abc",
    toolName: "edit",
    sandboxPolicy: { mode: "container" },
    filePath: "/src/file.ts",
    oldString: "old content",
    newString: "new content",
    beforeAnchor: "before",
    afterAnchor: "after",
    occurredAt: "2026-04-26T00:00:00.000Z",
    lockTtlMs: 5000,
    timeoutMs: 30000,
  };

  assert.equal(request.callId, "call-123");
  assert.equal(request.taskId, "task-456");
  assert.equal(request.executionId, "exec-789");
  assert.equal(request.toolName, "edit");
  assert.equal(request.filePath, "/src/file.ts");
  assert.equal(request.oldString, "old content");
  assert.equal(request.newString, "new content");
});

test("EditInstruction structure", () => {
  const instruction: EditInstruction = {
    oldString: "foo",
    newString: "bar",
    beforeAnchor: "before",
    afterAnchor: "after",
  };

  assert.equal(instruction.oldString, "foo");
  assert.equal(instruction.newString, "bar");
});

test("EditBatchRequest extends EditReplacementRequest", () => {
  const request: EditBatchRequest = {
    callId: "call-123",
    taskId: "task-456",
    executionId: null,
    traceId: "trace-abc",
    toolName: "batch_edit",
    sandboxPolicy: { mode: "container" },
    filePath: "/src/file.ts",
    edits: [
      { oldString: "a", newString: "b" },
      { oldString: "c", newString: "d" },
    ],
  };

  assert.equal(request.toolName, "batch_edit");
  assert.equal(request.edits.length, 2);
});

test("EditReplacementData structure", () => {
  const data: EditReplacementData = {
    attempts: [],
    matchLevel: "exact",
    similarityScore: 1.0,
    appliedRange: "0-10",
  };

  assert.deepEqual(data.attempts, []);
  assert.equal(data.matchLevel, "exact");
});

test("EditBatchItemResult status values", () => {
  const statuses: EditBatchItemResult["status"][] = ["applied", "already_applied", "failed"];

  assert.ok(statuses.includes("applied"));
  assert.ok(statuses.includes("already_applied"));
  assert.ok(statuses.includes("failed"));
});

test("EditBatchItemResult structure", () => {
  const item: EditBatchItemResult = {
    index: 0,
    status: "applied",
    attempts: [],
    warnings: [],
    matchLevel: "exact",
    similarityScore: null,
    appliedRange: null,
    errorCode: null,
  };

  assert.equal(item.index, 0);
  assert.equal(item.status, "applied");
  assert.ok(item.attempts !== undefined);
});

test("EditBatchData structure", () => {
  const data: EditBatchData = {
    edits: [],
    appliedEditCount: 5,
    rolledBack: false,
  };

  assert.equal(data.appliedEditCount, 5);
  assert.equal(data.rolledBack, false);
});

test("EditReplacementMetadata structure", () => {
  const metadata: EditReplacementMetadata = {
    filePath: "/src/test.ts",
    warnings: ["warning1"],
    attemptCount: 3,
    warningCount: 1,
    diagnostics: null,
  };

  assert.equal(metadata.filePath, "/src/test.ts");
  assert.equal(metadata.attemptCount, 3);
});

test("EditBatchMetadata structure", () => {
  const metadata: EditBatchMetadata = {
    filePath: "/src/test.ts",
    warnings: [],
    attemptCount: 10,
    warningCount: 0,
    editCount: 5,
    diagnostics: null,
  };

  assert.equal(metadata.editCount, 5);
});

test("MatchCandidate structure", () => {
  const candidate: MatchCandidate = {
    startOffset: 0,
    endOffset: 10,
    text: "matched text",
  };

  assert.equal(candidate.startOffset, 0);
  assert.equal(candidate.endOffset, 10);
  assert.equal(candidate.text, "matched text");
});

test("MatchOutcome stop reasons", () => {
  const reasons: MatchOutcome["stopReason"][] = [
    "matched",
    "multiple_candidates",
    "not_found",
    "similarity_too_low",
  ];

  assert.ok(reasons.includes("matched"));
  assert.ok(reasons.includes("not_found"));
});

test("MatchOutcome structure", () => {
  const outcome: MatchOutcome = {
    matched: true,
    candidateCount: 1,
    candidate: null,
    similarityScore: 0.95,
    warningCodes: [],
    stopReason: "matched",
  };

  assert.equal(outcome.matched, true);
  assert.equal(outcome.stopReason, "matched");
});

test("StageEvaluation structure", () => {
  const evaluation: StageEvaluation = {
    attempts: [],
    matchedCandidate: null,
    errorCode: null,
    similarityScore: null,
  };

  assert.ok(Array.isArray(evaluation.attempts));
  assert.equal(evaluation.matchedCandidate, null);
});

test("PreparedEdit structure", () => {
  const prepared: PreparedEdit = {
    updatedContent: "updated file content",
    item: {
      index: 0,
      status: "applied",
      attempts: [],
      warnings: [],
      matchLevel: "exact",
      similarityScore: null,
      appliedRange: null,
      errorCode: null,
    },
  };

  assert.ok(prepared.updatedContent.length > 0);
  assert.equal(prepared.item.index, 0);
});

test("EditReplacementResult structure", () => {
  const result: EditReplacementResult = {
    success: true,
    value: "file content",
    metadata: {
      filePath: "/src/test.ts",
      warnings: [],
      attemptCount: 1,
      warningCount: 0,
      diagnostics: null,
    },
    data: {
      attempts: [],
      matchLevel: "exact",
      similarityScore: null,
      appliedRange: null,
    },
    attempts: [],
    warnings: [],
    matchLevel: "exact",
    similarityScore: null,
    appliedRange: null,
  };

  assert.equal(result.success, true);
  assert.equal(result.matchLevel, "exact");
});

test("EditBatchResult structure", () => {
  const result: EditBatchResult = {
    success: true,
    value: "batch result",
    metadata: {
      filePath: "/src/test.ts",
      warnings: [],
      attemptCount: 5,
      warningCount: 0,
      editCount: 3,
      diagnostics: null,
    },
    data: {
      edits: [],
      appliedEditCount: 2,
      rolledBack: false,
    },
    edits: [],
    warnings: [],
  };

  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.edits));
});

test("EditBatchItemResult without optional fields", () => {
  const item: EditBatchItemResult = {
    index: 0,
    status: "failed",
    attempts: [],
    warnings: ["error occurred"],
    matchLevel: null,
    similarityScore: null,
    appliedRange: null,
    errorCode: "EDIT_FAILED",
  };

  assert.equal(item.status, "failed");
  assert.equal(item.errorCode, "EDIT_FAILED");
  assert.equal(item.matchLevel, null);
});

test("EditInstruction without optional anchor fields", () => {
  const instruction: EditInstruction = {
    oldString: "original",
    newString: "modified",
  };

  assert.equal(instruction.oldString, "original");
  assert.equal(instruction.beforeAnchor, undefined);
  assert.equal(instruction.afterAnchor, undefined);
});

test("MatchOutcome with multiple candidates", () => {
  const outcome: MatchOutcome = {
    matched: false,
    candidateCount: 5,
    candidate: null,
    similarityScore: null,
    warningCodes: ["MULTIPLE_CANDIDATES"],
    stopReason: "multiple_candidates",
  };

  assert.equal(outcome.matched, false);
  assert.equal(outcome.candidateCount, 5);
  assert.equal(outcome.stopReason, "multiple_candidates");
});

test("StageEvaluation with matched candidate", () => {
  const candidate: MatchCandidate = {
    startOffset: 10,
    endOffset: 50,
    text: "matched content",
  };

  const evaluation: StageEvaluation = {
    attempts: [],
    matchedCandidate: candidate,
    errorCode: null,
    similarityScore: 1.0,
  };

  assert.ok(evaluation.matchedCandidate !== null);
  assert.equal(evaluation.matchedCandidate.text, "matched content");
});