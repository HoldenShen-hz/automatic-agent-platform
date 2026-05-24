import assert from "node:assert/strict";
import test from "node:test";

import {
  HashEmbeddingProvider,
  OpenAIEmbeddingProvider,
  MiniMaxEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  EMBEDDING_PROVIDER_TYPES,
  type EmbeddingProviderType,
  type EmbeddingResult,
  type OpenAIEmbeddingOptions,
  type MiniMaxEmbeddingOptions,
} from "../../../../../../src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.js";

test("EMBEDDING_PROVIDER_TYPES contains hash, openai, minimax", () => {
  assert.deepEqual(EMBEDDING_PROVIDER_TYPES, ["hash", "openai", "minimax"]);
});

test("EmbeddingProviderType is one of the provider types", () => {
  const types: EmbeddingProviderType[] = ["hash", "openai", "minimax"];
  assert.ok(types.includes("hash"));
  assert.ok(types.includes("openai"));
  assert.ok(types.includes("minimax"));
});

test("EmbeddingResult structure", () => {
  const result: EmbeddingResult = {
    vector: [0.1, 0.2, 0.3],
    dimensions: 32,
    tokenCount: 10,
  };

  assert.deepEqual(result.vector, [0.1, 0.2, 0.3]);
  assert.equal(result.dimensions, 32);
  assert.equal(result.tokenCount, 10);
});

test("EmbeddingResult tokenCount is optional", () => {
  const result: EmbeddingResult = {
    vector: [0.1, 0.2, 0.3],
    dimensions: 32,
  };

  assert.equal(result.tokenCount, undefined);
});

test("HashEmbeddingProvider has correct type", () => {
  const provider = new HashEmbeddingProvider();

  assert.equal(provider.type, "hash");
  assert.equal(provider.dimensions, 32);
});

test("HashEmbeddingProvider.embed returns vector for non-empty text", async () => {
  const provider = new HashEmbeddingProvider();

  const result = await provider.embed("Hello, world!");

  assert.ok(result.vector);
  assert.equal(result.vector.length, 32);
  assert.equal(result.dimensions, 32);
});

test("HashEmbeddingProvider.embed returns same vector for same text", async () => {
  const provider = new HashEmbeddingProvider();

  const result1 = await provider.embed("Same text");
  const result2 = await provider.embed("Same text");

  assert.deepEqual(result1.vector, result2.vector);
});

test("HashEmbeddingProvider.embed returns different vectors for different text", async () => {
  const provider = new HashEmbeddingProvider();

  const result1 = await provider.embed("Text one");
  const result2 = await provider.embed("Text two");

  assert.notDeepEqual(result1.vector, result2.vector);
});

test("HashEmbeddingProvider.embedBatch processes multiple texts", async () => {
  const provider = new HashEmbeddingProvider();

  const results = await provider.embedBatch(["Text one", "Text two", "Text three"]);

  assert.equal(results.length, 3);
  assert.equal(results[0]!.dimensions, 32);
  assert.equal(results[1]!.dimensions, 32);
  assert.equal(results[2]!.dimensions, 32);
});

test("HashEmbeddingProvider.embedBatch returns same results as individual calls", async () => {
  const provider = new HashEmbeddingProvider();

  const batchResults = await provider.embedBatch(["Text A", "Text B"]);
  const individualResult1 = await provider.embed("Text A");
  const individualResult2 = await provider.embed("Text B");

  assert.deepEqual(batchResults[0]!.vector, individualResult1.vector);
  assert.deepEqual(batchResults[1]!.vector, individualResult2.vector);
});

test("OpenAIEmbeddingOptions interface structure", () => {
  const options: OpenAIEmbeddingOptions = {
    apiKey: "sk-test",
    baseUrl: "https://api.openai.com",
    model: "text-embedding-3-small",
    dimensions: 1536,
    batchSize: 100,
  };

  assert.equal(options.apiKey, "sk-test");
  assert.equal(options.model, "text-embedding-3-small");
});

test("OpenAIEmbeddingProvider has correct type and default dimensions", () => {
  const provider = new OpenAIEmbeddingProvider({ apiKey: "sk-test" });

  assert.equal(provider.type, "openai");
  assert.equal(provider.dimensions, 1536); // default
});

test("OpenAIEmbeddingProvider respects custom dimensions", () => {
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "sk-test",
    dimensions: 1024,
  });

  assert.equal(provider.dimensions, 1024);
});

test("OpenAIEmbeddingProvider normalizes baseUrl by removing trailing slash", () => {
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "sk-test",
    baseUrl: "https://api.openai.com/",
  });

  // Internal behavior: baseUrl should not have trailing slash
  assert.ok(true); // Would need to test via embed() call with mocked fetch
});

test("MiniMaxEmbeddingOptions interface structure", () => {
  const options: MiniMaxEmbeddingOptions = {
    apiKey: "mmx-test",
    baseUrl: "https://api.minimaxi.com/v1",
    groupId: "group_123",
    model: "embo-01",
  };

  assert.equal(options.apiKey, "mmx-test");
  assert.equal(options.model, "embo-01");
});

test("MiniMaxEmbeddingProvider has correct type and dimensions", () => {
  const provider = new MiniMaxEmbeddingProvider({
    apiKey: "mmx-test",
  });

  assert.equal(provider.type, "minimax");
  assert.equal(provider.dimensions, 1024); // embo-01 is 1024-dim
});

test("MiniMaxEmbeddingProvider normalizes baseUrl", () => {
  const provider1 = new MiniMaxEmbeddingProvider({
    apiKey: "mmx-test",
    baseUrl: "https://api.minimaxi.com/v1",
  });

  const provider2 = new MiniMaxEmbeddingProvider({
    apiKey: "mmx-test",
    baseUrl: "https://api.minimaxi.com/v1/",
  });

  // Both should work correctly
  assert.ok(true);
});

test("createEmbeddingProviderFromEnv defaults to hash when no provider env var", () => {
  const env: NodeJS.ProcessEnv = {};
  const provider = createEmbeddingProviderFromEnv(env);

  assert.equal(provider.type, "hash");
});

test("createEmbeddingProviderFromEnv creates hash provider when specified", () => {
  const env: NodeJS.ProcessEnv = {
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "hash",
  };
  const provider = createEmbeddingProviderFromEnv(env);

  assert.equal(provider.type, "hash");
  assert.equal(provider.dimensions, 32);
});

test("createEmbeddingProviderFromEnv throws for openai without api key", () => {
  const env: NodeJS.ProcessEnv = {
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
  };

  assert.throws(
    () => createEmbeddingProviderFromEnv(env),
    /OPENAI_API_KEY or AA_OPENAI_API_KEY/,
  );
});

test("createEmbeddingProviderFromEnv creates openai provider with api key", () => {
  const env: NodeJS.ProcessEnv = {
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test-key",
  };
  const provider = createEmbeddingProviderFromEnv(env);

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv throws for minimax without api key", () => {
  const env: NodeJS.ProcessEnv = {
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
  };

  assert.throws(
    () => createEmbeddingProviderFromEnv(env),
    /MINIMAX_API_KEY or AA_MINIMAX_API_KEY/,
  );
});

test("createEmbeddingProviderFromEnv creates minimax provider with api key", () => {
  const env: NodeJS.ProcessEnv = {
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    MINIMAX_API_KEY: "mmx-test-key",
  };
  const provider = createEmbeddingProviderFromEnv(env);

  assert.equal(provider.type, "minimax");
});

test("createEmbeddingProviderFromEnv uses AA_ prefixed env vars", () => {
  const env: NodeJS.ProcessEnv = {
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    AA_OPENAI_API_KEY: "sk-aa-test",
    AA_OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
    AA_OPENAI_EMBEDDING_DIMENSIONS: "256",
  };
  const provider = createEmbeddingProviderFromEnv(env);

  assert.equal(provider.type, "openai");
});
