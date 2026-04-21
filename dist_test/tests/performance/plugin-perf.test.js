/**
 * Performance Test: Plugin Invocation
 * G4 Benchmark — plugin-spi-registry.invoke() P99 < 200ms
 *
 * Design target: Plugin invocation <200ms P99 (§7.4)
 * Tests basic-planner plugin suggestWorkflow() as representative workload.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createBasicPlannerPlugin } from "../../src/plugins/planners/basic-planner.js";
function createMinimalTask(complexity = "moderate") {
    return {
        taskId: `task_test_${Date.now()}`,
        intent: "Test task for performance benchmark",
        assessment: {
            taskId: `task_test_${Date.now()}`,
            timestamp: Date.now(),
            situationRef: `situation_${Date.now()}`,
            phase: "pre-execution",
            complexity,
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "core",
                workflow: "default",
                rationale: "test",
            },
            resourceAllocation: {
                modelClass: "standard",
                maxTokens: 1000,
                timeoutMs: 60000,
            },
            approvalPolicy: {
                required: false,
            },
            executionMode: "auto",
            suggestedActions: [],
        },
    };
}
test("performance: basic-planner suggestWorkflow() P99 < 200ms (trivial)", () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask("trivial");
    const latencies = [];
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        plugin.suggestWorkflow(task);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    const p50 = latencies[Math.floor(iterations * 0.5)];
    assert.ok(p99 < 200, `basic-planner (trivial) P99 latency ${p99.toFixed(3)}ms exceeds 200ms target`);
    assert.ok(p50 < 100, `basic-planner (trivial) P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`);
});
test("performance: basic-planner suggestWorkflow() P99 < 200ms (moderate)", () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask("moderate");
    const latencies = [];
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        plugin.suggestWorkflow(task);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    assert.ok(p99 < 200, `basic-planner (moderate) P99 latency ${p99.toFixed(3)}ms exceeds 200ms target`);
});
test("performance: basic-planner suggestWorkflow() P99 < 200ms (complex)", () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask("complex");
    const latencies = [];
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        plugin.suggestWorkflow(task);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    assert.ok(p99 < 200, `basic-planner (complex) P99 latency ${p99.toFixed(3)}ms exceeds 200ms target`);
});
test("performance: basic-planner plugin lifecycle (initialize + suggest + healthCheck) P99 < 300ms", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask("simple");
    await plugin.initialize?.();
    const latencies = [];
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await plugin.suggestWorkflow(task);
        await plugin.healthCheck?.();
        latencies.push(performance.now() - start);
    }
    await plugin.shutdown?.();
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    assert.ok(p99 < 300, `basic-planner lifecycle P99 latency ${p99.toFixed(3)}ms exceeds 300ms target`);
});
//# sourceMappingURL=plugin-perf.test.js.map