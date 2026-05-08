import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIChatService } from "../../../../../../src/platform/model-gateway/provider-registry/openai/openai-chat-service.js";

test("OpenAIChatService preserves the last non-null streaming finish reason", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(
        'data: {"id":"chunk-1","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}],"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}\n\n',
      ));
      controller.enqueue(encoder.encode(
        'data: {"id":"chunk-2","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":"length"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\n',
      ));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const service = new OpenAIChatService({
    apiKey: "test-key",
    fetchImpl: async () => new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
  });

  const seen: Array<{ finishReason: string; isFinal: boolean; content: string | null }> = [];
  await service.createStreamingChatCompletion(
    {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
    },
    (chunk, isFinal) => {
      seen.push({
        finishReason: chunk.finishReason,
        isFinal,
        content: chunk.content,
      });
    },
  );

  assert.deepEqual(seen, [
    {
      finishReason: "length",
      isFinal: true,
      content: "Hello world",
    },
  ]);
});
