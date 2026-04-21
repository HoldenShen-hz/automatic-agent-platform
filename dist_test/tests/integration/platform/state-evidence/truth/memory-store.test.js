import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { parseStructuredMemoryContent } from "../../../../../src/platform/state-evidence/memory/memory-schema.js";
import { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("memory store persists recall access counts revocation and quality reporting", () => {
    const workspace = createTempWorkspace("aa-memory-store-");
    const dbPath = join(workspace, "memory-store.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const memory = new MemoryService(store);
        const projectMemory = memory.remember({
            taskId: "task-memory-1",
            executionId: "exec-memory-1",
            scope: "project",
            content: { note: "ship queue reconciliation first" },
            classification: "internal",
            qualityScore: 0.9,
            createdAt: "2026-04-07T09:00:00.000Z",
        });
        memory.remember({
            taskId: "task-memory-2",
            scope: "role:ops",
            content: { note: "page operator on degraded remote session" },
            classification: "operational",
            sourceTrustLevel: "external",
            qualityScore: 0.7,
            createdAt: "2026-04-07T09:05:00.000Z",
        });
        const recalled = memory.recall({
            scopes: ["project"],
            evaluatedAt: "2026-04-07T10:00:00.000Z",
        });
        assert.equal(recalled.length, 1);
        assert.equal(recalled[0]?.id, projectMemory.id);
        assert.equal(store.getMemory(projectMemory.id)?.hitCount, 1);
        assert.equal(store.getMemory(projectMemory.id)?.lastAccessedAt, "2026-04-07T10:00:00.000Z");
        const revoked = memory.revoke(projectMemory.id, "superseded by newer guidance", "2026-04-07T10:05:00.000Z");
        assert.equal(revoked?.revocationReason, "superseded by newer guidance");
        const quality = memory.getQualityReport({
            evaluatedAt: "2026-04-07T10:06:00.000Z",
        });
        assert.equal(quality.totalCount, 2);
        assert.equal(quality.activeCount, 1);
        assert.equal(quality.revokedCount, 1);
        assert.equal(quality.recalledCount, 1);
        assert.equal(quality.byScope[0]?.key, "project");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("memory store consolidates older layer_3 memories into a layer_5 summary and revokes sources", () => {
    const workspace = createTempWorkspace("aa-memory-consolidation-");
    const dbPath = join(workspace, "memory-consolidation.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const memory = new MemoryService(store);
        memory.remember({
            taskId: "task-memory-1",
            scope: "project",
            content: { note: "capture operator rollback prerequisites" },
            classification: "internal",
            qualityScore: 0.9,
            createdAt: "2026-04-07T09:00:00.000Z",
        });
        memory.remember({
            taskId: "task-memory-1",
            scope: "project",
            content: { note: "record queue replay safeguards" },
            classification: "operational",
            qualityScore: 0.7,
            createdAt: "2026-04-07T09:05:00.000Z",
        });
        memory.remember({
            taskId: "task-memory-1",
            scope: "project",
            content: { note: "preserve writeback fail-close rationale" },
            classification: "operational",
            qualityScore: 0.8,
            createdAt: "2026-04-07T09:10:00.000Z",
        });
        const result = memory.consolidate({
            taskId: "task-memory-1",
            scopes: ["project"],
            minSourceMemories: 3,
            olderThanCreatedAt: "2026-04-07T09:30:00.000Z",
            evaluatedAt: "2026-04-07T10:00:00.000Z",
        });
        assert.equal(result.consolidated, true);
        assert.equal(result.createdMemory?.memoryLayer, "layer_5");
        assert.equal(result.createdMemory?.classification, "summary");
        assert.equal(result.sourceMemoryIds.length, 3);
        const createdPayload = parseStructuredMemoryContent(result.createdMemory?.contentJson ?? "{}");
        assert.equal(createdPayload.workContext, "Consolidated 3 memories into layer_5");
        assert.equal(createdPayload.facts.length >= 3, true);
        const remainingShortTerm = memory.recall({
            taskId: "task-memory-1",
            scopes: ["project"],
            memoryLayers: ["layer_3"],
            evaluatedAt: "2026-04-07T10:01:00.000Z",
        });
        assert.equal(remainingShortTerm.length, 0);
        const longTerm = memory.recall({
            taskId: "task-memory-1",
            scopes: ["project"],
            memoryLayers: ["layer_5"],
            evaluatedAt: "2026-04-07T10:01:00.000Z",
        });
        assert.equal(longTerm.length, 1);
        assert.equal(longTerm[0]?.id, result.createdMemory?.id);
        const revokedSources = store.listMemories({
            taskId: "task-memory-1",
            scopes: ["project"],
            memoryLayers: ["layer_3"],
            includeRevoked: true,
            evaluatedAt: "2026-04-07T10:02:00.000Z",
        });
        assert.equal(revokedSources.every((record) => record.revocationReason === `consolidated_into:${result.createdMemory?.id}`), true);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=memory-store.test.js.map