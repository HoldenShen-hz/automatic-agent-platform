/**
 * Model Call Provider Tests
 *
 * Tests for ModelCallProviderService - covers provider configuration,
 * hasAnyProvider branches, and error handling.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ModelCallProviderService,
  resetModelCallProvider,
  getModelCallProvider,
  initializeModelCallProvider,
  type ModelCallProviderConfig,
  type LlmModelCallRequest,
} from "../../../../../src/platform/five-plane-execution/execution-engine/model-call-provider.js";

test("ModelCallProviderService hasAnthropic returns false when not configured", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.hasAnthropic(), false);
});

test("ModelCallProviderService hasOpenAI returns false when not configured", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.hasOpenAI(), false);
});

test("ModelCallProviderService hasMinimax returns false when not configured", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.hasMinimax(), false);
});

test("ModelCallProviderService hasAnyProvider returns false when no providers configured", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.hasAnyProvider(), false);
});

test("ModelCallProviderService getDefaultModel returns MiniMax-M2.7 by default", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.getDefaultModel(), "MiniMax-M2.7");
});

test("ModelCallProviderService getDefaultModel returns configured default", () => {
  const config: ModelCallProviderConfig = { defaultModel: "claude-3-5-sonnet" };
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.getDefaultModel(), "claude-3-5-sonnet");
});

test("ModelCallProviderService dispose marks provider as disposed", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  assert.equal(provider.hasAnthropic(), false);
  provider.dispose();
  // After dispose, hasAnthropic returns false due to disposed check
  assert.equal(provider.hasAnthropic(), false);
});

test("ModelCallProviderService dispose can only be called once", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  provider.dispose();
  // Second dispose should be no-op (no error thrown)
  provider.dispose();
});

test("ModelCallProviderService createCompletion throws when no provider configured", async () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  const request: LlmModelCallRequest = {
    model: "test-model",
    messages: [],
    maxTokens: 100,
  };

  await assert.rejects(
    async () => provider.createCompletion(request),
    (error: unknown) => {
      if (error instanceof Error && error.message.includes("No model provider configured")) {
        return true;
      }
      return false;
    },
  );
});

test("ModelCallProviderService createStreamingCompletion throws when no provider configured", async () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  const request: LlmModelCallRequest = {
    model: "test-model",
    messages: [],
    maxTokens: 100,
  };

  const onChunk = () => {};

  await assert.rejects(
    async () => provider.createStreamingCompletion(request, onChunk),
    (error: unknown) => {
      if (error instanceof Error && error.message.includes("No model provider configured")) {
        return true;
      }
      return false;
    },
  );
});

test("ModelCallProviderService createMiddlewareHook returns a hook object", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  const hook = provider.createMiddlewareHook();

  assert.equal(hook.name, "model_call_provider");
  assert.equal(hook.priority, 0);
  assert.equal(typeof hook.run, "function");
});

test("initializeModelCallProvider returns singleton instance", () => {
  resetModelCallProvider();

  const config: ModelCallProviderConfig = {};
  const provider1 = initializeModelCallProvider(config);
  const provider2 = initializeModelCallProvider(config);

  assert.strictEqual(provider1, provider2);

  resetModelCallProvider();
});

test("getModelCallProvider returns null when not initialized", () => {
  resetModelCallProvider();

  assert.equal(getModelCallProvider(), null);
});

test("getModelCallProvider returns instance after initialization", () => {
  resetModelCallProvider();

  const config: ModelCallProviderConfig = {};
  initializeModelCallProvider(config);

  assert.ok(getModelCallProvider() !== null);

  resetModelCallProvider();
});

test("ModelCallProviderService accepts callRateLimit in config", () => {
  const config: ModelCallProviderConfig = {
    callRateLimit: {
      maxCalls: 100,
      windowMs: 1000,
    },
  };

  const provider = new ModelCallProviderService(config);

  assert.equal(provider.hasAnyProvider(), false);
});

test("resetModelCallProvider clears the singleton", () => {
  resetModelCallProvider();

  const config: ModelCallProviderConfig = {};
  initializeModelCallProvider(config);

  assert.ok(getModelCallProvider() !== null);

  resetModelCallProvider();

  assert.equal(getModelCallProvider(), null);
});

test("ModelCallProviderService hasAnthropic returns false when disposed", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  provider.dispose();

  assert.equal(provider.hasAnthropic(), false);
});

test("ModelCallProviderService hasOpenAI returns false when disposed", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  provider.dispose();

  assert.equal(provider.hasOpenAI(), false);
});

test("ModelCallProviderService hasMinimax returns false when disposed", () => {
  const config: ModelCallProviderConfig = {};
  const provider = new ModelCallProviderService(config);

  provider.dispose();

  assert.equal(provider.hasMinimax(), false);
});
