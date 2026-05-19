import assert from "node:assert/strict";
import test from "node:test";
import { ErasurePlanningService } from "../../../../../src/platform/compliance/erasure/index.js";
test("ErasurePlanningService createPlan assigns unique requestId", () => {
    const service = new ErasurePlanningService();
    const plan1 = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [{ targetRef: "memory:1", targetKind: "memory", containsPii: true }],
    });
    const plan2 = service.createPlan({
        subjectRef: "user:bob",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [{ targetRef: "memory:1", targetKind: "memory", containsPii: true }],
    });
    assert.notStrictEqual(plan1.requestId, plan2.requestId);
});
test("ErasurePlanningService createPlan assigns correct subject and requester", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [],
    });
    assert.equal(plan.subjectRef, "user:alice");
    assert.equal(plan.requestedBy, "privacy@example.com");
});
test("ErasurePlanningService createPlan sets status ready when no legal holds", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:1", targetKind: "memory", containsPii: true },
            { targetRef: "task:1", targetKind: "task", containsPii: false },
        ],
    });
    assert.equal(plan.status, "ready");
});
test("ErasurePlanningService createPlan handles empty targets", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [],
    });
    assert.equal(plan.steps.length, 0);
    assert.equal(plan.status, "ready");
});
test("ErasurePlanningService createPlan calculates due date correctly for different SLA values", () => {
    const service = new ErasurePlanningService();
    const before = Date.now();
    const plan48h = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 48,
        targets: [{ targetRef: "memory:1", targetKind: "memory", containsPii: true }],
    });
    const after = Date.now();
    const dueDate = new Date(plan48h.dueAt).getTime();
    // Verify due date is approximately 48 hours from now
    const expectedMin = before + 48 * 60 * 60 * 1000;
    const expectedMax = after + 48 * 60 * 60 * 1000;
    assert.ok(dueDate >= expectedMin && dueDate <= expectedMax, "Due date should be approximately 48 hours from creation");
});
test("ErasurePlanningService createPlan marks PII targets for erasure", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:user-data", targetKind: "memory", containsPii: true },
        ],
    });
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0]?.action, "erase");
    assert.equal(plan.steps[0]?.reason, "pii_subject_request");
});
test("ErasurePlanningService createPlan marks backup with PII for redaction", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:bob",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "backup:daily", targetKind: "backup", containsPii: true, backupCopy: true },
        ],
    });
    assert.equal(plan.steps[0]?.action, "redact");
    assert.equal(plan.steps[0]?.reason, "backup_copy_redaction");
});
test("ErasurePlanningService createPlan handles legal hold target", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:charlie",
        requestedBy: "legal@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "artifact:contract", targetKind: "artifact", containsPii: true, legalHold: true },
        ],
    });
    assert.equal(plan.steps[0]?.action, "hold");
    assert.equal(plan.steps[0]?.reason, "legal_hold");
    assert.equal(plan.status, "blocked_by_legal_hold");
});
test("ErasurePlanningService createPlan skips non-PII targets", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:dave",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "task:report-123", targetKind: "task", containsPii: false },
        ],
    });
    assert.equal(plan.steps[0]?.action, "skip");
    assert.equal(plan.steps[0]?.reason, "no_pii");
});
test("ErasurePlanningService createPlan processes targets in order", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:mixed",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:1", targetKind: "memory", containsPii: true },
            { targetRef: "task:1", targetKind: "task", containsPii: false },
            { targetRef: "backup:1", targetKind: "backup", containsPii: true, backupCopy: true },
        ],
    });
    assert.equal(plan.steps[0]?.targetRef, "memory:1");
    assert.equal(plan.steps[1]?.targetRef, "task:1");
    assert.equal(plan.steps[2]?.targetRef, "backup:1");
});
test("ErasurePlanningService createPlan preserves targetKind in steps", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:test",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:1", targetKind: "memory", containsPii: true },
            { targetRef: "task:1", targetKind: "task", containsPii: true },
            { targetRef: "message:1", targetKind: "message", containsPii: true },
            { targetRef: "artifact:1", targetKind: "artifact", containsPii: true },
            { targetRef: "backup:1", targetKind: "backup", containsPii: true },
        ],
    });
    assert.equal(plan.steps.filter((s) => s.targetKind === "memory").length, 1);
    assert.equal(plan.steps.filter((s) => s.targetKind === "task").length, 1);
    assert.equal(plan.steps.filter((s) => s.targetKind === "message").length, 1);
    assert.equal(plan.steps.filter((s) => s.targetKind === "artifact").length, 1);
    assert.equal(plan.steps.filter((s) => s.targetKind === "backup").length, 1);
});
test("ErasurePlanningService createPlan includes createdAt timestamp", () => {
    const service = new ErasurePlanningService();
    const before = new Date().toISOString();
    const plan = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [],
    });
    const after = new Date().toISOString();
    assert.ok(plan.createdAt >= before);
    assert.ok(plan.createdAt <= after);
});
test("ErasurePlanningService createPlan is idempotent (same input produces consistent structure)", () => {
    const service = new ErasurePlanningService();
    const plan1 = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:1", targetKind: "memory", containsPii: true },
        ],
    });
    // Create another plan and verify structure consistency
    const plan2 = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:1", targetKind: "memory", containsPii: true },
        ],
    });
    // Both plans should have the same structure
    assert.equal(plan1.status, plan2.status);
    assert.equal(plan1.steps.length, plan2.steps.length);
    // But requestIds should be different
    assert.notStrictEqual(plan1.requestId, plan2.requestId);
});
//# sourceMappingURL=erasure-planning-service.test.js.map