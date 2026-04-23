import assert from "node:assert/strict";
import test from "node:test";
test("ChatMessage structure is correct", () => {
    const message = {
        role: "user",
        content: "Hello, world!",
    };
    assert.equal(message.role, "user");
    assert.equal(message.content, "Hello, world!");
});
test("ChatMessage role accepts all valid values", () => {
    const roles = ["system", "user", "assistant"];
    assert.equal(roles.length, 3);
});
test("ChatTool structure is correct", () => {
    const tool = {
        type: "function",
        name: "read_file",
        description: "Read a file from the filesystem",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string" },
            },
            required: ["path"],
        },
    };
    assert.equal(tool.type, "function");
    assert.equal(tool.name, "read_file");
});
test("ChatTool allows minimal definition", () => {
    const tool = {
        type: "function",
        name: "minimal_tool",
        parameters: {},
    };
    assert.equal(tool.description, undefined);
});
test("ChatCompletionUsage structure is correct", () => {
    const usage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
    };
    assert.equal(usage.promptTokens, 100);
    assert.equal(usage.totalTokens, 150);
});
test("ChatCompletionResult structure is correct", () => {
    const result = {
        id: "chatcmpl_123",
        content: "Hello! How can I help you?",
        refusal: null,
        reasoningContent: null,
        finishReason: "stop",
        stopSequence: null,
        toolCalls: [],
        usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
        },
        model: "claude-3-5-sonnet",
        provider: "anthropic",
    };
    assert.equal(result.content, "Hello! How can I help you?");
    assert.equal(result.finishReason, "stop");
});
test("ChatCompletionResult allows tool calls", () => {
    const result = {
        id: "chatcmpl_456",
        content: "",
        refusal: null,
        reasoningContent: null,
        finishReason: "tool_calls",
        stopSequence: null,
        toolCalls: [
            {
                id: "call_abc",
                type: "function",
                function: { name: "read_file", arguments: '{"path":"/tmp/test.txt"}' },
            },
        ],
        usage: {
            promptTokens: 50,
            completionTokens: 100,
            totalTokens: 150,
        },
        model: "gpt-4o",
        provider: "openai",
    };
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0]?.function.name, "read_file");
});
test("ChatCompletionResult allows reasoning content", () => {
    const result = {
        id: "chatcmpl_reasoning",
        content: "Let me think about this...",
        refusal: null,
        reasoningContent: "I need to consider the implications...",
        finishReason: "stop",
        stopSequence: null,
        toolCalls: [],
        usage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
        },
        model: "claude-4-sonnet",
        provider: "anthropic",
    };
    assert.equal(result.reasoningContent, "I need to consider the implications...");
});
test("ChatCompletionRequest structure is correct", () => {
    const request = {
        model: "claude-3-5-sonnet",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello!" },
        ],
        system: "You are a helpful assistant.",
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
        stream: false,
        tools: [],
        toolChoice: "auto",
    };
    assert.equal(request.model, "claude-3-5-sonnet");
    assert.equal(request.maxTokens, 4096);
});
test("ChatCompletionRequest allows minimal definition", () => {
    const request = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 1024,
    };
    assert.equal(request.system, undefined);
    assert.equal(request.temperature, undefined);
});
test("ChatProviderType accepts all valid values", () => {
    const types = ["anthropic", "openai", "minimax"];
    assert.equal(types.length, 3);
});
test("UnifiedProviderConfig structure is correct", () => {
    const config = {
        anthropic: {
            apiKey: "sk-ant-...",
            baseUrl: "https://api.anthropic.com",
        },
        openai: {
            apiKey: "sk-...",
            baseUrl: "https://api.openai.com",
            organization: "org_123",
        },
        minimax: {
            apiKey: "minimax_...",
        },
    };
    assert.equal(config.anthropic?.baseUrl, "https://api.anthropic.com");
    assert.equal(config.openai?.organization, "org_123");
});
test("UnifiedProviderConfig allows partial providers", () => {
    const config = {
        anthropic: {
            apiKey: "sk-ant-...",
        },
    };
    assert.equal(config.openai, undefined);
    assert.equal(config.minimax, undefined);
});
//# sourceMappingURL=unified-chat-provider-types.test.js.map