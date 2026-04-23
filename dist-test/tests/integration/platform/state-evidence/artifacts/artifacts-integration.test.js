import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("Artifact creation with required fields", () => {
    const artifact = {
        id: newId("artifact"),
        taskId: newId("task"),
        sessionId: newId("sess"),
        kind: "file",
        contentHash: "abc123",
        createdAt: nowIso(),
        metadata: {},
    };
    assert.ok(artifact.id.startsWith("artifact_"));
    assert.ok(artifact.taskId.startsWith("task_"));
    assert.ok(artifact.sessionId.startsWith("sess_"));
    assert.equal(artifact.kind, "file");
});
test("Artifact with different kinds", () => {
    const kinds = ["file", "image", "document", "code", "data"];
    for (const kind of kinds) {
        const artifact = {
            id: newId("artifact"),
            taskId: newId("task"),
            sessionId: newId("sess"),
            kind,
            contentHash: newId("hash"),
            createdAt: nowIso(),
            metadata: {},
        };
        assert.equal(artifact.kind, kind);
    }
});
test("Artifact metadata attachment", () => {
    const artifact = {
        id: newId("artifact"),
        taskId: newId("task"),
        sessionId: newId("sess"),
        kind: "file",
        contentHash: "xyz789",
        createdAt: nowIso(),
        metadata: {
            filename: "test.ts",
            size: 1024,
            mimeType: "text/typescript",
        },
    };
    assert.equal(artifact.metadata.filename, "test.ts");
    assert.equal(artifact.metadata.size, 1024);
    assert.equal(artifact.metadata.mimeType, "text/typescript");
});
test("Multiple artifacts for same task", () => {
    const taskId = newId("task");
    const artifacts = [];
    for (let i = 0; i < 5; i++) {
        artifacts.push({
            id: newId("artifact"),
            taskId,
            sessionId: newId("sess"),
            kind: "file",
            contentHash: newId("hash"),
            createdAt: nowIso(),
            metadata: { index: i },
        });
    }
    const sameTask = artifacts.filter((a) => a.taskId === taskId);
    assert.equal(sameTask.length, 5);
});
test("Artifact content hash uniqueness", () => {
    const hashes = new Set();
    for (let i = 0; i < 100; i++) {
        hashes.add(newId("hash").replace("hash_", ""));
    }
    assert.equal(hashes.size, 100);
});
test("Artifact timestamp ordering", () => {
    const artifacts = [];
    for (let i = 0; i < 10; i++) {
        artifacts.push({
            id: newId("artifact"),
            taskId: newId("task"),
            sessionId: newId("sess"),
            kind: "file",
            contentHash: newId("hash"),
            createdAt: nowIso(),
            metadata: { order: i },
        });
    }
    const sorted = artifacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (let i = 1; i < sorted.length; i++) {
        assert.ok(sorted[i].createdAt >= sorted[i - 1].createdAt);
    }
});
//# sourceMappingURL=artifacts-integration.test.js.map