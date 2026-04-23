import assert from "node:assert/strict";
import test from "node:test";
import { buildAttempt } from "../../../../../../src/platform/execution/tool-executor/edit-replacement/edit-replacement-result-support.js";
test("buildAttempt creates attempt with exact level and matched candidate", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 5, text: "hello" },
        similarityScore: null,
        warningCodes: [],
        stopReason: "matched",
    };
    const attempt = buildAttempt("exact", outcome, "hello world");
    assert.equal(attempt.attemptLevel, "exact");
    assert.equal(attempt.matched, true);
    assert.equal(attempt.candidateCount, 1);
    assert.equal(attempt.similarityScore, null);
    assert.deepEqual(attempt.warningCodes, []);
    assert.equal(attempt.appliedRange, "L1:C1-L1:C6");
});
test("buildAttempt creates attempt with fuzzy level and warning codes", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 5, text: "hello" },
        similarityScore: 0.92,
        warningCodes: ["fuzzy_edit_applied"],
        stopReason: "matched",
    };
    const attempt = buildAttempt("fuzzy", outcome, "hello world");
    assert.equal(attempt.attemptLevel, "fuzzy");
    assert.equal(attempt.matched, true);
    assert.equal(attempt.candidateCount, 1);
    assert.equal(attempt.similarityScore, 0.92);
    assert.deepEqual(attempt.warningCodes, ["fuzzy_edit_applied"]);
    assert.equal(attempt.appliedRange, "L1:C1-L1:C6");
});
test("buildAttempt returns null appliedRange when candidate is null", () => {
    const outcome = {
        matched: false,
        candidateCount: 0,
        candidate: null,
        similarityScore: null,
        warningCodes: [],
        stopReason: "not_found",
    };
    const attempt = buildAttempt("exact", outcome, "hello world");
    assert.equal(attempt.appliedRange, null);
    assert.equal(attempt.matched, false);
    assert.equal(attempt.candidateCount, 0);
});
test("buildAttempt returns null appliedRange for multiple candidates", () => {
    const outcome = {
        matched: false,
        candidateCount: 3,
        candidate: null,
        similarityScore: null,
        warningCodes: [],
        stopReason: "multiple_candidates",
    };
    const attempt = buildAttempt("exact", outcome, "hello hello hello");
    assert.equal(attempt.appliedRange, null);
    assert.equal(attempt.matched, false);
    assert.equal(attempt.candidateCount, 3);
});
test("buildAttempt handles multiline content with correct range", () => {
    const content = "line1\nline2\nline3";
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 6, endOffset: 11, text: "line2" },
        similarityScore: null,
        warningCodes: [],
        stopReason: "matched",
    };
    const attempt = buildAttempt("exact", outcome, content);
    assert.equal(attempt.appliedRange, "L2:C1-L2:C6");
});
test("buildAttempt handles anchored fuzzy with anchored warning", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 6, endOffset: 11, text: "hello" },
        similarityScore: 0.88,
        warningCodes: ["anchored_fuzzy_edit_applied"],
        stopReason: "matched",
    };
    const attempt = buildAttempt("context_anchored", outcome, "prefix hello suffix");
    assert.equal(attempt.attemptLevel, "context_anchored");
    assert.ok(attempt.warningCodes.includes("anchored_fuzzy_edit_applied"));
});
test("buildAttempt handles whitespace_normalized level", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 11, text: "hello world" },
        similarityScore: null,
        warningCodes: [],
        stopReason: "matched",
    };
    const attempt = buildAttempt("whitespace_normalized", outcome, "hello   world");
    assert.equal(attempt.attemptLevel, "whitespace_normalized");
    assert.equal(attempt.matched, true);
});
test("buildAttempt handles indentation_normalized level", () => {
    const content = "  hello\n  world";
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 13, text: "  hello\n  world" },
        similarityScore: null,
        warningCodes: [],
        stopReason: "matched",
    };
    const attempt = buildAttempt("indentation_normalized", outcome, content);
    assert.equal(attempt.attemptLevel, "indentation_normalized");
    assert.equal(attempt.matched, true);
});
test("buildAttempt preserves all warning codes", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 5, text: "hello" },
        similarityScore: 0.87,
        warningCodes: ["fuzzy_edit_applied", "indentation_adjusted"],
        stopReason: "matched",
    };
    const attempt = buildAttempt("fuzzy", outcome, "hello");
    assert.deepEqual(attempt.warningCodes, ["fuzzy_edit_applied", "indentation_adjusted"]);
});
test("buildAttempt handles empty content", () => {
    const outcome = {
        matched: true,
        candidateCount: 1,
        candidate: { startOffset: 0, endOffset: 0, text: "" },
        similarityScore: null,
        warningCodes: [],
        stopReason: "matched",
    };
    const attempt = buildAttempt("exact", outcome, "");
    assert.equal(attempt.appliedRange, "L1:C1-L1:C1");
});
//# sourceMappingURL=edit-replacement-result-support.test.js.map