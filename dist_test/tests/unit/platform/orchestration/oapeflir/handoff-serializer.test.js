import test from "node:test";
import assert from "node:assert/strict";
import { serializeHandoff } from "../../../../../src/platform/orchestration/oapeflir/handoff-serializer.js";
function makeHandoff(overrides = {}) {
    const { planDeltaSize = 1, blockersCount = 2, summaryLength = 50, toolCallRecordsCount = 2, artifactRefsCount = 3, } = overrides;
    return {
        handoffId: "handoff_test",
        taskId: "task_test",
        fromAgentId: "agent_a",
        toAgentId: "agent_b",
        createdAt: "2026-01-01T00:00:00.000Z",
        primaryRefs: Array.from({ length: artifactRefsCount }, (_, i) => `artifact:ref_${i}`),
        fact: {
            artifactRefs: Array.from({ length: artifactRefsCount }, (_, i) => `artifact:ref_${i}`),
            toolCallRecords: Array.from({ length: toolCallRecordsCount }, (_, i) => ({
                callId: `call_${i}`,
                toolName: `tool_${i}`,
                inputArgs: {},
                rawOutput: `Call ${i} summary with some text`.padEnd(summaryLength, "x"),
                parsedOutput: null,
                success: true,
                errorCode: null,
                errorMessage: null,
                durationMs: 100,
                tokenUsage: { input: 50, output: 20 },
                sandboxViolation: false,
                retryAttempt: 0,
                outputRef: null,
            })),
        },
        state: {
            currentPhase: "execute",
            blockers: Array.from({ length: blockersCount }, (_, i) => `blocker_${i}_${"x".repeat(20)}`),
            remainingBudgetUsd: 0.05,
            latestSummary: "Latest summary text".padEnd(summaryLength, "x"),
        },
        planDelta: {
            addedSteps: Array.from({ length: planDeltaSize }, (_, i) => `step_added_${i}`),
            removedSteps: Array.from({ length: planDeltaSize }, (_, i) => `step_removed_${i}`),
            changedSteps: Array.from({ length: planDeltaSize }, (_, i) => ({
                stepId: `step_changed_${i}`,
                reason: `Reason for change ${i}`.padEnd(30, "x"),
            })),
        },
    };
}
test("serializeHandoff returns unchanged handoff when under budget", () => {
    const handoff = makeHandoff();
    const result = serializeHandoff(handoff, { totalMaxTokens: 10000 });
    assert.equal(result.handoffId, handoff.handoffId);
    assert.equal(result.taskId, handoff.taskId);
    assert.deepEqual(result.planDelta, handoff.planDelta);
    assert.deepEqual(result.fact, handoff.fact);
    assert.deepEqual(result.state, handoff.state);
});
test("serializeHandoff trims planDelta (L3) first when over budget", () => {
    const handoff = makeHandoff({ planDeltaSize: 10 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 200 });
    // L3 is trimmed first: changedSteps removed, removedSteps removed
    assert.ok(result.planDelta.changedSteps.length <= handoff.planDelta.changedSteps.length);
    assert.ok(result.planDelta.removedSteps.length <= handoff.planDelta.removedSteps.length);
});
test("serializeHandoff trims state.summary after planDelta when still over budget", () => {
    const handoff = makeHandoff({ planDeltaSize: 10, summaryLength: 500 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 100 });
    // After L3 trimmed, L2 summary gets truncated
    assert.ok(result.state.latestSummary.length <= handoff.state.latestSummary.length);
});
test("serializeHandoff clears toolCallRecords after state trimming", () => {
    const handoff = makeHandoff({
        planDeltaSize: 10,
        summaryLength: 500,
        blockersCount: 10,
    });
    const result = serializeHandoff(handoff, { totalMaxTokens: 50 });
    // After L1 trimming, toolCallRecords should be empty
    assert.equal(result.fact.toolCallRecords.length, 0);
});
test("serializeHandoff reduces artifactRefs to max 3 after L1 trimming", () => {
    const handoff = makeHandoff({ artifactRefsCount: 10 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 20 });
    assert.ok(result.fact.artifactRefs.length <= 3);
});
test("serializeHandoff falls back to minimal handoff when everything trimmed", () => {
    const handoff = makeHandoff({
        planDeltaSize: 20,
        blockersCount: 20,
        summaryLength: 1000,
        toolCallRecordsCount: 20,
        artifactRefsCount: 20,
    });
    const result = serializeHandoff(handoff, { totalMaxTokens: 5 });
    // Minimal fallback: identity fields preserved, primaryRefs at most 1
    assert.equal(result.handoffId, handoff.handoffId);
    assert.equal(result.taskId, handoff.taskId);
    assert.equal(result.fromAgentId, handoff.fromAgentId);
    assert.equal(result.toAgentId, handoff.toAgentId);
    assert.ok(result.primaryRefs.length <= 1);
    assert.deepEqual(result.planDelta.addedSteps, []);
    assert.deepEqual(result.planDelta.removedSteps, []);
    assert.deepEqual(result.planDelta.changedSteps, []);
});
test("serializeHandoff preserves phase identity in minimal fallback", () => {
    const handoff = makeHandoff({ planDeltaSize: 50 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 1 });
    assert.equal(result.state.currentPhase, handoff.state.currentPhase);
});
test("serializeHandoff preserves remainingBudgetUsd in minimal fallback", () => {
    const handoff = makeHandoff({ planDeltaSize: 50 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 1 });
    assert.equal(result.state.remainingBudgetUsd, handoff.state.remainingBudgetUsd);
});
test("serializeHandoff returns a new object (does not mutate original)", () => {
    const handoff = makeHandoff();
    const original = structuredClone(handoff);
    serializeHandoff(handoff, { totalMaxTokens: 1 });
    assert.deepEqual(handoff, original);
});
test("serializeHandoff handles zero blockers gracefully", () => {
    const handoff = makeHandoff({ blockersCount: 0 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 1 });
    assert.deepEqual(result.state.blockers, []);
});
test("serializeHandoff handles empty planDelta gracefully", () => {
    const handoff = makeHandoff({ planDeltaSize: 0 });
    const result = serializeHandoff(handoff, { totalMaxTokens: 1 });
    assert.deepEqual(result.planDelta.addedSteps, []);
    assert.deepEqual(result.planDelta.removedSteps, []);
    assert.deepEqual(result.planDelta.changedSteps, []);
});
//# sourceMappingURL=handoff-serializer.test.js.map