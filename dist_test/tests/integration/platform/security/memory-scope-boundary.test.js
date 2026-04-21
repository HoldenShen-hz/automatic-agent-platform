import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { parseStructuredMemoryContent } from "../../../../src/platform/state-evidence/memory/memory-schema.js";
import { MemoryService } from "../../../../src/platform/state-evidence/memory/memory-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("memory recall stays within explicit scope, trust, and lifecycle boundaries", () => {
    const workspace = createTempWorkspace("aa-memory-security-");
    const dbPath = join(workspace, "memory-security.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const memory = new MemoryService(store);
        const trustedProject = memory.remember({
            scope: "project",
            content: { note: "safe operational memory" },
            classification: "internal",
            sourceTrustLevel: "trusted",
            createdAt: "2026-04-07T08:00:00.000Z",
        });
        memory.remember({
            scope: "role:finance",
            content: { note: "foreign role memory" },
            classification: "internal",
            sourceTrustLevel: "trusted",
            createdAt: "2026-04-07T08:05:00.000Z",
        });
        memory.remember({
            scope: "project",
            content: { note: "expired memory" },
            classification: "internal",
            sourceTrustLevel: "trusted",
            createdAt: "2026-04-07T08:10:00.000Z",
            expiresAt: "2026-04-07T08:20:00.000Z",
        });
        memory.remember({
            scope: "project",
            content: { note: "untrusted memory" },
            classification: "internal",
            sourceTrustLevel: "untrusted",
            createdAt: "2026-04-07T08:15:00.000Z",
        });
        memory.revoke(trustedProject.id, "rotated", "2026-04-07T08:30:00.000Z");
        const recalled = memory.recall({
            scopes: ["project"],
            sourceTrustLevels: ["trusted"],
            evaluatedAt: "2026-04-07T09:00:00.000Z",
        });
        assert.deepEqual(recalled.map((record) => record.id), []);
        const includeRevoked = memory.recall({
            scopes: ["project"],
            sourceTrustLevels: ["trusted"],
            includeRevoked: true,
            evaluatedAt: "2026-04-07T09:00:00.000Z",
        });
        assert.equal(includeRevoked.length, 1);
        assert.equal(includeRevoked[0]?.id, trustedProject.id);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("memory consolidation fails closed without an explicit boundary and does not revoke foreign scopes", () => {
    const workspace = createTempWorkspace("aa-memory-consolidation-security-");
    const dbPath = join(workspace, "memory-consolidation-security.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const memory = new MemoryService(store);
        memory.remember({
            taskId: "task-memory-security",
            scope: "project",
            content: { note: "project memory 1" },
            createdAt: "2026-04-07T08:00:00.000Z",
        });
        memory.remember({
            taskId: "task-memory-security",
            scope: "project",
            content: { note: "project memory 2" },
            createdAt: "2026-04-07T08:05:00.000Z",
        });
        const foreignScope = memory.remember({
            taskId: "task-memory-security",
            scope: "role:finance",
            content: { note: "finance-only memory" },
            createdAt: "2026-04-07T08:10:00.000Z",
        });
        assert.throws(() => memory.consolidate({
            minSourceMemories: 2,
            evaluatedAt: "2026-04-07T09:00:00.000Z",
        }), /memory_consolidation_scope_required/);
        const consolidated = memory.consolidate({
            taskId: "task-memory-security",
            scopes: ["project"],
            minSourceMemories: 2,
            olderThanCreatedAt: "2026-04-07T08:30:00.000Z",
            evaluatedAt: "2026-04-07T09:00:00.000Z",
        });
        assert.equal(consolidated.consolidated, true);
        assert.equal(store.getMemory(foreignScope.id)?.revokedAt, null);
        assert.equal(store.getMemory(foreignScope.id)?.revocationReason, null);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("memory schema normalization keeps canonical structure without widening recall boundaries", () => {
    const workspace = createTempWorkspace("aa-memory-structured-security-");
    const dbPath = join(workspace, "memory-structured-security.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const memory = new MemoryService(store);
        memory.remember({
            scope: "project",
            sourceTrustLevel: "trusted",
            classification: "internal",
            content: {
                workContext: "protect stable dispatch",
                topOfMind: ["keep queue replay evidence"],
                facts: [{ content: "stale snapshots must fail closed", category: "safety_rule", confidence: 1 }],
            },
        });
        memory.remember({
            scope: "role:finance",
            sourceTrustLevel: "trusted",
            classification: "internal",
            content: {
                workContext: "foreign scope",
                facts: [{ content: "should never leak", category: "foreign" }],
            },
        });
        const recalled = memory.recall({
            scopes: ["project"],
            sourceTrustLevels: ["trusted"],
        });
        assert.equal(recalled.length, 1);
        const structured = parseStructuredMemoryContent(recalled[0]?.contentJson ?? "{}");
        assert.equal(structured.workContext, "protect stable dispatch");
        assert.equal(structured.facts.some((fact) => fact.content === "stale snapshots must fail closed"), true);
        assert.equal(structured.facts.some((fact) => fact.content === "should never leak"), false);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=memory-scope-boundary.test.js.map