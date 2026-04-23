import assert from "node:assert/strict";
import test from "node:test";
import { buildTaskResultEnvelope, buildStepResultEnvelope, } from "../../../../../src/platform/contracts/result-envelope/result-envelope.js";
function createTaskRecord(overrides = {}) {
    return {
        id: "task_1",
        parentId: null,
        rootId: "task_1",
        divisionId: "general",
        title: "Test Task",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: '{"prompt": "test"}',
        normalizedInputJson: null,
        outputJson: '{"result": "success"}',
        estimatedCostUsd: null,
        actualCostUsd: 0.01,
        errorCode: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
        completedAt: "2026-04-14T00:01:00.000Z",
        ...overrides,
    };
}
function createStepOutputRecord(overrides = {}) {
    return {
        id: "step_out_1",
        taskId: "task_1",
        stepId: "step1",
        roleId: "executor",
        status: "succeeded",
        dataJson: '{"output": "done"}',
        summary: "Step completed",
        artifactsJson: null,
        tokenCost: 100,
        durationMs: 500,
        validationJson: null,
        producedAt: "2026-04-14T00:00:30.000Z",
        ...overrides,
    };
}
function createWorkflowStateRecord(overrides = {}) {
    return {
        taskId: "task_1",
        divisionId: "general",
        workflowId: "workflow_1",
        currentStepIndex: 0,
        status: "completed",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
        ...overrides,
    };
}
function createArtifactRecord(overrides = {}) {
    return {
        artifactId: "art_1",
        taskId: "task_1",
        executionId: null,
        stepId: null,
        kind: "code",
        storagePath: "/tmp/art_1.txt",
        fileName: "art_1.txt",
        mimeType: "text/plain",
        sizeBytes: 1024,
        checksum: null,
        lineageJson: null,
        createdAt: "2026-04-14T00:00:30.000Z",
        ...overrides,
    };
}
test("buildTaskResultEnvelope returns null when task has no output and no step outputs and no artifacts", () => {
    const task = createTaskRecord({
        outputJson: null,
        status: "done",
    });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
    });
    // Should return null because structuredData is null and there are no step outputs or artifacts
    assert.equal(result, null);
});
test("buildTaskResultEnvelope creates success envelope for done task", () => {
    const task = createTaskRecord({ status: "done" });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.equal(result.status, "success");
    assert.equal(result.resultId, "task_1");
});
test("buildTaskResultEnvelope creates error envelope for failed task", () => {
    const task = createTaskRecord({
        status: "failed",
        errorCode: "task.execution_failed",
    });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.equal(result.status, "error");
    assert.equal(result.error.code, "task.execution_failed");
});
test("buildTaskResultEnvelope creates partial envelope for in_progress task", () => {
    const task = createTaskRecord({ status: "in_progress" });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.equal(result.status, "partial");
    assert.ok(result.warnings.some(w => w.includes("task_non_terminal")));
});
test("buildTaskResultEnvelope uses outputJson as structuredData", () => {
    const task = createTaskRecord({ outputJson: '{"result": "test output"}' });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.deepEqual(result.structuredData, { result: "test output" });
});
test("buildTaskResultEnvelope returns null for invalid outputJson", () => {
    const task = createTaskRecord({ outputJson: "not valid json" });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
    });
    assert.equal(result, null);
});
test("buildTaskResultEnvelope uses last step summary as humanSummary", () => {
    const task = createTaskRecord({ outputJson: null });
    const stepOutputs = [
        createStepOutputRecord({ id: "step_1", summary: "First step" }),
        createStepOutputRecord({ id: "step_2", summary: "Final step" }),
    ];
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs,
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.equal(result.humanSummary, "Final step");
});
test("buildTaskResultEnvelope falls back to task title when no step summary available", () => {
    const task = createTaskRecord({ outputJson: null, title: "My Task Title" });
    // Provide a step output without a summary to test fallback to task title
    const stepOutputs = [
        createStepOutputRecord({ summary: null, dataJson: "{}" }),
    ];
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs,
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.equal(result.humanSummary, "My Task Title");
});
test("buildTaskResultEnvelope aggregates step metrics", () => {
    const task = createTaskRecord({ status: "done" });
    const stepOutputs = [
        createStepOutputRecord({ tokenCost: 100, durationMs: 500 }),
        createStepOutputRecord({ tokenCost: 200, durationMs: 300 }),
    ];
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs,
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.deepEqual(result.metrics, { tokenCost: 300, durationMs: 800 });
});
test("buildTaskResultEnvelope includes workflow provenance when provided", () => {
    const task = createTaskRecord({ status: "done" });
    const workflowState = createWorkflowStateRecord({ workflowId: "wf_test" });
    const result = buildTaskResultEnvelope({
        task,
        workflowState,
        stepOutputs: [],
        artifacts: [],
    });
    assert.notEqual(result, null);
    assert.equal(result.provenance.workflowId, "wf_test");
    assert.equal(result.provenance.workflowStatus, "completed");
});
test("buildStepResultEnvelope creates success envelope for succeeded step", () => {
    const stepOutput = createStepOutputRecord({ status: "succeeded" });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.status, "success");
    assert.equal(result.resultId, "step_out_1");
});
test("buildStepResultEnvelope creates error envelope for failed step", () => {
    const stepOutput = createStepOutputRecord({
        status: "failed",
        dataJson: '{"error": "Step failed"}',
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.status, "error");
    assert.equal(result.error.code, "step_output.failed");
    assert.equal(result.error.message, "Step failed");
});
test("buildStepResultEnvelope creates partial envelope for partial_success step", () => {
    const stepOutput = createStepOutputRecord({ status: "partial_success" });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.status, "partial");
    assert.ok(result.warnings.includes("partial_success"));
});
test("buildStepResultEnvelope includes validation warnings", () => {
    const stepOutput = createStepOutputRecord({
        validationJson: '{"valid": false, "warnings": ["deprecated_field"]}',
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.ok(result.warnings.includes("validation_failed"));
    assert.ok(result.warnings.some(w => w.includes("deprecated_field")));
});
test("buildStepResultEnvelope parses nested error message", () => {
    const stepOutput = createStepOutputRecord({
        status: "failed",
        dataJson: '{"error": {"message": "Nested error"}}',
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.error.message, "Nested error");
});
test("buildStepResultEnvelope extracts summary from structured data", () => {
    const stepOutput = createStepOutputRecord({
        summary: null,
        dataJson: '{"summary": "Data summary"}',
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.humanSummary, "Data summary");
});
test("buildStepResultEnvelope prefers explicit summary over data summary", () => {
    const stepOutput = createStepOutputRecord({
        summary: "Explicit summary",
        dataJson: '{"summary": "Data summary"}',
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.humanSummary, "Explicit summary");
});
test("buildStepResultEnvelope includes step metrics", () => {
    const stepOutput = createStepOutputRecord({
        tokenCost: 150,
        durationMs: 750,
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.deepEqual(result.metrics, { tokenCost: 150, durationMs: 750 });
});
test("buildStepResultEnvelope resolves artifact refs from step output", () => {
    const artifact = createArtifactRecord({ artifactId: "art_1" });
    const stepOutput = createStepOutputRecord({
        artifactsJson: JSON.stringify([{
                artifactId: "art_1",
                kind: "code",
                uri: "/path/file.ts",
                createdAt: "2026-04-14T00:00:30.000Z",
            }]),
    });
    const result = buildStepResultEnvelope(stepOutput, [artifact]);
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.artifacts[0].artifactId, "art_1");
});
test("buildStepResultEnvelope enriches artifact refs with record data", () => {
    const artifact = createArtifactRecord({
        artifactId: "art_1",
        mimeType: "text/plain",
        sizeBytes: 2048,
    });
    const stepOutput = createStepOutputRecord({
        artifactsJson: JSON.stringify([{
                artifactId: "art_1",
                kind: "code",
                uri: "/path/file.ts",
                createdAt: "2026-04-14T00:00:30.000Z",
            }]),
    });
    const result = buildStepResultEnvelope(stepOutput, [artifact]);
    assert.equal(result.artifacts[0].mimeType, "text/plain");
    assert.equal(result.artifacts[0].sizeBytes, 2048);
});
test("buildStepResultEnvelope provenance includes step details", () => {
    const stepOutput = createStepOutputRecord({
        taskId: "task_1",
        stepId: "step_1",
        roleId: "executor",
    });
    const result = buildStepResultEnvelope(stepOutput, []);
    assert.equal(result.provenance.taskId, "task_1");
    assert.equal(result.provenance.stepId, "step_1");
    assert.equal(result.provenance.roleId, "executor");
});
test("buildTaskResultEnvelope deduplicates artifact refs", () => {
    const artifact1 = createArtifactRecord({ artifactId: "art_1" });
    const artifact2 = createArtifactRecord({ artifactId: "art_1" }); // Duplicate
    const task = createTaskRecord({ status: "done" });
    const result = buildTaskResultEnvelope({
        task,
        workflowState: null,
        stepOutputs: [],
        artifacts: [artifact1, artifact2],
    });
    assert.notEqual(result, null);
    assert.equal(result.artifacts.length, 1);
});
//# sourceMappingURL=result-envelope.test.js.map