/**
 * Integration Test: Message Parts
 *
 * Verifies message parts parsing, rendering, and serialization.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMessageParts,
  buildStructuredToolResultParts,
  buildRetryRecordParts,
  parseMessagePartsJson,
  renderMessagePartContent,
  renderMessagePartsForContext,
  serializeMessageParts,
  ensureMessagePartsJson,
  type StructuredToolResultPartsInput,
  type RetryRecordPartsInput,
} from "../../../../../src/platform/model-gateway/messages/message-parts.js";

test("MessageParts: buildMessageParts creates text part for text message", () => {
  const parts = buildMessageParts({
    id: "msg_123",
    messageType: "text",
    content: "Hello world",
    createdAt: "2024-01-01T00:00:00.000Z",
  });

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "text");
  assert.equal(parts[0]!.messageId, "msg_123");
  assert.equal(parts[0]!.sequence, 1);
});

test("MessageParts: buildMessageParts creates tool_result part type for tool message", () => {
  const parts = buildMessageParts({
    id: "msg_456",
    messageType: "tool_result",
    content: '{"result": "file created"}',
    createdAt: "2024-01-01T00:00:00.000Z",
  });

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "tool_result");
});

test("MessageParts: buildMessageParts creates summary part type for compaction summary", () => {
  const parts = buildMessageParts({
    id: "msg_789",
    messageType: "compaction_summary",
    content: "Summary of previous context",
    createdAt: "2024-01-01T00:00:00.000Z",
  });

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "summary");
});

test("MessageParts: buildStructuredToolResultParts with summary and artifact refs", () => {
  const input: StructuredToolResultPartsInput = {
    messageId: "msg_tool_1",
    createdAt: "2024-01-01T00:00:00.000Z",
    resultText: "File created at /path/to/file.txt",
    summaryText: "Successfully created file",
    artifactRefs: [
      {
        artifactId: "artifact_1",
        kind: "file",
        uri: "file:///path/to/file.txt",
      },
    ],
  };

  const parts = buildStructuredToolResultParts(input);

  // Should have 3 parts: summary, artifact_ref, tool_result
  assert.equal(parts.length, 3);
  assert.equal(parts[0]!.partType, "summary");
  assert.equal(parts[1]!.partType, "artifact_ref");
  assert.equal(parts[2]!.partType, "tool_result");
});

test("MessageParts: buildStructuredToolResultParts without summary", () => {
  const input: StructuredToolResultPartsInput = {
    messageId: "msg_tool_2",
    createdAt: "2024-01-01T00:00:00.000Z",
    resultText: "Tool execution result",
  };

  const parts = buildStructuredToolResultParts(input);

  // Should have 1 part: tool_result only
  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "tool_result");
});

test("MessageParts: buildStructuredToolResultParts with empty summary is excluded", () => {
  const input: StructuredToolResultPartsInput = {
    messageId: "msg_tool_3",
    createdAt: "2024-01-01T00:00:00.000Z",
    resultText: "Tool result",
    summaryText: "   ", // whitespace only - should be excluded
  };

  const parts = buildStructuredToolResultParts(input);

  // Should have 1 part: tool_result (summary excluded due to whitespace)
  assert.equal(parts.length, 1);
});

test("MessageParts: buildRetryRecordParts creates retry record", () => {
  const input: RetryRecordPartsInput = {
    messageId: "msg_retry_1",
    createdAt: "2024-01-01T00:00:00.000Z",
    attempt: 1,
    nextAttempt: 2,
    errorCode: "RATE_LIMIT",
    source: "openai",
    retryDelayMs: 1000,
    failureClass: "TransientError",
  };

  const parts = buildRetryRecordParts(input);

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "retry_record");
  assert.equal(parts[0]!.messageId, "msg_retry_1");
});

test("MessageParts: parseMessagePartsJson parses valid JSON array", () => {
  const partsJson = JSON.stringify([
    {
      partId: "msg_123:part:1",
      messageId: "msg_123",
      partType: "text",
      sequence: 1,
      contentJson: '{"text": "Hello"}',
      lineageJson: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
      partId: "msg_123:part:2",
      messageId: "msg_123",
      partType: "tool_result",
      sequence: 2,
      contentJson: '{"text": "Tool result", "structured": false}',
      lineageJson: null,
      createdAt: "2024-01-01T00:00:01.000Z",
    },
  ]);

  const parts = parseMessagePartsJson(partsJson);

  assert.equal(parts.length, 2);
  assert.equal(parts[0]!.partType, "text");
  assert.equal(parts[1]!.partType, "tool_result");
});

test("MessageParts: parseMessagePartsJson sorts by sequence", () => {
  const partsJson = JSON.stringify([
    {
      partId: "msg_123:part:2",
      messageId: "msg_123",
      partType: "text",
      sequence: 2,
      contentJson: '{"text": "Second"}',
      lineageJson: null,
      createdAt: "2024-01-01T00:00:01.000Z",
    },
    {
      partId: "msg_123:part:1",
      messageId: "msg_123",
      partType: "text",
      sequence: 1,
      contentJson: '{"text": "First"}',
      lineageJson: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ]);

  const parts = parseMessagePartsJson(partsJson);

  assert.equal(parts[0]!.sequence, 1);
  assert.equal(parts[1]!.sequence, 2);
});

test("MessageParts: parseMessagePartsJson returns empty array for null", () => {
  assert.deepEqual(parseMessagePartsJson(null), []);
});

test("MessageParts: parseMessagePartsJson returns empty array for empty string", () => {
  assert.deepEqual(parseMessagePartsJson(""), []);
});

test("MessageParts: parseMessagePartsJson returns empty array for whitespace", () => {
  assert.deepEqual(parseMessagePartsJson("   "), []);
});

test("MessageParts: parseMessagePartsJson returns empty array for invalid JSON", () => {
  assert.deepEqual(parseMessagePartsJson("not valid json"), []);
});

test("MessageParts: parseMessagePartsJson returns empty array for non-array JSON", () => {
  assert.deepEqual(parseMessagePartsJson('{"key": "value"}'), []);
});

test("MessageParts: renderMessagePartContent renders text part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "text" as const,
    sequence: 1,
    contentJson: JSON.stringify({ text: "Hello world" }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "Hello world");
});

test("MessageParts: renderMessagePartContent renders summary part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "summary" as const,
    sequence: 1,
    contentJson: JSON.stringify({ summary: "This is a summary" }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "This is a summary");
});

test("MessageParts: renderMessagePartContent renders tool_result part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "tool_result" as const,
    sequence: 1,
    contentJson: JSON.stringify({ text: "Tool result content" }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "Tool result content");
});

test("MessageParts: renderMessagePartContent renders artifact_ref part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "artifact_ref" as const,
    sequence: 1,
    contentJson: JSON.stringify({
      kind: "file",
      artifactId: "artifact_123",
      uri: "file:///path/to/file.txt",
    }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("artifact_123"));
  assert.ok(content.includes("file"));
});

test("MessageParts: renderMessagePartContent renders retry_record part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "retry_record" as const,
    sequence: 1,
    contentJson: JSON.stringify({
      attempt: 2,
      errorCode: "RATE_LIMIT",
    }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("2"));
  assert.ok(content.includes("RATE_LIMIT"));
});

test("MessageParts: renderMessagePartContent returns empty string for invalid contentJson", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "text" as const,
    sequence: 1,
    contentJson: "not valid json",
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "");
});

test("MessageParts: renderMessagePartsForContext with parts", () => {
  const message = {
    id: "msg_123",
    content: "Original content",
    partsJson: JSON.stringify([
      {
        partId: "msg_123:part:1",
        messageId: "msg_123",
        partType: "text",
        sequence: 1,
        contentJson: JSON.stringify({ text: "Rendered part 1" }),
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        partId: "msg_123:part:2",
        messageId: "msg_123",
        partType: "text",
        sequence: 2,
        contentJson: JSON.stringify({ text: "Rendered part 2" }),
        lineageJson: null,
        createdAt: "2024-01-01T00:00:01.000Z",
      },
    ]),
  };

  const result = renderMessagePartsForContext(message);

  assert.equal(result.trimmed, false);
  assert.equal(result.trimmedPartCount, 0);
  assert.ok(result.content.includes("Rendered part 1"));
  assert.ok(result.content.includes("Rendered part 2"));
});

test("MessageParts: renderMessagePartsForContext with trimToolResultParts", () => {
  const message = {
    id: "msg_123",
    content: "Original content",
    partsJson: JSON.stringify([
      {
        partId: "msg_123:part:1",
        messageId: "msg_123",
        partType: "text",
        sequence: 1,
        contentJson: JSON.stringify({ text: "Text part" }),
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        partId: "msg_123:part:2",
        messageId: "msg_123",
        partType: "tool_result",
        sequence: 2,
        contentJson: JSON.stringify({ text: "Tool result that should be trimmed" }),
        lineageJson: null,
        createdAt: "2024-01-01T00:00:01.000Z",
      },
    ]),
  };

  const result = renderMessagePartsForContext(message, { trimToolResultParts: true });

  assert.equal(result.trimmed, true);
  assert.equal(result.trimmedPartCount, 1);
  assert.ok(result.content.includes("Tool result trimmed"));
});

test("MessageParts: renderMessagePartsForContext falls back to content when no parts", () => {
  const message = {
    id: "msg_123",
    content: "Fallback content",
    partsJson: null,
  };

  const result = renderMessagePartsForContext(message);

  assert.equal(result.trimmed, false);
  assert.equal(result.trimmedPartCount, 0);
  assert.equal(result.content, "Fallback content");
});

test("MessageParts: serializeMessageParts and parseMessagePartsJson roundtrip", () => {
  const originalParts = buildStructuredToolResultParts({
    messageId: "msg_roundtrip",
    createdAt: "2024-01-01T00:00:00.000Z",
    resultText: "Result text",
    summaryText: "Summary text",
  });

  const serialized = serializeMessageParts(originalParts);
  const parsed = parseMessagePartsJson(serialized);

  assert.equal(parsed.length, originalParts.length);
  assert.equal(parsed[0]!.partId, originalParts[0]!.partId);
  assert.equal(parsed[0]!.partType, originalParts[0]!.partType);
});

test("MessageParts: ensureMessagePartsJson returns existing partsJson", () => {
  const existingPartsJson = JSON.stringify([
    {
      partId: "msg:part:1",
      messageId: "msg",
      partType: "text",
      sequence: 1,
      contentJson: '{"text": "Existing"}',
      lineageJson: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ]);

  const result = ensureMessagePartsJson({
    id: "msg",
    messageType: "text",
    content: "Hello",
    createdAt: "2024-01-01T00:00:00.000Z",
    partsJson: existingPartsJson,
  });

  assert.equal(result, existingPartsJson);
});

test("MessageParts: ensureMessagePartsJson builds parts when partsJson is null", () => {
  const result = ensureMessagePartsJson({
    id: "msg_new",
    messageType: "text",
    content: "Hello",
    createdAt: "2024-01-01T00:00:00.000Z",
    partsJson: null,
  });

  const parts = parseMessagePartsJson(result);
  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "text");
});

test("MessageParts: renderMessagePartContent handles reasoning part type", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "reasoning" as const,
    sequence: 1,
    contentJson: JSON.stringify({ text: "Thinking about this..." }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "Thinking about this...");
});

test("MessageParts: renderMessagePartContent handles step_boundary part type", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "step_boundary" as const,
    sequence: 1,
    contentJson: JSON.stringify({
      stepId: "step_5",
      boundaryKind: "start",
    }),
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("step_5"));
  assert.ok(content.includes("start"));
});
