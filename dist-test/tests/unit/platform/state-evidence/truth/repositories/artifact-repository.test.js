import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ArtifactRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/artifact-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
function createTestTask(db, taskId, tenantId, now) {
    const taskRepo = new TaskRepository(db.connection);
    taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId,
        title: "Test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    });
}
test("ArtifactRepository getArtifact returns artifact by ID", () => {
    const workspace = createTempWorkspace("aa-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new ArtifactRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-artifact-1", null, now);
        db.connection.exec(`
      INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
      VALUES ('artifact-001', 'task-artifact-1', NULL, 'step-1', 'output', '/storage/artifact-001.txt', 'output.txt', 'text/plain', 1024, 'abc123', '[]', '${now}')
    `);
        const result = repo.getArtifact("artifact-001");
        assert.ok(result);
        assert.equal(result.artifactId, "artifact-001");
        assert.equal(result.taskId, "task-artifact-1");
        assert.equal(result.kind, "output");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ArtifactRepository insertArtifact persists a new artifact", () => {
    const workspace = createTempWorkspace("aa-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new ArtifactRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-artifact-insert", null, now);
        repo.insertArtifact({
            artifactId: "artifact-insert-001",
            taskId: "task-artifact-insert",
            executionId: null,
            stepId: "step-insert",
            kind: "output",
            storagePath: "/storage/insert.txt",
            fileName: "insert.txt",
            mimeType: "text/plain",
            sizeBytes: 10,
            checksum: "checksum-insert",
            lineageJson: "[]",
            createdAt: now,
        });
        const result = repo.getArtifact("artifact-insert-001");
        assert.equal(result?.fileName, "insert.txt");
        assert.equal(result?.checksum, "checksum-insert");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ArtifactRepository getArtifact returns null for non-existent", () => {
    const workspace = createTempWorkspace("aa-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new ArtifactRepository(db.connection);
        const result = repo.getArtifact("nonexistent-artifact");
        assert.strictEqual(result, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ArtifactRepository listArtifactsByTask returns artifacts for a task", () => {
    const workspace = createTempWorkspace("aa-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new ArtifactRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-artifact-list", null, now);
        db.connection.exec(`
      INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
      VALUES ('artifact-list-1', 'task-artifact-list', NULL, 'step-1', 'output', '/storage/1.txt', 'file1.txt', 'text/plain', 100, 'hash1', '[]', '${now}')
    `);
        db.connection.exec(`
      INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
      VALUES ('artifact-list-2', 'task-artifact-list', NULL, 'step-2', 'log', '/storage/2.txt', 'file2.txt', 'text/plain', 200, 'hash2', '[]', '${now}')
    `);
        const results = repo.listArtifactsByTask("task-artifact-list");
        assert.equal(results.length, 2);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ArtifactRepository listArtifactsByTask returns empty for non-existent task", () => {
    const workspace = createTempWorkspace("aa-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new ArtifactRepository(db.connection);
        const results = repo.listArtifactsByTask("nonexistent-task");
        assert.equal(results.length, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ArtifactRepository column mapping snake_case to camelCase is correct", () => {
    const workspace = createTempWorkspace("aa-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new ArtifactRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-artifact-cols", null, now);
        db.connection.exec(`
      INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
      VALUES ('artifact-cols-001', 'task-artifact-cols', NULL, 'step-cols', 'output', '/storage/cols.txt', 'result.txt', 'application/json', 2048, 'xyz789', '["parent"]', '${now}')
    `);
        const result = repo.getArtifact("artifact-cols-001");
        assert.ok(result);
        assert.equal(result.artifactId, "artifact-cols-001");
        assert.equal(result.taskId, "task-artifact-cols");
        assert.strictEqual(result.executionId, null);
        assert.equal(result.stepId, "step-cols");
        assert.equal(result.kind, "output");
        assert.equal(result.storagePath, "/storage/cols.txt");
        assert.equal(result.fileName, "result.txt");
        assert.equal(result.mimeType, "application/json");
        assert.equal(result.sizeBytes, 2048);
        assert.equal(result.checksum, "xyz789");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=artifact-repository.test.js.map