/**
 * Control Directive Contract Unit Tests
 *
 * Tests the control directive creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createControlDirective } from "../../../../src/platform/contracts/control-directive/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("control-directive: createControlDirective generates valid pause directive", () => {
  const directive = createControlDirective({
    kind: "pause",
    targetRef: "task_123",
    reasonCode: "operator_request",
    issuedBy: "operator_1",
    tenantId: null,
    executionId: null,
    metadata: {},
  });

  assert.equal(directive.kind, "pause");
  assert.equal(directive.targetRef, "task_123");
  assert.equal(directive.reasonCode, "operator_request");
  assert.equal(directive.issuedBy, "operator_1");
  assert.equal(directive.tenantId, null);
  assert.equal(directive.executionId, null);
  assert.deepEqual(directive.metadata, {});
  assert.ok(directive.directiveId.startsWith("directive_"));
  assert.ok(directive.createdAt.length > 0);
});

test("control-directive: createControlDirective generates valid resume directive", () => {
  const directive = createControlDirective({
    kind: "resume",
    targetRef: "task_456",
    reasonCode: "issue_resolved",
    issuedBy: "system",
    tenantId: "tenant_abc",
    executionId: "exec_789",
    metadata: { resumeReason: "manual" },
  });

  assert.equal(directive.kind, "resume");
  assert.equal(directive.targetRef, "task_456");
  assert.deepEqual(directive.metadata, { resumeReason: "manual" });
  assert.equal(directive.tenantId, "tenant_abc");
  assert.equal(directive.executionId, "exec_789");
});

test("control-directive: createControlDirective throws when targetRef is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("control-directive: createControlDirective throws when reasonCode is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "cancel",
        targetRef: "task_123",
        reasonCode: "   ",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("control-directive: createControlDirective throws when issuedBy is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "rollback",
        targetRef: "task_123",
        reasonCode: "failure",
        issuedBy: "",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("control-directive: createControlDirective accepts rollback kind", () => {
  const directive = createControlDirective({
    kind: "rollback",
    targetRef: "exec_abc",
    reasonCode: "critical_failure",
    issuedBy: "system",
    tenantId: null,
    executionId: "exec_abc",
    metadata: {},
  });

  assert.equal(directive.kind, "rollback");
});

test("control-directive: createControlDirective accepts escalate kind", () => {
  const directive = createControlDirective({
    kind: "escalate",
    targetRef: "task_789",
    reasonCode: "human_review_required",
    issuedBy: "ai_agent",
    tenantId: null,
    executionId: null,
    metadata: {},
  });

  assert.equal(directive.kind, "escalate");
});

test("control-directive: createControlDirective accepts custom directiveId and createdAt", () => {
  const directive = createControlDirective({
    kind: "pause",
    targetRef: "task_123",
    reasonCode: "operator_request",
    issuedBy: "operator_1",
    tenantId: null,
    executionId: null,
    metadata: {},
    directiveId: "custom_directive",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(directive.directiveId, "custom_directive");
  assert.equal(directive.createdAt, "2026-01-01T00:00:00.000Z");
});
