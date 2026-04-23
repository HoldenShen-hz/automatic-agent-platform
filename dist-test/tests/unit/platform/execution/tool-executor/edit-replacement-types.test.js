import assert from "node:assert/strict";
import test from "node:test";
test("EditReplacementAttemptLevel type accepts valid values", () => {
    const levels = [
        "exact",
        "whitespace_normalized",
        "indentation_normalized",
        "fuzzy",
        "context_anchored",
    ];
    assert.equal(levels.length, 5);
});
test("EditReplacementAttempt structure is correct", () => {
    const attempt = {
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
});
test("EditReplacementAttempt allows null similarityScore", () => {
    const attempt = {
        attemptLevel: "fuzzy",
        matched: false,
        candidateCount: 0,
        similarityScore: null,
        warningCodes: ["no_match"],
        appliedRange: null,
    };
    assert.equal(attempt.similarityScore, null);
    assert.equal(attempt.matched, false);
});
test("EditInstruction structure is correct", () => {
    const instruction = {
        oldString: "hello",
        newString: "world",
    };
    assert.equal(instruction.oldString, "hello");
    assert.equal(instruction.newString, "world");
});
test("EditInstruction allows optional anchors", () => {
    const instruction = {
        oldString: "hello",
        newString: "world",
        beforeAnchor: "prefix",
        afterAnchor: "suffix",
    };
    assert.equal(instruction.beforeAnchor, "prefix");
    assert.equal(instruction.afterAnchor, "suffix");
});
test("EditReplacementData structure is correct", () => {
    const data = {
        attempts: [],
        matchLevel: "exact",
        similarityScore: 1.0,
        appliedRange: "0-10",
    };
    assert.equal(data.matchLevel, "exact");
    assert.equal(data.appliedRange, "0-10");
});
test("EditReplacementData allows null values", () => {
    const data = {
        attempts: [],
        matchLevel: null,
        similarityScore: null,
        appliedRange: null,
    };
    assert.equal(data.matchLevel, null);
    assert.equal(data.appliedRange, null);
});
test("EditBatchItemResult status accepts valid values", () => {
    const statuses = ["applied", "already_applied", "failed"];
    assert.equal(statuses.length, 3);
});
test("EditBatchItemResult structure is correct", () => {
    const item = {
        index: 0,
        status: "applied",
        attempts: [],
        warnings: [],
        matchLevel: "exact",
        similarityScore: 1.0,
        appliedRange: "0-10",
        errorCode: null,
    };
    assert.equal(item.index, 0);
    assert.equal(item.status, "applied");
    assert.equal(item.errorCode, null);
});
test("EditBatchItemResult allows error code on failure", () => {
    const item = {
        index: 0,
        status: "failed",
        attempts: [],
        warnings: [],
        matchLevel: null,
        similarityScore: null,
        appliedRange: null,
        errorCode: "edit.no_matching_content",
    };
    assert.equal(item.status, "failed");
    assert.equal(item.errorCode, "edit.no_matching_content");
});
test("EditBatchData structure is correct", () => {
    const data = {
        edits: [],
        appliedEditCount: 0,
        rolledBack: false,
    };
    assert.equal(data.appliedEditCount, 0);
    assert.equal(data.rolledBack, false);
});
test("MatchCandidate structure is correct", () => {
    const candidate = {
        startOffset: 0,
        endOffset: 10,
        text: "hello world",
    };
    assert.equal(candidate.startOffset, 0);
    assert.equal(candidate.endOffset, 10);
    assert.equal(candidate.text, "hello world");
});
test("MatchOutcome stopReason accepts valid values", () => {
    const reasons = [
        "matched",
        "multiple_candidates",
        "not_found",
        "similarity_too_low",
    ];
    assert.equal(reasons.length, 4);
});
test("MatchOutcome structure is correct", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 10, text: "hello" },
        similarityScore: 1.0,
        warningCodes: [],
        stopReason: "matched",
    };
    assert.equal(outcome.matched, true);
    assert.equal(outcome.candidateCount, 1);
    assert.equal(outcome.stopReason, "matched");
});
test("MatchOutcome allows null candidate", () => {
    const outcome = {
        matched: false,
        candidateCount: 0,
        candidate: null,
        similarityScore: null,
        warningCodes: ["not_found"],
        stopReason: "not_found",
    };
    assert.equal(outcome.matched, false);
    assert.equal(outcome.candidate, null);
    assert.equal(outcome.stopReason, "not_found");
});
test("StageEvaluation structure is correct", () => {
    const evaluation = {
        attempts: [],
        matchedCandidate: null,
        errorCode: null,
        similarityScore: null,
    };
    assert.equal(evaluation.matchedCandidate, null);
    assert.equal(evaluation.errorCode, null);
});
test("PreparedEdit structure is correct", () => {
    const prepared = {
        updatedContent: "new content",
        item: {
            index: 0,
            status: "applied",
            attempts: [],
            warnings: [],
            matchLevel: null,
            similarityScore: null,
            appliedRange: null,
            errorCode: null,
        },
    };
    assert.equal(prepared.updatedContent, "new content");
    assert.equal(prepared.item.index, 0);
});
//# sourceMappingURL=edit-replacement-types.test.js.map