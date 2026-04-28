import assert from "node:assert/strict";
import test from "node:test";

import {
  createDelegationRequest,
  type DelegationRequest,
  type DelegationPriority,
} from "../../../../../src/platform/contracts/delegation-request/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("DelegationPriority accepts all valid values", () => {
  const priorities: DelegationPriority[] = ["low", "normal", "high", "critical"];
  assert.deepEqual(priorities, ["low", "normal", "high", "critical"]);
});

test("createDelegationRequest builds a valid delegation request", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "high",
    reason: "Specialized capability required",
    contextRef: null,
    tenantId: "tenant_abc",
  });

  assert.equal(request.taskId, "task_123");
  assert.equal(request.fromAgentId, "agent_alpha");
  assert.equal(request.toAgentId, "agent_beta");
  assert.equal(request.priority, "high");
  assert.equal(request.reason, "Specialized capability required");
  assert.ok(request.requestId.startsWith("delegate_"));
});

test("createDelegationRequest generates requestId when not provided", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: null,
    capabilityRef: "cap_read",
    priority: "normal",
    reason: "Delegation test",
    contextRef: null,
    tenantId: null,
  });

  assert.ok(request.requestId.startsWith("delegate_"));
  assert.ok(request.requestId.includes("_"));
});

test("createDelegationRequest uses provided requestId", () => {
  const request = createDelegationRequest({
    requestId: "custom_delegate_123",
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "low",
    reason: "Test",
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.requestId, "custom_delegate_123");
});

test("createDelegationRequest sets createdAt to nowIso when not provided", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "normal",
    reason: "Test",
    contextRef: null,
    tenantId: null,
  });

  assert.ok(request.createdAt.includes("T"));
});

test("createDelegationRequest uses provided createdAt timestamp", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "normal",
    reason: "Test",
    contextRef: null,
    tenantId: null,
    createdAt: "2026-01-15T10:30:00.000Z",
  });

  assert.equal(request.createdAt, "2026-01-15T10:30:00.000Z");
});

test("createDelegationRequest throws when taskId is empty", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "",
        fromAgentId: "agent_alpha",
        toAgentId: "agent_beta",
        capabilityRef: null,
        priority: "normal",
        reason: "Test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest throws when taskId is only whitespace", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "   ",
        fromAgentId: "agent_alpha",
        toAgentId: "agent_beta",
        capabilityRef: null,
        priority: "normal",
        reason: "Test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest throws when fromAgentId is empty", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "task_123",
        fromAgentId: "",
        toAgentId: "agent_beta",
        capabilityRef: null,
        priority: "normal",
        reason: "Test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest throws when both toAgentId and capabilityRef are missing", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "task_123",
        fromAgentId: "agent_alpha",
        toAgentId: null,
        capabilityRef: null,
        priority: "normal",
        reason: "Test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest throws when both toAgentId and capabilityRef are empty", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "task_123",
        fromAgentId: "agent_alpha",
        toAgentId: "",
        capabilityRef: "",
        priority: "normal",
        reason: "Test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest accepts capabilityRef as target", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: null,
    capabilityRef: "cap_specialized_handler",
    priority: "critical",
    reason: "Requires specialized handler",
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.capabilityRef, "cap_specialized_handler");
  assert.equal(request.toAgentId, null);
});

test("createDelegationRequest accepts toAgentId as target", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "high",
    reason: "Direct delegation",
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.toAgentId, "agent_beta");
  assert.equal(request.capabilityRef, null);
});

test("createDelegationRequest allows null tenantId and contextRef", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "normal",
    reason: "Test",
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.tenantId, null);
  assert.equal(request.contextRef, null);
});

test("createDelegationRequest accepts all priority levels", () => {
  for (const priority of ["low", "normal", "high", "critical"] as DelegationPriority[]) {
    const request = createDelegationRequest({
      taskId: "task_123",
      fromAgentId: "agent_alpha",
      toAgentId: "agent_beta",
      capabilityRef: null,
      priority,
      reason: "Test priority",
      contextRef: null,
      tenantId: null,
    });

    assert.equal(request.priority, priority);
  }
});

test("DelegationRequest interface accepts all fields", () => {
  const request: DelegationRequest = {
    requestId: "delegate_abc",
    taskId: "task_xyz",
    fromAgentId: "agent_1",
    toAgentId: "agent_2",
    capabilityRef: "cap_abc",
    priority: "critical",
    reason: "Special handling needed",
    contextRef: "ctx_123",
    tenantId: "tenant_global",
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(request.requestId, "delegate_abc");
  assert.equal(request.priority, "critical");
  assert.equal(request.contextRef, "ctx_123");
});

test("createDelegationRequest normalizes empty strings to null", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "",
    capabilityRef: "capability.review",
    priority: "normal",
    reason: "Test",
    contextRef: "   ",
    tenantId: "",
  });

  assert.equal(request.toAgentId, null);
  assert.equal(request.contextRef, null);
  assert.equal(request.tenantId, null);
});

test("createDelegationRequest copies reason to avoid mutation", () => {
  const originalReason = "Original reason for delegation";
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_alpha",
    toAgentId: "agent_beta",
    capabilityRef: null,
    priority: "normal",
    reason: originalReason,
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.reason, originalReason);
});
