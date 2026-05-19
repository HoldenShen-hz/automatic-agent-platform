/**
 * Model Response Contract Unit Tests
 *
 * Tests the model response creation and validation logic.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createModelResponse } from "../../../../src/platform/contracts/model-response/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("model-response: createModelResponse generates valid response", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-3-5-sonnet",
        content: "This is the response content",
        finishReason: "stop",
        usage: {
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300,
        },
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.requestId, "req_123");
    assert.equal(response.model, "claude-3-5-sonnet");
    assert.equal(response.content, "This is the response content");
    assert.equal(response.finishReason, "stop");
    assert.deepEqual(response.usage, { inputTokens: 100, outputTokens: 200, totalTokens: 300 });
    assert.equal(response.tenantId, null);
    assert.equal(response.taskId, null);
    assert.ok(response.responseId.startsWith("modelresp_"));
    assert.ok(response.createdAt.length > 0);
});
test("model-response: createModelResponse throws when requestId is empty", () => {
    assert.throws(() => createModelResponse({
        requestId: "",
        model: "claude-3-5-sonnet",
        content: "Response content",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("model-response: createModelResponse throws when requestId is whitespace", () => {
    assert.throws(() => createModelResponse({
        requestId: "  \t",
        model: "claude-3-5-sonnet",
        content: "Response content",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("model-response: createModelResponse throws when model is empty", () => {
    assert.throws(() => createModelResponse({
        requestId: "req_123",
        model: "",
        content: "Response content",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("model-response: createModelResponse throws when content is empty", () => {
    assert.throws(() => createModelResponse({
        requestId: "req_123",
        model: "claude-3-5-sonnet",
        content: "",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("model-response: createModelResponse accepts all finish reason values", () => {
    const reasons = [
        "stop",
        "length",
        "content_filter",
        "tool_use",
        null,
    ];
    for (const reason of reasons) {
        const response = createModelResponse({
            requestId: "req_123",
            model: "claude-3-5-sonnet",
            content: "Response content",
            finishReason: reason,
            usage: null,
            tenantId: null,
            taskId: null,
        });
        assert.equal(response.finishReason, reason);
    }
});
test("model-response: createModelResponse accepts optional usage", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-3-5-sonnet",
        content: "Response content",
        finishReason: "stop",
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.usage, null);
});
test("model-response: createModelResponse accepts custom responseId and createdAt", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-3-5-sonnet",
        content: "Response content",
        finishReason: "stop",
        usage: null,
        tenantId: "tenant_abc",
        taskId: "task_456",
        responseId: "custom_response",
        createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(response.responseId, "custom_response");
    assert.equal(response.createdAt, "2026-01-01T00:00:00.000Z");
    assert.equal(response.tenantId, "tenant_abc");
    assert.equal(response.taskId, "task_456");
});
//# sourceMappingURL=model-response.test.js.map