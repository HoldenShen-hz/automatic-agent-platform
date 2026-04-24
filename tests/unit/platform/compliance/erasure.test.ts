import assert from "node:assert/strict";
import test from "node:test";

import { ErasurePlanningService, type ErasureTarget } from "../../../../src/platform/compliance/erasure/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// Helper to create an erasure target with defaults
function createTarget(overrides: Partial<ErasureTarget> = {}): ErasureTarget {
  return {
    targetRef: "artifact_123",
    targetKind: "artifact",
    containsPii: false,
    legalHold: false,
    backupCopy: false,
    ...overrides,
  };
}

test("createPlan creates a valid erasure plan", () => {
  const service = new ErasurePlanningService();
  const targets = [createTarget({ targetRef: "task_1", containsPii: true })];

  const plan = service.createPlan({
    subjectRef: "subject_abc",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  assert.ok(plan.requestId.startsWith("erase_"), "requestId should have erase_ prefix");
  assert.equal(plan.subjectRef, "subject_abc");
  assert.equal(plan.requestedBy, "admin_1");
  assert.equal(plan.status, "ready");
  assert.equal(plan.steps.length, 1);
  assert.ok(plan.createdAt.length > 0, "createdAt should be set");
  assert.ok(plan.dueAt.length > 0, "dueAt should be set");
});

test("createPlan calculates dueAt correctly", () => {
  const service = new ErasurePlanningService();
  const before = new Date();
  const slaHours = 48;

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets: [],
    slaHours,
  });

  const after = new Date();
  const expectedDueMin = new Date(before.getTime() + slaHours * 60 * 60 * 1000);
  const expectedDueMax = new Date(after.getTime() + slaHours * 60 * 60 * 1000);

  const dueDate = new Date(plan.dueAt);
  assert.ok(dueDate >= expectedDueMin && dueDate <= expectedDueMax, "dueAt should be approximately SLA hours from now");
});

test("createPlan throws for invalid slaHours - zero", () => {
  const service = new ErasurePlanningService();

  assert.throws(
    () =>
      service.createPlan({
        subjectRef: "subject_1",
        requestedBy: "admin_1",
        targets: [],
        slaHours: 0,
      }),
    ValidationError,
  );
});

test("createPlan throws for invalid slaHours - negative", () => {
  const service = new ErasurePlanningService();

  assert.throws(
    () =>
      service.createPlan({
        subjectRef: "subject_1",
        requestedBy: "admin_1",
        targets: [],
        slaHours: -1,
      }),
    ValidationError,
  );
});

test("createPlan throws for invalid slaHours - Infinity", () => {
  const service = new ErasurePlanningService();

  assert.throws(
    () =>
      service.createPlan({
        subjectRef: "subject_1",
        requestedBy: "admin_1",
        targets: [],
        slaHours: Infinity,
      }),
    ValidationError,
  );
});

test("createPlan throws for invalid slaHours - NaN", () => {
  const service = new ErasurePlanningService();

  assert.throws(
    () =>
      service.createPlan({
        subjectRef: "subject_1",
        requestedBy: "admin_1",
        targets: [],
        slaHours: NaN,
      }),
    ValidationError,
  );
});

test("createPlan marks legal hold targets with action 'hold'", () => {
  const service = new ErasurePlanningService();
  const targets = [createTarget({ targetRef: "task_1", legalHold: true })];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  const firstStep = plan.steps.at(0);
  assert.ok(firstStep);
  assert.equal(firstStep.action, "hold");
  assert.equal(firstStep.reason, "legal_hold");
});

test("createPlan marks backup copy targets with action 'redact'", () => {
  const service = new ErasurePlanningService();
  const targets = [createTarget({ targetRef: "backup_1", backupCopy: true })];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  const firstStep = plan.steps.at(0);
  assert.ok(firstStep);
  assert.equal(firstStep.action, "redact");
  assert.equal(firstStep.reason, "backup_copy_redaction");
});

test("createPlan marks PII targets with action 'erase'", () => {
  const service = new ErasurePlanningService();
  const targets = [createTarget({ targetRef: "task_1", containsPii: true })];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  const firstStep = plan.steps.at(0);
  assert.ok(firstStep);
  assert.equal(firstStep.action, "erase");
  assert.equal(firstStep.reason, "pii_subject_request");
});

test("createPlan marks non-PII targets without legal hold with action 'skip'", () => {
  const service = new ErasurePlanningService();
  const targets = [createTarget({ targetRef: "task_1", containsPii: false })];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  const firstStep = plan.steps.at(0);
  assert.ok(firstStep);
  assert.equal(firstStep.action, "skip");
  assert.equal(firstStep.reason, "no_pii");
});

test("createPlan sets status to blocked_by_legal_hold when any target has legal hold", () => {
  const service = new ErasurePlanningService();
  const targets = [
    createTarget({ targetRef: "task_1", containsPii: true }),
    createTarget({ targetRef: "task_2", legalHold: true }),
  ];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  assert.equal(plan.status, "blocked_by_legal_hold");
});

test("createPlan sets status to ready when no legal holds", () => {
  const service = new ErasurePlanningService();
  const targets = [
    createTarget({ targetRef: "task_1", containsPii: true }),
    createTarget({ targetRef: "task_2", backupCopy: true }),
  ];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  assert.equal(plan.status, "ready");
});

test("createPlan handles all target kinds", () => {
  const service = new ErasurePlanningService();
  const targets: ErasureTarget[] = [
    createTarget({ targetKind: "task" }),
    createTarget({ targetKind: "message" }),
    createTarget({ targetKind: "artifact" }),
    createTarget({ targetKind: "memory" }),
    createTarget({ targetKind: "backup" }),
  ];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  assert.equal(plan.steps.length, 5);
  assert.ok(plan.steps.every((step) => step.targetKind !== undefined));
});

test("createPlan preserves targetRef and targetKind in steps", () => {
  const service = new ErasurePlanningService();
  const targets = [
    createTarget({ targetRef: "ref_1", targetKind: "task" }),
    createTarget({ targetRef: "ref_2", targetKind: "message" }),
  ];

  const plan = service.createPlan({
    subjectRef: "subject_1",
    requestedBy: "admin_1",
    targets,
    slaHours: 24,
  });

  const firstStep = plan.steps.at(0);
  const secondStep = plan.steps.at(1);
  assert.ok(firstStep);
  assert.ok(secondStep);
  assert.equal(firstStep.targetRef, "ref_1");
  assert.equal(firstStep.targetKind, "task");
  assert.equal(secondStep.targetRef, "ref_2");
  assert.equal(secondStep.targetKind, "message");
});
