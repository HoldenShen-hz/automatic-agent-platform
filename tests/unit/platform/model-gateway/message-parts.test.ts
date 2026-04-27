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
} from "../../../../src/platform/model-gateway/messages/message-parts.js";

test("buildMessageParts creates simple text message parts", () => {
  const message = {
    id: "msg_001",
    messageType: "user",
    content: "Hello world",
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const parts = buildMessageParts(message);

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partId, "msg_001:part:1");
  assert.equal(parts[0]!.messageId, "msg_001");
  assert.equal(parts[0]!.partType, "text");
  assert.equal(parts[0]!.sequence, 1);
});

test("buildMessageParts creates tool_result part type", () => {
  const message = {
    id: "msg_002",
    messageType: "tool_result",
    content: "Tool execution completed",
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const parts = buildMessageParts(message);

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "tool_result");
});

test("buildMessageParts creates summary part type for compaction_summary", () => {
  const message = {
    id: "msg_003",
    messageType: "compaction_summary",
    content: "Summary of conversation",
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const parts = buildMessageParts(message);

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "summary");
});

test("buildStructuredToolResultParts creates parts with summary", () => {
  const input: StructuredToolResultPartsInput = {
    messageId: "msg_004",
    createdAt: "2026-04-27T00:00:00.000Z",
    resultText: "Execution result",
    summaryText: "Brief summary",
  };

  const parts = buildStructuredToolResultParts(input);

  assert.ok(parts.length >= 2);
  assert.equal(parts[0]!.partType, "summary");
  assert.equal(parts[1]!.partType, "tool_result");
});

test("buildStructuredToolResultParts creates parts with artifact refs", () => {
  const input: StructuredToolResultPartsInput = {
    messageId: "msg_005",
    createdAt: "2026-04-27T00:00:00.000Z",
    resultText: "Execution result",
    artifactRefs: [
      { artifactId: "art_001", kind: "code", uri: "file:///tmp/code.ts" },
      { artifactId: "art_002", kind: "document", uri: "file:///tmp/doc.md" },
    ],
  };

  const parts = buildStructuredToolResultParts(input);

  assert.ok(parts.length >= 3);
  assert.equal(parts[0]!.partType, "artifact_ref");
  assert.equal(parts[1]!.partType, "artifact_ref");
  assert.equal(parts[2]!.partType, "tool_result");
});

test("buildStructuredToolResultParts handles empty summary", () => {
  const input: StructuredToolResultPartsInput = {
    messageId: "msg_006",
    createdAt: "2026-04-27T00:00:00.000Z",
    resultText: "Result",
    summaryText: "   ",
  };

  const parts = buildStructuredToolResultParts(input);

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "tool_result");
});

test("buildRetryRecordParts creates retry record part", () => {
  const input: RetryRecordPartsInput = {
    messageId: "msg_007",
    createdAt: "2026-04-27T00:00:00.000Z",
    attempt: 1,
    nextAttempt: 2,
    errorCode: "tool.execution_failed",
    source: "dispatcher",
    retryDelayMs: 1000,
    failureClass: "NetworkError",
  };

  const parts = buildRetryRecordParts(input);

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.partType, "retry_record");
  assert.equal(parts[0]!.sequence, 1);
});

test("parseMessagePartsJson parses valid JSON array", () => {
  const partsJson = JSON.stringify([
    {
      partId: "msg:part:1",
      messageId: "msg",
      partType: "text",
      sequence: 1,
      contentJson: '{"text":"Hello"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    {
      partId: "msg:part:2",
      messageId: "msg",
      partType: "text",
      sequence: 2,
      contentJson: '{"text":"World"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
  ]);

  const parts = parseMessagePartsJson(partsJson);

  assert.equal(parts.length, 2);
  assert.equal(parts[0]!.sequence, 1);
  assert.equal(parts[1]!.sequence, 2);
});

test("parseMessagePartsJson returns empty array for null input", () => {
  const parts = parseMessagePartsJson(null);
  assert.deepEqual(parts, []);
});

test("parseMessagePartsJson returns empty array for undefined input", () => {
  const parts = parseMessagePartsJson(undefined);
  assert.deepEqual(parts, []);
});

test("parseMessagePartsJson returns empty array for empty string", () => {
  const parts = parseMessagePartsJson("");
  assert.deepEqual(parts, []);
});

test("parseMessagePartsJson returns empty array for whitespace only", () => {
  const parts = parseMessagePartsJson("   ");
  assert.deepEqual(parts, []);
});

test("parseMessagePartsJson returns empty array for non-array JSON", () => {
  const parts = parseMessagePartsJson('{"key":"value"}');
  assert.deepEqual(parts, []);
});

test("parseMessagePartsJson filters invalid parts", () => {
  const partsJson = JSON.stringify([
    {
      partId: "msg:part:1",
      messageId: "msg",
      partType: "text",
      sequence: 1,
      contentJson: '{"text":"Hello"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    {
      partId: "msg:part:2",
      messageId: "msg",
      partType: "text",
      sequence: 2,
      contentJson: '{"text":"World"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    {
      partId: "invalid",
      messageId: "msg",
      partType: "text",
      sequence: "not a number",
      contentJson: '{"text":"Hello"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
  ]);

  const parts = parseMessagePartsJson(partsJson);

  assert.equal(parts.length, 2);
});

test("parseMessagePartsJson sorts by sequence", () => {
  const partsJson = JSON.stringify([
    {
      partId: "msg:part:3",
      messageId: "msg",
      partType: "text",
      sequence: 3,
      contentJson: '{"text":"Third"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    {
      partId: "msg:part:1",
      messageId: "msg",
      partType: "text",
      sequence: 1,
      contentJson: '{"text":"First"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    {
      partId: "msg:part:2",
      messageId: "msg",
      partType: "text",
      sequence: 2,
      contentJson: '{"text":"Second"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
  ]);

  const parts = parseMessagePartsJson(partsJson);

  assert.equal(parts[0]!.sequence, 1);
  assert.equal(parts[1]!.sequence, 2);
  assert.equal(parts[2]!.sequence, 3);
});

test("renderMessagePartContent renders text part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "text" as const,
    sequence: 1,
    contentJson: '{"text":"Hello world"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "Hello world");
});

test("renderMessagePartContent renders summary part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "summary" as const,
    sequence: 1,
    contentJson: '{"summary":"This is a summary"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "This is a summary");
});

test("renderMessagePartContent renders tool_result part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "tool_result" as const,
    sequence: 1,
    contentJson: '{"text":"Tool executed successfully"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "Tool executed successfully");
});

test("renderMessagePartContent renders artifact_ref part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "artifact_ref" as const,
    sequence: 1,
    contentJson: '{"kind":"code","artifactId":"art_001","uri":"file:///tmp/code.ts"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("code"));
  assert.ok(content.includes("art_001"));
  assert.ok(content.includes("code.ts"));
});

test("renderMessagePartContent renders retry_record part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "retry_record" as const,
    sequence: 1,
    contentJson: '{"attempt":2,"errorCode":"tool.execution_failed","source":"dispatcher"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("attempt=2"));
  assert.ok(content.includes("tool.execution_failed"));
});

test("renderMessagePartContent renders step_boundary part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "step_boundary" as const,
    sequence: 1,
    contentJson: '{"stepId":"step_1","boundaryKind":"start"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("step_1"));
  assert.ok(content.includes("start"));
});

test("renderMessagePartContent renders command_execution part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "command_execution" as const,
    sequence: 1,
    contentJson: '{"commandRef":"cmd_001","status":"success","cwd":"/workspace"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("cmd_001"));
  assert.ok(content.includes("success"));
  assert.ok(content.includes("/workspace"));
});

test("renderMessagePartContent renders mcp_call part", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "mcp_call" as const,
    sequence: 1,
    contentJson: '{"serverName":"filesystem","toolName":"readFile","status":"completed"}',
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.ok(content.includes("filesystem"));
  assert.ok(content.includes("readFile"));
  assert.ok(content.includes("completed"));
});

test("renderMessagePartContent returns empty string for invalid JSON", () => {
  const part = {
    partId: "msg:part:1",
    messageId: "msg",
    partType: "text" as const,
    sequence: 1,
    contentJson: "not valid json",
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const content = renderMessagePartContent(part);

  assert.equal(content, "");
});

test("renderMessagePartsForContext uses content when no parts", () => {
  const message = {
    id: "msg_001",
    content: "Direct content",
    partsJson: null,
  };

  const result = renderMessagePartsForContext(message);

  assert.equal(result.content, "Direct content");
  assert.equal(result.trimmed, false);
  assert.equal(result.trimmedPartCount, 0);
});

test("renderMessagePartsForContext renders parts when present", () => {
  const message = {
    id: "msg_001",
    content: "Fallback content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Part one"}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      {
        partId: "msg:part:2",
        messageId: "msg",
        partType: "text",
        sequence: 2,
        contentJson: '{"text":"Part two"}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const result = renderMessagePartsForContext(message);

  assert.ok(result.content.includes("Part one"));
  assert.ok(result.content.includes("Part two"));
  assert.equal(result.trimmed, false);
  assert.equal(result.trimmedPartCount, 0);
});

test("renderMessagePartsForContext trims tool_result parts when option enabled", () => {
  const message = {
    id: "msg_001",
    content: "Fallback content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Text part"}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      {
        partId: "msg:part:2",
        messageId: "msg",
        partType: "tool_result",
        sequence: 2,
        contentJson: '{"text":"Tool result"}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const result = renderMessagePartsForContext(message, { trimToolResultParts: true });

  assert.equal(result.trimmed, true);
  assert.equal(result.trimmedPartCount, 1);
  assert.ok(result.content.includes("trimmed"));
});

test("serializeMessageParts serializes parts to JSON", () => {
  const parts = [
    {
      partId: "msg:part:1",
      messageId: "msg",
      partType: "text" as const,
      sequence: 1,
      contentJson: '{"text":"Hello"}',
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    },
  ];

  const json = serializeMessageParts(parts);
  const parsed = JSON.parse(json);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.partId, "msg:part:1");
});

test("ensureMessagePartsJson returns existing partsJson", () => {
  const existingJson = '{"some":"json"}';
  const message = {
    id: "msg_001",
    messageType: "user",
    content: "Hello",
    createdAt: "2026-04-27T00:00:00.000Z",
    partsJson: existingJson,
  };

  const result = ensureMessagePartsJson(message);

  assert.equal(result, existingJson);
});

test("ensureMessagePartsJson builds parts when partsJson is null", () => {
  const message = {
    id: "msg_001",
    messageType: "user",
    content: "Hello",
    createdAt: "2026-04-27T00:00:00.000Z",
    partsJson: null,
  };

  const result = ensureMessagePartsJson(message);
  const parsed = JSON.parse(result);

  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 1);
});
