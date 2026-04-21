/**
 * Integration Test: Artifacts Persistence
 *
 * Verifies artifact storage and retrieval
 * using the actual database layer.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("artifacts: can insert and retrieve artifact records", () => {
    const workspace = createTempWorkspace("aa-artifact-");
    try {
        const dbPath = join(workspace, "artifact.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const artifactId = newId("artifact");
        const taskId = newId("task");
        const now = nowIso();
        // Create parent task first (artifacts have FK to tasks)
        db.connection
            .prepare(`INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", "Artifact test", "in_progress", "user", "normal", "{}", null, null, 0, 0, null, now, now, null);
        // Insert artifact directly with correct schema columns
        db.connection
            .prepare(`INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(artifactId, taskId, null, null, "file", "/workspace/output.txt", "output.txt", "text/plain", 1024, "sha256:abc123", null, now);
        // Retrieve artifact
        const artifact = db.connection
            .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
            .get(artifactId);
        assert.ok(artifact, "Artifact should exist");
        assert.equal(artifact.artifact_id, artifactId);
        assert.equal(artifact.task_id, taskId);
        assert.equal(artifact.kind, "file");
        assert.equal(artifact.storage_path, "/workspace/output.txt");
        assert.equal(artifact.file_name, "output.txt");
        assert.equal(artifact.size_bytes, 1024);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("artifacts: can query artifacts by task", () => {
    const workspace = createTempWorkspace("aa-artifact-task-");
    try {
        const dbPath = join(workspace, "artifact-task.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const taskId = newId("task");
        const now = nowIso();
        // Create parent task first (artifacts have FK to tasks)
        db.connection
            .prepare(`INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", "Artifact task query test", "in_progress", "user", "normal", "{}", null, null, 0, 0, null, now, now, null);
        // Insert multiple artifacts for same task
        for (let i = 0; i < 3; i++) {
            const artifactId = newId("artifact");
            db.connection
                .prepare(`INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(artifactId, taskId, null, null, "file", `/workspace/file${i}.txt`, `file${i}.txt`, "text/plain", 100 * (i + 1), `sha256:hash${i}`, null, now);
        }
        // Query artifacts by task
        const artifacts = db.connection
            .prepare("SELECT * FROM artifacts WHERE task_id = ?")
            .all(taskId);
        assert.equal(artifacts.length, 3, "Should find 3 artifacts");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("artifacts: metadata JSON is preserved correctly", () => {
    const workspace = createTempWorkspace("aa-artifact-meta-");
    try {
        const dbPath = join(workspace, "artifact-meta.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const artifactId = newId("artifact");
        const taskId = newId("task");
        const now = nowIso();
        // Create parent task first (artifacts have FK to tasks)
        db.connection
            .prepare(`INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", "Artifact metadata test", "in_progress", "user", "normal", "{}", null, null, 0, 0, null, now, now, null);
        const metadata = {
            filename: "report.pdf",
            pages: 42,
            author: "system",
            tags: ["important", "quarterly"],
        };
        db.connection
            .prepare(`INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(artifactId, taskId, null, null, "document", "/reports/q4.pdf", "report.pdf", "application/pdf", 102400, "sha256:metadata_test", JSON.stringify(metadata), now);
        // Retrieve and verify metadata
        const artifact = db.connection
            .prepare("SELECT lineage_json FROM artifacts WHERE artifact_id = ?")
            .get(artifactId);
        const retrievedMetadata = JSON.parse(artifact.lineage_json);
        assert.equal(retrievedMetadata.filename, "report.pdf");
        assert.equal(retrievedMetadata.pages, 42);
        assert.deepEqual(retrievedMetadata.tags, ["important", "quarterly"]);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=artifacts-persistence-integration.test.js.map