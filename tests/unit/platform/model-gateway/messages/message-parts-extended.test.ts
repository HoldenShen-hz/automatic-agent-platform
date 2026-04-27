/**
 * Extended unit tests for message-parts module
 * Tests buildMessageParts, buildStructuredToolResultParts, buildRetryRecordParts,
 * parseMessagePartsJson, renderMessagePartContent, renderMessagePartsForContext,
 * serializeMessageParts, and ensureMessagePartsJson
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildMessageParts,
  buildStructuredToolResultParts,
  buildRetryRecordParts,
  parseMessagePartsJson,
  renderMessagePartContent,
  renderMessagePartsForContext,
  serializeMessageParts,
  ensureMessagePartsJson,
} from "../../../../../src/platform/model-gateway/messages/message-parts.js";

function createMockMessageRecord(overrides: Partial<{
  id: string;
  messageType: string;
  content: string;
  createdAt: string;
  partsJson: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "msg-123",
    messageType: overrides.messageType ?? "user",
    content: overrides.content ?? "Hello, world!",
    createdAt: overrides.createdAt ?? "2026-04-26T00:00:00.000Z",
    partsJson: overrides.partsJson ?? null,
    ...overrides,
  };
}

function createMockMessagePart(overrides: Partial<{
  partId: string;
  messageId: string;
  partType: string;
  sequence: number;
  contentJson: string;
  lineageJson: string | null;
  createdAt: string;
}> = {}) {
  return {
    partId: overrides.partId ?? "msg-123:part:1",
    messageId: overrides.messageId ?? "msg-123",
    partType: overrides.partType ?? "text",
    sequence: overrides.sequence ?? 1,
    contentJson: overrides.contentJson ?? '{"text":"test"}',
    lineageJson: overrides.lineageJson ?? null,
    createdAt: overrides.createdAt ?? "2026-04-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildMessageParts", () => {
  test("builds parts for user message with default text partType", () => {
    const record = createMockMessageRecord({
      id: "user-msg-1",
      messageType: "user",
      content: "Hello there",
      createdAt: "2026-04-26T10:00:00.000Z",
    });

    const parts = buildMessageParts(record);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].partId, "user-msg-1:part:1");
    assert.equal(parts[0].messageId, "user-msg-1");
    assert.equal(parts[0].partType, "text");
    assert.equal(parts[0].sequence, 1);
    assert.ok(parts[0].contentJson.includes("Hello there"));
    assert.equal(parts[0].lineageJson, null);
    assert.equal(parts[0].createdAt, "2026-04-26T10:00:00.000Z");
  });

  test("builds parts for tool_result message with tool_result partType", () => {
    const record = createMockMessageRecord({
      id: "tool-msg-1",
      messageType: "tool_result",
      content: "Tool execution result",
      createdAt: "2026-04-26T10:00:00.000Z",
    });

    const parts = buildMessageParts(record);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].partType, "tool_result");
    assert.ok(parts[0].contentJson.includes("Tool execution result"));
  });

  test("builds parts for compaction_summary message with summary partType", () => {
    const record = createMockMessageRecord({
      id: "summary-msg-1",
      messageType: "compaction_summary",
      content: "Compacted summary content",
      createdAt: "2026-04-26T10:00:00.000Z",
    });

    const parts = buildMessageParts(record);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].partType, "summary");
    assert.ok(parts[0].contentJson.includes("Compacted summary content"));
  });

  test("sequence numbers are assigned correctly", () => {
    const record = createMockMessageRecord({
      id: "seq-test",
      messageType: "user",
      content: "Test content",
    });

    const parts = buildMessageParts(record);

    assert.equal(parts[0].sequence, 1);
  });

  test("lineageJson is always null in built parts", () => {
    const record = createMockMessageRecord({
      id: "lineage-test",
      messageType: "user",
      content: "Content",
    });

    const parts = buildMessageParts(record);

    assert.equal(parts[0].lineageJson, null);
  });
});

describe("buildStructuredToolResultParts", () => {
  test("builds tool result parts with summary and artifact refs", () => {
    const input = {
      messageId: "tool-result-1",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Execution completed successfully",
      summaryText: "Task finished in 2 seconds",
      artifactRefs: [
        { artifactId: "art-123", uri: "file:///tmp/output.txt" },
        { artifactId: "art-456", uri: "file:///tmp/logs.txt" },
      ],
    };

    const parts = buildStructuredToolResultParts(input);

    // Should have 3 parts: summary + 2 artifact refs + tool_result
    assert.equal(parts.length, 4);
    assert.equal(parts[0].partType, "summary");
    assert.ok(parts[0].contentJson.includes("Task finished in 2 seconds"));
    assert.equal(parts[1].partType, "artifact_ref");
    assert.ok(parts[1].contentJson.includes("art-123"));
    assert.equal(parts[2].partType, "artifact_ref");
    assert.ok(parts[2].contentJson.includes("art-456"));
    assert.equal(parts[3].partType, "tool_result");
    assert.ok(parts[3].contentJson.includes("Execution completed successfully"));
  });

  test("builds tool result parts without summary", () => {
    const input = {
      messageId: "tool-result-2",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Result without summary",
      summaryText: null,
      artifactRefs: [],
    };

    const parts = buildStructuredToolResultParts(input);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].partType, "tool_result");
  });

  test("builds tool result parts with empty summary string", () => {
    const input = {
      messageId: "tool-result-3",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Result with empty summary",
      summaryText: "   ",
      artifactRefs: [],
    };

    const parts = buildStructuredToolResultParts(input);

    // Empty/whitespace-only summary should be skipped
    assert.equal(parts.length, 1);
    assert.equal(parts[0].partType, "tool_result");
  });

  test("builds tool result parts without artifact refs", () => {
    const input = {
      messageId: "tool-result-4",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Simple result",
      summaryText: "Brief summary",
      artifactRefs: undefined,
    };

    const parts = buildStructuredToolResultParts(input);

    assert.equal(parts.length, 2); // summary + tool_result
    assert.equal(parts[0].partType, "summary");
    assert.equal(parts[1].partType, "tool_result");
  });

  test("tool result contentJson has structured flag based on parts count", () => {
    const inputWithSummary = {
      messageId: "tool-1",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Result with summary",
      summaryText: "Summary",
      artifactRefs: [],
    };

    const parts1 = buildStructuredToolResultParts(inputWithSummary);
    assert.ok(parts1[parts1.length - 1].contentJson.includes('"structured":true'));

    const inputWithoutSummary = {
      messageId: "tool-2",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Result without summary",
      summaryText: null,
      artifactRefs: [],
    };

    const parts2 = buildStructuredToolResultParts(inputWithoutSummary);
    assert.ok(parts2[parts2.length - 1].contentJson.includes('"structured":false'));
  });

  test("tool result includes metadata when provided", () => {
    const input = {
      messageId: "tool-with-meta",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Result with metadata",
      metadata: { durationMs: 1500, exitCode: 0 },
    };

    const parts = buildStructuredToolResultParts(input);

    const toolResultPart = parts[parts.length - 1];
    assert.ok(toolResultPart.contentJson.includes("durationMs"));
    assert.ok(toolResultPart.contentJson.includes("1500"));
  });

  test("sequence numbers are assigned correctly across all part types", () => {
    const input = {
      messageId: "seq-test-tool",
      createdAt: "2026-04-26T10:00:00.000Z",
      resultText: "Result",
      summaryText: "Summary text",
      artifactRefs: [{ artifactId: "art-1", uri: "file:///test" }],
    };

    const parts = buildStructuredToolResultParts(input);

    assert.equal(parts[0].sequence, 1); // summary
    assert.equal(parts[1].sequence, 2); // artifact_ref
    assert.equal(parts[2].sequence, 3); // tool_result
  });
});

describe("buildRetryRecordParts", () => {
  test("builds retry record parts with all fields", () => {
    const input = {
      messageId: "retry-msg-1",
      createdAt: "2026-04-26T10:00:00.000Z",
      attempt: 2,
      nextAttempt: 3,
      errorCode: "PROVIDER_TIMEOUT",
      source: "openai",
      retryDelayMs: 1000,
      failureClass: "TimeoutError",
    };

    const parts = buildRetryRecordParts(input);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].partType, "retry_record");
    assert.equal(parts[0].messageId, "retry-msg-1");
    assert.ok(parts[0].contentJson.includes('"attempt":2'));
    assert.ok(parts[0].contentJson.includes('"nextAttempt":3'));
    assert.ok(parts[0].contentJson.includes('"errorCode":"PROVIDER_TIMEOUT"'));
    assert.ok(parts[0].contentJson.includes('"source":"openai"'));
    assert.ok(parts[0].contentJson.includes('"retryDelayMs":1000'));
    assert.ok(parts[0].contentJson.includes('"failureClass":"TimeoutError"'));
  });

  test("handles null nextAttempt and failureClass", () => {
    const input = {
      messageId: "retry-msg-2",
      createdAt: "2026-04-26T10:00:00.000Z",
      attempt: 1,
      nextAttempt: null,
      errorCode: "NETWORK_ERROR",
      source: "anthropic",
      retryDelayMs: null,
      failureClass: null,
    };

    const parts = buildRetryRecordParts(input);

    assert.ok(parts[0].contentJson.includes('"nextAttempt":null'));
    assert.ok(parts[0].contentJson.includes('"failureClass":null'));
    assert.ok(parts[0].contentJson.includes('"retryDelayMs":0'));
  });

  test("uses default retryDelayMs of 0 when not provided", () => {
    const input = {
      messageId: "retry-msg-3",
      createdAt: "2026-04-26T10:00:00.000Z",
      attempt: 1,
      errorCode: "ERROR",
      source: "test",
    };

    const parts = buildRetryRecordParts(input);

    assert.ok(parts[0].contentJson.includes('"retryDelayMs":0'));
  });

  test("uses default failureClass of null when not provided", () => {
    const input = {
      messageId: "retry-msg-4",
      createdAt: "2026-04-26T10:00:00.000Z",
      attempt: 3,
      errorCode: "ERROR",
      source: "test",
    };

    const parts = buildRetryRecordParts(input);

    assert.ok(parts[0].contentJson.includes('"failureClass":null'));
  });

  test("partId and messageId are correctly set", () => {
    const input = {
      messageId: "retry-xyz-123",
      createdAt: "2026-04-26T10:00:00.000Z",
      attempt: 5,
      errorCode: "ERROR",
      source: "test",
    };

    const parts = buildRetryRecordParts(input);

    assert.equal(parts[0].partId, "retry-xyz-123:part:1");
    assert.equal(parts[0].messageId, "retry-xyz-123");
    assert.equal(parts[0].sequence, 1);
  });
});

describe("parseMessagePartsJson", () => {
  test("parses valid parts JSON array", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partId: "p1", partType: "text", sequence: 1 }),
      createMockMessagePart({ partId: "p2", partType: "tool_result", sequence: 2 }),
    ]);

    const parts = parseMessagePartsJson(partsJson);

    assert.equal(parts.length, 2);
    assert.equal(parts[0].partId, "p1");
    assert.equal(parts[1].partId, "p2");
  });

  test("sorts parts by sequence ascending", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partId: "p3", sequence: 3 }),
      createMockMessagePart({ partId: "p1", sequence: 1 }),
      createMockMessagePart({ partId: "p2", sequence: 2 }),
    ]);

    const parts = parseMessagePartsJson(partsJson);

    assert.equal(parts[0].partId, "p1");
    assert.equal(parts[1].partId, "p2");
    assert.equal(parts[2].partId, "p3");
  });

  test("returns empty array for null input", () => {
    const parts = parseMessagePartsJson(null);
    assert.deepEqual(parts, []);
  });

  test("returns empty array for undefined input", () => {
    const parts = parseMessagePartsJson(undefined);
    assert.deepEqual(parts, []);
  });

  test("returns empty array for empty string", () => {
    const parts = parseMessagePartsJson("");
    assert.deepEqual(parts, []);
  });

  test("returns empty array for whitespace-only string", () => {
    const parts = parseMessagePartsJson("   ");
    assert.deepEqual(parts, []);
  });

  test("returns empty array for non-array JSON", () => {
    const parts = parseMessagePartsJson('{"text":"not an array"}');
    assert.deepEqual(parts, []);
  });

  test("filters out invalid parts", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partId: "valid-part" }),
      { partId: "invalid-no-sequence" }, // missing sequence
      createMockMessagePart({ partId: "another-valid" }),
    ]);

    const parts = parseMessagePartsJson(partsJson);

    assert.equal(parts.length, 2);
    assert.equal(parts[0].partId, "valid-part");
    assert.equal(parts[1].partId, "another-valid");
  });

  test("accepts valid part with all required fields", () => {
    const validPart = createMockMessagePart({
      partId: "complete-part",
      messageId: "msg-1",
      partType: "text",
      sequence: 1,
      contentJson: '{"text":"hello"}',
      lineageJson: null,
      createdAt: "2026-04-26T00:00:00.000Z",
    });

    const partsJson = JSON.stringify([validPart]);
    const parts = parseMessagePartsJson(partsJson);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].partId, "complete-part");
  });

  test("accepts part with string lineageJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ lineageJson: '{"parent":"abc"}' }),
    ]);

    const parts = parseMessagePartsJson(partsJson);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].lineageJson, '{"parent":"abc"}');
  });

  test("filters parts with missing partId", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partId: "valid-1" }),
      { messageId: "msg", partType: "text", sequence: 1, contentJson: "{}", lineageJson: null, createdAt: "2026-04-26T00:00:00.000Z" },
    ]);

    const parts = parseMessagePartsJson(partsJson);
    assert.equal(parts.length, 1);
  });

  test("filters parts with non-string contentJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"text":"valid"}' }),
      createMockMessagePart({ contentJson: 123 as unknown as string }),
    ]);

    const parts = parseMessagePartsJson(partsJson);
    assert.equal(parts.length, 1);
  });

  test("handles malformed JSON gracefully", () => {
    const parts = parseMessagePartsJson("not valid json {");
    assert.deepEqual(parts, []);
  });

  test("handles JSON with extra fields on parts", () => {
    const partsJson = JSON.stringify([
      {
        partId: "extra-fields",
        messageId: "msg-1",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"test"}',
        lineageJson: null,
        createdAt: "2026-04-26T00:00:00.000Z",
        extraField: "should be ignored",
        anotherExtra: 123,
      },
    ]);

    const parts = parseMessagePartsJson(partsJson);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].partId, "extra-fields");
  });
});

describe("renderMessagePartContent", () => {
  test("renders summary part", () => {
    const part = createMockMessagePart({
      partType: "summary",
      contentJson: '{"summary":"This is a summary","extra":"ignored"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "This is a summary");
  });

  test("renders summary part using text key as fallback", () => {
    const part = createMockMessagePart({
      partType: "summary",
      contentJson: '{"text":"fallback text"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "fallback text");
  });

  test("renders tool_result part", () => {
    const part = createMockMessagePart({
      partType: "tool_result",
      contentJson: '{"text":"tool output","structured":true}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "tool output");
  });

  test("renders text part", () => {
    const part = createMockMessagePart({
      partType: "text",
      contentJson: '{"text":"plain text content"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "plain text content");
  });

  test("renders reasoning part", () => {
    const part = createMockMessagePart({
      partType: "reasoning",
      contentJson: '{"summary":"reasoning trace"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "reasoning trace");
  });

  test("renders decision_prompt part", () => {
    const part = createMockMessagePart({
      partType: "decision_prompt",
      contentJson: '{"prompt":"Should we proceed?","reason":"cost benefit analysis"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Should we proceed?");
  });

  test("renders step_boundary part", () => {
    const part = createMockMessagePart({
      partType: "step_boundary",
      contentJson: '{"stepId":"step-5","boundaryKind":"begin"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Step step-5 begin");
  });

  test("renders step_boundary with missing stepId", () => {
    const part = createMockMessagePart({
      partType: "step_boundary",
      contentJson: '{"boundaryKind":"end"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Step unknown end");
  });

  test("renders retry_record part with attempt number", () => {
    const part = createMockMessagePart({
      partType: "retry_record",
      contentJson: '{"attempt":3,"errorCode":"TIMEOUT"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Retry attempt=3 error=TIMEOUT");
  });

  test("renders retry_record part without attempt number", () => {
    const part = createMockMessagePart({
      partType: "retry_record",
      contentJson: '{"errorCode":"ERROR_X"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Retry error=ERROR_X");
  });

  test("renders command_execution part", () => {
    const part = createMockMessagePart({
      partType: "command_execution",
      contentJson: '{"commandRef":"cmd-123","status":"success","cwd":"/workspace"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Command cmd-123 status=success cwd=/workspace");
  });

  test("renders command_execution part without cwd", () => {
    const part = createMockMessagePart({
      partType: "command_execution",
      contentJson: '{"commandRef":"cmd-456","status":"failed"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Command cmd-456 status=failed");
  });

  test("renders mcp_call part", () => {
    const part = createMockMessagePart({
      partType: "mcp_call",
      contentJson: '{"serverName":"filesystem","toolName":"read_file","status":"completed"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "MCP filesystem/read_file status=completed");
  });

  test("renders artifact_ref part", () => {
    const part = createMockMessagePart({
      partType: "artifact_ref",
      contentJson: '{"kind":"code","artifactId":"art-789","uri":"file:///src/main.ts"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Artifact ref kind=code artifact_id=art-789 uri=file:///src/main.ts");
  });

  test("renders artifact_ref part without uri", () => {
    const part = createMockMessagePart({
      partType: "artifact_ref",
      contentJson: '{"kind":"data","artifact_id":"art-999"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Artifact ref kind=data artifact_id=art-999");
  });

  test("renders artifact_ref with missing fields using defaults", () => {
    const part = createMockMessagePart({
      partType: "artifact_ref",
      contentJson: '{}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "Artifact ref kind=artifact artifact_id=unknown");
  });

  test("renders unknown part type using fallback keys", () => {
    const part = createMockMessagePart({
      partType: "unknown_type",
      contentJson: '{"result":"fallback result"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "fallback result");
  });

  test("renders part with invalid contentJson as empty string", () => {
    const part = createMockMessagePart({
      partType: "text",
      contentJson: "not valid json",
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "");
  });

  test("renders part with empty contentJson payload", () => {
    const part = createMockMessagePart({
      partType: "text",
      contentJson: '{"text":""}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "");
  });

  test("renders part with whitespace content", () => {
    const part = createMockMessagePart({
      partType: "text",
      contentJson: '{"text":"   "}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "");
  });

  test("renders part using result key when text not available", () => {
    const part = createMockMessagePart({
      partType: "custom",
      contentJson: '{"result":"output via result"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "output via result");
  });

  test("renders part using status key for unknown types", () => {
    const part = createMockMessagePart({
      partType: "status_type",
      contentJson: '{"status":"pending"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "pending");
  });

  test("renders part with JSON.stringify payload as last resort", () => {
    const part = createMockMessagePart({
      partType: "complex",
      contentJson: '{"nested":{"deep":"value"}}',
    });

    const content = renderMessagePartContent(part);
    assert.ok(content.includes("nested"));
    assert.ok(content.includes("deep"));
  });

  test("renders part prioritizing text over summary for tool_result", () => {
    const part = createMockMessagePart({
      partType: "tool_result",
      contentJson: '{"text":"actual output","summary":"this should not be used"}',
    });

    const content = renderMessagePartContent(part);
    assert.equal(content, "actual output");
  });
});

describe("renderMessagePartsForContext", () => {
  test("renders content from parts when available", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partType: "text", contentJson: '{"text":"Hello"}', sequence: 1 }),
      createMockMessagePart({ partType: "text", contentJson: '{"text":"World"}', sequence: 2 }),
    ]);

    const record = createMockMessageRecord({
      id: "msg-with-parts",
      partsJson,
    });

    const result = renderMessagePartsForContext(record);

    assert.equal(result.content, "Hello World");
    assert.equal(result.trimmed, false);
    assert.equal(result.trimmedPartCount, 0);
  });

  test("returns original content when partsJson is null", () => {
    const record = createMockMessageRecord({
      id: "msg-no-parts",
      content: "Original content here",
      partsJson: null,
    });

    const result = renderMessagePartsForContext(record);

    assert.equal(result.content, "Original content here");
    assert.equal(result.trimmed, false);
  });

  test("returns original content when partsJson is empty array", () => {
    const record = createMockMessageRecord({
      id: "msg-empty-parts",
      content: "Fallback content",
      partsJson: "[]",
    });

    const result = renderMessagePartsForContext(record);

    assert.equal(result.content, "Fallback content");
    assert.equal(result.trimmed, false);
  });

  test("trims tool_result parts when trimToolResultParts is true", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partType: "text", contentJson: '{"text":"Visible text"}', sequence: 1 }),
      createMockMessagePart({ partType: "tool_result", contentJson: '{"text":"Should be trimmed"}', sequence: 2 }),
    ]);

    const record = createMockMessageRecord({
      id: "msg-trim-test",
      partsJson,
    });

    const result = renderMessagePartsForContext(record, { trimToolResultParts: true });

    assert.ok(result.content.includes("Visible text"));
    assert.ok(result.content.includes("trimmed"));
    assert.ok(result.content.includes("msg-trim-test"));
    assert.equal(result.trimmed, true);
    assert.equal(result.trimmedPartCount, 1);
  });

  test("includes trim notice when all parts are tool_result", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partType: "tool_result", contentJson: '{"text":"Trimmed"}', sequence: 1 }),
    ]);

    const record = createMockMessageRecord({
      id: "all-trimmed-msg",
      partsJson,
    });

    const result = renderMessagePartsForContext(record, { trimToolResultParts: true });

    assert.ok(result.content.includes("trimmed"));
    assert.ok(result.content.includes("all-trimmed-msg"));
    assert.equal(result.trimmed, true);
    assert.equal(result.trimmedPartCount, 1);
  });

  test("does not add trim notice when nothing is trimmed", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partType: "text", contentJson: '{"text":"Just text"}', sequence: 1 }),
    ]);

    const record = createMockMessageRecord({ partsJson });

    const result = renderMessagePartsForContext(record, { trimToolResultParts: true });

    assert.ok(!result.content.includes("trimmed"));
    assert.equal(result.trimmed, false);
    assert.equal(result.trimmedPartCount, 0);
  });

  test("renders multiple tool_result parts trimmed", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partType: "text", contentJson: '{"text":"Start"}', sequence: 1 }),
      createMockMessagePart({ partType: "tool_result", contentJson: '{"text":"First trim"}', sequence: 2 }),
      createMockMessagePart({ partType: "tool_result", contentJson: '{"text":"Second trim"}', sequence: 3 }),
      createMockMessagePart({ partType: "text", contentJson: '{"text":"End"}', sequence: 4 }),
    ]);

    const record = createMockMessageRecord({ partsJson });

    const result = renderMessagePartsForContext(record, { trimToolResultParts: true });

    assert.ok(result.content.includes("Start"));
    assert.ok(result.content.includes("End"));
    assert.equal(result.trimmedPartCount, 2);
  });

  test("returns content from parsed parts even if original content exists", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partType: "summary", contentJson: '{"summary":"From parts"}', sequence: 1 }),
    ]);

    const record = createMockMessageRecord({
      id: "parts-override",
      content: "Original content",
      partsJson,
    });

    const result = renderMessagePartsForContext(record);

    assert.equal(result.content, "From parts");
  });

  test("empty parts returns original content", () => {
    const record = createMockMessageRecord({
      id: "empty-parts-test",
      content: "Original content",
      partsJson: "[]",
    });

    const result = renderMessagePartsForContext(record);

    assert.equal(result.content, "Original content");
    assert.equal(result.trimmed, false);
  });
});

describe("serializeMessageParts", () => {
  test("serializes parts to JSON string", () => {
    const parts = [
      createMockMessagePart({ partId: "p1", sequence: 1 }),
      createMockMessagePart({ partId: "p2", sequence: 2 }),
    ];

    const json = serializeMessageParts(parts);

    const parsed = JSON.parse(json);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].partId, "p1");
    assert.equal(parsed[1].partId, "p2");
  });

  test("roundtrip serialize and parse", () => {
    const originalParts = [
      createMockMessagePart({ partId: "rt-1", partType: "text", contentJson: '{"text":"hello"}' }),
      createMockMessagePart({ partId: "rt-2", partType: "tool_result", contentJson: '{"text":"world"}' }),
    ];

    const json = serializeMessageParts(originalParts);
    const parsed = parseMessagePartsJson(json);

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].partId, "rt-1");
    assert.equal(parsed[1].partId, "rt-2");
  });
});

describe("ensureMessagePartsJson", () => {
  test("returns existing partsJson when provided", () => {
    const existingJson = '[{"partId":"existing","messageId":"msg-1","partType":"text","sequence":1,"contentJson":"{}","lineageJson":null,"createdAt":"2026-04-26T00:00:00.000Z"}]';

    const result = ensureMessagePartsJson(createMockMessageRecord({ partsJson: existingJson }));

    assert.equal(result, existingJson);
  });

  test("builds partsJson from content when partsJson is null", () => {
    const record = createMockMessageRecord({
      id: "build-from-content",
      messageType: "user",
      content: "Test content",
      partsJson: null,
    });

    const result = ensureMessagePartsJson(record);

    const parsed = JSON.parse(result);
    assert.equal(parsed.length, 1);
    assert.ok(result.includes("Test content"));
  });

  test("builds correct partType based on messageType", () => {
    const record = createMockMessageRecord({
      id: "tool-result-msg",
      messageType: "tool_result",
      content: "Tool output",
      partsJson: null,
    });

    const result = ensureMessagePartsJson(record);
    const parsed = JSON.parse(result);

    assert.equal(parsed[0].partType, "tool_result");
  });

  test("builds summary partType for compaction_summary messageType", () => {
    const record = createMockMessageRecord({
      id: "summary-msg",
      messageType: "compaction_summary",
      content: "Summary content",
      partsJson: null,
    });

    const result = ensureMessagePartsJson(record);
    const parsed = JSON.parse(result);

    assert.equal(parsed[0].partType, "summary");
  });
});