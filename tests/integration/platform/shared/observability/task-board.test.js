import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TaskBoardService } from "../../../../../src/platform/shared/observability/task-board-service.js";
import { runSingleTaskExecution } from "../../../../../src/platform/execution/execution-engine/single-task-execution.js";
import { runMultiStepOrchestration } from "../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("task board lists recent single-task and multi-step tasks with workflow/session status", async () => {
    const workspace = createTempWorkspace("aa-task-board-");
    const dbPath = join(workspace, "board.db");
    try {
        await runSingleTaskExecution({
            dbPath,
            title: "Single-task demo",
            request: "Create the minimal stable single-agent execution baseline.",
        });
        await runMultiStepOrchestration({
            dbPath,
            title: "Multi-step demo",
            request: "Analyze the task, draft a solution, and review the final output.",
        });
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskBoard = new TaskBoardService(store);
        const items = taskBoard.list(10);
        assert.equal(items.length, 2);
        assert.equal(items[0]?.title, "Multi-step demo");
        assert.equal(items[0]?.workflowStatus, "completed");
        assert.equal(items[0]?.sessionStatus, "completed");
        assert.equal(items[1]?.title, "Single-task demo");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=task-board.test.js.map