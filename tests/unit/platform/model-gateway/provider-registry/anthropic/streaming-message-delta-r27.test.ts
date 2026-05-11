import assert from "node:assert/strict";
import test from "node:test";

import {
  AnthropicChatService,
  type AnthropicChatCompletionRequest,
} from "../../../../../../src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.js";

const FAKE_API_KEY = "test-api-key-anthropic";
const FAKE_MODEL = "claude-sonnet-4-20251120";

test("Anthropic streaming preserves stop_reason and usage from message_delta (R27-10)", async () => {
  const chunks = [
    {
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "text_delta",
        text: "Hello from Claude",
      },
    },
    {
      type: "message_delta",
      delta: {
        stop_reason: "max_tokens",
      },
      usage: {
        input_tokens: 17,
        output_tokens: 29,
      },
    },
  ];

  const mockCredentialPool = {
    releaseCredential: () => {},
    markSuccess: () => {},
    markFailure: () => {},
    selectCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
      apiKey: FAKE_API_KEY,
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

  const service = new AnthropicChatService({
    apiKey: FAKE_API_KEY,
    fetchImpl: mockFetch,
    credentialPool: mockCredentialPool as unknown as import("../../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js").ProviderCredentialPool,
  });

  const request: AnthropicChatCompletionRequest = {
    model: FAKE_MODEL,
    messages: [{ role: "user", content: "Say hello" }],
    max_tokens: 64,
    stream: true,
  };

  let finalChunk: {
    content: string;
    stopReason: string;
    usage: { input_tokens: number; output_tokens: number };
  } | null = null;

  await service.createStreamingChatCompletion(request, (chunk, isFinal) => {
    if (isFinal) {
      finalChunk = chunk;
    }
  });

  assert.ok(finalChunk !== null, "Should emit a final stream chunk");
  assert.equal(finalChunk.content, "Hello from Claude");
  assert.equal(finalChunk.stopReason, "max_tokens");
  assert.deepEqual(finalChunk.usage, {
    input_tokens: 17,
    output_tokens: 29,
  });
});
