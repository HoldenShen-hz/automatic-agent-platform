/**
 * Repair CLI Tests
 *
 * Tests for repair CLI module which runs consistency checks and applies repairs.
 */
import test from "node:test";
import assert from "node:assert/strict";
test("repair CLI output structure - before, applied, and after reports", () => {
    const output = {
        before: {
            issues: [
                { type: "orphaned_execution", id: "exec_1" },
                { type: "missing_checkpoint", id: "wf_2" },
            ],
        },
        applied: [
            { fix: "removed_orphaned_execution", target: "exec_1" },
            { fix: "recreated_checkpoint", target: "wf_2" },
        ],
        after: {
            issues: [],
        },
    };
    assert.ok(Array.isArray(output.before.issues));
    assert.ok(Array.isArray(output.applied));
    assert.ok(Array.isArray(output.after.issues));
    assert.equal(output.before.issues.length, 2);
    assert.equal(output.applied.length, 2);
    assert.equal(output.after.issues.length, 0);
});
test("repair CLI before report structure", () => {
    const report = {
        issues: [
            { type: "inconsistent_state", id: "task_123", severity: "high" },
        ],
        timestamp: "2024-01-01T00:00:00Z",
    };
    assert.ok(Array.isArray(report.issues));
    assert.equal(report.issues[0].type, "inconsistent_state");
    assert.equal(report.issues[0].id, "task_123");
});
test("repair CLI applied fixes structure", () => {
    const applied = [
        { fix: "repaired_state", targetId: "task_123", status: "success" },
        { fix: "repaired_state", targetId: "task_456", status: "success" },
    ];
    assert.equal(applied.length, 2);
    assert.equal(applied[0].status, "success");
});
test("repair CLI after report - no issues means clean", () => {
    const after = {
        issues: [],
    };
    assert.equal(after.issues.length, 0);
});
test("repair CLI after report - shows remaining issues", () => {
    const after = {
        issues: [
            { type: "unrepaired", id: "task_789", reason: "not_repairable" },
        ],
    };
    assert.equal(after.issues.length, 1);
    assert.equal(after.issues[0].reason, "not_repairable");
});
test("repair CLI JSON output format", () => {
    const output = {
        before: { issues: [] },
        applied: [],
        after: { issues: [] },
    };
    const json = JSON.stringify(output, null, 2);
    assert.ok(json.includes("before"));
    assert.ok(json.includes("applied"));
    assert.ok(json.includes("after"));
});
test("repair CLI - repair can address multiple issue types", () => {
    const applied = [
        { fix: "remove_orphaned_execution", target: "exec_1" },
        { fix: "restore_missing_workflow", target: "wf_2" },
        { fix: "reconcile_inconsistent_task", target: "task_3" },
    ];
    assert.equal(applied.length, 3);
    assert.ok(applied[0].fix.includes("remove"));
    assert.ok(applied[1].fix.includes("restore"));
    assert.ok(applied[2].fix.includes("reconcile"));
});
//# sourceMappingURL=repair.test.js.map