import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  UnifiedChatProvider,
  type ChatCompletionRequest,
} from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

function createRequest(model: string): ChatCompletionRequest {
  return {
    model,
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
    traceId: "test-trace",
    tenantId: "test-tenant",
    costTag: "test",
  };
}

test("UnifiedChatProvider marks the final MiniMax streaming callback as isFinal", async () => {
  const provider = new UnifiedChatProvider({ minimax: { apiKey: "test-minimax-key" } });
  const minimaxService = (provider as unknown as {
    minimax: {
      createStreamingChatCompletion: (
        request: unknown,
        onChunk: (chunk: {
          id: string;
          content: string;
          reasoningContent: string | null;
          finishReason: string;
          usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          model: string;
        }) => void,
      ) => Promise<void>;
    };
  }).minimax;

  const stub = mock.method(minimaxService, "createStreamingChatCompletion", async (_request, onChunk) => {
    onChunk({
      id: "chunk-1",
      content: "partial",
      reasoningContent: null,
      finishReason: "",
      usage: { total_tokens: 5 },
      model: "MiniMax-M2.7",
    });
    onChunk({
      id: "chunk-2",
      content: "complete",
      reasoningContent: null,
      finishReason: "stop",
      usage: { total_tokens: 9 },
      model: "MiniMax-M2.7",
    });
  });

  const seen: boolean[] = [];
  try {
    await provider.createStreamingChatCompletion(createRequest("MiniMax-M2.7"), (_chunk, isFinal) => {
      seen.push(isFinal);
    });
  } finally {
    stub.mock.restore();
  }

  assert.deepEqual(seen, [false, true]);
});
