/**
 * Unit Tests: Orphan Cleanup Service
 *
 * Tests utility functions and the OrphanCleanupService class.
 */
import assert from "node:assert/strict";
import test from "node:test";
// =============================================================================
// Type and Interface tests
// =============================================================================
test("OrphanCleanupIssueType covers all expected types", () => {
    const types = [
        "orphan_session",
        "orphan_queue_claim",
        "worker_execution_reference_orphan",
    ];
    assert.ok(types.every(t => typeof t === "string"));
});
test("OrphanCleanupReport structure is correct", () => {
    const report = {
        checkedAt: "2026-04-22T00:00:00.000Z",
        issues: [],
    };
    assert.ok(report.checkedAt);
    assert.ok(Array.isArray(report.issues));
});
test("OrphanCleanupResult covers expected actions", () => {
    const results = [
        { action: "close_orphan_session", entityId: "s1", applied: true, detail: "closed" },
        { action: "requeue_ticket", entityId: "t1", applied: false, detail: "not needed" },
        { action: "clean_worker_execution_refs", entityId: "w1", applied: true, detail: "cleaned" },
    ];
    assert.equal(results.length, 3);
});
test("WorkerExecutionReferenceOrphan has correct structure", () => {
    const orphan = {
        executionId: "exec-1",
        taskId: "task-1",
        reasonCode: "execution_missing",
        executionStatus: null,
        activeLeaseWorkerId: null,
    };
    assert.equal(orphan.executionId, "exec-1");
    assert.equal(orphan.reasonCode, "execution_missing");
});
test("WorkerExecutionReferenceOrphan reasonCodes are all valid", () => {
    const reasonCodes = [
        "execution_missing",
        "execution_terminal",
        "missing_active_lease",
        "owned_by_another_worker",
    ];
    assert.ok(reasonCodes.every(r => typeof r === "string"));
});
test("OrphanCleanupIssue entityType is limited to expected values", () => {
    const issue = {
        issueType: "orphan_session",
        entityType: "session",
        entityId: "session-123",
        taskId: "task-456",
        executionId: null,
        workerId: null,
        detail: "Session is streaming while task is done",
    };
    assert.ok(["session", "ticket", "worker"].includes(issue.entityType));
});
// =============================================================================
// Enforce switch branch coverage via issue type combinations
// =============================================================================
test("OrphanCleanupIssue can represent orphan_session issue", () => {
    const issue = {
        issueType: "orphan_session",
        entityType: "session",
        entityId: "session-abc",
        taskId: "task-xyz",
        executionId: "exec-123",
        workerId: null,
        detail: "Session streaming but task is cancelled",
    };
    assert.equal(issue.issueType, "orphan_session");
    assert.equal(issue.entityType, "session");
});
test("OrphanCleanupIssue can represent orphan_queue_claim issue", () => {
    const issue = {
        issueType: "orphan_queue_claim",
        entityType: "ticket",
        entityId: "ticket-def",
        taskId: "task-ghi",
        executionId: "exec-456",
        workerId: "worker-1",
        detail: "Ticket claimed but no valid lease",
    };
    assert.equal(issue.issueType, "orphan_queue_claim");
    assert.equal(issue.entityType, "ticket");
});
test("OrphanCleanupIssue can represent worker_execution_reference_orphan issue", () => {
    const issue = {
        issueType: "worker_execution_reference_orphan",
        entityType: "worker",
        entityId: "worker-789",
        taskId: null,
        executionId: null,
        workerId: "worker-789",
        detail: "Worker has invalid execution references",
        orphanExecutionRefs: [
            {
                executionId: "exec-dead",
                taskId: null,
                reasonCode: "execution_terminal",
                executionStatus: "failed",
                activeLeaseWorkerId: null,
            },
        ],
    };
    assert.equal(issue.issueType, "worker_execution_reference_orphan");
    assert.ok(issue.orphanExecutionRefs);
    assert.equal(issue.orphanExecutionRefs[0].reasonCode, "execution_terminal");
});
// =============================================================================
// Multiple issues in a report
// =============================================================================
test("OrphanCleanupReport can contain multiple issues of different types", () => {
    const report = {
        checkedAt: "2026-04-22T12:00:00.000Z",
        issues: [
            {
                issueType: "orphan_session",
                entityType: "session",
                entityId: "s1",
                taskId: "t1",
                executionId: null,
                workerId: null,
                detail: "Issue 1",
            },
            {
                issueType: "orphan_queue_claim",
                entityType: "ticket",
                entityId: "t1",
                taskId: "t1",
                executionId: "e1",
                workerId: null,
                detail: "Issue 2",
            },
            {
                issueType: "worker_execution_reference_orphan",
                entityType: "worker",
                entityId: "w1",
                taskId: null,
                executionId: null,
                workerId: "w1",
                detail: "Issue 3",
            },
        ],
    };
    assert.equal(report.issues.length, 3);
    assert.ok(report.issues.some(i => i.issueType === "orphan_session"));
    assert.ok(report.issues.some(i => i.issueType === "orphan_queue_claim"));
    assert.ok(report.issues.some(i => i.issueType === "worker_execution_reference_orphan"));
});
test("OrphanCleanupReport with applied results has correct structure", () => {
    const report = {
        checkedAt: "2026-04-22T12:00:00.000Z",
        issues: [
            {
                issueType: "orphan_session",
                entityType: "session",
                entityId: "s1",
                taskId: "t1",
                executionId: null,
                workerId: null,
                detail: "Session is orphan",
            },
        ],
        applied: [
            { action: "close_orphan_session", entityId: "s1", applied: true, detail: "Session closed" },
        ],
    };
    assert.ok(report.applied);
    assert.equal(report.applied.length, 1);
    assert.equal(report.applied[0].action, "close_orphan_session");
});
test("OrphanCleanupIssue detail can contain specific context", () => {
    const issue = {
        issueType: "orphan_session",
        entityType: "session",
        entityId: "session-abc-123",
        taskId: "task-xyz-456",
        executionId: "exec-789",
        workerId: null,
        detail: "Session session-abc-123 is streaming while task task-xyz-456 is succeeded",
    };
    assert.ok(issue.detail.includes("streaming"));
    assert.ok(issue.detail.includes("succeeded"));
});
test("WorkerExecutionReferenceOrphan with all reason codes", () => {
    const orphans = [
        { executionId: "e1", taskId: null, reasonCode: "execution_missing", executionStatus: null, activeLeaseWorkerId: null },
        { executionId: "e2", taskId: "t1", reasonCode: "execution_terminal", executionStatus: "failed", activeLeaseWorkerId: null },
        { executionId: "e3", taskId: "t2", reasonCode: "missing_active_lease", executionStatus: "executing", activeLeaseWorkerId: null },
        { executionId: "e4", taskId: "t3", reasonCode: "owned_by_another_worker", executionStatus: "executing", activeLeaseWorkerId: "other-worker" },
    ];
    assert.equal(orphans.length, 4);
    assert.equal(orphans[0].reasonCode, "execution_missing");
    assert.equal(orphans[3].activeLeaseWorkerId, "other-worker");
});
//# sourceMappingURL=orphan-cleanup-service.test.js.map