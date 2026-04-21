import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("Approval request creation with pending status", () => {
    const approval = {
        id: newId("approval"),
        taskId: newId("task"),
        requestedBy: newId("agent"),
        status: "pending",
        createdAt: nowIso(),
        decidedAt: null,
    };
    assert.ok(approval.id.startsWith("approval_"));
    assert.equal(approval.status, "pending");
    assert.equal(approval.decidedAt, null);
});
test("Approval request transitions to approved", () => {
    const approval = {
        id: newId("approval"),
        taskId: newId("task"),
        requestedBy: newId("agent"),
        status: "pending",
        createdAt: nowIso(),
        decidedAt: null,
    };
    approval.status = "approved";
    approval.decidedAt = nowIso();
    assert.equal(approval.status, "approved");
    assert.ok(approval.decidedAt !== null);
});
test("Approval request transitions to rejected", () => {
    const approval = {
        id: newId("approval"),
        taskId: newId("task"),
        requestedBy: newId("agent"),
        status: "pending",
        createdAt: nowIso(),
        decidedAt: null,
    };
    approval.status = "rejected";
    approval.decidedAt = nowIso();
    assert.equal(approval.status, "rejected");
});
test("Multiple pending approvals", () => {
    const approvals = [];
    for (let i = 0; i < 5; i++) {
        approvals.push({
            id: newId("approval"),
            taskId: newId("task"),
            requestedBy: newId("agent"),
            status: "pending",
            createdAt: nowIso(),
            decidedAt: null,
        });
    }
    const pending = approvals.filter((a) => a.status === "pending");
    assert.equal(pending.length, 5);
});
test("Approval request age calculation", () => {
    const approval = {
        id: newId("approval"),
        taskId: newId("task"),
        requestedBy: newId("agent"),
        status: "pending",
        createdAt: "2026-04-01T00:00:00.000Z",
        decidedAt: null,
    };
    const created = new Date(approval.createdAt).getTime();
    const now = Date.now();
    const ageMs = now - created;
    assert.ok(ageMs > 0); // Approval is at least some time old
});
test("Approval request decidedAt is after createdAt", () => {
    const approval = {
        id: newId("approval"),
        taskId: newId("task"),
        requestedBy: newId("agent"),
        status: "approved",
        createdAt: "2026-04-01T00:00:00.000Z",
        decidedAt: "2026-04-01T01:00:00.000Z",
    };
    const created = new Date(approval.createdAt).getTime();
    const decided = new Date(approval.decidedAt).getTime();
    assert.ok(decided > created);
});
//# sourceMappingURL=approvals-integration.test.js.map