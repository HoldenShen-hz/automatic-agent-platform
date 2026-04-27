/**
 * Delegation Request Contract Unit Tests
 *
 * Tests the delegation request creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createDelegationRequest } from "../../../../src/platform/contracts/delegation-request/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("delegation-request: createDelegationRequest generates valid request with toAgentId", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    capabilityRef: null,
    priority: "normal",
    reason: "load balancing",
    contextRef: null,
    tenantId: null,
  });

  assert.equal(request.taskId, "task_123");
  assert.equal(request.fromAgentId, "agent_a");
  assert.equal(request.toAgentId, "agent_b");
  assert.equal(request.capabilityRef, null);
  assert.equal(request.priority, "normal");
  assert.equal(request.reason, "load balancing");
  assert.equal(request.contextRef, null);
  assert.equal(request.tenantId, null);
  assert.ok(request.requestId.startsWith("delegate_"));
  assert.ok(request.createdAt.length > 0);
});

test("delegation-request: createDelegationRequest generates valid request with capabilityRef", () => {
  const request = createDelegationRequest({
    taskId: "task_456",
    fromAgentId: "agent_a",
    toAgentId: null,
    capabilityRef: "capability_image_analysis",
    priority: "high",
    reason: "specialized capability needed",
    contextRef: "ctx_123",
    tenantId: "tenant_abc",
  });

  assert.equal(request.taskId, "task_456");
  assert.equal(request.toAgentId, null);
  assert.equal(request.capabilityRef, "capability_image_analysis");
  assert.equal(request.priority, "high");
  assert.equal(request.contextRef, "ctx_123");
  assert.equal(request.tenantId, "tenant_abc");
});

test("delegation-request: createDelegationRequest throws when taskId is empty", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "",
        fromAgentId: "agent_a",
        toAgentId: "agent_b",
        capabilityRef: null,
        priority: "normal",
        reason: "test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("delegation-request: createDelegationRequest throws when fromAgentId is empty", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "task_123",
        fromAgentId: "  ",
        toAgentId: "agent_b",
        capabilityRef: null,
        priority: "normal",
        reason: "test",
        contextRef: null,
        tenantId: null,
      }),
    ValidationError,
  );
});

test("delegation-request: createDelegationRequest throws when both toAgentId and capabilityRef are missing", () => {
  assert.throws(
    () =>
      createDelegationRequest({
        taskId: "task_123",
        fromAgentId: "agent_a",
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

test("delegation-request: createDelegationRequest accepts priority levels", () => {
  const priorities: Array<"low" | "normal" | "high" | "critical"> = ["low", "normal", "high", "critical"];

  for (const priority of priorities) {
    const request = createDelegationRequest({
      taskId: "task_123",
      fromAgentId: "agent_a",
      toAgentId: "agent_b",
      capabilityRef: null,
      priority,
      reason: "test",
      contextRef: null,
      tenantId: null,
    });

    assert.equal(request.priority, priority);
  }
});

test("delegation-request: createDelegationRequest normalizes whitespace to null", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_a",
    toAgentId: "agent_b", // valid target
    capabilityRef: null,
    priority: "normal",
    reason: "test",
    contextRef: "",
    tenantId: "  ",
  });

  assert.equal(request.toAgentId, "agent_b");
  assert.equal(request.contextRef, null);
  assert.equal(request.tenantId, null);
});

test("delegation-request: createDelegationRequest accepts custom requestId and createdAt", () => {
  const request = createDelegationRequest({
    taskId: "task_123",
    fromAgentId: "agent_a",
    toAgentId: "agent_b",
    capabilityRef: null,
    priority: "critical",
    reason: "urgent",
    contextRef: null,
    tenantId: null,
    requestId: "custom_delegate",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(request.requestId, "custom_delegate");
  assert.equal(request.createdAt, "2026-01-01T00:00:00.000Z");
});
