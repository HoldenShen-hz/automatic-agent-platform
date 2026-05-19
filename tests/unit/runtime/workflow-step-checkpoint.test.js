import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createWorkflowStepCheckpoint, readWorkflowStepCheckpoint, summarizeWorkflowStepCheckpoint, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION, } from "../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
test("workflow step checkpoint builder preserves recovery-critical fields", () => {
    const checkpoint = createWorkflowStepCheckpoint({
        taskId: "task-1",
        executionId: "exec-1",
        workflowId: "wf-1",
        divisionId: "general_ops",
        stepId: "draft_solution",
        roleId: "engineer",
        outputKey: "draft",
        status: "succeeded",
        producedAt: "2026-04-07T10:00:00.000Z",
        output: {
            summary: "Draft prepared",
            result: "Detailed draft output",
        },
        decisionContext: {
            source: "multi_step_orchestration",
            request: "Prepare a patch",
            routeReason: "engineering workflow matched",
            priorStepSummaries: ["Request triaged"],
            dependsOnStepIds: ["intake_triage"],
        },
        resumeContext: {
            completedStepIds: ["intake_triage", "draft_solution"],
            nextStepId: "final_review",
            outputKeys: ["triage", "draft"],
        },
        upstreamArtifactRefs: [
            {
                artifactId: "artifact-1",
                kind: "workflow_step_snapshot",
                uri: "/tmp/artifact-1.json",
                createdAt: "2026-04-07T09:59:00.000Z",
            },
        ],
    });
    assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
    assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["intake_triage", "draft_solution"]);
    assert.equal(checkpoint.resumeContext.nextStepId, "final_review");
    assert.equal(checkpoint.upstreamArtifactRefs[0]?.artifactId, "artifact-1");
    const summary = summarizeWorkflowStepCheckpoint("artifact-latest", checkpoint);
    assert.equal(summary.artifactId, "artifact-latest");
    assert.equal(summary.stepId, "draft_solution");
    assert.equal(summary.summary, "Draft prepared");
    assert.deepEqual(summary.outputKeys, ["triage", "draft"]);
});
test("workflow step checkpoint reader ignores malformed artifacts", () => {
    const workspace = createTempWorkspace("aa-step-checkpoint-");
    try {
        const artifactDir = join(workspace, "artifacts", "task-1", "artifact-1");
        mkdirSync(artifactDir, { recursive: true });
        const storagePath = join(artifactDir, "draft_solution.json");
        writeFileSync(storagePath, JSON.stringify({ schemaVersion: "wrong" }), "utf8");
        const checkpoint = readWorkflowStepCheckpoint({
            artifactId: "artifact-1",
            taskId: "task-1",
            executionId: "exec-1",
            stepId: "draft_solution",
            kind: "workflow_step_snapshot",
            storagePath,
            fileName: "draft_solution.json",
            mimeType: "application/json",
            sizeBytes: 2,
            checksum: null,
            lineageJson: null,
            createdAt: "2026-04-07T10:00:00.000Z",
        });
        assert.equal(checkpoint, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("workflow step checkpoint reader reads valid checkpoint", () => {
    const workspace = createTempWorkspace("aa-step-checkpoint-valid-");
    try {
        const artifactDir = join(workspace, "artifacts", "task-2", "artifact-2");
        mkdirSync(artifactDir, { recursive: true });
        const storagePath = join(artifactDir, "step.json");
        writeFileSync(storagePath, JSON.stringify({
            schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
            taskId: "task-2",
            executionId: "exec-2",
            workflowId: "wf-2",
            divisionId: "general_ops",
            stepId: "execute",
            roleId: "engineer",
            outputKey: "output",
            status: "succeeded",
            producedAt: "2026-04-07T11:00:00.000Z",
            output: { summary: "Step completed", result: "ok" },
            decisionContext: {
                source: "multi_step_orchestration",
                request: "Execute the plan",
                routeReason: "engineering workflow",
                priorStepSummaries: ["Planning done"],
                dependsOnStepIds: ["plan"],
            },
            resumeContext: { completedStepIds: ["step-1"], nextStepId: null, outputKeys: ["output"] },
            fileDiffSummary: { summary: null, createdPaths: [], updatedPaths: [], deletedPaths: [] },
            upstreamArtifactRefs: [],
            compensationModel: null,
        }), "utf8");
        const checkpoint = readWorkflowStepCheckpoint({
            artifactId: "artifact-2",
            taskId: "task-2",
            executionId: "exec-2",
            stepId: "execute",
            kind: "workflow_step_snapshot",
            storagePath,
            fileName: "step.json",
            mimeType: "application/json",
            sizeBytes: 512,
            checksum: null,
            lineageJson: null,
            createdAt: "2026-04-07T11:00:00.000Z",
        });
        assert.notEqual(checkpoint, null);
        assert.equal(checkpoint?.taskId, "task-2");
        assert.equal(checkpoint?.stepId, "execute");
        assert.equal(checkpoint?.status, "succeeded");
        assert.deepEqual(checkpoint?.resumeContext.completedStepIds, ["step-1"]);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("workflow step checkpoint reader returns null for missing file", () => {
    const workspace = createTempWorkspace("aa-step-checkpoint-missing-");
    try {
        const checkpoint = readWorkflowStepCheckpoint({
            artifactId: "artifact-missing",
            taskId: "task-missing",
            executionId: "exec-missing",
            stepId: "missing-step",
            kind: "workflow_step_snapshot",
            storagePath: "/nonexistent/path/step.json",
            fileName: "step.json",
            mimeType: "application/json",
            sizeBytes: 0,
            checksum: null,
            lineageJson: null,
            createdAt: "2026-04-07T12:00:00.000Z",
        });
        assert.equal(checkpoint, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=workflow-step-checkpoint.test.js.map