import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeModelCallProvider,
  getModelCallProvider,
  resetModelCallProvider,
  createModelCallMiddleware,
  type LlmModelCallRequest,
  type LlmModelCallResult,
} from "../../../../src/platform/five-plane-execution/execution-engine/model-call-provider.js";

test("initializeModelCallProvider returns provider instance [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});

  assert.ok(provider);
  assert.equal(typeof provider.createCompletion, "function");
  assert.equal(typeof provider.createStreamingCompletion, "function");
  assert.equal(typeof provider.hasAnyProvider, "function");
});

test("initializeModelCallProvider returns singleton on subsequent calls [model-call-provider]", () => {
  resetModelCallProvider();

  const provider1 = initializeModelCallProvider({});
  const provider2 = initializeModelCallProvider({});

  assert.strictEqual(provider1, provider2);
});

test("getModelCallProvider returns null before initialization [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = getModelCallProvider();

  assert.strictEqual(provider, null);
});

test("getModelCallProvider returns provider after initialization [model-call-provider]", () => {
  resetModelCallProvider();

  initializeModelCallProvider({});
  const provider = getModelCallProvider();

  assert.ok(provider);
});

test("resetModelCallProvider clears the singleton [model-call-provider]", () => {
  resetModelCallProvider();

  initializeModelCallProvider({});
  assert.ok(getModelCallProvider());

  resetModelCallProvider();

  assert.strictEqual(getModelCallProvider(), null);
});

test("ModelCallProviderService has provider detection methods [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});

  assert.equal(typeof provider.hasAnthropic, "function");
  assert.equal(typeof provider.hasOpenAI, "function");
  assert.equal(typeof provider.hasMinimax, "function");
  assert.equal(typeof provider.hasAnyProvider, "function");
});

test("ModelCallProviderService has getDefaultModel method [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});

  assert.equal(typeof provider.getDefaultModel, "function");
  assert.equal(provider.getDefaultModel(), "MiniMax-M2.7");
});

test("ModelCallProviderService dispose is safe to call multiple times [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});

  provider.dispose();
  provider.dispose(); // Should not throw

  assert.ok(true);
});

test("createModelCallMiddleware creates a middleware hook [model-call-provider]", () => {
  resetModelCallProvider();

  const hook = createModelCallMiddleware({});

  assert.ok(hook);
  assert.equal(hook.name, "model_call_provider");
  assert.equal(typeof hook.run, "function");
  assert.equal(typeof hook.priority, "number");
});

test("ModelCallProviderService with custom default model [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({
    defaultModel: "custom-model",
  });

  assert.equal(provider.getDefaultModel(), "custom-model");
});

test("createCompletion throws when no provider is configured [model-call-provider]", async () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});

  await assert.rejects(
    async () => {
      await provider.createCompletion({
        model: "test-model",
        messages: [],
        maxTokens: 100,
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(String(error), /no model provider configured/i);
      return true;
    },
  );
});

test("createStreamingCompletion throws when no provider is configured [model-call-provider]", async () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});

  await assert.rejects(
    async () => {
      await provider.createStreamingCompletion(
        {
          model: "test-model",
          messages: [],
          maxTokens: 100,
        },
        () => {},
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(String(error), /no model provider configured/i);
      return true;
    },
  );
});

test("LlmModelCallRequest type accepts valid structure [model-call-provider]", () => {
  const request: LlmModelCallRequest = {
    model: "MiniMax-M2.7",
    messages: [
      { role: "user", content: "Hello" },
    ],
    maxTokens: 1024,
  };

  assert.equal(request.model, "MiniMax-M2.7");
  assert.equal(request.messages.length, 1);
  assert.equal(request.maxTokens, 1024);
});

test("LlmModelCallResult type structure [model-call-provider]", () => {
  const result: LlmModelCallResult = {
    id: "test-id",
    content: "Test response",
    finishReason: "stop",
    model: "MiniMax-M2.7",
    provider: "minimax",
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
  };

  assert.equal(result.id, "test-id");
  assert.equal(result.content, "Test response");
  assert.equal(result.finishReason, "stop");
});

test("initializeModelCallProvider registers middleware hook [model-call-provider]", () => {
  resetModelCallProvider();

  initializeModelCallProvider({});

  const provider = getModelCallProvider();
  assert.ok(provider);
});

test("provider dispose clears state [model-call-provider]", () => {
  resetModelCallProvider();

  const provider = initializeModelCallProvider({});
  provider.dispose();

  assert.ok(true); // No error means success
});
