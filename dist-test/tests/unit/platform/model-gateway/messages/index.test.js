import assert from "node:assert/strict";
import test from "node:test";
test("RenderMessagePartsOptions structure is correct", () => {
    const options = {
        trimToolResultParts: true,
    };
    assert.equal(options.trimToolResultParts, true);
});
test("RenderedMessageParts structure is correct", () => {
    const rendered = {
        content: "Hello world",
        trimmed: false,
        trimmedPartCount: 0,
    };
    assert.equal(rendered.content, "Hello world");
    assert.equal(rendered.trimmed, false);
});
test("StructuredToolResultPartsInput structure is correct", () => {
    const input = {
        messageId: "msg_1",
        createdAt: "2026-04-14T00:00:00.000Z",
        resultText: "Tool executed successfully",
        summaryText: "Done",
    };
    assert.equal(input.messageId, "msg_1");
    assert.equal(input.resultText, "Tool executed successfully");
});
test("StructuredToolResultPartsInput with artifacts", () => {
    const input = {
        messageId: "msg_1",
        createdAt: "2026-04-14T00:00:00.000Z",
        resultText: "Tool executed",
        artifactRefs: [],
    };
    assert.ok(Array.isArray(input.artifactRefs));
});
test("RetryRecordPartsInput structure is correct", () => {
    const input = {
        messageId: "msg_1",
        createdAt: "2026-04-14T00:00:00.000Z",
        attempt: 1,
        nextAttempt: 2,
        errorCode: "tool.execution_failed",
        source: "dispatcher",
    };
    assert.equal(input.attempt, 1);
    assert.equal(input.nextAttempt, 2);
    assert.equal(input.source, "dispatcher");
});
test("RetryRecordPartsInput without nextAttempt", () => {
    const input = {
        messageId: "msg_1",
        createdAt: "2026-04-14T00:00:00.000Z",
        attempt: 3,
        errorCode: "tool.execution_failed",
        source: "dispatcher",
    };
    assert.equal(input.attempt, 3);
    assert.equal(input.source, "dispatcher");
});
//# sourceMappingURL=index.test.js.map