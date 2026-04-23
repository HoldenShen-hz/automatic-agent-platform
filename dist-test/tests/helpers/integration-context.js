/**
 * Integration Test Context
 *
 * Provides a unified context for integration tests with consistent
 * DB setup, store initialization, and cleanup patterns.
 */
import { join } from "node:path";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "./fs.js";
/**
 * Creates a new integration test context with a temporary SQLite database.
 *
 * Usage:
 * ```typescript
 * test("my integration test", () => {
 *   const ctx = createIntegrationContext("aa-my-test-");
 *   try {
 *     // Use ctx.db, ctx.store, etc.
 *   } finally {
 *     ctx.cleanup();
 *   }
 * });
 * ```
 */
export function createIntegrationContext(prefix = "aa-integration-") {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "integration-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    return {
        workspace,
        dbPath,
        db,
        store,
        cleanup() {
            try {
                db.close();
            }
            finally {
                cleanupPath(workspace);
            }
        },
    };
}
/**
 * Creates an integration context with pre-seeded task and execution.
 * Use this when the test requires a valid task/execution for FK constraints.
 */
export function createSeededIntegrationContext(prefix = "aa-seeded-integration-", options = {}) {
    const ctx = createIntegrationContext(prefix);
    const taskId = options.taskId ?? "task-seeded-001";
    const executionId = options.executionId ?? "exec-seeded-001";
    const now = new Date().toISOString();
    ctx.db.transaction(() => {
        ctx.store.insertTask({
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general_ops",
            tenantId: null,
            title: "Seeded task",
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
        ctx.store.insertExecution({
            id: executionId,
            taskId,
            workflowId: "single_agent_minimal",
            parentExecutionId: null,
            agentId: "agent-seeded",
            roleId: "general_executor",
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
    return ctx;
}
//# sourceMappingURL=integration-context.js.map