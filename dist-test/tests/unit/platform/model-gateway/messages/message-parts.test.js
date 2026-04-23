import assert from "node:assert/strict";
import test from "node:test";
import { buildMessageParts, buildStructuredToolResultParts, buildRetryRecordParts, parseMessagePartsJson, renderMessagePartContent, renderMessagePartsForContext, serializeMessageParts, ensureMessagePartsJson, } from "../../../../../src/platform/model-gateway/messages/message-parts.js";
test("buildMessageParts creates text part for default message type", () => {
    const result = buildMessageParts({
        id: "msg_1",
        messageType: "user",
        content: "Hello world",
        createdAt: "2024-01-01T00:00:00.000Z",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "text");
    assert.equal(result[0].messageId, "msg_1");
    assert.equal(result[0].sequence, 1);
});
test("buildMessageParts creates tool_result part for tool_result message type", () => {
    const result = buildMessageParts({
        id: "msg_1",
        messageType: "tool_result",
        content: "Tool output",
        createdAt: "2024-01-01T00:00:00.000Z",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "tool_result");
});
test("buildMessageParts creates summary part for compaction_summary message type", () => {
    const result = buildMessageParts({
        id: "msg_1",
        messageType: "compaction_summary",
        content: "Summary content",
        createdAt: "2024-01-01T00:00:00.000Z",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "summary");
});
test("buildStructuredToolResultParts creates tool result with summary", () => {
    const result = buildStructuredToolResultParts({
        messageId: "msg_1",
        createdAt: "2024-01-01T00:00:00.000Z",
        resultText: "Tool output here",
        summaryText: "Summary of output",
    });
    assert.equal(result.length, 2);
    assert.equal(result[0].partType, "summary");
    assert.equal(result[1].partType, "tool_result");
});
test("buildStructuredToolResultParts creates tool result with artifact refs", () => {
    const result = buildStructuredToolResultParts({
        messageId: "msg_1",
        createdAt: "2024-01-01T00:00:00.000Z",
        resultText: "Tool output",
        artifactRefs: [
            { artifactId: "art_1", kind: "file", uri: "/src/file.ts", createdAt: "2024-01-01T00:00:00.000Z" },
            { artifactId: "art_2", kind: "file", uri: "/src/file2.ts", createdAt: "2024-01-01T00:00:00.000Z" },
        ],
    });
    assert.equal(result.length, 3);
    assert.equal(result[0].partType, "artifact_ref");
    assert.equal(result[1].partType, "artifact_ref");
    assert.equal(result[2].partType, "tool_result");
});
test("buildStructuredToolResultParts omits empty summary", () => {
    const result = buildStructuredToolResultParts({
        messageId: "msg_1",
        createdAt: "2024-01-01T00:00:00.000Z",
        resultText: "Tool output",
        summaryText: null,
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "tool_result");
});
test("buildStructuredToolResultParts omits whitespace-only summary", () => {
    const result = buildStructuredToolResultParts({
        messageId: "msg_1",
        createdAt: "2024-01-01T00:00:00.000Z",
        resultText: "Tool output",
        summaryText: "   ",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "tool_result");
});
test("buildRetryRecordParts creates retry record part", () => {
    const result = buildRetryRecordParts({
        messageId: "msg_1",
        createdAt: "2024-01-01T00:00:00.000Z",
        attempt: 1,
        errorCode: "TOOL_TIMEOUT",
        source: "tool-execution",
        retryDelayMs: 1000,
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "retry_record");
    const content = JSON.parse(result[0].contentJson);
    assert.equal(content.attempt, 1);
    assert.equal(content.errorCode, "TOOL_TIMEOUT");
    assert.equal(content.retryDelayMs, 1000);
});
test("parseMessagePartsJson parses valid JSON array", () => {
    const parts = [
        {
            partId: "msg_1:part:1",
            messageId: "msg_1",
            partType: "text",
            sequence: 1,
            contentJson: '{"text":"hello"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
    ];
    const result = parseMessagePartsJson(JSON.stringify(parts));
    assert.equal(result.length, 1);
    assert.equal(result[0].partType, "text");
});
test("parseMessagePartsJson sorts by sequence", () => {
    const parts = [
        {
            partId: "msg_1:part:2",
            messageId: "msg_1",
            partType: "text",
            sequence: 2,
            contentJson: '{"text":"second"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
            partId: "msg_1:part:1",
            messageId: "msg_1",
            partType: "text",
            sequence: 1,
            contentJson: '{"text":"first"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
    ];
    const result = parseMessagePartsJson(JSON.stringify(parts));
    assert.equal(result[0].sequence, 1);
    assert.equal(result[1].sequence, 2);
});
test("parseMessagePartsJson returns empty array for null input", () => {
    assert.deepEqual(parseMessagePartsJson(null), []);
});
test("parseMessagePartsJson returns empty array for undefined input", () => {
    assert.deepEqual(parseMessagePartsJson(undefined), []);
});
test("parseMessagePartsJson returns empty array for empty string", () => {
    assert.deepEqual(parseMessagePartsJson(""), []);
});
test("parseMessagePartsJson returns empty array for whitespace string", () => {
    assert.deepEqual(parseMessagePartsJson("   "), []);
});
test("parseMessagePartsJson returns empty array for non-array JSON", () => {
    assert.deepEqual(parseMessagePartsJson('{"key":"value"}'), []);
});
test("parseMessagePartsJson filters invalid parts", () => {
    const parts = [
        {
            partId: "msg_1:part:1",
            messageId: "msg_1",
            partType: "text",
            sequence: 1,
            contentJson: '{"text":"valid"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
            partId: "msg_1:part:2",
            messageId: "msg_1",
            partType: "text",
            sequence: "not a number", // invalid - should be number
            contentJson: '{"text":"invalid - missing required fields"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
    ];
    const result = parseMessagePartsJson(JSON.stringify(parts));
    assert.equal(result.length, 1);
});
test("renderMessagePartContent renders summary part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "summary",
        sequence: 1,
        contentJson: '{"summary":"This is a summary"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("This is a summary"));
});
test("renderMessagePartContent renders tool_result part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "tool_result",
        sequence: 1,
        contentJson: '{"text":"Tool output"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("Tool output"));
});
test("renderMessagePartContent renders artifact_ref part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "artifact_ref",
        sequence: 1,
        contentJson: '{"kind":"file","artifactId":"art_1","uri":"/src/file.ts"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("art_1"));
    assert.ok(result.includes("/src/file.ts"));
});
test("renderMessagePartContent renders retry_record part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "retry_record",
        sequence: 1,
        contentJson: '{"attempt":2,"errorCode":"TIMEOUT","source":"test"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("attempt=2"));
    assert.ok(result.includes("TIMEOUT"));
});
test("renderMessagePartContent renders step_boundary part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "step_boundary",
        sequence: 1,
        contentJson: '{"stepId":"step_1","boundaryKind":"start"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("step_1"));
    assert.ok(result.includes("start"));
});
test("renderMessagePartContent returns empty string for invalid JSON", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "text",
        sequence: 1,
        contentJson: "not json",
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.equal(result, "");
});
test("renderMessagePartsForContext returns content when no parts", () => {
    const result = renderMessagePartsForContext({
        id: "msg_1",
        content: "Original content",
        partsJson: null,
    });
    assert.equal(result.content, "Original content");
    assert.equal(result.trimmed, false);
    assert.equal(result.trimmedPartCount, 0);
});
test("renderMessagePartsForContext trims tool_result parts when requested", () => {
    const parts = [
        {
            partId: "msg_1:part:1",
            messageId: "msg_1",
            partType: "text",
            sequence: 1,
            contentJson: '{"text":"Summary part"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
            partId: "msg_1:part:2",
            messageId: "msg_1",
            partType: "tool_result",
            sequence: 2,
            contentJson: '{"text":"Long tool output"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
    ];
    const result = renderMessagePartsForContext({
        id: "msg_1",
        content: "Original",
        partsJson: JSON.stringify(parts),
    }, { trimToolResultParts: true });
    assert.ok(result.content.includes("Summary part"));
    assert.ok(result.content.includes("trimmed"));
    assert.equal(result.trimmed, true);
    assert.equal(result.trimmedPartCount, 1);
});
test("serializeMessageParts serializes parts to JSON", () => {
    const parts = [
        {
            partId: "msg_1:part:1",
            messageId: "msg_1",
            partType: "text",
            sequence: 1,
            contentJson: '{"text":"hello"}',
            lineageJson: null,
            createdAt: "2024-01-01T00:00:00.000Z",
        },
    ];
    const result = serializeMessageParts(parts);
    const parsed = JSON.parse(result);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].partType, "text");
});
test("ensureMessagePartsJson returns existing partsJson", () => {
    const existingJson = '[{"partId":"msg_1:part:1","messageId":"msg_1","partType":"text","sequence":1,"contentJson":"{}","lineageJson":null,"createdAt":"2024-01-01T00:00:00.000Z"}]';
    const result = ensureMessagePartsJson({
        id: "msg_1",
        messageType: "user",
        content: "test",
        createdAt: "2024-01-01T00:00:00.000Z",
        partsJson: existingJson,
    });
    assert.equal(result, existingJson);
});
test("ensureMessagePartsJson builds parts when partsJson is null", () => {
    const result = ensureMessagePartsJson({
        id: "msg_1",
        messageType: "user",
        content: "test content",
        createdAt: "2024-01-01T00:00:00.000Z",
        partsJson: null,
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].partType, "text");
});
test("renderMessagePartContent renders retry_record when attempt is not a number", () => {
    // This test exercises the else branch at line 283 in message-parts.ts
    // where typeof attempt !== "number"
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "retry_record",
        sequence: 1,
        contentJson: '{"attempt":"not-a-number","errorCode":"ERR_NULL"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    // Should not include "attempt=" since attempt is not a number
    assert.ok(result.includes("error=ERR_NULL"));
    assert.ok(!result.includes("attempt="));
});
test("renderMessagePartContent renders command_execution part with cwd", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "command_execution",
        sequence: 1,
        contentJson: '{"commandRef":"cmd_123","status":"success","cwd":"/workspace/project"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("cmd_123"));
    assert.ok(result.includes("success"));
    assert.ok(result.includes("/workspace/project"));
});
test("renderMessagePartContent renders command_execution part without cwd", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "command_execution",
        sequence: 1,
        contentJson: '{"commandRef":"cmd_456","status":"failed"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("cmd_456"));
    assert.ok(result.includes("failed"));
    assert.ok(!result.includes("cwd="));
});
test("renderMessagePartContent renders mcp_call part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "mcp_call",
        sequence: 1,
        contentJson: '{"serverName":"filesystem","toolName":"read_file","status":"completed"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("filesystem"));
    assert.ok(result.includes("read_file"));
    assert.ok(result.includes("completed"));
});
test("renderMessagePartContent renders mcp_call part with missing fields", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "mcp_call",
        sequence: 1,
        contentJson: '{"status":"error"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("unknown"));
    assert.ok(result.includes("error"));
});
test("renderMessagePartContent renders decision_prompt part", () => {
    const part = {
        partId: "msg_1:part:1",
        messageId: "msg_1",
        partType: "decision_prompt",
        sequence: 1,
        contentJson: '{"prompt":"Should I proceed?","reason":"User asked to continue"}',
        lineageJson: null,
        createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = renderMessagePartContent(part);
    assert.ok(result.includes("Should I proceed"));
});
//# sourceMappingURL=message-parts.test.js.map