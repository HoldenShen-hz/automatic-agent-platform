import assert from "node:assert/strict";
import test from "node:test";

import {
  OpenAIChatService,
  type OpenAIChatCompletionRequest,
} from "../../../../../../../src/platform/model-gateway/provider-registry/openai/openai-chat-service.js";

const FAKE_API_KEY = "test-api-key-openai";
const FAKE_MODEL = "gpt-4o";

test("OpenAI streaming takes final finish_reason from last chunk with non-null value (R27-03)", async () => {
  // Simulate SSE chunks where first chunk has finish_reason: null, subsequent
  // chunks have content, and the final chunk has finish_reason: "length".
  // The bug was: first chunk's finish_reason (null) was used instead of last.
  const chunks = [
    // Chunk 0: finish_reason is null on first chunk (the bug - using this one)
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "" },
          finish_reason: null,
        },
      ],
    },
    // Chunk 1: content chunk with null finish_reason
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        {
          index: 0,
          delta: { content: "Hello" },
          finish_reason: null,
        },
      ],
    },
    // Chunk 2: another content chunk
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        {
          index: 0,
          delta: { content: " world" },
          finish_reason: null,
        },
      ],
    },
    // Final chunk: finish_reason = "length" (max_tokens reached)
    // This is the correct one to use
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "length",
        },
      ],
    },
  ];

  const mockCredentialPool = {
    acquireCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
    }),
    releaseCredential: () => {},
    selectCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
      selectedCredential: { apiKey: FAKE_API_KEY },
    }),
  };

  let chunkIndex = 0;
  const mockFetch = async () => {
    const stream = new ReadableStream({
      start(controller) {
        // Send all chunks as SSE
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: {
        getReader: () => stream.getReader(),
      },
    } as unknown as Response;
  };

  const service = new OpenAIChatService({
    apiKey: FAKE_API_KEY,
    fetchImpl: mockFetch,
    credentialPool: mockCredentialPool as unknown as import("../../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js").ProviderCredentialPool,
  });

  const request: OpenAIChatCompletionRequest = {
    model: FAKE_MODEL,
    messages: [{ role: "user", content: "Say hello" }],
    stream: true,
  };

  let finalChunk: { finishReason: string } | null = null;
  await service.createStreamingChatCompletion(request, (chunk) => {
    finalChunk = chunk;
  });

  // The fix: final finish_reason should be "length" (from last non-null chunk),
  // NOT "stop" (the default initial value) and NOT the null from first chunk.
  assert.ok(finalChunk !== null, "Should have received at least one chunk");
  assert.equal(
    finalChunk!.finishReason,
    "length",
    `Expected finish_reason 'length' from last non-null chunk, got '${finalChunk!.finishReason}'`
  );
});

test("OpenAI streaming preserves content_filter finish_reason", async () => {
  const chunks = [
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        { index: 0, delta: { content: "" }, finish_reason: null },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        { index: 0, delta: { content: "filtered" }, finish_reason: null },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        { index: 0, delta: {}, finish_reason: "content_filter" },
      ],
    },
  ];

  const mockCredentialPool = {
    acquireCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
    }),
    releaseCredential: () => {},
    selectCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
      selectedCredential: { apiKey: FAKE_API_KEY },
    }),
  };

  const mockFetch = async () => {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: {
        getReader: () => stream.getReader(),
      },
    } as unknown as Response;
  };

  const service = new OpenAIChatService({
    apiKey: FAKE_API_KEY,
    fetchImpl: mockFetch,
    credentialPool: mockCredentialPool as unknown as import("../../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js").ProviderCredentialPool,
  });

  const request: OpenAIChatCompletionRequest = {
    model: FAKE_MODEL,
    messages: [{ role: "user", content: "Trigger filter" }],
    stream: true,
  };

  let finalChunk: { finishReason: string } | null = null;
  await service.createStreamingChatCompletion(request, (chunk) => {
    finalChunk = chunk;
  });

  assert.ok(finalChunk !== null);
  assert.equal(
    finalChunk!.finishReason,
    "content_filter",
    `Expected 'content_filter', got '${finalChunk!.finishReason}'`
  );
});

test("OpenAI streaming preserves tool_calls finish_reason", async () => {
  const chunks = [
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        { index: 0, delta: { role: "assistant" }, finish_reason: null },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_abc", type: "function", function: { name: "get_weather", arguments: "{" } }] },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_abc", type: "function", function: { name: "get_weather", arguments: "}" } }] },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: FAKE_MODEL,
      choices: [
        { index: 0, delta: {}, finish_reason: "tool_calls" },
      ],
    },
  ];

  const mockCredentialPool = {
    acquireCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
    }),
    releaseCredential: () => {},
    selectCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
      selectedCredential: { apiKey: FAKE_API_KEY },
    }),
  };

  const mockFetch = async () => {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: {
        getReader: () => stream.getReader(),
      },
    } as unknown as Response;
  };

  const service = new OpenAIChatService({
    apiKey: FAKE_API_KEY,
    fetchImpl: mockFetch,
    credentialPool: mockCredentialPool as unknown as import("../../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js").ProviderCredentialPool,
  });

  const request: OpenAIChatCompletionRequest = {
    model: FAKE_MODEL,
    messages: [{ role: "user", content: "Use a tool" }],
    stream: true,
  };

  let finalChunk: { finishReason: string } | null = null;
  await service.createStreamingChatCompletion(request, (chunk) => {
    finalChunk = chunk;
  });

  assert.ok(finalChunk !== null);
  assert.equal(
    finalChunk!.finishReason,
    "tool_calls",
    `Expected 'tool_calls', got '${finalChunk!.finishReason}'`
  );
});