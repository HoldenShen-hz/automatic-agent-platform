import assert from "node:assert/strict";
import test from "node:test";
import { createModelResponse, } from "../../../../../src/platform/contracts/model-response/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
test("ModelResponse interface accepts all fields", () => {
    const response = {
        responseId: "resp_123",
        requestId: "req_456",
        model: "gpt-5.4",
        content: "Hello world",
        finishReason: "stop",
        usage: {
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
        },
        tenantId: "tenant-1",
        taskId: "task-1",
        createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(response.responseId, "resp_123");
    assert.equal(response.requestId, "req_456");
    assert.equal(response.finishReason, "stop");
    assert.equal(response.usage?.totalTokens, 30);
});
test("createModelResponse builds minimal model response envelope", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Response content here",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.model, "claude-4-opus");
    assert.equal(response.content, "Response content here");
    assert.ok(response.responseId.startsWith("modelresp_"));
    assert.ok(response.createdAt.includes("T"));
});
test("createModelResponse uses provided responseId", () => {
    const response = createModelResponse({
        responseId: "custom-response-id",
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.responseId, "custom-response-id");
});
test("createModelResponse uses provided createdAt timestamp", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
        createdAt: "2026-06-15T12:00:00.000Z",
    });
    assert.equal(response.createdAt, "2026-06-15T12:00:00.000Z");
});
test("createModelResponse accepts all finish reason values", () => {
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
            model: "claude-4-opus",
            content: "Test",
            finishReason: reason,
            usage: null,
            tenantId: null,
            taskId: null,
        });
        assert.equal(response.finishReason, reason);
    }
});
test("createModelResponse accepts usage statistics", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: "stop",
        usage: {
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300,
        },
        tenantId: "tenant-1",
        taskId: "task-1",
    });
    assert.ok(response.usage !== null);
    assert.equal(response.usage?.inputTokens, 100);
    assert.equal(response.usage?.outputTokens, 200);
    assert.equal(response.usage?.totalTokens, 300);
});
test("createModelResponse defaults usage to null", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.usage, null);
});
test("createModelResponse defaults finishReason to null", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.finishReason, null);
});
test("createModelResponse defaults tenantId and taskId to null", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.tenantId, null);
    assert.equal(response.taskId, null);
});
test("createModelResponse accepts explicit tenantId and taskId", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: "tenant_abc",
        taskId: "task_xyz",
    });
    assert.equal(response.tenantId, "tenant_abc");
    assert.equal(response.taskId, "task_xyz");
});
test("createModelResponse throws when requestId is empty", () => {
    assert.throws(() => createModelResponse({
        requestId: "",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("createModelResponse throws when requestId is only whitespace", () => {
    assert.throws(() => createModelResponse({
        requestId: "   ",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("createModelResponse throws when model is empty", () => {
    assert.throws(() => createModelResponse({
        requestId: "req_123",
        model: "",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("createModelResponse throws when model is only whitespace", () => {
    assert.throws(() => createModelResponse({
        requestId: "req_123",
        model: "   ",
        content: "Hello",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("createModelResponse throws when content is empty", () => {
    assert.throws(() => createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("createModelResponse throws when content is only whitespace", () => {
    assert.throws(() => createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "   ",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    }), ValidationError);
});
test("createModelResponse preserves content exactly including whitespace", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "  Hello   World  ",
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.content, "  Hello   World  ");
});
test("createModelResponse handles long content", () => {
    const longContent = "A".repeat(10000);
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: longContent,
        finishReason: null,
        usage: null,
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.content.length, 10000);
});
test("createModelResponse accepts finishReason and usage explicitly", () => {
    const response = createModelResponse({
        requestId: "req_123",
        model: "claude-4-opus",
        content: "Hello",
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        tenantId: null,
        taskId: null,
    });
    assert.equal(response.finishReason, "stop");
    assert.deepEqual(response.usage, { inputTokens: 10, outputTokens: 20, totalTokens: 30 });
});
//# sourceMappingURL=index.test.js.map