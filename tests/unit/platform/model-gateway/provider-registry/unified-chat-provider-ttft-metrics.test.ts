import assert from "node:assert/strict";
import test from "node:test";

import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";
import { UnifiedChatProvider } from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

test("UnifiedChatProvider does not record total latency as TTFT for non-streaming completions", async () => {
  runtimeMetricsRegistry.reset();
  const provider = new UnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  (provider as any).openai = {
    createChatCompletion: async () => ({
      id: "chatcmpl-test",
      content: "ok",
      refusal: null,
      finishReason: "stop",
      toolCalls: [],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
      model: "gpt-4o",
      rawResponse: {},
    }),
    dispose: () => {},
  };

  await provider.createChatCompletion({
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 64,
    traceId: "ttft-metrics-test",
    tenantId: "tenant-test",
    costTag: "metrics-test",
  });

  assert.equal(runtimeMetricsRegistry.getHistograms("llm_ttfb_seconds").length, 0);
  assert.equal(runtimeMetricsRegistry.getHistograms("llm_total_seconds").length, 1);

  provider.dispose();
  runtimeMetricsRegistry.reset();
});
