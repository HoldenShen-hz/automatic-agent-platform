import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("terminal session transition auto-creates a summary from recent messages", () => {
    const workspace = createTempWorkspace("aa-session-summary-");
    const db = new SqliteDatabase(join(workspace, "summary.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = nowIso();
    try {
        store.insertTask({
            id: "task-summary",
            parentId: null,
            rootId: "task-summary",
            divisionId: "general_ops",
            tenantId: null,
            title: "Session summary auto generation",
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
        store.insertSession({
            id: "sess-summary",
            taskId: "task-summary",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        store.insertMessage({
            id: "msg-1",
            sessionId: "sess-summary",
            direction: "inbound",
            messageType: "user_request",
            content: "Please investigate the deployment mismatch and summarize the impact.",
            partsJson: null,
            attachmentsJson: null,
            createdAt: now,
        });
        store.insertMessage({
            id: "msg-2",
            sessionId: "sess-summary",
            direction: "outbound",
            messageType: "assistant_response",
            content: "The deployment mismatch is isolated to staging and rollback is ready.",
            partsJson: null,
            attachmentsJson: null,
            createdAt: now,
        });
        store.updateSessionStatus("sess-summary", "completed", now);
        const summary = store.getLatestSessionSummary("sess-summary");
        assert.ok(summary);
        assert.equal(summary?.sessionId, "sess-summary");
        assert.equal(summary?.taskId, "task-summary");
        assert.equal(summary?.summaryText.includes("deployment mismatch"), true);
        assert.equal(summary?.summaryText.includes("completed"), true);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("terminal session transition does not duplicate existing summaries", () => {
    const workspace = createTempWorkspace("aa-session-summary-existing-");
    const db = new SqliteDatabase(join(workspace, "summary.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = nowIso();
    try {
        store.insertTask({
            id: "task-summary-existing",
            parentId: null,
            rootId: "task-summary-existing",
            divisionId: "general_ops",
            tenantId: null,
            title: "Existing summary",
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
        store.insertSession({
            id: "sess-summary-existing",
            taskId: "task-summary-existing",
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        store.insertSessionSummary({
            id: "summ-existing",
            sessionId: "sess-summary-existing",
            taskId: "task-summary-existing",
            agentId: null,
            summaryText: "Precomputed summary.",
            keyDecisions: null,
            keyOutcomes: null,
            memoryIdsReferenced: null,
            tokenCount: 3,
            createdAt: now,
        });
        store.updateSessionStatus("sess-summary-existing", "completed", now);
        const all = store
            .withConnection((connection) => connection.prepare(`SELECT COUNT(*) AS count FROM session_summaries WHERE session_id = ?`).get("sess-summary-existing"));
        assert.equal(all.count, 1);
        assert.equal(store.getLatestSessionSummary("sess-summary-existing")?.summaryText, "Precomputed summary.");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=session-summary-autogen.test.js.map