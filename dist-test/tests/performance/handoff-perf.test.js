/**
 * Performance Test: Agent Handoff Serializer
 * G4 Benchmark — handoff-serializer.serialize() P99 < 5ms
 *
 * Design target: Handoff <5ms P99 (§7.4)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import { serializeHandoff } from "../../src/platform/orchestration/oapeflir/handoff-serializer.js";
function createTestHandoff() {
    return {
        handoffId: newId("handoff"),
        taskId: newId("task"),
        fromAgentId: newId("agent"),
        toAgentId: newId("agent"),
        createdAt: nowIso(),
        fact: {
            artifactRefs: [
                newId("art"),
                newId("art"),
                newId("art"),
            ],
            toolCallRecords: [
                {
                    callId: newId("tc"),
                    toolName: "read",
                    inputArgs: {},
                    rawOutput: "",
                    parsedOutput: null,
                    success: true,
                    errorCode: null,
                    errorMessage: null,
                    durationMs: 100,
                    tokenUsage: { input: 0, output: 0 },
                    sandboxViolation: false,
                    retryAttempt: 0,
                    outputRef: null,
                },
                {
                    callId: newId("tc"),
                    toolName: "execute",
                    inputArgs: {},
                    rawOutput: "",
                    parsedOutput: null,
                    success: true,
                    errorCode: null,
                    errorMessage: null,
                    durationMs: 500,
                    tokenUsage: { input: 0, output: 0 },
                    sandboxViolation: false,
                    retryAttempt: 0,
                    outputRef: null,
                },
            ],
        },
        state: {
            currentPhase: "execute",
            blockers: ["waiting_for_user", "resource_limit"],
            remainingBudgetUsd: 0.05,
            latestSummary: "Task is proceeding well, completed file read and execution step",
        },
        planDelta: {
            addedSteps: [newId("step"), newId("step")],
            removedSteps: [newId("step")],
            changedSteps: [
                { stepId: newId("step"), reason: "optimization" },
                { stepId: newId("step"), reason: "error_recovery" },
            ],
        },
        primaryRefs: [newId("ref"), newId("ref")],
    };
}
test("performance: serializeHandoff P99 < 5ms", () => {
    const handoff = createTestHandoff();
    const options = { totalMaxTokens: 1000 };
    const latencies = [];
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        serializeHandoff(handoff, options);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    const p50 = latencies[Math.floor(iterations * 0.5)];
    assert.ok(p99 < 5, `serializeHandoff P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`);
    assert.ok(p50 < 2, `serializeHandoff P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`);
});
test("performance: serializeHandoff with large payload P99 < 10ms", () => {
    // Create a handoff with larger payload to stress test
    const largeHandoff = {
        handoffId: newId("handoff"),
        taskId: newId("task"),
        fromAgentId: newId("agent"),
        toAgentId: newId("agent"),
        createdAt: nowIso(),
        fact: {
            artifactRefs: Array.from({ length: 20 }, () => newId("art")),
            toolCallRecords: Array.from({ length: 10 }, () => ({
                callId: newId("tc"),
                toolName: "execute",
                inputArgs: {},
                rawOutput: "",
                parsedOutput: null,
                success: true,
                errorCode: null,
                errorMessage: null,
                durationMs: 1000,
                tokenUsage: { input: 0, output: 0 },
                sandboxViolation: false,
                retryAttempt: 0,
                outputRef: null,
            })),
        },
        state: {
            currentPhase: "execute",
            blockers: ["blocker1", "blocker2", "blocker3", "blocker4"],
            remainingBudgetUsd: 0.10,
            latestSummary: "This is a longer summary that contains more details about the current state of the task".repeat(3),
        },
        planDelta: {
            addedSteps: Array.from({ length: 10 }, () => newId("step")),
            removedSteps: Array.from({ length: 5 }, () => newId("step")),
            changedSteps: Array.from({ length: 10 }, () => ({
                stepId: newId("step"),
                reason: "various_reasons_for_change",
            })),
        },
        primaryRefs: Array.from({ length: 10 }, () => newId("ref")),
    };
    const options = { totalMaxTokens: 500 };
    const latencies = [];
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        serializeHandoff(largeHandoff, options);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    assert.ok(p99 < 10, `serializeHandoff (large payload) P99 latency ${p99.toFixed(3)}ms exceeds 10ms relaxed target`);
});
//# sourceMappingURL=handoff-perf.test.js.map