import test from "node:test";
import assert from "node:assert/strict";
import { ContextAssembler } from "../../../../../src/platform/orchestration/harness/context-assembler.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
// Helper to create a minimal HarnessRun for snapshot testing
function createMinimalRun(overrides = {}) {
    return {
        runId: overrides.runId ?? newId("harness_run"),
        taskId: newId("task"),
        domainId: overrides.domainId ?? newId("domain"),
        constraintPack: {
            policyIds: [],
            approvalMode: "none",
            autonomyMode: "auto",
            toolPolicy: { allowedTools: [] },
            risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
            output_policy: { requiredEvidence: [], redactSensitiveData: false },
            budget: { maxSteps: 10, maxCost: 1000, maxDurationMs: 60000 },
        },
        steps: (overrides.steps ?? []),
        maxIterations: 10,
        currentIteration: overrides.currentIteration ?? 0,
        status: (overrides.status ?? "running"),
        createdAt: nowIso(),
        completedAt: null,
        decision: (overrides.decision ?? null),
        contextSnapshots: [],
        sleepLease: null,
        recoveryCheckpoint: null,
        feedbackEnvelope: null,
        toolbelt: null,
        guardrailAssessment: null,
        hitlRequest: null,
        timeline: [],
    };
}
test("ContextAssembler.assemble creates context with all source fields", () => {
    const assembler = new ContextAssembler();
    const sources = {
        conversation: { messages: ["hello", "world"] },
        task: { taskId: "task-123", description: "test task" },
        memory: { lastResult: "success" },
        knowledge: { domain: "testing" },
    };
    const context = assembler.assemble(sources, 4096);
    assert.strictEqual(context.tokenBudget, 4096);
    assert.deepEqual(context.conversation, { messages: ["hello", "world"] });
    assert.deepEqual(context.task, { taskId: "task-123", description: "test task" });
    assert.deepEqual(context.memory, { lastResult: "success" });
    assert.deepEqual(context.knowledge, { domain: "testing" });
    assert.ok(context.contextId.startsWith("harness_context_"));
    assert.ok(context.assembledAt.length > 0);
});
test("ContextAssembler.assemble handles empty sources", () => {
    const assembler = new ContextAssembler();
    const sources = {};
    const context = assembler.assemble(sources, 2048);
    assert.strictEqual(context.tokenBudget, 2048);
    assert.deepEqual(context.conversation, {});
    assert.deepEqual(context.task, {});
    assert.deepEqual(context.memory, {});
    assert.deepEqual(context.knowledge, {});
});
test("ContextAssembler.assemble handles partial sources", () => {
    const assembler = new ContextAssembler();
    const sources = {
        conversation: { count: 5 },
        // task, memory, knowledge omitted
    };
    const context = assembler.assemble(sources, 1024);
    assert.strictEqual(context.tokenBudget, 1024);
    assert.deepEqual(context.conversation, { count: 5 });
    assert.deepEqual(context.task, {});
    assert.deepEqual(context.memory, {});
    assert.deepEqual(context.knowledge, {});
});
test("ContextAssembler.assemble performs shallow copy of sources", () => {
    const assembler = new ContextAssembler();
    const nested = { messages: ["original"] };
    const sources = {
        conversation: nested,
    };
    const context = assembler.assemble(sources, 4096);
    // Shallow copy means top-level properties are new objects, but nested references are preserved
    // So modifying the nested array affects both
    nested.messages.push("modified");
    assert.deepEqual(context.conversation, { messages: ["original", "modified"] });
});
test("ContextAssembler.assemble generates unique context IDs", () => {
    const assembler = new ContextAssembler();
    const sources = {};
    const context1 = assembler.assemble(sources, 1000);
    const context2 = assembler.assemble(sources, 1000);
    assert.notStrictEqual(context1.contextId, context2.contextId);
});
test("ContextAssembler.snapshot creates snapshot with run metadata", () => {
    const assembler = new ContextAssembler();
    const run = createMinimalRun({
        runId: "run_abc",
        domainId: "domain_xyz",
        currentIteration: 3,
        steps: [{ stepId: "step_1" }, { stepId: "step_2" }],
    });
    const context = assembler.assemble({}, 4096);
    const snapshot = assembler.snapshot(run, context);
    assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
    assert.strictEqual(snapshot.runId, "run_abc");
    assert.strictEqual(snapshot.domainId, "domain_xyz");
    assert.strictEqual(snapshot.iteration, 3);
    assert.strictEqual(snapshot.stepCount, 2);
    assert.strictEqual(snapshot.capturedAt, context.assembledAt);
});
test("ContextAssembler.snapshot captures lastDecisionId from run decision", () => {
    const assembler = new ContextAssembler();
    const run = createMinimalRun({
        runId: "run_with_decision",
        decision: {
            decisionId: "decision_123",
            action: "accept",
            reasonCodes: [],
            confidence: 0.95,
            createdAt: nowIso(),
        },
    });
    const context = assembler.assemble({}, 4096);
    const snapshot = assembler.snapshot(run, context);
    assert.strictEqual(snapshot.lastDecisionId, "decision_123");
});
test("ContextAssembler.snapshot captures null lastDecisionId when no decision", () => {
    const assembler = new ContextAssembler();
    const run = createMinimalRun({ runId: "run_no_decision", decision: null });
    const context = assembler.assemble({}, 4096);
    const snapshot = assembler.snapshot(run, context);
    assert.strictEqual(snapshot.lastDecisionId, null);
});
test("ContextAssembler.snapshot stepCount reflects run steps length", () => {
    const assembler = new ContextAssembler();
    const run = createMinimalRun({
        runId: "run_steps",
    });
    // Add steps by spreading into a new run object with proper typing
    const runWithSteps = {
        ...run,
        steps: Array(5).fill({ stepId: "step" }),
    };
    const context = assembler.assemble({}, 4096);
    const snapshot = assembler.snapshot(runWithSteps, context);
    assert.strictEqual(snapshot.stepCount, 5);
});
test("ContextAssembler snapshot iteration captures currentIteration", () => {
    const assembler = new ContextAssembler();
    const run = createMinimalRun({ currentIteration: 7 });
    const context = assembler.assemble({}, 4096);
    const snapshot = assembler.snapshot(run, context);
    assert.strictEqual(snapshot.iteration, 7);
});
//# sourceMappingURL=context-assembler.test.js.map