import assert from "node:assert/strict";
import test from "node:test";

import { ErasurePlanningService, type ErasureTarget } from "../../../../../src/platform/compliance/erasure/index.js";

test("ErasurePlanningService creates erasure plan for subject request", () => {
  const service = new ErasurePlanningService();
  const plan = service.createPlan({
    subjectRef: "user:alice",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    targets: [
      { targetRef: "memory:1", targetKind: "memory", containsPii: true },
      { targetRef: "task:session-1", targetKind: "task", containsPii: false },
    ],
  });

  assert.ok(plan.requestId);
  assert.equal(plan.subjectRef, "user:alice");
  assert.equal(plan.requestedBy, "privacy@example.com");
  assert.equal(plan.status, "ready");
  assert.equal(plan.steps.length, 2);
  assert.ok(plan.dueAt);
  assert.ok(plan.createdAt);
});

test("ErasurePlanningService marks backup copies for redaction", () => {
  const service = new ErasurePlanningService();
  const plan = service.createPlan({
    subjectRef: "user:bob",
    requestedBy: "admin@example.com",
    slaHours: 48,
    targets: [
      { targetRef: "backup:main", targetKind: "backup", containsPii: true, backupCopy: true },
    ],
  });

  assert.equal(plan.steps[0]?.action, "redact");
  assert.equal(plan.steps[0]?.reason, "backup_copy_redaction");
});

test("ErasurePlanningService marks legal hold targets as hold and blocks plan", () => {
  const service = new ErasurePlanningService();
  const plan = service.createPlan({
    subjectRef: "user:charlie",
    requestedBy: "legal@example.com",
    slaHours: 72,
    targets: [
      { targetRef: "artifact:important", targetKind: "artifact", containsPii: true, legalHold: true },
    ],
  });

  assert.equal(plan.steps[0]?.action, "hold");
  assert.equal(plan.steps[0]?.reason, "legal_hold");
  assert.equal(plan.status, "blocked_by_legal_hold");
});

test("ErasurePlanningService skips non-PII targets", () => {
  const service = new ErasurePlanningService();
  const plan = service.createPlan({
    subjectRef: "user:dave",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    targets: [
      { targetRef: "task:public-1", targetKind: "task", containsPii: false },
    ],
  });

  assert.equal(plan.steps[0]?.action, "skip");
  assert.equal(plan.steps[0]?.reason, "no_pii");
  assert.equal(plan.status, "ready");
});

test("ErasurePlanningService calculates correct due date from SLA", () => {
  const service = new ErasurePlanningService();
  const before = new Date().toISOString();
  const plan = service.createPlan({
    subjectRef: "user:eve",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    targets: [
      { targetRef: "memory:1", targetKind: "memory", containsPii: true },
    ],
  });
  const after = new Date().toISOString();

  const dueDate = new Date(plan.dueAt);
  const beforeDate = new Date(before);
  const afterDate = new Date(after);

  // Due date should be approximately 24 hours after creation
  const diffMs = dueDate.getTime() - beforeDate.getTime();
  assert.ok(diffMs >= 24 * 60 * 60 * 1000 - 1000); // Within 1 second
  assert.ok(diffMs <= 24 * 60 * 60 * 1000 + 1000);
});

test("ErasurePlanningService throws for invalid SLA hours", async () => {
  const service = new ErasurePlanningService();

  await assert.rejects(
    async () =>
      service.createPlan({
        subjectRef: "user:invalid",
        requestedBy: "test@example.com",
        slaHours: 0,
        targets: [],
      }),
    (error: unknown) => {
      if (error instanceof Error && "code" in error) {
        return (error as { code: string }).code === "erasure.invalid_sla";
      }
      return false;
    },
  );

  await assert.rejects(
    async () =>
      service.createPlan({
        subjectRef: "user:invalid",
        requestedBy: "test@example.com",
        slaHours: -5,
        targets: [],
      }),
    (error: unknown) => {
      if (error instanceof Error && "code" in error) {
        return (error as { code: string }).code === "erasure.invalid_sla";
      }
      return false;
    },
  );

  await assert.rejects(
    async () =>
      service.createPlan({
        subjectRef: "user:invalid",
        requestedBy: "test@example.com",
        slaHours: Infinity,
        targets: [],
      }),
    (error: unknown) => {
      if (error instanceof Error && "code" in error) {
        return (error as { code: string }).code === "erasure.invalid_sla";
      }
      return false;
    },
  );
});

test("ErasurePlanningService handles mixed target types in plan", () => {
  const service = new ErasurePlanningService();
  const plan = service.createPlan({
    subjectRef: "user:mixed",
    requestedBy: "privacy@example.com",
    slaHours: 48,
    targets: [
      { targetRef: "memory:1", targetKind: "memory", containsPii: true },
      { targetRef: "backup:1", targetKind: "backup", containsPii: true, backupCopy: true },
      { targetRef: "artifact:1", targetKind: "artifact", containsPii: true, legalHold: true },
      { targetRef: "task:1", targetKind: "task", containsPii: false },
      { targetRef: "message:1", targetKind: "message", containsPii: true },
    ],
  });

  assert.equal(plan.steps[0]?.action, "erase"); // memory with PII
  assert.equal(plan.steps[1]?.action, "redact"); // backup copy
  assert.equal(plan.steps[2]?.action, "hold"); // legal hold
  assert.equal(plan.steps[3]?.action, "skip"); // no PII
  assert.equal(plan.steps[4]?.action, "erase"); // message with PII
  assert.equal(plan.status, "blocked_by_legal_hold");
});

test("ErasurePlanningService preserves target metadata in steps", () => {
  const service = new ErasurePlanningService();
  const plan = service.createPlan({
    subjectRef: "user:metadata",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    targets: [
      { targetRef: "artifact:special", targetKind: "artifact", containsPii: true },
    ],
  });

  const step = plan.steps[0]!;
  assert.equal(step.targetRef, "artifact:special");
  assert.equal(step.targetKind, "artifact");
});
