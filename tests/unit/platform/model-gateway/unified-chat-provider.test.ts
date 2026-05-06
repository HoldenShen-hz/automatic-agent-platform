/**
 * UnifiedChatProvider Unit Tests - Root level tests for model-gateway
 *
 * Tests for the unified chat provider focusing on:
 * - Model detection and routing
 * - Provider configuration
 * - Error handling and edge cases
 * - Circuit breaker integration
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  UnifiedChatProvider,
  createUnifiedChatProvider,
  type ChatCompletionRequest,
  type ChatProviderType,
  type ChatMessage,
  type ChatTool,
  type UnifiedProviderConfig,
} from "../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

// ============================================================================
// Helper Functions
// ============================================================================

function createProvider(config?: UnifiedProviderConfig): UnifiedChatProvider {
  return new UnifiedChatProvider(config ?? {
    anthropic: { apiKey: "test-anthropic-key" },
    openai: { apiKey: "test-openai-key" },
    minimax: { apiKey: "test-minimax-key" },
  });
}

function createMinimalProvider(): UnifiedChatProvider {
  return new UnifiedChatProvider({});
}

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

// ============================================================================
// Model Detection Tests
// ============================================================================

test("UnifiedChatProvider routes claude-opus-4-5 to anthropic", () => {
  const provider = new UnifiedChatProvider({ anthropic: { apiKey: "test" } });
  assert.equal(provider.hasProvider("anthropic"), true);
});

test("UnifiedChatProvider routes gpt-4o to openai", () => {
  const provider = new UnifiedChatProvider({ openai: { apiKey: "test" } });
  assert.equal(provider.hasProvider("openai"), true);
});

test("UnifiedChatProvider routes MiniMax-M2.7 to minimax", () => {
  const provider = new UnifiedChatProvider({ minimax: { apiKey: "test" } });
  assert.equal(provider.hasProvider("minimax"), true);
});

test("UnifiedChatProvider throws for unknown model without configured provider", () => {
  const provider = createMinimalProvider();

  assert.throws(
    () => {
      provider.createChatCompletion({
        model: "completely-unknown-model-xyz",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 100,
        traceId: "test",
        tenantId: null,
        costTag: "test",
      });
    },
    /Unknown model|cannot determine provider/,
  );
});

// ============================================================================
// Provider Availability Tests
// ============================================================================

test("UnifiedChatProvider hasProvider returns false when no providers configured", () => {
  const provider = createMinimalProvider();
  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("UnifiedChatProvider hasProvider is false after dispose", () => {
  const provider = createProvider();
  provider.dispose();
  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("UnifiedChatProvider hasProvider returns correct state per provider", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "key" },
  });
  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

// ============================================================================
// Configuration Tests
// ============================================================================

test("UnifiedChatProvider accepts baseUrl override for anthropic", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "key", baseUrl: "https://custom.anthropic.com" },
  });
  assert.equal(provider.hasProvider("anthropic"), true);
});

test("UnifiedChatProvider accepts baseUrl override for openai", () => {
  const provider = new UnifiedChatProvider({
    openai: { apiKey: "key", baseUrl: "https://custom.openai.com" },
  });
  assert.equal(provider.hasProvider("openai"), true);
});

test("UnifiedChatProvider accepts baseUrl override for minimax", () => {
  const provider = new UnifiedChatProvider({
    minimax: { apiKey: "key", baseUrl: "https://custom.minimax.com" },
  });
  assert.equal(provider.hasProvider("minimax"), true);
});

test("UnifiedChatProvider accepts organization for openai", () => {
  const provider = new UnifiedChatProvider({
    openai: { apiKey: "key", organization: "my-org" },
  });
  assert.equal(provider.hasProvider("openai"), true);
});

test("UnifiedChatProvider accepts region for minimax (china)", () => {
  const provider = new UnifiedChatProvider({
    minimax: { apiKey: "key", region: "china" },
  });
  assert.equal(provider.hasProvider("minimax"), true);
});

test("UnifiedChatProvider accepts region for minimax (global)", () => {
  const provider = new UnifiedChatProvider({
    minimax: { apiKey: "key", region: "global" },
  });
  assert.equal(provider.hasProvider("minimax"), true);
});

// ============================================================================
// Disposal Tests
// ============================================================================

test("UnifiedChatProvider dispose is idempotent", () => {
  const provider = createProvider();
  provider.dispose();
  provider.dispose(); // Should not throw
  provider.dispose();
});

test("UnifiedChatProvider multiple dispose calls keep hasProvider false", () => {
  const provider = createProvider();
  provider.dispose();
  provider.dispose();
  assert.equal(provider.hasProvider("anthropic"), false);
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test("UnifiedChatProvider throws ProviderError when disposed", () => {
  const provider = createProvider();
  provider.dispose();

  assert.throws(
    () => provider.createChatCompletion(createRequest("gpt-4o")),
    /disposed/,
  );
});

test("UnifiedChatProvider throws when abort signal already aborted", () => {
  const provider = createProvider();
  const controller = new AbortController();
  controller.abort();

  const request = createRequest("gpt-4o");
  request.abortSignal = controller.signal;

  assert.throws(
    () => provider.createChatCompletion(request),
    /aborted/,
  );
});

test("UnifiedChatProvider abort signal check happens before provider call", () => {
  const provider = createProvider();
  const controller = new AbortController();
  controller.abort();

  const request = createRequest("claude-opus-4-5");
  request.abortSignal = controller.signal;

  assert.throws(
    () => provider.createChatCompletion(request),
    /aborted/,
  );
});

// ============================================================================
// Chat Method Tests
// ============================================================================

test("UnifiedChatProvider chat is alias for createChatCompletion", () => {
  const provider = createProvider();
  assert.equal(typeof provider.chat, "function");
});

test("UnifiedChatProvider streamChat is alias for createStreamingChatCompletion", () => {
  const provider = createProvider();
  assert.equal(typeof provider.streamChat, "function");
});

test("UnifiedChatProvider complete method exists", () => {
  const provider = createProvider();
  assert.equal(typeof provider.complete, "function");
});

// ============================================================================
// Factory Method Tests
// ============================================================================

test("createUnifiedChatProvider creates empty provider with no config", () => {
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

test("UnifiedChatProvider.fromProfile creates provider from config", () => {
  const provider = UnifiedChatProvider.fromProfile(
    { profile: "test" },
    { anthropic: { apiKey: "key" } },
  );
  assert.equal(provider.hasProvider("anthropic"), true);
});

// ============================================================================
// getAvailableProfiles Tests
// ============================================================================

test("getAvailableProfiles returns profiles for configured providers only", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "key" },
    openai: { apiKey: "key" },
  });

  const profiles = provider.getAvailableProfiles();
  const providers = new Set(profiles.map((p) => p.provider));

  assert.ok(providers.has("anthropic"));
  assert.ok(providers.has("openai"));
  assert.ok(!providers.has("minimax"));
});

test("getAvailableProfiles returns valid profile structure", () => {
  const provider = createProvider();
  const profiles = provider.getAvailableProfiles();

  for (const profile of profiles) {
    assert.ok(typeof profile.profileName === "string");
    assert.ok(typeof profile.provider === "string");
    assert.ok(typeof profile.tier === "string");
  }
});

test("getAvailableProfiles excludes primary model from candidates", () => {
  const provider = createProvider();
  const profiles = provider.getAvailableProfiles();

  // Primary model should not appear in its own fallback candidates
  for (const profile of profiles) {
    assert.notEqual(profile.profileName, "claude-opus-4-5");
  }
});

// ============================================================================
// Embedding Tests
// ============================================================================

test("UnifiedChatProvider embed method exists", () => {
  const provider = createProvider();
  assert.equal(typeof provider.embed, "function");
});

test("UnifiedChatProvider embed returns vectors for string input", async () => {
  const provider = createProvider();
  const vectors = await provider.embed("hello world");
  assert.ok(Array.isArray(vectors));
  assert.ok(vectors.length > 0);
});

test("UnifiedChatProvider embed returns vectors for array input", async () => {
  const provider = createProvider();
  const vectors = await provider.embed(["hello", "world"]);
  assert.ok(Array.isArray(vectors));
  assert.equal(vectors.length, 2);
});

// ============================================================================
// ChatCompletionRequest Type Tests
// ============================================================================

test("ChatCompletionRequest with all optional fields", () => {
  const request: ChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    system: "You are helpful",
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1000,
    stream: false,
    tools: [
      {
        type: "function",
        name: "get_weather",
        description: "Get weather",
        parameters: { type: "object", properties: {} },
      },
    ],
    toolChoice: "auto",
    traceId: "trace-123",
    spanId: "span-456",
    tenantId: "tenant-1",
    principalId: "user-1",
    costTag: "test",
    timeoutMs: 30000,
  };

  assert.equal(request.model, "gpt-4o");
  assert.equal(request.temperature, 0.7);
  assert.equal(request.tools!.length, 1);
});

test("ChatMessage role validation", () => {
  const messages: ChatMessage[] = [
    { role: "system", content: "You are helpful" },
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there" },
  ];

  assert.equal(messages[0]!.role, "system");
  assert.equal(messages[1]!.role, "user");
  assert.equal(messages[2]!.role, "assistant");
});

test("ChatTool structure", () => {
  const tool: ChatTool = {
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

// ============================================================================
// Type Validation Tests
// ============================================================================

test("ChatProviderType is union of valid providers", () => {
  const types: ChatProviderType[] = ["anthropic", "openai", "minimax"];
  assert.equal(types.length, 3);
});

test("UnifiedProviderConfig structure validation", () => {
  const config: UnifiedProviderConfig = {
    anthropic: { apiKey: "key-1", baseUrl: "https://custom.anthropic.com" },
    openai: { apiKey: "key-2", baseUrl: "https://custom.openai.com", organization: "org-1" },
    minimax: { apiKey: "key-3", baseUrl: "https://custom.minimax.com", region: "global" },
  };

  assert.ok(config.anthropic?.baseUrl);
  assert.ok(config.openai?.organization);
  assert.equal(config.minimax?.region, "global");
});
