import test from "node:test";
import assert from "node:assert/strict";
import { detectLlmTruncation } from "../../../../../../src/platform/orchestration/oapeflir/learn/pattern-detectors/truncation-detector.js";
import { detectToolPermissionDenial } from "../../../../../../src/platform/orchestration/oapeflir/learn/pattern-detectors/permission-detector.js";
import { detectModelHallucination } from "../../../../../../src/platform/orchestration/oapeflir/learn/pattern-detectors/hallucination-detector.js";
import { detectSchemaValidationLoop } from "../../../../../../src/platform/orchestration/oapeflir/learn/pattern-detectors/schema-loop-detector.js";
function makeSignal(overrides = {}) {
    return {
        learningSignalId: "sig_test_1",
        taskId: "task_123",
        sourceFeedbackId: "fb_123",
        learningType: "failure_pattern",
        confidence: 0.8,
        valueSummary: "Test signal summary",
        evidenceRefs: [],
        sourceSignalIds: [],
        relatedSignalIds: [],
        evidence: {},
        generatedAt: Date.now(),
        ...overrides,
    };
}
// ============ Truncation Detector Tests ============
test("detectLlmTruncation returns null when finishReason is not 'length'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_trunc_1",
        evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 500 },
    });
    const result = detectLlmTruncation(signal);
    assert.equal(result, null);
});
test("detectLlmTruncation detects explicit finish_reason='length'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_trunc_2",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
    });
    const result = detectLlmTruncation(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "llm_truncation");
    assert.equal(result.taskId, "task_123");
    assert.ok(result.title.includes("truncated"));
    assert.ok(result.summary.includes("1000"));
    assert.ok(result.recommendation.includes("max_tokens"));
});
test("detectLlmTruncation detects tokens near max_tokens (>95%)", () => {
    const signal = makeSignal({
        learningSignalId: "sig_trunc_3",
        evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 970 },
    });
    const result = detectLlmTruncation(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "llm_truncation");
    assert.ok(result.title.includes("near token limit"));
    assert.ok(result.summary.includes("97%"));
});
test("detectLlmTruncation does not trigger when tokensUsed is 0", () => {
    const signal = makeSignal({
        learningSignalId: "sig_trunc_4",
        evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 0 },
    });
    const result = detectLlmTruncation(signal);
    assert.equal(result, null);
});
test("detectLlmTruncation does not trigger when maxTokens is 0", () => {
    const signal = makeSignal({
        learningSignalId: "sig_trunc_5",
        evidence: { finishReason: "stop", maxTokens: 0, tokensUsed: 500 },
    });
    const result = detectLlmTruncation(signal);
    assert.equal(result, null);
});
test("detectLlmTruncation handles snake_case evidence keys", () => {
    const signal = makeSignal({
        learningSignalId: "sig_trunc_6",
        evidence: { finish_reason: "length", max_tokens: 2000, tokens_used: 2000 },
    });
    const result = detectLlmTruncation(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "llm_truncation");
});
// ============ Permission Detector Tests ============
test("detectToolPermissionDenial returns null when no denial pattern matches", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_1",
        valueSummary: "Tool executed successfully",
        evidence: { toolName: "Read" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.equal(result, null);
});
test("detectToolPermissionDenial detects 'permission denied'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_2",
        valueSummary: "permission denied",
        evidence: { toolName: "Write" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "tool_permission_denial");
    assert.ok(result.title.includes("permission denial"));
    assert.ok(result.recommendation.includes("sandbox"));
});
test("detectToolPermissionDenial detects 'access denied'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_3",
        valueSummary: "access denied for tool",
        evidence: { toolName: "Delete" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "tool_permission_denial");
});
test("detectToolPermissionDenial detects 'forbidden'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_4",
        evidence: { toolName: "Exec", operation: "execute" },
    });
    signal.valueSummary = "forbidden";
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "tool_permission_denial");
});
test("detectToolPermissionDenial detects 'EPERM'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_5",
        valueSummary: "EPERM error occurred",
        evidence: { errorCode: "EPERM" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "tool_permission_denial");
});
test("detectToolPermissionDenial detects 'eacces'", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_6",
        evidence: { errorCode: "eacces" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "tool_permission_denial");
});
test("detectToolPermissionDenial uses evidence.tool when toolName is not present", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_7",
        valueSummary: "permission denied",
        evidence: { tool: "Read" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.ok(result.title.includes("Read"));
});
test("detectToolPermissionDenial uses evidence.action when operation is not present", () => {
    const signal = makeSignal({
        learningSignalId: "sig_perm_8",
        valueSummary: "permission denied",
        evidence: { toolName: "Write", action: "file_write" },
    });
    const result = detectToolPermissionDenial(signal);
    assert.notEqual(result, null);
    assert.ok(result.summary.includes("file_write"));
});
// ============ Hallucination Detector Tests ============
test("detectModelHallucination returns null when evalScore >= 0.3", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_1",
        evidence: { evalScore: 0.5, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.equal(result, null);
});
test("detectModelHallucination returns null when evalScore is 0", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_2",
        evidence: { evalScore: 0, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.equal(result, null);
});
test("detectModelHallucination returns null when evalScore is above threshold", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_3",
        evidence: { evalScore: 0.3, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.equal(result, null);
});
test("detectModelHallucination detects evalScore < 0.3", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_4",
        evidence: { evalScore: 0.1, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "model_hallucination");
    assert.ok(result.title.includes("hallucination"));
    assert.ok(result.title.includes("0.10"));
    assert.ok(result.recommendation.includes("grounding context"));
});
test("detectModelHallucination detects evalScore exactly below threshold (0.29)", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_5",
        evidence: { evalScore: 0.29, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "model_hallucination");
});
test("detectModelHallucination handles snake_case eval_score key", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_6",
        evidence: { eval_score: 0.15, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "model_hallucination");
});
test("detectModelHallucination handles qualityScore key", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_7",
        evidence: { qualityScore: 0.2, modelId: "claude-3" },
    });
    const result = detectModelHallucination(signal);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "model_hallucination");
});
test("detectModelHallucination uses 'unknown' when modelId is not present", () => {
    const signal = makeSignal({
        learningSignalId: "sig_hall_8",
        evidence: { evalScore: 0.1 },
    });
    const result = detectModelHallucination(signal);
    assert.notEqual(result, null);
    assert.ok(result.summary.includes("unknown"));
});
// ============ Schema Loop Detector Tests ============
test("detectSchemaValidationLoop returns null for empty signals", () => {
    const result = detectSchemaValidationLoop([]);
    assert.equal(result, null);
});
test("detectSchemaValidationLoop returns null when no step has enough occurrences", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_x" } }),
    ];
    const result = detectSchemaValidationLoop(signals);
    assert.equal(result, null);
});
test("detectSchemaValidationLoop returns null when step has fewer than minOccurrences", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_3", evidence: { stepId: "step_x" } }),
    ];
    const result = detectSchemaValidationLoop(signals, 4);
    assert.equal(result, null);
});
test("detectSchemaValidationLoop detects loop when minOccurrences met", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: { stepId: "step_x" }, valueSummary: "validation failed" }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_x" }, valueSummary: "validation failed" }),
        makeSignal({ learningSignalId: "sig_loop_3", evidence: { stepId: "step_x" }, valueSummary: "validation failed" }),
    ];
    const result = detectSchemaValidationLoop(signals, 3);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "schema_validation_loop");
    assert.ok(result.title.includes("Schema validation loop"));
    assert.ok(result.title.includes("3"));
});
test("detectSchemaValidationLoop groups by taskId and stepId", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", taskId: "task_1", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_2", taskId: "task_1", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_3", taskId: "task_2", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_4", taskId: "task_2", evidence: { stepId: "step_x" } }),
    ];
    const result = detectSchemaValidationLoop(signals, 2);
    // Both task_1/step_x and task_2/step_x have 2 occurrences, so both should be detected
    // But detectSchemaValidationLoop returns the first match
    assert.notEqual(result, null);
    assert.equal(result.patternType, "schema_validation_loop");
});
test("detectSchemaValidationLoop skips non-failure_pattern signals", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", learningType: "user_correction", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_3", evidence: { stepId: "step_x" } }),
    ];
    const result = detectSchemaValidationLoop(signals, 3);
    // Only 2 failure_pattern signals, so should return null
    assert.equal(result, null);
});
test("detectSchemaValidationLoop skips signals without stepId", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: {} }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_3", evidence: { stepId: "step_x" } }),
    ];
    const result = detectSchemaValidationLoop(signals, 3);
    // Only 2 signals with stepId, so should return null
    assert.equal(result, null);
});
test("detectSchemaValidationLoop includes all sourceSignalIds in evidence", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_x" } }),
        makeSignal({ learningSignalId: "sig_loop_3", evidence: { stepId: "step_x" } }),
    ];
    const result = detectSchemaValidationLoop(signals, 3);
    assert.notEqual(result, null);
    assert.equal(result.evidenceRefs.length, 3);
    assert.equal(result.sourceSignalIds.length, 3);
    assert.ok(result.evidenceRefs.includes("sig_loop_1"));
    assert.ok(result.evidenceRefs.includes("sig_loop_2"));
    assert.ok(result.evidenceRefs.includes("sig_loop_3"));
});
test("detectSchemaValidationLoop uses default minOccurrences of 3", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: { stepId: "step_y" } }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_y" } }),
        makeSignal({ learningSignalId: "sig_loop_3", evidence: { stepId: "step_y" } }),
    ];
    const result = detectSchemaValidationLoop(signals);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "schema_validation_loop");
});
test("detectSchemaValidationLoop accepts custom minOccurrences", () => {
    const signals = [
        makeSignal({ learningSignalId: "sig_loop_1", evidence: { stepId: "step_z" } }),
        makeSignal({ learningSignalId: "sig_loop_2", evidence: { stepId: "step_z" } }),
    ];
    const result = detectSchemaValidationLoop(signals, 2);
    assert.notEqual(result, null);
    assert.equal(result.patternType, "schema_validation_loop");
});
//# sourceMappingURL=pattern-detectors.test.js.map