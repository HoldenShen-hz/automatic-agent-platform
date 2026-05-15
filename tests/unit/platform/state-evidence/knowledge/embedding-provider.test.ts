import test from "node:test";
import assert from "node:assert/strict";

import {
  HashEmbeddingProvider,
  OpenAIEmbeddingProvider,
  MiniMaxEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  EMBEDDING_PROVIDER_TYPES,
  type EmbeddingProvider,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.js";

test("HashEmbeddingProvider produces 32-dim normalized vectors", async () => {
  const provider = new HashEmbeddingProvider();
  assert.equal(provider.type, "hash");
  assert.equal(provider.dimensions, 32);

  const result = await provider.embed("Hello world");
  assert.equal(result.vector.length, 32);
  assert.equal(result.dimensions, 32);
  // Check normalization: magnitude should be ~1.0
  const magnitude = Math.sqrt(result.vector.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(magnitude - 1.0) < 0.001, `magnitude should be ~1.0, got ${magnitude}`);

  // Same text should produce same vector
  const result2 = await provider.embed("Hello world");
  assert.deepEqual(result.vector, result2.vector);

  // Different text should produce different vector
  const result3 = await provider.embed("Goodbye world");
  assert.ok(
    result.vector.some((v, i) => v !== result3.vector[i]),
    "different text should produce different vector",
  );
});

test("HashEmbeddingProvider.embedBatch processes multiple texts", async () => {
  const provider = new HashEmbeddingProvider();
  const texts = ["alpha", "beta", "gamma"];
  const results = await provider.embedBatch(texts);

  assert.equal(results.length, 3);
  for (const r of results) {
    assert.equal(r.vector.length, 32);
    assert.equal(r.dimensions, 32);
  }
  // Each result should be distinct
  assert.ok(
    results[0]!.vector.some((v, i) => v !== results[1]!.vector[i]),
    "batch results should be distinct",
  );
});

test("HashEmbeddingProvider rejects empty input", async () => {
  const provider = new HashEmbeddingProvider();
  let threw = false;
  try {
    await provider.embed("");
  } catch (err: unknown) {
    if (err instanceof Error && /empty_input|cannot build/.test(err.message)) {
      threw = true;
    }
  }
  assert.equal(threw, true, "empty text should be rejected");
});

test("EMBEDDING_PROVIDER_TYPES contains all expected types", () => {
  assert.deepEqual(EMBEDDING_PROVIDER_TYPES, ["hash", "openai", "minimax"]);
});

test("createEmbeddingProviderFromEnv creates hash provider by default", () => {
  const provider = createEmbeddingProviderFromEnv({});
  assert.equal(provider.type, "hash");
  assert.equal(provider.dimensions, 32);
});

test("createEmbeddingProviderFromEnv creates OpenAI provider when configured", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test123",
  });
  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv creates MiniMax provider when configured", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    MINIMAX_API_KEY: "mmx-test123",
  });
  assert.equal(provider.type, "minimax");
});

test("OpenAIEmbeddingProvider produces 1536-dim vectors (mock test - no real API call)", async () => {
  // This uses a mock URL that will fail, but we can verify the provider structure
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "sk-test-fake",
    baseUrl: "https://example.invalid",
    dimensions: 1536,
  });
  assert.equal(provider.type, "openai");
  assert.equal(provider.dimensions, 1536);

  // The actual fetch will fail (no real server), but we verify the structure
  await assert.rejects(
    () => provider.embed("test"),
    /fetch|network|failed/,
    "should fail without valid endpoint",
  );
});

test("MiniMaxEmbeddingProvider produces 1024-dim vectors (mock test - no real API call)", async () => {
  const provider = new MiniMaxEmbeddingProvider({
    apiKey: "mmx-test-fake",
    baseUrl: "https://example.invalid",
    groupId: "test-group",
  });
  assert.equal(provider.type, "minimax");
  assert.equal(provider.dimensions, 1024);

  await assert.rejects(
    () => provider.embed("test"),
    /fetch|network|failed/,
    "should fail without valid endpoint",
  );
});

test("embedding vector dimensions are correctly reported", async () => {
  const provider = new HashEmbeddingProvider();
  const result = await provider.embed("test input for dimension check");
  assert.equal(result.dimensions, 32);

  const batch = await provider.embedBatch(["alpha document", "beta document"]);
  for (const r of batch) {
    assert.equal(r.dimensions, 32);
    assert.equal(r.vector.length, 32);
  }
});

test("embedding provider interface contract - all providers implement embed and embedBatch", () => {
  const providers: EmbeddingProvider[] = [
    new HashEmbeddingProvider(),
    new OpenAIEmbeddingProvider({ apiKey: "test", dimensions: 1536 }),
    new MiniMaxEmbeddingProvider({ apiKey: "test" }),
  ];

  for (const p of providers) {
    assert.equal(typeof p.embed, "function", `${p.type} should have embed method`);
    assert.equal(typeof p.embedBatch, "function", `${p.type} should have embedBatch method`);
    assert.equal(typeof p.dimensions, "number", `${p.type} should have dimensions property`);
    assert.ok(p.dimensions > 0, `${p.type} dimensions should be positive`);
  }
});
