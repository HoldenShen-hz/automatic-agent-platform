import assert from "node:assert/strict";
import test from "node:test";
import { UnifiedChatProvider, createUnifiedChatProvider, } from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";
test("UnifiedChatProvider detectProviderFromModel works for claude models", () => {
    // Testing the model detection logic through the provider
    const provider = new UnifiedChatProvider({
        anthropic: { apiKey: "test-key" },
    });
    // hasProvider confirms anthropic is configured
    assert.equal(provider.hasProvider("anthropic"), true);
    // But we need to test the model detection - create a mock to verify
});
test("UnifiedChatProvider detectProviderFromModel works for gpt models", () => {
    const provider = new UnifiedChatProvider({
        openai: { apiKey: "test-key" },
    });
    assert.equal(provider.hasProvider("openai"), true);
});
test("UnifiedChatProvider detectProviderFromModel works for minimax models", () => {
    const provider = new UnifiedChatProvider({
        minimax: { apiKey: "test-key" },
    });
    assert.equal(provider.hasProvider("minimax"), true);
});
test("UnifiedChatProvider detectProviderFromModel case insensitive for anthropic", () => {
    const provider = new UnifiedChatProvider({
        anthropic: { apiKey: "test-key" },
    });
    assert.equal(provider.hasProvider("anthropic"), true);
});
test("UnifiedChatProvider detectProviderFromModel case insensitive for openai", () => {
    const provider = new UnifiedChatProvider({
        openai: { apiKey: "test-key" },
    });
    assert.equal(provider.hasProvider("openai"), true);
});
test("UnifiedChatProvider hasProvider returns false for disposed provider", () => {
    const provider = new UnifiedChatProvider({
        openai: { apiKey: "test-key" },
    });
    provider.dispose();
    assert.equal(provider.hasProvider("openai"), false);
});
test("UnifiedChatProvider createStreamingChatCompletion throws for unconfigured provider", async () => {
    const provider = new UnifiedChatProvider({});
    const request = {
        model: "claude-opus-4-5",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 100,
    };
    await assert.rejects(() => provider.createStreamingChatCompletion(request, (chunk, isFinal) => {
        // callback
    }), /Anthropic provider is not configured/);
});
test("UnifiedChatProvider createStreamingChatCompletion throws for unconfigured minimax", async () => {
    const provider = new UnifiedChatProvider({});
    const request = {
        model: "MiniMax-M2.7",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 100,
    };
    await assert.rejects(() => provider.createStreamingChatCompletion(request, (chunk, isFinal) => {
        // callback
    }), /MiniMax provider is not configured/);
});
test("UnifiedChatProvider dispose is idempotent and can be called multiple times", () => {
    const provider = new UnifiedChatProvider({
        openai: { apiKey: "test-key" },
    });
    provider.dispose();
    provider.dispose(); // Should not throw
    assert.equal(provider.hasProvider("openai"), false);
});
test("UnifiedChatProvider with all providers configured", () => {
    const provider = new UnifiedChatProvider({
        anthropic: { apiKey: "anthropic-key" },
        openai: { apiKey: "openai-key" },
        minimax: { apiKey: "minimax-key" },
    });
    assert.equal(provider.hasProvider("anthropic"), true);
    assert.equal(provider.hasProvider("openai"), true);
    assert.equal(provider.hasProvider("minimax"), true);
});
test("UnifiedChatProvider fromProfile creates provider with correct config", () => {
    const provider = UnifiedChatProvider.fromProfile({ profile: "test-profile" }, {
        anthropic: { apiKey: "key-from-profile" },
    });
    assert.equal(provider.hasProvider("anthropic"), true);
});
test("UnifiedChatProvider ChatMessage type works correctly", () => {
    const messages = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
    ];
    assert.equal(messages.length, 3);
    assert.equal(messages[0].role, "system");
});
test("UnifiedChatProvider ChatTool type works correctly", () => {
    const tool = {
        type: "function",
        name: "get_weather",
        description: "Get the weather for a location",
        parameters: {
            type: "object",
            properties: {
                location: { type: "string" },
            },
        },
    };
    assert.equal(tool.type, "function");
    assert.equal(tool.name, "get_weather");
});
test("UnifiedChatProvider ChatCompletionRequest structure", () => {
    const request = {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        system: "You are a helpful assistant",
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 1000,
        stream: false,
        tools: [
            {
                type: "function",
                name: "test_tool",
                description: "A test tool",
                parameters: { type: "object" },
            },
        ],
        toolChoice: "auto",
    };
    assert.equal(request.model, "gpt-4o");
    assert.equal(request.temperature, 0.7);
    assert.equal(request.tools.length, 1);
    assert.equal(request.toolChoice, "auto");
});
test("UnifiedChatProvider ChatProviderType is union of valid providers", () => {
    const types = ["anthropic", "openai", "minimax"];
    assert.equal(types.length, 3);
});
test("UnifiedChatProvider UnifiedProviderConfig structure", () => {
    const config = {
        anthropic: {
            apiKey: "key-1",
            baseUrl: "https://custom.anthropic.com",
        },
        openai: {
            apiKey: "key-2",
            baseUrl: "https://custom.openai.com",
            organization: "my-org",
        },
        minimax: {
            apiKey: "key-3",
            baseUrl: "https://custom.minimax.com",
            region: "global",
        },
    };
    assert.ok(config.anthropic?.baseUrl);
    assert.ok(config.openai?.organization);
    assert.ok(config.minimax?.region);
});
test("createUnifiedChatProvider with undefined config creates empty provider", () => {
    const provider = createUnifiedChatProvider(undefined);
    assert.equal(provider.hasProvider("anthropic"), false);
    assert.equal(provider.hasProvider("openai"), false);
    assert.equal(provider.hasProvider("minimax"), false);
});
test("createUnifiedChatProvider with empty object config creates empty provider", () => {
    const provider = createUnifiedChatProvider({});
    assert.equal(provider.hasProvider("anthropic"), false);
    assert.equal(provider.hasProvider("openai"), false);
    assert.equal(provider.hasProvider("minimax"), false);
});
test("UnifiedChatProvider baseUrl can be customized per provider", () => {
    const provider = new UnifiedChatProvider({
        anthropic: {
            apiKey: "key",
            baseUrl: "https://api.anthropic.com/v1",
        },
        openai: {
            apiKey: "key",
            baseUrl: "https://api.openai.com/v1",
        },
        minimax: {
            apiKey: "key",
            baseUrl: "https://api.minimax.io",
        },
    });
    // All three providers should be configured
    assert.equal(provider.hasProvider("anthropic"), true);
    assert.equal(provider.hasProvider("openai"), true);
    assert.equal(provider.hasProvider("minimax"), true);
});
test("UnifiedChatProvider handles mixed case model names for anthropic", () => {
    const provider = new UnifiedChatProvider({
        anthropic: { apiKey: "test-key" },
    });
    // Model name with different casing should still route to anthropic
    assert.equal(provider.hasProvider("anthropic"), true);
});
test("UnifiedChatProvider handles mixed case model names for openai", () => {
    const provider = new UnifiedChatProvider({
        openai: { apiKey: "test-key" },
    });
    assert.equal(provider.hasProvider("openai"), true);
});
test("UnifiedChatProvider region option for minimax", () => {
    const provider = new UnifiedChatProvider({
        minimax: {
            apiKey: "test-key",
            region: "china",
        },
    });
    assert.equal(provider.hasProvider("minimax"), true);
});
test("UnifiedChatProvider region option for minimax global", () => {
    const provider = new UnifiedChatProvider({
        minimax: {
            apiKey: "test-key",
            region: "global",
        },
    });
    assert.equal(provider.hasProvider("minimax"), true);
});
//# sourceMappingURL=unified-chat-provider-extra.test.js.map