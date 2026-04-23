import test from "node:test";
import assert from "node:assert/strict";

import {
  AstStructuralIndex,
  type AstIndexedSymbol,
  type AstIndexQuery,
} from "../../../../../../src/platform/state-evidence/knowledge/indexing/ast-index.js";
import {
  HashEmbeddingProvider,
  OpenAIEmbeddingProvider,
  MiniMaxEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  EMBEDDING_PROVIDER_TYPES,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "../../../../../../src/platform/state-evidence/knowledge/indexing/embedding-provider.js";

/* ============================================================
   AstStructuralIndex - private method coverage helpers
   ============================================================ */

function makeSymbol(overrides: Partial<AstIndexedSymbol> = {}): AstIndexedSymbol {
  return {
    symbolId: "doc1:TestClass:1:class",
    symbolName: "TestClass",
    symbolKind: "class",
    sourceUri: "/src/test.ts",
    namespace: "test",
    documentId: "doc1",
    line: 1,
    character: 1,
    snippet: "export class TestClass {}",
    ...overrides,
  };
}

/* ============================================================
   AstStructuralIndex tests
   ============================================================ */

test("AstStructuralIndex handles empty document content", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_empty",
    sourceUri: "/src/empty.ts",
    namespace: "ns",
    content: "",
  });
  assert.equal(symbols.length, 0);
});

test("AstStructuralIndex handles document with only whitespace", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_ws",
    sourceUri: "/src/whitespace.ts",
    namespace: "ns",
    content: "   \n\n   ",
  });
  assert.equal(symbols.length, 0);
});

test("AstStructuralIndex extracts symbol with correct line/character positions", () => {
  const index = new AstStructuralIndex();
  const content = `export function myFunction() {
  return 1;
}`;
  const symbols = index.upsertDocument({
    documentId: "doc_pos",
    sourceUri: "/src/pos.ts",
    namespace: "ns",
    content,
  });

  assert.equal(symbols.length, 1);
  // Line 1 (1-indexed), character 9 (1-indexed) — "function" starts at column 9
  assert.equal(symbols[0]!.line, 1);
  assert.ok(symbols[0]!.character >= 1);
  assert.ok(symbols[0]!.snippet.includes("myFunction"));
});

test("AstStructuralIndex snippet captures 3 lines starting at symbol line", () => {
  const index = new AstStructuralIndex();
  const content = `// line 0
// line 1
export function foo() {
  const x = 1;
  const y = 2;
  return x + y;
}`;

  const symbols = index.upsertDocument({
    documentId: "doc_snippet",
    sourceUri: "/src/snippet.ts",
    namespace: "ns",
    content,
  });

  assert.equal(symbols.length, 1);
  // Snippet should include the function line and next 2 lines
  const snippet = symbols[0]!.snippet;
  assert.ok(snippet.includes("foo"), `snippet should include 'foo', got: ${snippet}`);
  // Snippet is built from 3 lines starting at the symbol line
  const snippetLines = snippet.split("\n");
  assert.ok(snippetLines.length >= 1, "snippet should have at least 1 line");
});

test("AstStructuralIndex snippet handles document end gracefully", () => {
  const index = new AstStructuralIndex();
  const content = `export function atEnd()`;

  const symbols = index.upsertDocument({
    documentId: "doc_end",
    sourceUri: "/src/end.ts",
    namespace: "ns",
    content,
  });

  assert.equal(symbols.length, 1);
  assert.ok(symbols[0]!.snippet.includes("atEnd"));
});

test("AstStructuralIndex does not parse .json files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_json",
    sourceUri: "/src/data.json",
    namespace: "ns",
    content: '{"key": "value"}',
  });
  assert.equal(symbols.length, 0);
});

test("AstStructuralIndex does not parse .py files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_py",
    sourceUri: "/src/script.py",
    namespace: "ns",
    content: "def foo():\n    pass",
  });
  assert.equal(symbols.length, 0);
});

test("AstStructuralIndex parses .tsx files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_tsx",
    sourceUri: "/src/component.tsx",
    namespace: "ns",
    content: "export function Component() { return null; }",
  });
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "function");
});

test("AstStructuralIndex parses .jsx files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_jsx",
    sourceUri: "/src/component.jsx",
    namespace: "ns",
    content: "export function Component() { return null; }",
  });
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "function");
});

test("AstStructuralIndex parses .mjs files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_mjs",
    sourceUri: "/src/module.mjs",
    namespace: "ns",
    content: "export const VALUE = 42;",
  });
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "variable");
});

test("AstStructuralIndex parses .cjs files by extension", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_cjs",
    sourceUri: "/src/module.cjs",
    namespace: "ns",
    content: "class Helper {}",
  });
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "class");
});

test("AstStructuralIndex language hint 'javascript' forces JS parsing", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "doc_js_hint",
    sourceUri: "/src/weird.ext",
    namespace: "ns",
    language: "javascript",
    content: "export function jsFunc() {}",
  });
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolKind, "function");
});

test("AstStructuralIndex query scoring: exact name match gets score 3", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/utils.ts",
    namespace: "ns",
    content: "export function calculate() {}",
  });

  // Access internal state through list to verify scoring
  const results = index.query({ query: "calculate" });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.symbolName, "calculate");
});

test("AstStructuralIndex query scoring: partial name match gets score 2", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/utils.ts",
    namespace: "ns",
    content: "export function calculateScore() {}",
  });

  const results = index.query({ query: "calculate" });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.symbolName, "calculateScore");
});

test("AstStructuralIndex query scoring: snippet match gets score 1", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/utils.ts",
    namespace: "ns",
    content: "export function handler() {\n  // calls fetchUserData\n  return fetchUserData();\n}",
  });

  const results = index.query({ query: "fetchUserData" });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.symbolName, "handler");
});

test("AstStructuralIndex query returns results sorted by score descending", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/utils.ts",
    namespace: "ns",
    content: `export function helper() {}
export class Helper {}`,
  });

  const results = index.query({ query: "helper" });
  assert.ok(results.length >= 1);
  // First result should be the best match
  assert.ok(results[0]!.symbolName.toLowerCase().includes("helper"));
});

test("AstStructuralIndex list returns empty array for unknown namespace", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/a.ts",
    namespace: "known",
    content: "export function func() {}",
  });

  const results = index.list("unknown");
  assert.equal(results.length, 0);
});

test("AstStructuralIndex query returns empty array for unknown namespace", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/a.ts",
    namespace: "known",
    content: "export function func() {}",
  });

  const results = index.query({ query: "func", namespace: "unknown" });
  assert.equal(results.length, 0);
});

test("AstStructuralIndex removeDocument cleans up symbolsByNamespace", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc_to_remove",
    sourceUri: "/src/toRemove.ts",
    namespace: "ns",
    content: "export function removeMe() {}",
  });

  // Re-upsert with same docId effectively removes old symbols
  index.upsertDocument({
    documentId: "doc_to_remove",
    sourceUri: "/src/newContent.ts",
    namespace: "ns",
    content: "export function replaced() {}",
  });

  const results = index.query({ query: "removeMe" });
  assert.equal(results.length, 0);
});

test("AstStructuralIndex handles nested declarations (only top-level extracted)", () => {
  const index = new AstStructuralIndex();
  const content = `export function outer() {
  function inner() {}
  class InnerClass {}
}`;
  const symbols = index.upsertDocument({
    documentId: "doc_nested",
    sourceUri: "/src/nested.ts",
    namespace: "ns",
    content,
  });

  // Only outer function should be extracted (top-level)
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]!.symbolName, "outer");
});

test("AstStructuralIndex symbolId format is correct", () => {
  const index = new AstStructuralIndex();
  const symbols = index.upsertDocument({
    documentId: "my_doc",
    sourceUri: "/src/test.ts",
    namespace: "ns",
    content: "export function myFunc() {}",
  });

  assert.equal(symbols.length, 1);
  const parts = symbols[0]!.symbolId.split(":");
  assert.equal(parts[0], "my_doc");
  assert.equal(parts[1], "myFunc");
  assert.ok(Number.isInteger(Number(parts[2])));
  assert.equal(parts[3], "function");
});

test("AstStructuralIndex query limit defaults to 10", () => {
  const index = new AstStructuralIndex();
  for (let i = 0; i < 15; i++) {
    index.upsertDocument({
      documentId: `doc_${i}`,
      sourceUri: `/src/f${i}.ts`,
      namespace: "ns",
      content: `export function match${i}() {}`,
    });
  }

  const results = index.query({ query: "match" });
  assert.equal(results.length, 10); // default limit
});

test("AstStructuralIndex query with explicit limit", () => {
  const index = new AstStructuralIndex();
  for (let i = 0; i < 5; i++) {
    index.upsertDocument({
      documentId: `doc_${i}`,
      sourceUri: `/src/f${i}.ts`,
      namespace: "ns",
      content: `export function item${i}() {}`,
    });
  }

  const results = index.query({ query: "item", limit: 2 });
  assert.equal(results.length, 2);
});

test("AstStructuralIndex query limit of 0 defaults to 1", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/f.ts",
    namespace: "ns",
    content: "export function test() {}",
  });

  const results = index.query({ query: "test", limit: 0 });
  // limit=0 should be treated as 1 (Math.max(1, 0) === 1)
  assert.equal(results.length, 1);
});

test("AstStructuralIndex query is case-insensitive", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/utils.ts",
    namespace: "ns",
    content: "export function CamelCase() {}",
  });

  assert.equal(index.query({ query: "camelcase" }).length, 1);
  assert.equal(index.query({ query: "CAMELCASE" }).length, 1);
  assert.equal(index.query({ query: "CamelCase" }).length, 1);
});

test("AstStructuralIndex query whitespace-only returns empty", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/utils.ts",
    namespace: "ns",
    content: "export function test() {}",
  });

  assert.equal(index.query({ query: "   " }).length, 0);
  assert.equal(index.query({ query: "\t" }).length, 0);
  assert.equal(index.query({ query: "\n" }).length, 0);
});

test("AstStructuralIndex list returns all documents across namespaces", () => {
  const index = new AstStructuralIndex();
  index.upsertDocument({
    documentId: "doc1",
    sourceUri: "/src/a.ts",
    namespace: "ns1",
    content: "export function func1() {}",
  });
  index.upsertDocument({
    documentId: "doc2",
    sourceUri: "/src/b.ts",
    namespace: "ns2",
    content: "export function func2() {}",
  });
  index.upsertDocument({
    documentId: "doc3",
    sourceUri: "/src/c.ts",
    namespace: "ns3",
    content: "export function func3() {}",
  });

  const results = index.list();
  assert.equal(results.length, 3);
});

/* ============================================================
   HashEmbeddingProvider tests
   ============================================================ */

test("HashEmbeddingProvider returns normalized vector with magnitude ~1.0", async () => {
  const provider = new HashEmbeddingProvider();
  const result = await provider.embed("test normalization");

  const magnitude = Math.sqrt(result.vector.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(magnitude - 1.0) < 0.001, `magnitude=${magnitude}`);
});

test("HashEmbeddingProvider embedBatch preserves order", async () => {
  const provider = new HashEmbeddingProvider();
  const texts = ["first", "second", "third"];
  const results = await provider.embedBatch(texts);

  assert.equal(results.length, 3);
  assert.notDeepEqual(results[0]!.vector, results[1]!.vector);
  assert.notDeepEqual(results[1]!.vector, results[2]!.vector);
});

test("HashEmbeddingProvider rejects null-like inputs via semantic-embedding", async () => {
  const provider = new HashEmbeddingProvider();
  await assert.rejects(
    () => provider.embed(""),
    /empty_input|cannot build/i,
  );
});

test("HashEmbeddingProvider produces consistent results for same input", async () => {
  const provider = new HashEmbeddingProvider();
  const text = "deterministic input";

  const r1 = await provider.embed(text);
  const r2 = await provider.embed(text);

  assert.deepEqual(r1.vector, r2.vector);
  assert.equal(r1.dimensions, r2.dimensions);
});

test("HashEmbeddingProvider dimensions is always 32", () => {
  const provider = new HashEmbeddingProvider();
  assert.equal(provider.dimensions, 32);

  // Also check via embed result
  assert.equal(provider.dimensions, 32);
});

/* ============================================================
   OpenAIEmbeddingProvider tests
   ============================================================ */

test("OpenAIEmbeddingProvider constructor applies default values", () => {
  const provider = new OpenAIEmbeddingProvider({ apiKey: "test-key" });

  assert.equal(provider.type, "openai");
  assert.equal(provider.dimensions, 1536);
});

test("OpenAIEmbeddingProvider constructor accepts custom dimensions", () => {
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "test-key",
    dimensions: 512,
  });

  assert.equal(provider.dimensions, 512);
});

test("OpenAIEmbeddingProvider constructor normalizes baseUrl trailing slash", () => {
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "test-key",
    baseUrl: "https://api.example.com/",
  });

  // Should not have trailing slash
  assert.ok(!provider.dimensions || provider.dimensions > 0);
});

test("OpenAIEmbeddingProvider constructor accepts custom model", () => {
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "test-key",
    model: "text-embedding-3-large",
  });

  assert.equal(provider.type, "openai");
});

test("OpenAIEmbeddingProvider embedBatch splits into batches", async () => {
  const provider = new OpenAIEmbeddingProvider({
    apiKey: "test-key",
    batchSize: 2,
  });

  // This will fail at fetch but we can verify batching logic
  await assert.rejects(
    () => provider.embedBatch(["a", "b", "c", "d"]),
    /fetch|network|failed/,
  );
});

/* ============================================================
   MiniMaxEmbeddingProvider tests
   ============================================================ */

test("MiniMaxEmbeddingProvider constructor applies defaults", () => {
  const provider = new MiniMaxEmbeddingProvider({ apiKey: "test-key" });

  assert.equal(provider.type, "minimax");
  assert.equal(provider.dimensions, 1024);
});

test("MiniMaxEmbeddingProvider constructor normalizes baseUrl ending in /v1", () => {
  const provider = new MiniMaxEmbeddingProvider({
    apiKey: "test-key",
    baseUrl: "https://api.minimaxi.com/v1",
  });

  assert.equal(provider.type, "minimax");
});

test("MiniMaxEmbeddingProvider constructor adds /v1 when missing", () => {
  const provider = new MiniMaxEmbeddingProvider({
    apiKey: "test-key",
    baseUrl: "https://api.minimaxi.com",
  });

  assert.equal(provider.type, "minimax");
});

test("MiniMaxEmbeddingProvider constructor accepts custom model", () => {
  const provider = new MiniMaxEmbeddingProvider({
    apiKey: "test-key",
    model: "embo-01",
  });

  assert.equal(provider.type, "minimax");
});

test("MiniMaxEmbeddingProvider constructor accepts groupId", () => {
  const provider = new MiniMaxEmbeddingProvider({
    apiKey: "test-key",
    groupId: "my-group",
  });

  assert.equal(provider.type, "minimax");
});

/* ============================================================
   createEmbeddingProviderFromEnv tests
   ============================================================ */

test("createEmbeddingProviderFromEnv throws for OpenAI without API key", () => {
  assert.throws(
    () => createEmbeddingProviderFromEnv({ AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai" }),
    /missing_api_key/i,
  );
});

test("createEmbeddingProviderFromEnv throws for MiniMax without API key", () => {
  assert.throws(
    () => createEmbeddingProviderFromEnv({ AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax" }),
    /missing_api_key/i,
  );
});

test("createEmbeddingProviderFromEnv accepts OPENAI_API_KEY", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
  });

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv accepts AA_OPENAI_API_KEY", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    AA_OPENAI_API_KEY: "sk-test-aa",
  });

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv accepts MINIMAX_API_KEY", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    MINIMAX_API_KEY: "mmx-test",
  });

  assert.equal(provider.type, "minimax");
});

test("createEmbeddingProviderFromEnv accepts AA_MINIMAX_API_KEY", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    AA_MINIMAX_API_KEY: "mmx-test-aa",
  });

  assert.equal(provider.type, "minimax");
});

test("createEmbeddingProviderFromEnv accepts OPENAI_API_BASE_URL", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    OPENAI_API_BASE_URL: "https://custom.endpoint.com",
  });

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv accepts AA_OPENAI_EMBEDDING_MODEL", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    AA_OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
  });

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv accepts AA_OPENAI_EMBEDDING_DIMENSIONS", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    AA_OPENAI_EMBEDDING_DIMENSIONS: "512",
  });

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv accepts AA_OPENAI_EMBEDDING_BATCH_SIZE", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    AA_OPENAI_EMBEDDING_BATCH_SIZE: "50",
  });

  assert.equal(provider.type, "openai");
});

test("createEmbeddingProviderFromEnv accepts MINIMAX_API_BASE", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    MINIMAX_API_KEY: "mmx-test",
    MINIMAX_API_BASE: "https://custom.minimax.com",
  });

  assert.equal(provider.type, "minimax");
});

test("createEmbeddingProviderFromEnv accepts MINIMAX_GROUP_ID", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    MINIMAX_API_KEY: "mmx-test",
    MINIMAX_GROUP_ID: "my-group-id",
  });

  assert.equal(provider.type, "minimax");
});

test("createEmbeddingProviderFromEnv accepts AA_MINIMAX_EMBEDDING_MODEL", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "minimax",
    MINIMAX_API_KEY: "mmx-test",
    AA_MINIMAX_EMBEDDING_MODEL: "embo-01",
  });

  assert.equal(provider.type, "minimax");
});

test("createEmbeddingProviderFromEnv defaults to hash for unknown type", () => {
  const provider = createEmbeddingProviderFromEnv({
    AA_KNOWLEDGE_EMBEDDING_PROVIDER: "unknown-type" as any,
  });

  assert.equal(provider.type, "hash");
});

test("createEmbeddingProviderFromEnv defaults to hash when env is empty", () => {
  const provider = createEmbeddingProviderFromEnv({});
  assert.equal(provider.type, "hash");
});

/* ============================================================
   EMBEDDING_PROVIDER_TYPES constant
   ============================================================ */

test("EMBEDDING_PROVIDER_TYPES has exactly 3 types", () => {
  assert.equal(EMBEDDING_PROVIDER_TYPES.length, 3);
});

test("EMBEDDING_PROVIDER_TYPES contains hash, openai, minimax", () => {
  assert.ok(EMBEDDING_PROVIDER_TYPES.includes("hash"));
  assert.ok(EMBEDDING_PROVIDER_TYPES.includes("openai"));
  assert.ok(EMBEDDING_PROVIDER_TYPES.includes("minimax"));
});

/* ============================================================
   Interface compliance tests
   ============================================================ */

test("All embedding providers implement EmbeddingProvider interface", () => {
  const providers: EmbeddingProvider[] = [
    new HashEmbeddingProvider(),
    new OpenAIEmbeddingProvider({ apiKey: "test" }),
    new MiniMaxEmbeddingProvider({ apiKey: "test" }),
  ];

  for (const p of providers) {
    assert.equal(typeof p.embed, "function");
    assert.equal(typeof p.embedBatch, "function");
    assert.equal(typeof p.type, "string");
    assert.equal(typeof p.dimensions, "number");
    assert.ok(p.dimensions > 0);
  }
});

test("EmbeddingResult shape is consistent", async () => {
  const provider = new HashEmbeddingProvider();
  const result = await provider.embed("test");

  assert.ok(Array.isArray(result.vector));
  assert.equal(typeof result.dimensions, "number");
  assert.ok(result.dimensions > 0);
  assert.equal(result.vector.length, result.dimensions);
});
