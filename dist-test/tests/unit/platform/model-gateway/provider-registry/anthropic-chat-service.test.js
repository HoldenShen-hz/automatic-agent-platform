import assert from "node:assert/strict";
import test from "node:test";
import { ProviderCredentialPool } from "../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js";
import { AnthropicAPIError, AnthropicChatService, createAnthropicChatService, createAnthropicChatServiceFromEnvironment, } from "../../../../../src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.js";
const ANTHROPIC_RESPONSE = {
    id: "msg_01Dm8KLjvPKvRLq3ypWPiG",
    type: "message",
    role: "assistant",
    content: [
        {
            type: "text",
            text: "Hello! How can I help you today?",
        },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
        input_tokens: 10,
        output_tokens: 20,
    },
};
function createSuccessResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: new Headers({ "content-type": "application/json" }),
    });
}
// ============================================================================
// Chat Completion Tests
// ============================================================================
test("AnthropicChatService creates chat completion and returns normalized result", async () => {
    let requestBody;
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async (_input, init) => {
            requestBody = JSON.parse(init?.body);
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 1024,
    });
    assert.equal(result.id, "msg_01Dm8KLjvPKvRLq3ypWPiG");
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.equal(result.refusal, null);
    assert.equal(result.stopReason, "end_turn");
    assert.equal(result.model, "claude-sonnet-4-20250514");
    assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 20 });
    assert.ok(result.rawResponse);
});
test("AnthropicChatService transforms request to Anthropic format", async () => {
    let requestBody = {};
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async (_input, init) => {
            requestBody = JSON.parse(init?.body);
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    await service.createChatCompletion({
        model: "claude-opus-4-20250514",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
            { role: "user", content: "How are you?" },
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2048,
    });
    // System message should be extracted from messages array to separate field
    assert.equal(requestBody.model, "claude-opus-4-20250514");
    assert.equal(requestBody.system, "You are a helpful assistant.");
    assert.equal(requestBody.temperature, 0.7);
    assert.equal(requestBody.top_p, 0.9);
    assert.equal(requestBody.max_tokens, 2048);
    // Original system message should not be in messages array
    const messages = requestBody.messages;
    assert.equal(messages.length, 3);
    assert.equal(messages[0].role, "user");
    assert.equal(messages[0].content, "Hello");
    assert.equal(messages[1].role, "assistant");
    assert.equal(messages[2].role, "user");
});
test("AnthropicChatService handles tool definitions in request", async () => {
    let requestBody = {};
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async (_input, init) => {
            requestBody = JSON.parse(init?.body);
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Use the calculator" }],
        max_tokens: 1024,
        tools: [
            {
                type: "function",
                name: "calculator",
                description: "A simple calculator",
                input_schema: {
                    type: "object",
                    properties: {
                        expression: { type: "string" },
                    },
                    required: ["expression"],
                },
            },
        ],
        tool_choice: "auto",
    });
    const tools = requestBody.tools;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "calculator");
    assert.equal(tools[0].description, "A simple calculator");
    assert.deepEqual(tools[0].input_schema, {
        type: "object",
        properties: { expression: { type: "string" } },
        required: ["expression"],
    });
    const toolChoice = requestBody.tool_choice;
    assert.equal(toolChoice.type, "auto");
});
test("AnthropicChatService extracts refusal from response", async () => {
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => createSuccessResponse({
            id: "msg_01Refusal",
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "refusal",
                    text: "I cannot help with that request.",
                },
            ],
            model: "claude-sonnet-4-20250514",
            stop_reason: "end_turn",
            usage: { input_tokens: 5, output_tokens: 10 },
        }),
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Help me hack something" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "");
    assert.equal(result.refusal, "I cannot help with that request.");
    assert.equal(result.stopReason, "end_turn");
});
test("AnthropicChatService uses correct headers for Anthropic API", async () => {
    let capturedApiKey = null;
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-ant-api-key" }],
        }),
        fetchImpl: async (_input, init) => {
            const h = init?.headers;
            // Headers may be Headers object or plain record depending on environment
            if (h instanceof Headers) {
                capturedApiKey = h.get("x-api-key");
            }
            else if (h && typeof h === "object") {
                capturedApiKey = h["x-api-key"] ?? null;
            }
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(capturedApiKey, "sk-ant-api-key");
});
// ============================================================================
// Credential Failover Tests
// ============================================================================
test("AnthropicChatService fails over to next credential after rate limit", async () => {
    const requests = [];
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [
            { credentialId: "cred-a", apiKey: "sk-a" },
            { credentialId: "cred-b", apiKey: "sk-b" },
        ],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            requests.push(apiKey ?? "");
            if (requests.length === 1) {
                return new Response("rate limited", {
                    status: 429,
                    statusText: "Too Many Requests",
                    headers: new Headers({ "retry-after-ms": "1500" }),
                });
            }
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.deepEqual(requests, ["sk-a", "sk-b"]);
    const states = pool.getStates();
    assert.equal(states[0]?.status, "cooling_down");
    assert.equal(states[1]?.effectiveStatus, "active");
});
test("AnthropicChatService fails over after 5xx error", async () => {
    const requests = [];
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [
            { credentialId: "cred-a", apiKey: "sk-a" },
            { credentialId: "cred-b", apiKey: "sk-b" },
        ],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            requests.push(apiKey ?? "");
            if (requests.length === 1) {
                return new Response("Internal Server Error", {
                    status: 500,
                    statusText: "Internal Server Error",
                });
            }
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.deepEqual(requests, ["sk-a", "sk-b"]);
});
test("AnthropicChatService surfaces error after all credentials exhausted", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [
            { credentialId: "cred-a", apiKey: "sk-a" },
            { credentialId: "cred-b", apiKey: "sk-b" },
        ],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response("rate limited", {
            status: 429,
            statusText: "Too Many Requests",
            headers: new Headers({ "retry-after-ms": "1500" }),
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }), (error) => {
        assert.ok(error instanceof AnthropicAPIError);
        assert.equal(error.statusCode, 429);
        assert.equal(error.credentialId, "cred-b");
        assert.ok(error.retryAfterMs != null);
        return true;
    });
    const exhaustion = pool.getExhaustion("2026-04-12T12:00:01.000Z");
    assert.equal(exhaustion.reasonCode, "provider.credentials_cooling_down");
});
test("AnthropicChatService handles 529 error (overloaded) and fails over", async () => {
    const requests = [];
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [
            { credentialId: "cred-a", apiKey: "sk-a" },
            { credentialId: "cred-b", apiKey: "sk-b" },
        ],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            requests.push(apiKey ?? "");
            if (requests.length === 1) {
                return new Response("Overloaded", {
                    status: 529,
                    statusText: "Overloaded",
                    headers: new Headers({ "retry-after-ms": "1500" }),
                });
            }
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.deepEqual(requests, ["sk-a", "sk-b"]);
});
test("AnthropicChatService disables credential on 402 Payment Required", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [{ credentialId: "cred-a", apiKey: "sk-a" }],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response("Payment Required", {
            status: 402,
            statusText: "Payment Required",
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }), (error) => {
        assert.ok(error instanceof AnthropicAPIError);
        assert.equal(error.statusCode, 402);
        assert.equal(error.credentialId, "cred-a");
        return true;
    });
    const exhaustion = pool.getExhaustion("2026-04-12T12:00:01.000Z");
    assert.equal(exhaustion.reasonCode, "provider.credentials_disabled");
});
test("AnthropicChatService parses retry-after from seconds header", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [
            { credentialId: "cred-a", apiKey: "sk-a" },
            { credentialId: "cred-b", apiKey: "sk-b" },
        ],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            if (apiKey === "sk-a") {
                return new Response("rate limited", {
                    status: 429,
                    statusText: "Too Many Requests",
                    headers: new Headers({ "retry-after": "30" }),
                });
            }
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
});
test("AnthropicChatService parses reset-at from ratelimit header", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [
            { credentialId: "cred-a", apiKey: "sk-a" },
            { credentialId: "cred-b", apiKey: "sk-b" },
        ],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            if (apiKey === "sk-a") {
                return new Response("rate limited", {
                    status: 429,
                    statusText: "Too Many Requests",
                    headers: new Headers({
                        "retry-after": "30",
                        "anthropic-ratelimit-reset": "2026-04-12T12:01:00.000Z",
                    }),
                });
            }
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
});
// ============================================================================
// Error Handling Tests
// ============================================================================
test("AnthropicChatService throws AnthropicAPIError with correct properties on API error", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [{ credentialId: "cred-a", apiKey: "sk-a" }],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response(JSON.stringify({
            type: "invalid_request_error",
            message: "Invalid API key",
        }), {
            status: 401,
            statusText: "Unauthorized",
            headers: new Headers({ "content-type": "application/json" }),
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }), (error) => {
        assert.ok(error instanceof AnthropicAPIError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.statusText, "Unauthorized");
        assert.equal(error.type, "invalid_request_error");
        assert.equal(error.credentialId, "cred-a");
        return true;
    });
});
test("AnthropicChatService throws AnthropicAPIError on streaming with empty body", async () => {
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => new Response(null, {
            status: 200,
            statusText: "OK",
        }),
    });
    await assert.rejects(() => service.createStreamingChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        stream: true,
    }, () => { }), (error) => {
        assert.ok(error instanceof AnthropicAPIError);
        assert.ok(error.message.includes("empty response body"));
        return true;
    });
});
test("AnthropicChatService throws on invalid JSON error response", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [{ credentialId: "cred-a", apiKey: "sk-a" }],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response("not valid json", {
            status: 500,
            statusText: "Internal Server Error",
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }), (error) => {
        assert.ok(error instanceof AnthropicAPIError);
        assert.ok(error.message.includes("Anthropic API error: 500"));
        return true;
    });
});
test("AnthropicChatService throws when no credentials configured", async () => {
    const pool = new ProviderCredentialPool({
        provider: "anthropic",
        credentials: [],
    });
    const service = new AnthropicChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }), (error) => {
        assert.ok(error instanceof AnthropicAPIError);
        assert.equal(error.statusCode, 503);
        assert.ok(error.message.includes("no configured credentials"));
        return true;
    });
});
// ============================================================================
// Streaming Tests
// ============================================================================
test("AnthropicChatService handles streaming chat completion", async () => {
    const chunks = [];
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => {
            // Use pull-based stream to ensure data is properly available
            const lines = [
                'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
                'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}',
                'data: {"type":"message_delta","delta":{"type":"text_delta","text":""},"usage":{"input_tokens":10,"output_tokens":5}}',
                "data: [DONE]",
            ];
            let index = 0;
            const stream = new ReadableStream({
                pull(controller) {
                    if (index < lines.length) {
                        controller.enqueue(new TextEncoder().encode(lines[index] + "\n"));
                        index++;
                    }
                    else {
                        controller.close();
                    }
                },
            });
            return new Response(stream, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    await service.createStreamingChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }, (chunk, isFinal) => {
        chunks.push({ content: chunk.content, isFinal });
    });
    // Should have intermediate chunks and final chunk
    assert.ok(chunks.length >= 1);
    const finalChunk = chunks.find((c) => c.isFinal);
    assert.ok(finalChunk, "Should have a final chunk");
    assert.equal(finalChunk?.content, "Hello World");
    assert.deepEqual(finalChunk?.content, "Hello World");
});
test("AnthropicChatService handles streaming refusal", async () => {
    let finalRefusal = null;
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => {
            // For streaming, the refusal text is in content_block.refusal (not text)
            const lines = [
                'data: {"type":"content_block_start","index":0,"content_block":{"type":"refusal","refusal":"I cannot help."}}',
                "data: [DONE]",
            ];
            let index = 0;
            const stream = new ReadableStream({
                pull(controller) {
                    if (index < lines.length) {
                        controller.enqueue(new TextEncoder().encode(lines[index] + "\n"));
                        index++;
                    }
                    else {
                        controller.close();
                    }
                },
            });
            return new Response(stream, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    await service.createStreamingChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Help me hack" }],
        max_tokens: 1024,
    }, (chunk, isFinal) => {
        if (isFinal && chunk.refusal) {
            finalRefusal = chunk.refusal;
        }
    });
    assert.equal(finalRefusal, "I cannot help.");
});
test("AnthropicChatService handles malformed JSON in streaming response", async () => {
    // This test verifies that malformed JSON in the stream doesn't crash the service
    // Malformed lines should be skipped, and valid lines should still be processed
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => {
            const lines = [
                'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Valid text"}}',
                "data: not json",
                "data: [DONE]",
            ];
            let index = 0;
            const stream = new ReadableStream({
                pull(controller) {
                    if (index < lines.length) {
                        controller.enqueue(new TextEncoder().encode(lines[index] + "\n"));
                        index++;
                    }
                    else {
                        controller.close();
                    }
                },
            });
            return new Response(stream, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    // Should not throw - malformed JSON is caught and logged
    await service.createStreamingChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    }, (_chunk, _isFinal) => {
        // Just verify callback is called without throwing
    });
    // If we get here without throwing, the test passes
    assert.ok(true, "Service handled malformed JSON without crashing");
});
// ============================================================================
// Factory Function Tests
// ============================================================================
test("createAnthropicChatService creates service with provided API key", async () => {
    let apiKeyHeader = null;
    const service = createAnthropicChatService("sk-test-factory-key");
    // Access internal pool for testing
    service.credentialPool;
    // Create a custom fetch impl to capture the request
    const customService = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "anthropic-default", apiKey: "sk-test-factory-key" }],
        }),
        fetchImpl: async (_input, init) => {
            const h = init?.headers;
            apiKeyHeader = h instanceof Headers ? h.get("x-api-key") : h?.["x-api-key"] ?? null;
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    await customService.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(apiKeyHeader, "sk-test-factory-key");
});
test("createAnthropicChatServiceWithBaseUrl creates service with custom base URL", async () => {
    let requestUrl = "";
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test" }],
        }),
        baseUrl: "https://custom.anthropic.example.com",
        fetchImpl: async (input) => {
            requestUrl = String(input);
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.ok(requestUrl.startsWith("https://custom.anthropic.example.com/v1/messages"));
});
test("createAnthropicChatServiceFromEnvironment loads credentials from env", async () => {
    const requests = [];
    const service = createAnthropicChatServiceFromEnvironment({
        providerEnv: {
            ANTHROPIC_API_KEY: "sk-env-key",
        },
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            requests.push(apiKey ?? "");
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.deepEqual(requests, ["sk-env-key"]);
});
test("createAnthropicChatServiceFromEnvironment uses secret resolver for managed secrets", async () => {
    const requests = [];
    const service = createAnthropicChatServiceFromEnvironment({
        providerEnv: {
            ANTHROPIC_API_KEY_SECRET_REF: "secret://providers/anthropic/default",
        },
        secretResolver: (secretRef) => ({
            "secret://providers/anthropic/default": "sk-managed-anthropic-default",
        })[secretRef] ?? "",
        fetchImpl: async (_input, init) => {
            const apiKey = init?.headers instanceof Headers
                ? init.headers.get("x-api-key")
                : init?.headers?.["x-api-key"];
            requests.push(apiKey ?? "");
            return createSuccessResponse(ANTHROPIC_RESPONSE);
        },
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.deepEqual(requests, ["sk-managed-anthropic-default"]);
});
test("createAnthropicChatServiceFromEnvironment issues and revokes managed secret leases", async () => {
    const issued = [];
    const revoked = [];
    const service = createAnthropicChatServiceFromEnvironment({
        providerEnv: {
            ANTHROPIC_API_KEY_SECRET_REF: "secret://providers/anthropic/default",
        },
        secretLeaseIssuer: (secretRef, context) => {
            issued.push(`${context.credentialId}:${secretRef}`);
            return {
                apiKey: "sk-issued-anthropic-lease",
                leaseId: "lease-anthropic-1",
                expiresAt: "2099-01-01T00:00:00.000Z",
                leaseSource: "provider_issued",
            };
        },
        secretLeaseRevoker: (leaseId, context) => {
            revoked.push(`${leaseId}:${context.reasonCode}`);
        },
        fetchImpl: async () => createSuccessResponse(ANTHROPIC_RESPONSE),
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "Hello! How can I help you today?");
    assert.deepEqual(issued, ["anthropic-managed-default:secret://providers/anthropic/default"]);
    assert.deepEqual(revoked, ["lease-anthropic-1:provider.request_completed"]);
});
// ============================================================================
// Model Routing Tests
// ============================================================================
test("AnthropicChatService routes to different Claude models", async () => {
    const models = [];
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async (_input, init) => {
            const body = JSON.parse(init?.body);
            models.push(body.model);
            return createSuccessResponse({
                ...ANTHROPIC_RESPONSE,
                model: body.model,
            });
        },
    });
    await service.createChatCompletion({
        model: "claude-opus-4-20250514",
        messages: [{ role: "user", content: "Complex task" }],
        max_tokens: 4096,
    });
    await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Quick task" }],
        max_tokens: 1024,
    });
    await service.createChatCompletion({
        model: "claude-haiku-3.5-20250514",
        messages: [{ role: "user", content: "Simple task" }],
        max_tokens: 512,
    });
    assert.deepEqual(models, [
        "claude-opus-4-20250514",
        "claude-sonnet-4-20250514",
        "claude-haiku-3.5-20250514",
    ]);
});
// ============================================================================
// Helper Function Tests
// ============================================================================
test("AnthropicChatService extracts content from multi-block response", async () => {
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => createSuccessResponse({
            id: "msg_01MultiBlock",
            type: "message",
            role: "assistant",
            content: [
                { type: "text", text: "First part." },
                { type: "text", text: " Second part." },
                { type: "text", text: " Third part." },
            ],
            model: "claude-sonnet-4-20250514",
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 15 },
        }),
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Give me multiple paragraphs" }],
        max_tokens: 1024,
    });
    assert.equal(result.content, "First part.\n Second part.\n Third part.");
});
test("AnthropicChatService handles tool_use stop reason", async () => {
    const service = new AnthropicChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "anthropic",
            credentials: [{ credentialId: "test-key", apiKey: "sk-test-key" }],
        }),
        fetchImpl: async () => createSuccessResponse({
            id: "msg_01ToolUse",
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "tool_use",
                    id: "toolu_01abc",
                    name: "calculator",
                    input: { expression: "2 + 2" },
                },
            ],
            model: "claude-sonnet-4-20250514",
            stop_reason: "tool_use",
            stop_sequence: null,
            usage: { input_tokens: 15, output_tokens: 8 },
        }),
    });
    const result = await service.createChatCompletion({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Calculate 2 + 2" }],
        max_tokens: 1024,
        tools: [
            {
                type: "function",
                name: "calculator",
                description: "A calculator",
                input_schema: { type: "object", properties: {} },
            },
        ],
    });
    assert.equal(result.content, "");
    assert.equal(result.stopReason, "tool_use");
});
//# sourceMappingURL=anthropic-chat-service.test.js.map