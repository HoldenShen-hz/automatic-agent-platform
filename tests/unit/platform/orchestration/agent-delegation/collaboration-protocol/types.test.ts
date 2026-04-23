import assert from "node:assert/strict";
import test from "node:test";

import { ACPMessageTypeSchema, ACPMessageSchema, ACPCompletionPayloadSchema } from "../../../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/types.js";

test("ACPMessageTypeSchema accepts valid message types", () => {
  const validTypes = [
    "task_request",
    "task_offer",
    "task_accept",
    "task_reject",
    "partial_result",
    "escalation_request",
    "completion_report",
    "takeover_notice",
  ];

  for (const type of validTypes) {
    const result = ACPMessageTypeSchema.parse(type);
    assert.equal(result, type);
  }
});

test("ACPMessageTypeSchema rejects invalid message type", () => {
  assert.throws(() => ACPMessageTypeSchema.parse("invalid_type"));
});

test("ACPMessageSchema parses valid message", () => {
  const message = {
    messageId: "msg-123",
    messageType: "task_request",
    correlation_id: "corr-456",
    parent_run_id: "run-789",
    depth: 2,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "coding",
    risk_level: 50,
    budget_remaining: 100,
    trace_id: "trace-abc",
    payload: { key: "value" },
    timestamp: "2026-04-23T00:00:00.000Z",
  };

  const result = ACPMessageSchema.parse(message);
  assert.equal(result.messageId, "msg-123");
  assert.equal(result.messageType, "task_request");
  assert.equal(result.depth, 2);
});

test("ACPMessageSchema rejects negative depth", () => {
  const message = {
    messageId: "msg-123",
    messageType: "task_request",
    correlation_id: "corr-456",
    parent_run_id: "run-789",
    depth: -1,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "coding",
    risk_level: 50,
    budget_remaining: 100,
    trace_id: "trace-abc",
    payload: {},
    timestamp: "2026-04-23T00:00:00.000Z",
  };

  assert.throws(() => ACPMessageSchema.parse(message));
});

test("ACPMessageSchema rejects depth over 255", () => {
  const message = {
    messageId: "msg-123",
    messageType: "task_request",
    correlation_id: "corr-456",
    parent_run_id: "run-789",
    depth: 300,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "coding",
    risk_level: 50,
    budget_remaining: 100,
    trace_id: "trace-abc",
    payload: {},
    timestamp: "2026-04-23T00:00:00.000Z",
  };

  assert.throws(() => ACPMessageSchema.parse(message));
});

test("ACPMessageSchema rejects risk_level over 100", () => {
  const message = {
    messageId: "msg-123",
    messageType: "task_request",
    correlation_id: "corr-456",
    parent_run_id: "run-789",
    depth: 1,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "coding",
    risk_level: 150,
    budget_remaining: 100,
    trace_id: "trace-abc",
    payload: {},
    timestamp: "2026-04-23T00:00:00.000Z",
  };

  assert.throws(() => ACPMessageSchema.parse(message));
});

test("ACPMessageSchema rejects negative budget_remaining", () => {
  const message = {
    messageId: "msg-123",
    messageType: "task_request",
    correlation_id: "corr-456",
    parent_run_id: "run-789",
    depth: 1,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "coding",
    risk_level: 50,
    budget_remaining: -10,
    trace_id: "trace-abc",
    payload: {},
    timestamp: "2026-04-23T00:00:00.000Z",
  };

  assert.throws(() => ACPMessageSchema.parse(message));
});

test("ACPMessageSchema accepts empty payload", () => {
  const message = {
    messageId: "msg-123",
    messageType: "task_request",
    correlation_id: "corr-456",
    parent_run_id: "run-789",
    depth: 1,
    sender_agent_id: "agent-a",
    receiver_agent_id: "agent-b",
    domain_id: "coding",
    risk_level: 50,
    budget_remaining: 100,
    trace_id: "trace-abc",
    payload: {},
    timestamp: "2026-04-23T00:00:00.000Z",
  };

  const result = ACPMessageSchema.parse(message);
  assert.deepEqual(result.payload, {});
});

test("ACPCompletionPayloadSchema parses valid completion", () => {
  const payload = {
    evidence: ["artifact:1", "artifact:2"],
    result_summary: "Task completed successfully",
    artifacts: ["artifact:1"],
  };

  const result = ACPCompletionPayloadSchema.parse(payload);
  assert.deepEqual(result.evidence, ["artifact:1", "artifact:2"]);
  assert.equal(result.result_summary, "Task completed successfully");
  assert.deepEqual(result.artifacts, ["artifact:1"]);
});

test("ACPCompletionPayloadSchema requires at least one evidence", () => {
  const payload = {
    evidence: [],
    result_summary: "No evidence",
  };

  assert.throws(() => ACPCompletionPayloadSchema.parse(payload));
});

test("ACPCompletionPayloadSchema defaults artifacts to empty array", () => {
  const payload = {
    evidence: ["artifact:1"],
    result_summary: "Completed",
  };

  const result = ACPCompletionPayloadSchema.parse(payload);
  assert.deepEqual(result.artifacts, []);
});

test("ACPMessageSchema accepts all valid message types", () => {
  const types = [
    "task_request",
    "task_offer",
    "task_accept",
    "task_reject",
    "partial_result",
    "escalation_request",
    "completion_report",
    "takeover_notice",
  ] as const;

  for (const messageType of types) {
    const message = {
      messageId: "msg-123",
      messageType,
      correlation_id: "corr-456",
      parent_run_id: "run-789",
      depth: 1,
      sender_agent_id: "agent-a",
      receiver_agent_id: "agent-b",
      domain_id: "coding",
      risk_level: 50,
      budget_remaining: 100,
      trace_id: "trace-abc",
      payload: {},
      timestamp: "2026-04-23T00:00:00.000Z",
    };

    const result = ACPMessageSchema.parse(message);
    assert.equal(result.messageType, messageType);
  }
});
