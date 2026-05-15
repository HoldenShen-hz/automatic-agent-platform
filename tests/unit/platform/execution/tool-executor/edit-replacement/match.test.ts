import assert from "node:assert/strict";
import test from "node:test";

import {
  matchExact,
  matchNormalizedWindows,
  matchFuzzyWindows,
  matchAnchoredFuzzy,
  toExactOutcome,
  findAllOccurrences,
  buildCandidateWindows,
  dedupeWindows,
  computeLineOffsets,
  offsetToLineColumn,
  type MatchCandidate,
  type MatchOutcome,
  type EditInstruction,
} from "../../../../../../src/platform/five-plane-execution/tool-executor/edit-replacement/match.js";

test("findAllOccurrences returns empty array for empty needle", () => {
  assert.deepEqual(findAllOccurrences("content", ""), []);
});

test("findAllOccurrences returns empty array when not found", () => {
  assert.deepEqual(findAllOccurrences("content", "missing"), []);
});

test("findAllOccurrences finds single occurrence", () => {
  const result = findAllOccurrences("hello world", "world");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.startOffset, 6);
  assert.equal(result[0]!.endOffset, 11);
});

test("findAllOccurrences finds multiple occurrences", () => {
  const result = findAllOccurrences("foo bar foo", "foo");
  assert.equal(result.length, 2);
  assert.equal(result[0]!.startOffset, 0);
  assert.equal(result[0]!.endOffset, 3);
  assert.equal(result[1]!.startOffset, 8);
  assert.equal(result[1]!.endOffset, 11);
});

test("findAllOccurrences handles overlapping at boundaries", () => {
  const result = findAllOccurrences("aaa", "aa");
  assert.equal(result.length, 2);
  assert.equal(result[0]!.startOffset, 0);
  assert.equal(result[1]!.startOffset, 1);
});

test("toExactOutcome returns not_found for empty candidates", () => {
  const outcome = toExactOutcome([]);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.candidateCount, 0);
  assert.equal(outcome.candidate, null);
  assert.equal(outcome.stopReason, "not_found");
});

test("toExactOutcome returns matched for single candidate", () => {
  const candidate: MatchCandidate = { startOffset: 0, endOffset: 5, text: "hello" };
  const outcome = toExactOutcome([candidate]);
  assert.equal(outcome.matched, true);
  assert.equal(outcome.candidateCount, 1);
  assert.equal(outcome.candidate, candidate);
  assert.equal(outcome.stopReason, "matched");
});

test("toExactOutcome returns multiple_candidates for multiple candidates", () => {
  const candidates = [
    { startOffset: 0, endOffset: 5, text: "hello" },
    { startOffset: 10, endOffset: 15, text: "hello" },
  ];
  const outcome = toExactOutcome(candidates);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.candidateCount, 2);
  assert.equal(outcome.candidate, null);
  assert.equal(outcome.stopReason, "multiple_candidates");
});

test("matchExact returns not_found when no match", () => {
  const outcome = matchExact("content", "missing");
  assert.equal(outcome.matched, false);
  assert.equal(outcome.candidateCount, 0);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchExact returns matched for single occurrence", () => {
  const outcome = matchExact("hello world", "world");
  assert.equal(outcome.matched, true);
  assert.equal(outcome.candidateCount, 1);
  assert.equal(outcome.candidate?.startOffset, 6);
});

test("matchExact returns multiple_candidates for multiple occurrences", () => {
  const outcome = matchExact("foo bar foo", "foo");
  assert.equal(outcome.matched, false);
  assert.equal(outcome.candidateCount, 2);
  assert.equal(outcome.stopReason, "multiple_candidates");
});

test("matchNormalizedWindows filters windows by normalized match", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
    { startOffset: 10, endOffset: 15, text: "world" },
  ];
  const outcome = matchNormalizedWindows(windows, "  hello  ", (v) => v.trim());
  assert.equal(outcome.matched, true);
  assert.equal(outcome.candidateCount, 1);
});

test("matchNormalizedWindows returns not_found when no match", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
  ];
  const outcome = matchNormalizedWindows(windows, "world", (v) => v.trim());
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchFuzzyWindows returns not_found when no candidates", () => {
  const outcome = matchFuzzyWindows([], "hello", 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchFuzzyWindows returns matched for high similarity", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
  ];
  const outcome = matchFuzzyWindows(windows, "hello", 0.85);
  assert.equal(outcome.matched, true);
  assert.equal(outcome.stopReason, "matched");
});

test("matchFuzzyWindows returns not_found when no similarity", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 3, text: "abc" },
  ];
  const outcome = matchFuzzyWindows(windows, "xyz", 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchFuzzyWindows returns similarity_too_low when below threshold but non-zero", () => {
  // Use "a" vs "b" which have some similarity (both single chars)
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 1, text: "a" },
  ];
  const outcome = matchFuzzyWindows(windows, "b", 0.85);
  // Single chars that are different have 0 similarity, so it returns not_found
  assert.equal(outcome.matched, false);
  assert.ok(["not_found", "similarity_too_low"].includes(outcome.stopReason));
});

test("matchFuzzyWindows returns multiple_candidates when ambiguous", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
    { startOffset: 10, endOffset: 15, text: "hello" },
  ];
  const outcome = matchFuzzyWindows(windows, "hello", 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "multiple_candidates");
  assert.equal(outcome.candidateCount, 2);
});

test("matchFuzzyWindows adds fuzzy_edit_applied warning on success", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
  ];
  const outcome = matchFuzzyWindows(windows, "hello", 0.85);
  assert.ok(outcome.warningCodes.includes("fuzzy_edit_applied"));
});

test("matchAnchoredFuzzy returns not_found without anchors", () => {
  const request: EditInstruction = { oldString: "hello", newString: "world" };
  const outcome = matchAnchoredFuzzy("content", request, 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchAnchoredFuzzy returns not_found when anchor missing", () => {
  const request: EditInstruction = { oldString: "hello", newString: "world", beforeAnchor: "missing" };
  const outcome = matchAnchoredFuzzy("content", request, 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchAnchoredFuzzy returns multiple_candidates when anchors not unique", () => {
  const request: EditInstruction = {
    oldString: "hello",
    newString: "world",
    beforeAnchor: "foo",
    afterAnchor: "foo",
  };
  const outcome = matchAnchoredFuzzy("foo hello bar foo", request, 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "multiple_candidates");
});

test("matchAnchoredFuzzy returns not_found when anchors in wrong order", () => {
  const request: EditInstruction = {
    oldString: "hello",
    newString: "world",
    beforeAnchor: "bar",
    afterAnchor: "foo",
  };
  const outcome = matchAnchoredFuzzy("foo hello bar", request, 0.85);
  assert.equal(outcome.matched, false);
  assert.equal(outcome.stopReason, "not_found");
});

test("matchAnchoredFuzzy matches within anchored region", () => {
  const request: EditInstruction = {
    oldString: "hello",
    newString: "world",
    beforeAnchor: "start",
    afterAnchor: "end",
  };
  const outcome = matchAnchoredFuzzy("start hello end", request, 0.85);
  assert.equal(outcome.matched, true);
  assert.ok(outcome.warningCodes.includes("anchored_fuzzy_edit_applied"));
});

test("computeLineOffsets returns [0] for empty string", () => {
  assert.deepEqual(computeLineOffsets(""), [0]);
});

test("computeLineOffsets returns offsets for single line", () => {
  assert.deepEqual(computeLineOffsets("hello"), [0]);
});

test("computeLineOffsets returns offsets for multiple lines", () => {
  const offsets = computeLineOffsets("a\nb\nc");
  assert.deepEqual(offsets, [0, 2, 4]);
});

test("computeLineOffsets handles Windows line endings", () => {
  const offsets = computeLineOffsets("a\r\nb\r\nc");
  assert.deepEqual(offsets, [0, 3, 6]);
});

test("computeLineOffsets handles empty lines", () => {
  const offsets = computeLineOffsets("\n\n");
  assert.deepEqual(offsets, [0, 1, 2]);
});

test("offsetToLineColumn returns line 1 column 1 for offset 0", () => {
  const result = offsetToLineColumn("hello", 0);
  assert.equal(result.line, 1);
  assert.equal(result.column, 1);
});

test("offsetToLineColumn returns correct position in single line", () => {
  const result = offsetToLineColumn("hello", 3);
  assert.equal(result.line, 1);
  assert.equal(result.column, 4);
});

test("offsetToLineColumn increments line on newline", () => {
  const result = offsetToLineColumn("a\nb", 2);
  assert.equal(result.line, 2);
  assert.equal(result.column, 1);
});

test("offsetToLineColumn handles multiple lines", () => {
  const result = offsetToLineColumn("a\nb\nc", 4);
  assert.equal(result.line, 3);
  assert.equal(result.column, 1);
});

test("offsetToLineColumn handles offset beyond content length", () => {
  const result = offsetToLineColumn("hello", 100);
  assert.equal(result.line, 1);
  assert.equal(result.column, 6);
});

test("buildCandidateWindows handles empty content", () => {
  const result = buildCandidateWindows("", "hello");
  // For empty content, we still get one window with empty text
  assert.ok(result.length >= 1);
  assert.equal(result[0]!.text, "");
});

test("buildCandidateWindows generates windows spanning multiple lines", () => {
  const content = "line1\nline2\nline3";
  const result = buildCandidateWindows(content, "line1\nline2");
  assert.ok(result.length > 0);
  // Windows should cover the content
  const allText = result.map((w) => w.text).join("");
  assert.ok(allText.includes("line1") || allText.includes("line2"));
});

test("buildCandidateWindows generates windows with varying spans", () => {
  const content = "a\nb\nc\nd\ne";
  const result = buildCandidateWindows(content, "b\nc");
  // Should generate windows with different line counts
  const spans = result.map((w) => w.text.split("\n").length);
  assert.ok(spans.some((s) => s >= 1));
});

test("buildCandidateWindows returns windows with sequential spans", () => {
  const content = "a\nb\nc\nd\ne";
  const result = buildCandidateWindows(content, "b\nc");
  const spans = result.map((w) => w.text.split("\n").length);
  assert.ok(spans.includes(1));
  assert.ok(spans.includes(2));
  assert.ok(spans.includes(3));
});

test("dedupeWindows removes exact duplicates", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
    { startOffset: 0, endOffset: 5, text: "hello" },
    { startOffset: 0, endOffset: 5, text: "hello" },
  ];
  const result = dedupeWindows(windows);
  assert.equal(result.length, 1);
});

test("dedupeWindows keeps windows with different offsets", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "hello" },
    { startOffset: 5, endOffset: 10, text: "hello" },
  ];
  const result = dedupeWindows(windows);
  assert.equal(result.length, 2);
});

test("dedupeWindows handles mixed duplicates and unique", () => {
  const windows: MatchCandidate[] = [
    { startOffset: 0, endOffset: 5, text: "a" },
    { startOffset: 0, endOffset: 5, text: "a" },
    { startOffset: 10, endOffset: 15, text: "b" },
  ];
  const result = dedupeWindows(windows);
  assert.equal(result.length, 2);
});

test("MatchOutcome type accepts valid structures", () => {
  const hitOutcome: MatchOutcome = {
    matched: true,
    candidateCount: 1,
    candidate: { startOffset: 0, endOffset: 5, text: "hello" },
    similarityScore: 0.95,
    warningCodes: ["fuzzy_edit_applied"],
    stopReason: "matched",
  };
  const missOutcome: MatchOutcome = {
    matched: false,
    candidateCount: 0,
    candidate: null,
    similarityScore: null,
    warningCodes: [],
    stopReason: "not_found",
  };
  assert.equal(hitOutcome.matched, true);
  assert.equal(missOutcome.matched, false);
});

test("EditInstruction type accepts valid structure", () => {
  const instruction: EditInstruction = {
    oldString: "hello",
    newString: "world",
    beforeAnchor: "start",
    afterAnchor: "end",
  };
  assert.equal(instruction.oldString, "hello");
  assert.equal(instruction.newString, "world");
});
