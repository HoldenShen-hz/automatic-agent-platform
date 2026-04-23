import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ExecutionDbQueueDisconnectRepairService } from "../../../../src/platform/execution/recovery/execution-db-queue-disconnect-repair-service.js";
import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
test("execution DB queue disconnect repair service rebuilds a missing active ticket from authoritative plan metadata", () => {
    const workspace = createTempWorkspace("aa-db-queue-disconnect-repair-");
    const dbPath = join(workspace, "db-queue-disconnect-repair.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const dispatch = new ExecutionDispatchService(db, store);
        const repair = new ExecutionDbQueueDisconnectRepairService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-db-queue-disconnect-repair",
            executionId: "exec-db-queue-disconnect-repair",
            traceId: "trace-db-queue-disconnect-repair",
        });
        db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-db-queue-disconnect-repair");
        const created = dispatch.createTicket({
            executionId: "exec-db-queue-disconnect-repair",
            queueName: "priority",
            dispatchTarget: "require_remote",
            requiredIsolationLevel: "strict",
            requiredRepoVersion: "repo-v9",
            requiredCapabilities: ["python", "bash"],
            dispatchAfter: "2026-04-07T13:00:00.000Z",
            occurredAt: "2026-04-07T12:55:00.000Z",
        });
        db.connection.prepare("DELETE FROM execution_tickets WHERE id = ?").run(created.ticket.id);
        const issues = repair.scan();
        const repaired = repair.repair("2026-04-07T12:56:00.000Z");
        const tickets = store.listExecutionTicketsByExecution("exec-db-queue-disconnect-repair");
        const rebuilt = tickets[0] ?? null;
        const events = store.listEventsForTask("task-db-queue-disconnect-repair");
        db.close();
        assert.ok(issues.some((issue) => issue.issueType === "missing_dispatch_ticket" && issue.recoveredFromPlan));
        assert.ok(repaired.applied.some((item) => item.applied && item.recoveredFromPlan));
        assert.equal(tickets.length, 1);
        assert.equal(rebuilt?.queueName, "priority");
        assert.equal(rebuilt?.dispatchTarget, "require_remote");
        assert.equal(rebuilt?.requiredIsolationLevel, "strict");
        assert.equal(rebuilt?.requiredRepoVersion, "repo-v9");
        assert.equal(rebuilt?.dispatchAfter, "2026-04-07T13:00:00.000Z");
        assert.deepEqual(JSON.parse(rebuilt?.requiredCapabilitiesJson ?? "[]"), ["bash", "python"]);
        assert.ok(events.some((event) => event.eventType === "dispatch:ticket_rebuilt"));
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=execution-db-queue-disconnect-repair-service.test.js.map