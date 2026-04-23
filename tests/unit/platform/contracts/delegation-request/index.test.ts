import assert from "node:assert/strict";
import test from "node:test";

import {
  createDelegationRequest,
  type DelegationRequest,
  type DelegationPriority,
} from "../../../../../src/platform/contracts/delegation-request/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("DelegationPriority accepts the canonical priority values", () => {
  const priorities: DelegationPriority[] = ["low", "normal", "high", "critical"];
  assert.equal(priorities.length, 4);
});

test("createDelegationRequest requires a target agent or capability reference", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: null,
    capabilityRef: "capability:review",
    priority: "high",
    reason: "need code review",
    contextRef: "context:1",
    tenantId: "tenant-1",
  });

  assert.equal(request.capabilityRef, "capability:review");
  assert.equal(request.priority, "high");
});

test("createDelegationRequest generates a requestId when not provided", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: null,
    priority: "normal",
    reason: "test",
    contextRef: null,
    tenantId: null,
  });

  assert.ok(request.requestId.startsWith("delegate_"));
});

test("createDelegationRequest uses provided requestId", () => {
  const request = createDelegationRequest({
    requestId: "custom-request-id",
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: null,
    priority: "normal",
    reason: "test",
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.requestId, "custom-request-id");
});

test("createDelegationRequest sets createdAt to nowIso when not provided", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: null,
    priority: "normal",
    reason: "test",
    contextRef: null,
    tenantId: null,
  });

  assert.ok(request.createdAt.includes("T"));
});

test("createDelegationRequest uses provided createdAt timestamp", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: null,
    priority: "normal",
    reason: "test",
    contextRef: null,
    tenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(request.createdAt, "2026-01-01T00:00:00.000Z");
});

test("createDelegationRequest throws when taskId is empty", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "",
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        capabilityRef: null,
        priority: "normal",
        reason: "test",
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
        taskId: "task-1",
        fromAgentId: "",
        toAgentId: "agent-2",
        capabilityRef: null,
        priority: "normal",
        reason: "test",
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
        taskId: "task-1",
        fromAgentId: "agent-1",
        toAgentId: null,
        capabilityRef: null,
        priority: "normal",
        reason: "test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest throws when both toAgentId and capabilityRef are empty strings", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "task-1",
        fromAgentId: "agent-1",
        toAgentId: "",
        capabilityRef: "",
        priority: "normal",
        reason: "test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("createDelegationRequest normalizes empty strings to null for nullable fields", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "",
    capabilityRef: "cap:1",
    priority: "normal",
    reason: "test",
    contextRef: "",
    tenantId: "",
  });

  assert.equal(request.toAgentId, null);
  assert.equal(request.contextRef, null);
  assert.equal(request.tenantId, null);
});

test("createDelegationRequest accepts toAgentId as target", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: null,
    priority: "high",
    reason: "delegating work",
    contextRef: null,
    tenantId: "tenant-1",
  });

  assert.equal(request.toAgentId, "agent-2");
  assert.equal(request.capabilityRef, null);
  assert.equal(request.priority, "high");
});

test("createDelegationRequest accepts all priority levels", () => {
  for (const priority of ["low", "normal", "high", "critical"] as DelegationPriority[]) {
    const request = createDelegationRequest({
      taskId: "task-1",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      capabilityRef: null,
      priority,
      reason: "test",
      contextRef: null,
      tenantId: null,
    });
    assert.equal(request.priority, priority);
  }
});

test("DelegationRequest interface accepts all fields", () => {
  const request: DelegationRequest = {
    requestId: "req-123",
    taskId: "task-456",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: "cap:review",
    priority: "critical",
    reason: "urgent review needed",
    contextRef: "context:1",
    tenantId: "tenant-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(request.requestId, "req-123");
  assert.equal(request.taskId, "task-456");
  assert.equal(request.fromAgentId, "agent-1");
  assert.equal(request.toAgentId, "agent-2");
  assert.equal(request.capabilityRef, "cap:review");
  assert.equal(request.priority, "critical");
});