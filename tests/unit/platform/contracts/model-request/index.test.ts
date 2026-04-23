import assert from "node:assert/strict";
import test from "node:test";

import {
  createModelRequest,
  type ModelMessage,
  type ModelRequest,
} from "../../../../../src/platform/contracts/model-request/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("ModelMessage accepts canonical model chat roles", () => {
  const messages: ModelMessage[] = [
    { role: "system", content: "You are a reviewer." },
    { role: "user", content: "Review this deployment." },
    { role: "assistant", content: "I'll review it." },
    { role: "tool", content: '{"result": "reviewed"}' },
  ];
  assert.equal(messages.length, 4);
});

test("createModelRequest builds a minimal model request envelope", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.2,
    maxTokens: 512,
    tenantId: "tenant-1",
    taskId: "task-1",
  });

  assert.equal(request.model, "gpt-5.4");
  assert.equal(request.messages[0]?.role, "user");
});

test("createModelRequest generates a requestId when not provided", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  assert.ok(request.requestId.startsWith("modelreq_"));
});

test("createModelRequest uses provided requestId", () => {
  const request = createModelRequest({
    requestId: "custom-request-id",
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  assert.equal(request.requestId, "custom-request-id");
});

test("createModelRequest sets createdAt to nowIso when not provided", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  assert.ok(request.createdAt.includes("T"));
});

test("createModelRequest uses provided createdAt timestamp", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(request.createdAt, "2026-01-01T00:00:00.000Z");
});

test("createModelRequest throws when model is empty", () => {
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

test("createModelRequest throws when model is only whitespace", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "   ",
        messages: [{ role: "user", content: "Hello" }],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("createModelRequest throws when messages array is empty", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "gpt-5.4",
        messages: [],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("createModelRequest throws when message content is empty", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "gpt-5.4",
        messages: [{ role: "user", content: "" }],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("createModelRequest throws when message content is only whitespace", () => {
  assert.throws(
    () =>
      createModelRequest({
        model: "gpt-5.4",
        messages: [{ role: "user", content: "   " }],
        temperature: null,
        maxTokens: null,
        tenantId: null,
        taskId: null,
      }),
    ValidationError,
  );
});

test("createModelRequest accepts null temperature and maxTokens", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  assert.equal(request.temperature, null);
  assert.equal(request.maxTokens, null);
});

test("createModelRequest accepts multiple messages", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "Tell me a story" },
      { role: "assistant", content: "Once upon a time..." },
    ],
    temperature: 0.7,
    maxTokens: 1000,
    tenantId: "tenant-1",
    taskId: "task-1",
  });

  assert.equal(request.messages.length, 5);
  assert.equal(request.temperature, 0.7);
  assert.equal(request.maxTokens, 1000);
});

test("createModelRequest allows null tenantId and taskId", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
  });

  assert.equal(request.tenantId, null);
  assert.equal(request.taskId, null);
});

test("ModelRequest interface accepts all fields", () => {
  const request: ModelRequest = {
    requestId: "req-123",
    model: "gpt-5.4",
    messages: [{ role: "user", content: "test" }],
    temperature: 0.5,
    maxTokens: 512,
    tenantId: "tenant-1",
    taskId: "task-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(request.requestId, "req-123");
  assert.equal(request.temperature, 0.5);
  assert.equal(request.maxTokens, 512);
});