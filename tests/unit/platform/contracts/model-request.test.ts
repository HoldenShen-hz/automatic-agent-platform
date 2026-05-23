/**
 * Model Request Contract Unit Tests
 *
 * Tests the model request creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createModelRequest } from "../../../../src/platform/contracts/model-request/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("model-request: createModelRequest generates valid request", () => {
  const request = createModelRequest({
    model: "claude-3-5-sonnet",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
    temperature: 0.7,
    maxTokens: 1000,
    tenantId: null,
    taskId: null,
  });

  assert.equal(request.model, "claude-3-5-sonnet");
  assert.equal(request.messages.length, 2);
  assert.equal(request.temperature, 0.7);
  assert.equal(request.maxTokens, 1000);
  assert.equal(request.tenantId, null);
  assert.equal(request.taskId, null);
  assert.ok(request.requestId.startsWith("modelreq_"));
  assert.ok(request.createdAt.length > 0);
});

test("model-request: createModelRequest throws when model is empty", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "",
        messages: [{ role: "user", content: "Hello" }],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("model-request: createModelRequest throws when model is whitespace", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "   \t",
        messages: [{ role: "user", content: "Hello" }],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("model-request: createModelRequest throws when messages array is empty", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "claude-3-5-sonnet",
        messages: [],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("model-request: createModelRequest throws when message content is empty", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "claude-3-5-sonnet",
        messages: [{ role: "user", content: "" }],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("model-request: createModelRequest accepts all message roles", () => {
  const roles: Array<"system" | "user" | "assistant" | "tool"> = ["system", "user", "assistant", "tool"];

  for (const role of roles) {
    const request = createModelRequest({
      model: "claude-3-5-sonnet",
      messages: [{ role, content: "Test message" }],
      temperature: null,
      maxTokens: null,
      tenantId: null,
      taskId: null,
    });

    assert.equal(request.messages[0]?.role, role);
  }
});

test("model-request: createModelRequest sets null for optional fields when not provided", () => {
  const request = createModelRequest({
    model: "claude-3-5-sonnet",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  assert.equal(request.temperature, null);
  assert.equal(request.maxTokens, null);
  assert.equal(request.tenantId, null);
  assert.equal(request.taskId, null);
});

test("model-request: createModelRequest preserves message objects without mutation", () => {
  const originalMessage = { role: "user" as const, content: "Hello" };
  const request = createModelRequest({
    model: "claude-3-5-sonnet",
    messages: [originalMessage],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  // Verify it's a copy, not the same reference
  assert.ok(request.messages[0] !== originalMessage);
  assert.deepEqual(request.messages[0], originalMessage);
});
