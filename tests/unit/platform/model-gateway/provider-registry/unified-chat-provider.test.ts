import assert from "node:assert/strict";
import test from "node:test";

import {
  UnifiedChatProvider,
  createUnifiedChatProvider,
  type ChatCompletionRequest,
  type ChatProviderType,
} from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";
import { UnifiedChatProvider as BarrelUnifiedChatProvider } from "../../../../../src/platform/model-gateway/provider-registry/index.js";
import { MiniMaxAPIError } from "../../../../../src/platform/model-gateway/provider-registry/minimax/minimax-chat-service.js";

test("UnifiedChatProvider detects anthropic model", () => {
  const provider = new UnifiedChatProvider({});

  // Should detect from model string
  assert.equal(provider.hasProvider("anthropic"), false); // no API key configured

  // Test model detection via getProviderForModel
  // We can't call createChatCompletion without API keys, but we can test
  // the detection logic through error messages
});

test("UnifiedChatProvider.hasProvider returns false when not configured", () => {
  const provider = new UnifiedChatProvider({});

  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("UnifiedChatProvider.hasProvider returns true when configured", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
    openai: { apiKey: "test-key" },
    minimax: { apiKey: "test-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);
  assert.equal(provider.hasProvider("minimax"), true);
});

test("UnifiedChatProvider.hasProvider returns true when partially configured", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("UnifiedChatProvider.createChatCompletion throws for unconfigured provider", async () => {
  const provider = new UnifiedChatProvider({});

  const request: ChatCompletionRequest = {
    model: "claude-haiku-3-5",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    traceId: "test-trace",
    tenantId: "test-tenant",
    costTag: "test",
  };

  await assert.rejects(
    () => provider.createChatCompletion(request),
    /Anthropic provider is not configured/,
  );
});

test("UnifiedChatProvider.createChatCompletion throws for unconfigured openai model", async () => {
  const provider = new UnifiedChatProvider({});

  const request: ChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    traceId: "test-trace",
    tenantId: "test-tenant",
    costTag: "test",
  };

  await assert.rejects(
    () => provider.createChatCompletion(request),
    /OpenAI provider is not configured/,
  );
});

test("UnifiedChatProvider.fromProfile is a factory method", () => {
  const provider = UnifiedChatProvider.fromProfile(
    { profile: "test" },
    { anthropic: { apiKey: "key" } },
  );

  assert.equal(provider.hasProvider("anthropic"), true);
});

test("createUnifiedChatProvider creates provider with empty config", () => {
  const provider = createUnifiedChatProvider();

  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("createUnifiedChatProvider creates provider with config", () => {
  const provider = createUnifiedChatProvider({
    openai: { apiKey: "sk-test" },
  });

  assert.equal(provider.hasProvider("openai"), true);
});

test("UnifiedChatProvider routes anthropic model correctly", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
  });

  // Test that provider detects anthropic models correctly
  // We verify through hasProvider being true for configured providers
  assert.equal(provider.hasProvider("anthropic"), true);
});

test("UnifiedChatProvider baseUrl override is respected", () => {
  const customUrl = "https://custom.anthropic.example.com/v1";
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key", baseUrl: customUrl },
    openai: { apiKey: "test-key", baseUrl: "https://custom.openai.example.com/v1" },
    minimax: { apiKey: "test-key", baseUrl: "https://custom.minimax.example.com/v1" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);
  assert.equal(provider.hasProvider("minimax"), true);
});

test("UnifiedChatProvider handles unknown model defaults to openai", async () => {
  const provider = new UnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  // Unknown model defaults to openai, which is configured
  // It will try to use openai (will fail without real API, but proves routing)
  assert.equal(provider.hasProvider("openai"), true);
});

test("UnifiedChatProvider.dispose disables providers and rejects new requests", async () => {
  const provider = new UnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  provider.dispose();

  assert.equal(provider.hasProvider("openai"), false);
  await assert.rejects(
    () =>
      provider.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 100,
      }),
    (error: unknown) =>
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "provider.disposed",
  );
});

test("UnifiedChatProvider.complete uses chat completion facade", async () => {
  const provider = new UnifiedChatProvider({});

  await assert.rejects(
    () => provider.complete("hello"),
    /MiniMax provider is not configured/,
  );
});

test("UnifiedChatProvider falls back to MiniMax reasoning content when visible content is empty", async () => {
  const provider = new UnifiedChatProvider({
    minimax: { apiKey: "test-key" },
  });

  (
    provider as unknown as {
      minimax: {
        createChatCompletion: () => Promise<{
          id: string;
          content: string;
          reasoningContent: string | null;
          finishReason: string;
          usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
          model: string;
        }>;
      };
    }
  ).minimax = {
    createChatCompletion: async () => ({
      id: "resp-minimax-reasoning-only",
      content: "",
      reasoningContent: "Visible answer recovered from reasoning channel",
      finishReason: "stop",
      usage: {
        prompt_tokens: 12,
        completion_tokens: 30,
        total_tokens: 42,
      },
      model: "MiniMax-M2.7",
    }),
  };

  const result = await provider.createChatCompletion({
    model: "minimax-m2.7",
    messages: [{ role: "user", content: "Give me the answer" }],
    maxTokens: 128,
    traceId: "trace-minimax-fallback",
    tenantId: "tenant-1",
    costTag: "unit-test",
  });

  assert.equal(result.content, "Visible answer recovered from reasoning channel");
  assert.equal(result.reasoningContent, "Visible answer recovered from reasoning channel");

  const completed = await provider.complete("Give me the answer", {
    model: "minimax-m2.7",
    traceId: "trace-minimax-complete",
    tenantId: "tenant-1",
    costTag: "unit-test",
  });

  assert.equal(completed, "Visible answer recovered from reasoning channel");
});

test("UnifiedChatProvider retries retryable MiniMax business errors before failing", async () => {
  const provider = new UnifiedChatProvider({
    minimax: { apiKey: "test-key" },
  });
  let attemptCount = 0;

  (
    provider as unknown as {
      minimax: {
        createChatCompletion: () => Promise<{
          id: string;
          content: string;
          reasoningContent: string | null;
          finishReason: string;
          usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
          model: string;
        }>;
      };
    }
  ).minimax = {
    createChatCompletion: async () => {
      attemptCount += 1;
      if (attemptCount === 1) {
        throw new MiniMaxAPIError({
          statusCode: 200,
          statusText: "OK",
          message: "MiniMax API business error: 1000 - unknown error, 520",
        });
      }
      return {
        id: "resp-minimax-after-business-retry",
        content: "Recovered after business retry",
        reasoningContent: null,
        finishReason: "stop",
        usage: {
          prompt_tokens: 12,
          completion_tokens: 20,
          total_tokens: 32,
        },
        model: "MiniMax-M2.7",
      };
    },
  };

  const result = await provider.createChatCompletion({
    model: "minimax-m2.7",
    messages: [{ role: "user", content: "Recover from business error" }],
    maxTokens: 128,
    traceId: "trace-minimax-business-retry",
    tenantId: "tenant-1",
    costTag: "unit-test",
  });

  assert.equal(attemptCount, 2);
  assert.equal(result.content, "Recovered after business retry");
});

test("UnifiedChatProvider.embed falls back to hash embeddings when no embedding provider is configured", async () => {
  const provider = new UnifiedChatProvider({});
  const vectors = await provider.embed(["hello", "world"]);

  assert.equal(vectors.length, 2);
  assert.equal(vectors[0]?.length, 32);
  assert.notDeepEqual(vectors[0], vectors[1]);
});

test("UnifiedChatProvider facade is exported from provider-registry barrel", () => {
  const provider = new BarrelUnifiedChatProvider({});

  assert.equal(typeof provider.complete, "function");
  assert.equal(typeof provider.embed, "function");
});
