import test from "node:test";
import assert from "node:assert/strict";
import { RecoveryController } from "../../../../../src/platform/orchestration/harness/recovery-controller.js";
import { DurableHarnessService } from "../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
import { HarnessRuntimeService } from "../../../../../src/platform/orchestration/harness/index.js";
function createConstraintPack(overrides = {}) {
    return {
        policyIds: [],
        approvalMode: "none",
        autonomyMode: "auto",
        toolPolicy: { allowedTools: [] },
        risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
        output_policy: { requiredEvidence: [], redactSensitiveData: false },
        budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
        ...overrides,
    };
}
function createRun(overrides = {}) {
    return {
        runId: "run-test-1",
        taskId: "task-1",
        domainId: "coding",
        constraintPack: createConstraintPack(),
        steps: [],
        maxIterations: 10,
        currentIteration: 1,
        status: "running",
        createdAt: new Date().toISOString(),
        completedAt: null,
        decision: null,
        contextSnapshots: [],
        sleepLease: null,
        recoveryCheckpoint: null,
        feedbackEnvelope: null,
        toolbelt: null,
        guardrailAssessment: null,
        hitlRequest: null,
        timeline: [],
        ...overrides,
    };
}
test("RecoveryController.handleFailure with operator_abort sets status to aborted", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "running" });
    const result = controller.handleFailure(run, "operator_abort");
    assert.equal(result.status, "aborted");
    assert.notEqual(result.completedAt, null);
});
test("RecoveryController.handleFailure with operator_abort preserves completedAt if already set", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const existingCompletedAt = "2024-01-01T00:00:00.000Z";
    const run = createRun({ status: "running", completedAt: existingCompletedAt });
    const result = controller.handleFailure(run, "operator_abort");
    assert.equal(result.status, "aborted");
    assert.equal(result.completedAt, existingCompletedAt);
});
test("RecoveryController.handleFailure with worker_crash triggers recovery", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "running" });
    const result = controller.handleFailure(run, "worker_crash");
    assert.equal(result.status, "recovering");
    assert.notEqual(result.recoveryCheckpoint, null);
});
test("RecoveryController.handleFailure with tool_timeout triggers recovery then resume", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "running" });
    const result = controller.handleFailure(run, "tool_timeout");
    assert.equal(result.status, "running");
});
test("RecoveryController.handleFailure restores from checkpoint when available", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "running", steps: [{ stepId: "step-1", role: "planner", stage: "plan", iteration: 1, semanticPhase: "plan", inputs: {}, outputs: {}, startedAt: "", completedAt: "" }] });
    const checkpointRef = durableService.checkpoint(run);
    const freshRun = createRun({ runId: "run-fresh", status: "running" });
    const result = controller.handleFailure(freshRun, "worker_crash");
    assert.equal(result.status, "recovering");
    assert.notEqual(result.recoveryCheckpoint, null);
});
test("RecoveryController.handleFailure falls back to durable restore when no checkpoint", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "running" });
    durableService.persist(run);
    const result = controller.handleFailure(run, "worker_crash");
    assert.equal(result.status, "recovering");
});
test("RecoveryController passes sourceRun from restore to runtime.recover", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "running" });
    durableService.persist(run);
    const result = controller.handleFailure(run, "worker_crash");
    assert.ok(result.recoveryCheckpoint !== null);
    assert.equal(result.recoveryCheckpoint?.runId, run.runId);
});
test("RecoveryController returns original run when durable restore returns null and no checkpoint", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ runId: "unpersisted-run", status: "running" });
    const result = controller.handleFailure(run, "worker_crash");
    assert.equal(result.runId, run.runId);
    assert.equal(result.status, "recovering");
});
test("RecoveryController accepts all HarnessFailureType values", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const abortTypes = ["operator_abort", "worker_crash", "tool_timeout"];
    for (const failureType of abortTypes) {
        const run = createRun({ status: "running" });
        const result = controller.handleFailure(run, failureType);
        assert.ok(result !== undefined, `handleFailure should accept ${failureType}`);
    }
});
test("RecoveryController handles recovery for completed run", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({ status: "completed", completedAt: new Date().toISOString() });
    const result = controller.handleFailure(run, "worker_crash");
    assert.equal(result.status, "recovering");
});
test("RecoveryController preserves other run fields during operator_abort", () => {
    const durableService = new DurableHarnessService();
    const runtime = new HarnessRuntimeService({ durableService });
    const controller = new RecoveryController(durableService, runtime);
    const run = createRun({
        status: "running",
        taskId: "task-preserve",
        domainId: "preserve-domain",
        currentIteration: 5,
        toolbelt: { allowedTools: ["tool-a"], grantedTools: ["tool-a"], blockedTools: [], requiredEvidence: [] },
    });
    const result = controller.handleFailure(run, "operator_abort");
    assert.equal(result.taskId, "task-preserve");
    assert.equal(result.domainId, "preserve-domain");
    assert.equal(result.currentIteration, 5);
    assert.notEqual(result.completedAt, null);
});
//# sourceMappingURL=recovery-controller.test.js.map