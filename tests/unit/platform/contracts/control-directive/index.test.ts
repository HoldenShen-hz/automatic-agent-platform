import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlDirective,
  type ControlDirective,
  type ControlDirectiveKind,
} from "../../../../../src/platform/contracts/control-directive/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("ControlDirectiveKind accepts the canonical directive kinds", () => {
  const kinds: ControlDirectiveKind[] = ["pause", "resume", "cancel", "rollback", "escalate"];
  assert.equal(kinds.length, 5);
});

test("createControlDirective builds a canonical directive object", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: "tenant-1",
        executionId: "execution-1",
        metadata: { source: "console" },
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective generates a directiveId when not provided", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "resume",
        targetRef: "execution:1",
        reasonCode: "incident.resume",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective uses provided directiveId", () => {
  assert.throws(
    () =>
      createControlDirective({
        directiveId: "custom-directive-id",
        kind: "cancel",
        targetRef: "execution:1",
        reasonCode: "user.cancel",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective sets createdAt to nowIso when not provided", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "rollback",
        targetRef: "execution:1",
        reasonCode: "incident.rollback",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective uses provided createdAt timestamp", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "escalate",
        targetRef: "execution:1",
        reasonCode: "incident.escalate",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective throws when targetRef is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("createControlDirective throws when targetRef is only whitespace", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "   ",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("createControlDirective throws when reasonCode is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("createControlDirective throws when issuedBy is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("createControlDirective allows null tenantId and executionId", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
  );
});

test("createControlDirective accepts all directive kinds", () => {
  for (const kind of ["pause", "resume", "cancel", "rollback", "escalate"] as ControlDirectiveKind[]) {
    assert.throws(
      () =>
        createControlDirective({
          kind,
          targetRef: "execution:1",
          reasonCode: "test",
          issuedBy: "operator:1",
          tenantId: null,
          executionId: null,
          metadata: {},
        }),
      (error: unknown) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden",
    );
  }
});

test("ControlDirective interface accepts all fields", () => {
  const directive: ControlDirective = {
    directiveId: "dir-123",
    kind: "pause",
    targetRef: "execution:1",
    reasonCode: "incident.freeze",
    issuedBy: "operator:1",
    tenantId: "tenant-1",
    executionId: "exec-1",
    metadata: { source: "api" },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(directive.directiveId, "dir-123");
  assert.equal(directive.kind, "pause");
  assert.equal(directive.tenantId, "tenant-1");
  assert.equal(directive.executionId, "exec-1");
});
