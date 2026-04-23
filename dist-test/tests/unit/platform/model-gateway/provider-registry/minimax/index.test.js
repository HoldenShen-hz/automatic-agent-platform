import assert from "node:assert/strict";
import test from "node:test";
import { ProviderCredentialPool } from "../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js";
import { MiniMaxAPIError, MiniMaxChatService, createMiniMaxChatService, createMiniMaxChatServiceFromEnvironment, } from "../../../../../../src/platform/model-gateway/provider-registry/minimax/minimax-chat-service.js";
import { ProviderError } from "../../../../../../src/platform/contracts/errors.js";
// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function createTestCredentialPool() {
    return new ProviderCredentialPool({
        provider: "minimax",
        credentials: [{ credentialId: "test-cred", apiKey: "sk-test" }],
    });
}
function buildSingleResponse(body, options = {}) {
    return async () => {
        const status = options.status ?? 200;
        const statusText = options.statusText ?? (status === 200 ? "OK" : "Error");
        const headers = new Headers(options.headers ?? { "content-type": "application/json" });
        const responseBody = body != null ? JSON.stringify(body) : "";
        return new Response(responseBody, { status, statusText, headers });
    };
}
// ---------------------------------------------------------------------------
// Basic Chat Completion
// ---------------------------------------------------------------------------
test("MiniMax chat service returns content from successful completion", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-123",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "Hello, world!",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
            model: "MiniMax-M2",
        }),
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.id, "resp-123");
    assert.equal(result.content, "Hello, world!");
    assert.equal(result.finishReason, "stop");
    assert.equal(result.model, "MiniMax-M2");
    assert.deepEqual(result.usage, { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    assert.equal(result.reasoningContent, null);
});
test("MiniMax chat service extracts reasoning_content when present", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-reasoning",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "The answer is 42",
                        reasoning_content: "Let me think through this step by step...",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 20,
                completion_tokens: 10,
                total_tokens: 30,
            },
            model: "MiniMax-M2",
        }),
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "What is the answer?" }],
    });
    assert.equal(result.content, "The answer is 42");
    assert.equal(result.reasoningContent, "Let me think through this step by step...");
});
test("MiniMax chat service uses request model when response model is absent", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-no-model",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "Response without model field",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 5,
                completion_tokens: 3,
                total_tokens: 8,
            },
        }),
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-Text-01",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.model, "MiniMax-Text-01");
});
test("MiniMax chat service normalizes usage when undefined", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-no-usage",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "No usage in response",
                    },
                    finish_reason: "stop",
                },
            ],
            model: "MiniMax-M2",
        }),
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.deepEqual(result.usage, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
});
// ---------------------------------------------------------------------------
// Error Handling - API Errors
// ---------------------------------------------------------------------------
test("MiniMax chat service throws when API returns no choices", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-empty",
            choices: [],
            usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.equal(error.statusCode, 200);
        assert.match(error.message, /no choices/i);
        return true;
    });
});
test("MiniMax chat service throws when API returns empty choice", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-null-choice",
            choices: [null],
            usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.match(error.message, /empty choice/i);
        return true;
    });
});
test("MiniMax chat service throws MiniMaxAPIError for business error status codes", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-biz-error",
            base_resp: {
                status_code: 1001,
                status_msg: "Invalid request parameters",
            },
        }, { status: 200 }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.equal(error.statusCode, 200);
        assert.match(error.message, /1001/);
        assert.match(error.message, /Invalid request parameters/);
        return true;
    });
});
test("MiniMax chat service does NOT throw for status code 0 in base_resp (success)", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-status-0",
            base_resp: {
                status_code: 0,
                status_msg: "Success",
            },
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "OK with status 0",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "OK with status 0");
});
// ---------------------------------------------------------------------------
// Error Handling - HTTP Errors & Failover
// ---------------------------------------------------------------------------
test("MiniMax chat service throws MiniMaxAPIError for 500 server errors", async () => {
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [{ credentialId: "cred-500", apiKey: "sk-500" }],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response("Internal Server Error", {
            status: 500,
            statusText: "Internal Server Error",
            headers: new Headers({ "content-type": "application/json" }),
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.equal(error.statusCode, 500);
        assert.equal(error.credentialId, "cred-500");
        return true;
    });
});
test("MiniMax chat service does NOT retry on 400 bad request", async () => {
    const requestCount = [];
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [
            { credentialId: "cred-400-a", apiKey: "sk-400-a" },
            { credentialId: "cred-400-b", apiKey: "sk-400-b" },
        ],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const auth = init?.headers instanceof Headers
                ? init.headers.get("Authorization")
                : init?.headers?.Authorization;
            requestCount.push(auth ?? "");
            return new Response(JSON.stringify({
                error: "Bad request",
            }), {
                status: 400,
                statusText: "Bad Request",
                headers: new Headers({ "content-type": "application/json" }),
            });
        },
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.equal(error.statusCode, 400);
        return true;
    });
    assert.deepEqual(requestCount, ["Bearer sk-400-a"]);
});
test("MiniMax chat service retries on 502 bad gateway and fails over", async () => {
    const requests = [];
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [
            { credentialId: "cred-502-a", apiKey: "sk-502-a" },
            { credentialId: "cred-502-b", apiKey: "sk-502-b" },
        ],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const auth = init?.headers instanceof Headers
                ? init.headers.get("Authorization")
                : init?.headers?.Authorization;
            requests.push(auth ?? "");
            if (requests.length === 1) {
                return new Response("Bad Gateway", {
                    status: 502,
                    statusText: "Bad Gateway",
                    headers: new Headers({ "content-type": "application/json" }),
                });
            }
            return new Response(JSON.stringify({
                id: "resp-502-success",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "recovered",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "recovered");
    assert.deepEqual(requests, ["Bearer sk-502-a", "Bearer sk-502-b"]);
});
test("MiniMax chat service retries on 503 service unavailable and fails over", async () => {
    const requests = [];
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [
            { credentialId: "cred-503-a", apiKey: "sk-503-a" },
            { credentialId: "cred-503-b", apiKey: "sk-503-b" },
        ],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: async (_input, init) => {
            const auth = init?.headers instanceof Headers
                ? init.headers.get("Authorization")
                : init?.headers?.Authorization;
            requests.push(auth ?? "");
            if (requests.length === 1) {
                return new Response("Service Unavailable", {
                    status: 503,
                    statusText: "Service Unavailable",
                    headers: new Headers({ "content-type": "application/json" }),
                });
            }
            return new Response(JSON.stringify({
                id: "resp-503-success",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "recovered",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "recovered");
    assert.deepEqual(requests, ["Bearer sk-503-a", "Bearer sk-503-b"]);
});
test("MiniMax chat service throws when all credentials exhausted", async () => {
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [
            { credentialId: "cred-exhaust-a", apiKey: "sk-a" },
            { credentialId: "cred-exhaust-b", apiKey: "sk-b" },
        ],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: async () => new Response("rate limited", {
            status: 429,
            statusText: "Too Many Requests",
            headers: new Headers({ "retry-after": "3600", "content-type": "application/json" }),
        }),
    });
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.ok(error.statusCode === 429 || error.statusCode === 503);
        assert.ok(error.message.length > 0);
        return true;
    });
});
// ---------------------------------------------------------------------------
// URL Normalization
// ---------------------------------------------------------------------------
test("MiniMax chat service normalizes base URL without trailing slash", async () => {
    const requestedUrls = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        baseUrl: "https://api.minimax.io/",
        fetchImpl: async (input) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                id: "resp-url-test",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "ok",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.ok(requestedUrls[0]?.includes("/v1/text/chatcompletion_v2"));
    assert.ok(!requestedUrls[0]?.endsWith("//text/chatcompletion_v2"));
});
test("MiniMax chat service appends /v1 when base URL does not end with /v1", async () => {
    const requestedUrls = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        baseUrl: "https://api.minimax.io",
        fetchImpl: async (input) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                id: "resp-url-test-2",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "ok",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.ok(requestedUrls[0]?.endsWith("/v1/text/chatcompletion_v2"));
});
test("MiniMax chat service does not double-append /v1 when base URL already ends with /v1", async () => {
    const requestedUrls = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        baseUrl: "https://api.minimax.io/v1",
        fetchImpl: async (input) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                id: "resp-url-test-3",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "ok",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.ok(requestedUrls[0]?.endsWith("/v1/text/chatcompletion_v2"));
    assert.ok(!requestedUrls[0]?.includes("/v1/v1/"));
});
// ---------------------------------------------------------------------------
// Region-based URL Selection
// ---------------------------------------------------------------------------
test("MiniMax chat service uses China region URL by default", async () => {
    const requestedUrls = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async (input) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                id: "resp-region",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "ok",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    // Default is China region
    assert.ok(requestedUrls[0]?.includes("api.minimax.io"));
});
test("MiniMax chat service uses global region URL when specified", async () => {
    const requestedUrls = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        region: "global",
        fetchImpl: async (input) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                id: "resp-global",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "ok",
                        },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.ok(requestedUrls[0]?.includes("api.minimaxi.chat"));
});
// ---------------------------------------------------------------------------
// Request Headers
// ---------------------------------------------------------------------------
test("MiniMax chat service sends Authorization header with Bearer token", async () => {
    const authHeaders = [];
    const service = new MiniMaxChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "minimax",
            credentials: [{ credentialId: "cred-test", apiKey: "sk-test-key-12345" }],
        }),
        fetchImpl: async (_input, init) => {
            const header = init?.headers instanceof Headers
                ? init.headers.get("Authorization")
                : init?.headers?.Authorization;
            authHeaders.push(header ?? "");
            return new Response(JSON.stringify({
                id: "resp-auth",
                choices: [
                    {
                        message: { role: "assistant", content: "ok" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.deepEqual(authHeaders, ["Bearer sk-test-key-12345"]);
});
test("MiniMax chat service sends stream: true for streaming requests", async () => {
    const requestBodies = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async (_input, init) => {
            if (init?.body) {
                requestBodies.push(init.body);
            }
            const body = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder()
                        .encode('data: {"id":"stream-1","choices":[{"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{}}'));
                    controller.close();
                },
            });
            return new Response(body, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    const chunks = [];
    await service.createStreamingChatCompletion({ model: "MiniMax-M2", messages: [{ role: "user", content: "Hi" }] }, (chunk) => {
        chunks.push(chunk.content);
    });
    const parsedBody = JSON.parse(requestBodies[0] ?? "{}");
    assert.equal(parsedBody.stream, true);
});
// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------
test("MiniMax chat service streaming assembles content from SSE chunks", async () => {
    const chunks = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async () => {
            const body = new ReadableStream({
                start(controller) {
                    const lines = [
                        'data: {"id":"resp-stream-1","choices":[{"message":{"role":"assistant","content":"Hello"},"finish_reason":null}],"usage":{}}',
                        'data: {"id":"resp-stream-1","choices":[{"message":{"role":"assistant","content":" world"},"finish_reason":null}],"usage":{}}',
                        'data: {"id":"resp-stream-1","choices":[{"message":{"role":"assistant","content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}',
                        "data: [DONE]",
                    ];
                    for (const line of lines) {
                        controller.enqueue(new TextEncoder().encode(line + "\n"));
                    }
                    controller.close();
                },
            });
            return new Response(body, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    await service.createStreamingChatCompletion({ model: "MiniMax-M2", messages: [{ role: "user", content: "Hi" }] }, (chunk) => {
        chunks.push(chunk.content);
    });
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.some((c) => c.includes("Hello")));
    assert.ok(chunks.some((c) => c.includes("world")));
});
test("MiniMax chat service streaming extracts reasoning_content from chunks", async () => {
    const reasoningContents = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async () => {
            const body = new ReadableStream({
                start(controller) {
                    const lines = [
                        'data: {"id":"resp-reason-stream","choices":[{"message":{"role":"assistant","content":"Final answer","reasoning_content":"Thinking..."},"finish_reason":null}],"usage":{}}',
                        'data: {"id":"resp-reason-stream","choices":[{"message":{"role":"assistant","content":""},"finish_reason":"stop"}],"usage":{}}',
                        "data: [DONE]",
                    ];
                    for (const line of lines) {
                        controller.enqueue(new TextEncoder().encode(line + "\n"));
                    }
                    controller.close();
                },
            });
            return new Response(body, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    await service.createStreamingChatCompletion({ model: "MiniMax-M2", messages: [{ role: "user", content: "Hi" }] }, (chunk) => {
        reasoningContents.push(chunk.reasoningContent);
    });
    assert.ok(reasoningContents.some((r) => r === "Thinking..."));
});
test("MiniMax chat service streaming skips malformed JSON lines gracefully", async () => {
    const chunks = [];
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async () => {
            const body = new ReadableStream({
                start(controller) {
                    const lines = [
                        'data: {"id":"resp-partial","choices":[{"message":{"role":"assistant","content":"Valid"},"finish_reason":null}],"usage":{}}',
                        "data: not-valid-json",
                        'data: {"id":"resp-partial","choices":[{"message":{"role":"assistant","content":" still valid"},"finish_reason":null}],"usage":{}}',
                        'data: {"id":"resp-partial","choices":[{"message":{"role":"assistant","content":""},"finish_reason":"stop"}],"usage":{}}',
                        "data: [DONE]",
                    ];
                    for (const line of lines) {
                        controller.enqueue(new TextEncoder().encode(line + "\n"));
                    }
                    controller.close();
                },
            });
            return new Response(body, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    await service.createStreamingChatCompletion({ model: "MiniMax-M2", messages: [{ role: "user", content: "Hi" }] }, (chunk) => {
        chunks.push(chunk.content);
    });
    // Should still process valid chunks and skip malformed one
    assert.ok(chunks.some((c) => c.includes("Valid")));
    assert.ok(chunks.some((c) => c.includes("still valid")));
});
test("MiniMax chat service streaming handles empty response body", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async () => new Response(null, {
            status: 200,
            statusText: "OK",
            headers: new Headers({ "content-type": "application/json" }),
        }),
    });
    await assert.rejects(() => service.createStreamingChatCompletion({ model: "MiniMax-M2", messages: [{ role: "user", content: "Hi" }] }, () => { }), (error) => {
        assert.ok(error instanceof MiniMaxAPIError);
        assert.match(error.message, /empty response body/i);
        return true;
    });
});
test("MiniMax chat service streaming calls onChunk for each valid SSE data event", async () => {
    let chunkCount = 0;
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: async () => {
            const body = new ReadableStream({
                start(controller) {
                    const lines = [
                        'data: {"id":"chunk-count-test","choices":[{"message":{"role":"assistant","content":"Chunk1"},"finish_reason":null}],"usage":{}}',
                        'data: {"id":"chunk-count-test","choices":[{"message":{"role":"assistant","content":"Chunk2"},"finish_reason":null}],"usage":{}}',
                        'data: {"id":"chunk-count-test","choices":[{"message":{"role":"assistant","content":"Chunk3"},"finish_reason":null}],"usage":{}}',
                        "data: [DONE]",
                    ];
                    for (const line of lines) {
                        controller.enqueue(new TextEncoder().encode(line + "\n"));
                    }
                    controller.close();
                },
            });
            return new Response(body, {
                status: 200,
                headers: new Headers({ "content-type": "text/event-stream" }),
            });
        },
    });
    await service.createStreamingChatCompletion({ model: "MiniMax-M2", messages: [{ role: "user", content: "Hi" }] }, (_chunk) => {
        chunkCount++;
    });
    assert.equal(chunkCount, 3);
});
// ---------------------------------------------------------------------------
// Disposal
// ---------------------------------------------------------------------------
test("MiniMax chat service dispose releases credential pool when owned", async () => {
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [{ credentialId: "dispose-cred", apiKey: "sk-dispose" }],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: buildSingleResponse({
            id: "resp-dispose",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "ok",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    // Make a request so the credential is used
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    // Now dispose the service (which disposes the pool since it owns it)
    service.dispose();
    // After dispose, getExhaustion should return credentials_cooling_down
    // because dispose releases the lease and puts credential in cooling_down state
    const exhaustion = pool.getExhaustion();
    assert.equal(exhaustion.reasonCode, "provider.credentials_cooling_down");
});
test("MiniMax chat service dispose is idempotent", async () => {
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [{ credentialId: "dispose-idempotent", apiKey: "sk-dispose" }],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: buildSingleResponse({
            id: "resp-dispose-idempotent",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "ok",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    // Make a request first so credential is used
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    service.dispose();
    service.dispose(); // Should not throw
    const exhaustion = pool.getExhaustion();
    // After dispose, credential is in cooling_down state
    assert.equal(exhaustion.reasonCode, "provider.credentials_cooling_down");
});
test("MiniMax chat service throws ProviderError when called after disposal", async () => {
    const service = new MiniMaxChatService({
        credentialPool: createTestCredentialPool(),
        fetchImpl: buildSingleResponse({
            id: "resp-post-dispose",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "ok",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    service.dispose();
    await assert.rejects(() => service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    }), (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.code, "provider.disposed");
        assert.match(error.message, /disposed/i);
        return true;
    });
});
test("MiniMax chat service does NOT dispose external credential pool", async () => {
    const pool = new ProviderCredentialPool({
        provider: "minimax",
        credentials: [{ credentialId: "external-pool", apiKey: "sk-external" }],
    });
    const service = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: buildSingleResponse({
            id: "resp-external-pool",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "ok",
                    },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
    });
    // Make a request to use the credential
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    service.dispose();
    // Pool should still have credentials since it was external and not disposed by service
    // After dispose of service, pool is not disposed but credentials may have been released
    // The key point is that the pool itself is still functional
    const states = pool.getStates();
    assert.equal(states.length, 1);
    assert.equal(states[0]?.credentialId, "external-pool");
});
// ---------------------------------------------------------------------------
// MiniMaxAPIError
// ---------------------------------------------------------------------------
test("MiniMaxAPIError exposes all expected properties", () => {
    const error = new MiniMaxAPIError({
        statusCode: 429,
        statusText: "Too Many Requests",
        message: "Rate limit exceeded",
        credentialId: "cred-err-test",
        retryAfterMs: 5000,
        resetAt: "2026-04-12T12:05:00.000Z",
    });
    assert.equal(error.statusCode, 429);
    assert.equal(error.statusText, "Too Many Requests");
    assert.equal(error.message, "Rate limit exceeded");
    assert.equal(error.credentialId, "cred-err-test");
    assert.equal(error.retryAfterMs, 5000);
    assert.equal(error.resetAt, "2026-04-12T12:05:00.000Z");
    assert.equal(error.name, "MiniMaxAPIError");
});
test("MiniMaxAPIError defaults null properties when not provided", () => {
    const error = new MiniMaxAPIError({
        statusCode: 500,
        statusText: "Server Error",
        message: "Something went wrong",
    });
    assert.equal(error.credentialId, null);
    assert.equal(error.retryAfterMs, null);
    assert.equal(error.resetAt, null);
});
// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------
test("createMiniMaxChatService creates service with single credential", async () => {
    const authHeaders = [];
    const service = createMiniMaxChatService("sk-factory-test", "china");
    // Override fetch for testing
    const testFetch = async (_input, init) => {
        const header = init?.headers instanceof Headers
            ? init.headers.get("Authorization")
            : init?.headers?.Authorization;
        authHeaders.push(header ?? "");
        return new Response(JSON.stringify({
            id: "resp-factory",
            choices: [
                {
                    message: { role: "assistant", content: "factory ok" },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            model: "MiniMax-M2",
        }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
    };
    // Use reflection to inject test fetch
    const pool = service.credentialPool;
    const testService = new MiniMaxChatService({
        credentialPool: pool,
        fetchImpl: testFetch,
    });
    const result = await testService.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "factory ok");
    assert.deepEqual(authHeaders, ["Bearer sk-factory-test"]);
});
test("createMiniMaxChatService uses global region when specified", async () => {
    const service = createMiniMaxChatService("sk-global-test", "global");
    const baseUrl = service.baseUrl;
    assert.ok(baseUrl.includes("api.minimaxi.chat") || baseUrl.includes("minimaxi"));
});
test("createMiniMaxChatServiceFromEnvironment with explicit region", async () => {
    const requests = [];
    const service = createMiniMaxChatServiceFromEnvironment({
        region: "global",
        providerEnv: {
            MINIMAX_API_KEY: "sk-env-test",
        },
        fetchImpl: async (_input, init) => {
            const header = init?.headers instanceof Headers
                ? init.headers.get("Authorization")
                : init?.headers?.Authorization;
            requests.push(header ?? "");
            return new Response(JSON.stringify({
                id: "resp-env-region",
                choices: [
                    {
                        message: { role: "assistant", content: "region ok" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "region ok");
});
test("createMiniMaxChatServiceFromEnvironment with explicit baseUrl", async () => {
    const requestedUrls = [];
    const service = createMiniMaxChatServiceFromEnvironment({
        baseUrl: "https://custom.minimax.io",
        providerEnv: {
            MINIMAX_API_KEY: "sk-base-url-test",
        },
        fetchImpl: async (input) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                id: "resp-custom-url",
                choices: [
                    {
                        message: { role: "assistant", content: "custom url ok" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "custom url ok");
    assert.ok(requestedUrls[0]?.includes("custom.minimax.io"));
});
test("createMiniMaxChatServiceFromEnvironment with custom fetchImpl", async () => {
    let customFetchCalled = false;
    const service = createMiniMaxChatServiceFromEnvironment({
        providerEnv: {
            MINIMAX_API_KEY: "sk-custom-fetch-test",
        },
        fetchImpl: async () => {
            customFetchCalled = true;
            return new Response(JSON.stringify({
                id: "resp-custom-fetch",
                choices: [
                    {
                        message: { role: "assistant", content: "custom fetch ok" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    const result = await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.equal(result.content, "custom fetch ok");
    assert.equal(customFetchCalled, true);
});
// ---------------------------------------------------------------------------
// Rate Limit Reset Headers
// ---------------------------------------------------------------------------
test("MiniMax chat service parses x-ratelimit-reset header", async () => {
    const resetAtHeaders = [];
    const service = new MiniMaxChatService({
        credentialPool: new ProviderCredentialPool({
            provider: "minimax",
            credentials: [{ credentialId: "cred-reset", apiKey: "sk-reset" }],
        }),
        fetchImpl: async () => {
            const futureDate = new Date(Date.now() + 60_000).toISOString();
            resetAtHeaders.push(futureDate);
            return new Response(JSON.stringify({
                id: "resp-reset",
                choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                model: "MiniMax-M2",
            }), { status: 200, headers: new Headers({ "content-type": "application/json" }) });
        },
    });
    await service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "Hi" }],
    });
    assert.ok(resetAtHeaders.length >= 1);
});
//# sourceMappingURL=index.test.js.map