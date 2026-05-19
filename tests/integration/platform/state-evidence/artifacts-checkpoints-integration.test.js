/**
 * Integration Test: Artifacts and Checkpoints
 *
 * Tests artifact persistence and checkpoint envelope operations
 * using SQLite and temporary workspaces.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { createCheckpointEnvelope, unpackCheckpointEnvelope, getEnvelopeCompressionRatio, } from "../../../../src/platform/state-evidence/checkpoints/checkpoint-envelope.js";
test("integration: artifacts can be persisted and retrieved by task", () => {
    const ctx = createIntegrationContext("aa-artifact-retrieval-");
    try {
        const taskId = newId("task");
        const artifactId = newId("artifact");
        const now = nowIso();
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Artifact retrieval test",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        ctx.db.connection
            .prepare(`INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(artifactId, taskId, null, null, "file", "/workspace/test.txt", "test.txt", "text/plain", 512, "sha256:abc", null, now);
        const artifact = ctx.db.connection
            .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
            .get(artifactId);
        assert.ok(artifact, "Artifact should exist after insert");
        assert.equal(artifact.artifact_id, artifactId);
        assert.equal(artifact.task_id, taskId);
        assert.equal(artifact.size_bytes, 512);
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: multiple artifacts can be queried by execution", () => {
    const ctx = createIntegrationContext("aa-artifact-multi-exec-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "coding_ops",
                title: "Multi artifact exec test",
                status: "in_progress",
                source: "user",
                priority: "high",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            ctx.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "code_review",
                parentExecutionId: null,
                agentId: "agent-multi",
                roleId: "reviewer",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: `trace-${executionId}`,
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Insert multiple artifacts for same execution
        for (let i = 0; i < 3; i++) {
            const artifactId = newId("artifact");
            ctx.db.connection
                .prepare(`INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(artifactId, taskId, executionId, null, "file", `/workspace/file${i}.txt`, `file${i}.txt`, "text/plain", 256 * (i + 1), `sha256:hash${i}`, null, now);
        }
        const artifacts = ctx.db.connection
            .prepare("SELECT * FROM artifacts WHERE execution_id = ?")
            .all(executionId);
        assert.equal(artifacts.length, 3, "Should find 3 artifacts for execution");
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: checkpoint envelope wraps and unwraps data correctly", async () => {
    const workspace = createTempWorkspace("aa-checkpoint-env-");
    try {
        const checkpointData = {
            stepId: "step_001",
            status: "paused",
            outputs: { result: "partial_output" },
            iteration: 1,
        };
        const envelope = await createCheckpointEnvelope(checkpointData, "workflow_step_checkpoint.v1");
        assert.equal(envelope.version, "checkpoint_envelope.v1");
        assert.equal(envelope.schema, "workflow_step_checkpoint.v1");
        assert.ok(envelope.payload.length > 0, "Payload should be base64 encoded");
        assert.equal(envelope.metadata.algorithm, "gzip");
        assert.ok(envelope.metadata.originalSizeBytes > 0);
        assert.ok(envelope.metadata.compressedSizeBytes > 0);
        const unpacked = await unpackCheckpointEnvelope(envelope);
        assert.equal(unpacked.data.stepId, "step_001");
        assert.equal(unpacked.data.status, "paused");
        assert.equal(unpacked.data.outputs.result, "partial_output");
        assert.equal(unpacked.data.iteration, 1);
        assert.ok(unpacked.wasCompressed);
        assert.equal(unpacked.metadata.algorithm, "gzip");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("integration: checkpoint envelope detects corruption via checksum", async () => {
    const workspace = createTempWorkspace("aa-checkpoint-corr-");
    try {
        const checkpointData = { stepId: "step_corr", status: "done" };
        const envelope = await createCheckpointEnvelope(checkpointData, "workflow_step_checkpoint.v1");
        const tamperedEnvelope = await createCheckpointEnvelope({ stepId: "step_corr", status: "tampered" }, "workflow_step_checkpoint.v1");
        const corruptedEnvelope = {
            ...envelope,
            payload: tamperedEnvelope.payload,
        };
        await assert.rejects(async () => unpackCheckpointEnvelope(corruptedEnvelope), (err) => err.message.includes("Checksum verification failed"), "Should reject corrupted envelope");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("integration: checkpoint size limit is enforced", async () => {
    const workspace = createTempWorkspace("aa-checkpoint-size-");
    try {
        const largeData = { payload: "x".repeat(11 * 1024 * 1024) }; // > 10MB
        await assert.rejects(async () => createCheckpointEnvelope(largeData, "workflow_step_checkpoint.v1", { maxSizeBytes: 10 * 1024 * 1024 }), (err) => err.message.includes("exceeds maximum allowed"), "Should reject checkpoint exceeding size limit");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("integration: compression ratio is calculated correctly", async () => {
    const workspace = createTempWorkspace("aa-checkpoint-ratio-");
    try {
        const compressibleData = {
            repeated: "AAAA".repeat(1000),
        };
        const envelope = await createCheckpointEnvelope(compressibleData, "workflow_step_checkpoint.v1");
        const ratio = getEnvelopeCompressionRatio(envelope);
        assert.ok(ratio > 0 && ratio <= 1, "Compression ratio should be between 0 and 1");
        assert.ok(envelope.metadata.compressedSizeBytes < envelope.metadata.originalSizeBytes, "Compressed should be smaller");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=artifacts-checkpoints-integration.test.js.map