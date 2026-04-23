import assert from "node:assert/strict";
import test from "node:test";
import { LongRunningWorkflowService } from "../../../../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";
import { runSingleTaskExecution } from "../../../../../src/platform/execution/execution-engine/single-task-execution.js";
function createWorkflowTestHarness() {
    const workspace = createTempWorkspace("aa-scheduler-integration-");
    const dbPath = join(workspace, "scheduler.db");
    // Run a task to create workflow state
    runSingleTaskExecution({
        dbPath,
        title: "Scheduler integration test",
        request: "Test workflow scheduling",
    });
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new LongRunningWorkflowService(store);
    return {
        workspace,
        db,
        store,
        service,
        cleanup() {
            db.close();
            cleanupPath(workspace);
        },
    };
}
test("LongRunningWorkflowService suspends and resumes a workflow", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        // Suspend the workflow
        const suspension = h.service.suspend({
            taskId,
            reasonCode: "waiting_for_input",
            waitKind: "human_input",
            resumableFromStep: "await_response",
            timeoutPolicy: "fail_workflow",
        });
        assert.ok(suspension.suspensionId.startsWith("workflow_sleep:"));
        assert.equal(suspension.taskId, taskId);
        assert.equal(suspension.status, "active");
        assert.equal(suspension.reasonCode, "waiting_for_input");
        // Verify suspension is stored
        const retrieved = h.service.getSuspension(suspension.suspensionId);
        assert.ok(retrieved != null);
        assert.equal(retrieved?.taskId, taskId);
        // Resume the workflow
        const resumeDecision = h.service.resume(suspension.suspensionId);
        assert.equal(resumeDecision.allowed, true);
        assert.equal(resumeDecision.suspensionId, suspension.suspensionId);
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService marks suspensions due when resumeAfter is past", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        // Suspend with a past resumeAfter time
        const pastTime = new Date(Date.now() - 1000).toISOString();
        const suspension = h.service.suspend({
            taskId,
            reasonCode: "timer_expired",
            waitKind: "timer",
            resumableFromStep: "check_status",
            resumeAfter: pastTime,
            timeoutPolicy: "fail_workflow",
        });
        // Mark due - should find the suspension
        const due = h.service.markDue();
        assert.ok(due.length >= 1);
        const found = due.find((d) => d.suspensionId === suspension.suspensionId);
        assert.ok(found != null, "should find our suspension as due");
        assert.equal(found?.status, "resumable");
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService expires suspensions when expiresAt is past", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        // Suspend with a past expiry time
        const pastExpiry = new Date(Date.now() - 1000).toISOString();
        h.service.suspend({
            taskId,
            reasonCode: "approval_timeout",
            waitKind: "human_input",
            resumableFromStep: "pending_approval",
            expiresAt: pastExpiry,
            timeoutPolicy: "fail_workflow",
        });
        // Sweep expired - should expire the suspension
        const decisions = h.service.sweepExpired();
        assert.ok(decisions.length >= 1);
        const ourDecision = decisions.find((d) => d.taskId === taskId);
        assert.ok(ourDecision != null);
        assert.equal(ourDecision?.allowed, false);
        assert.equal(ourDecision?.reasonCode, "workflow_sleep.expired_failed");
        assert.equal(ourDecision?.nextWorkflowStatus, "failed");
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService builds sleep lease correctly", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        const suspension = h.service.suspend({
            taskId,
            reasonCode: "throttled",
            waitKind: "throttled",
            resumableFromStep: "process_queue",
            timeoutPolicy: "remain_pending",
            metadata: { queueDepth: 100 },
        });
        const lease = h.service.buildSleepLease(suspension.suspensionId);
        assert.equal(lease.suspensionId, suspension.suspensionId);
        assert.equal(lease.taskId, taskId);
        assert.equal(lease.waitKind, "throttled");
        assert.deepEqual(lease.metadata, { queueDepth: 100 });
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService builds resume window correctly", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        const futureResume = new Date(Date.now() + 60000).toISOString();
        const futureExpiry = new Date(Date.now() + 120000).toISOString();
        h.service.suspend({
            taskId,
            reasonCode: "awaiting_resource",
            waitKind: "external_event",
            resumableFromStep: "check_resource",
            resumeAfter: futureResume,
            expiresAt: futureExpiry,
            timeoutPolicy: "fail_workflow",
        });
        const windows = h.service.listResumeWindows();
        assert.ok(windows.length >= 1);
        const ourWindow = windows.find((w) => w.taskId === taskId);
        assert.ok(ourWindow != null);
        assert.equal(ourWindow?.due, false); // resumeAfter is in the future
        assert.equal(ourWindow?.expired, false); // expiresAt is in the future
        assert.equal(ourWindow?.nextAction, "wait");
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService prevents suspend on terminal workflow", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        // Manually set workflow to terminal state to test error handling
        h.store.workflow.updateWorkflowState(taskId, "completed", 0, JSON.stringify({}), new Date().toISOString(), null);
        // Attempt to suspend should throw
        assert.throws(() => h.service.suspend({
            taskId,
            reasonCode: "too_late",
            waitKind: "timer",
            resumableFromStep: "cleanup",
            timeoutPolicy: "fail_workflow",
        }), /workflow_sleep\.terminal_workflow/);
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService rejects resume for non-existent suspension", () => {
    const h = createWorkflowTestHarness();
    try {
        assert.throws(() => h.service.resume("nonexistent_suspension_id"), /workflow_sleep\.suspension_not_found/);
    }
    finally {
        h.cleanup();
    }
});
test("LongRunningWorkflowService listSuspensions returns all suspensions", () => {
    const h = createWorkflowTestHarness();
    try {
        const tasks = h.store.listTasks(10);
        const task = tasks.find((t) => t.title === "Scheduler integration test");
        assert.ok(task, "should find seeded task");
        const taskId = task.id;
        h.service.suspend({
            taskId,
            reasonCode: "reason_1",
            waitKind: "timer",
            resumableFromStep: "step_1",
            timeoutPolicy: "fail_workflow",
        });
        h.service.suspend({
            taskId,
            reasonCode: "reason_2",
            waitKind: "human_input",
            resumableFromStep: "step_2",
            timeoutPolicy: "remain_pending",
        });
        const all = h.service.listSuspensions();
        assert.ok(all.length >= 2);
    }
    finally {
        h.cleanup();
    }
});
//# sourceMappingURL=long-running-workflow-service-integration.test.js.map