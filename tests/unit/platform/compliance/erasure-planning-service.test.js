import assert from "node:assert/strict";
import test from "node:test";
import { ErasurePlanningService } from "../../../../src/platform/compliance/erasure/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("ErasurePlanningService creates plan with erase action for PII", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: true },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.equal(plan.status, "ready");
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0].action, "erase");
    assert.equal(plan.steps[0].reason, "pii_subject_request");
});
test("ErasurePlanningService creates plan with hold action for legal hold", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: true, legalHold: true },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.equal(plan.status, "blocked_by_legal_hold");
    assert.equal(plan.steps[0].action, "hold");
    assert.equal(plan.steps[0].reason, "legal_hold");
});
test("ErasurePlanningService creates plan with redact action for backup copies", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: true, backupCopy: true },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.equal(plan.status, "ready");
    assert.equal(plan.steps[0].action, "redact");
    assert.equal(plan.steps[0].reason, "backup_copy_redaction");
});
test("ErasurePlanningService creates plan with skip action for non-PII", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: false },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.equal(plan.status, "ready");
    assert.equal(plan.steps[0].action, "skip");
    assert.equal(plan.steps[0].reason, "no_pii");
});
test("ErasurePlanningService calculates dueAt correctly", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: false },
    ];
    const before = Date.now();
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    const after = Date.now();
    const dueAtTime = Date.parse(plan.dueAt);
    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;
    assert.ok(dueAtTime >= expectedMin && dueAtTime <= expectedMax);
});
test("ErasurePlanningService rejects invalid SLA hours", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: false },
    ];
    assert.throws(() => service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: -1,
    }), ValidationError);
    assert.throws(() => service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 0,
    }), ValidationError);
    assert.throws(() => service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: Infinity,
    }), ValidationError);
});
test("ErasurePlanningService sets blocked status when any target has legal hold", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: false },
        { targetRef: "task_456", targetKind: "task", containsPii: true, legalHold: true },
        { targetRef: "task_789", targetKind: "task", containsPii: false },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.equal(plan.status, "blocked_by_legal_hold");
    assert.equal(plan.steps.length, 3);
});
test("ErasurePlanningService plan includes requestId and subjectRef", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: false },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.ok(plan.requestId.startsWith("erase_"));
    assert.equal(plan.subjectRef, "user_456");
    assert.equal(plan.requestedBy, "admin_789");
});
test("ErasurePlanningService preserves target kind in steps", () => {
    const service = new ErasurePlanningService();
    const targets = [
        { targetRef: "task_123", targetKind: "task", containsPii: false },
        { targetRef: "msg_456", targetKind: "message", containsPii: false },
        { targetRef: "art_789", targetKind: "artifact", containsPii: false },
    ];
    const plan = service.createPlan({
        subjectRef: "user_456",
        requestedBy: "admin_789",
        targets,
        slaHours: 24,
    });
    assert.equal(plan.steps[0].targetKind, "task");
    assert.equal(plan.steps[1].targetKind, "message");
    assert.equal(plan.steps[2].targetKind, "artifact");
});
//# sourceMappingURL=erasure-planning-service.test.js.map