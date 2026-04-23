/**
 * Integration Test: Unified Chat Provider
 *
 * Verifies unified chat provider multi-provider support and lifecycle.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { UnifiedChatProvider } from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

test("UnifiedChatProvider: initializes with single provider", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);

  provider.dispose();
});

test("UnifiedChatProvider: initializes with multiple providers", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-anthropic-key" },
    openai: { apiKey: "test-openai-key" },
    minimax: { apiKey: "test-minimax-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);
  assert.equal(provider.hasProvider("minimax"), true);

  provider.dispose();
});

test("UnifiedChatProvider: dispose clears all providers", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
    openai: { apiKey: "test-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);

  provider.dispose();

  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
});

test("UnifiedChatProvider: hasProvider returns false for non-configured provider", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
  });

  // openai is a valid provider type but not configured
  assert.equal(provider.hasProvider("openai"), false);

  provider.dispose();
});

test("UnifiedChatProvider: double dispose is safe", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
  });

  provider.dispose();
  provider.dispose(); // Should not throw

  assert.equal(provider.hasProvider("anthropic"), false);
});

test("UnifiedChatProvider: empty initialization is valid", () => {
  const provider = new UnifiedChatProvider({});

  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);

  provider.dispose();
});
