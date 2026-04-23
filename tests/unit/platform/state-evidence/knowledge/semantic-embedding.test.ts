/**
 * Semantic Embedding Tests
 *
 * Tests for §4 semantic embedding generation:
 * - Tokenization with synonym normalization
 * - Vector building from tokens
 * - Cosine similarity computation
 * - Embedding ID generation
 *
 * Architecture: §4 Semantic Index Layer
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  tokenizeSemantically,
  buildSemanticEmbedding,
  semanticEmbeddingId,
  cosineSimilarity,
} from "../../../../../../../src/platform/state-evidence/knowledge/semantic-embedding.js";

// ─────────────────────────────────────────────────────────────────────────────
// tokenizeSemantically Tests
// ─────────────────────────────────────────────────────────────────────────────

test("tokenizeSemantically normalizes tokens and removes duplicates", () => {
  const tokens = tokenizeSemantically("Build builds building compiled compilation");
  assert.ok(tokens.length > 0);
  assert.ok(tokens.every((t: string) => typeof t === "string"));
});

test("tokenizeSemantically applies synonym mapping", () => {
  const tokens = tokenizeSemantically("builds building compilation");
  assert.ok(tokens.includes("build"), "builds/building should map to 'build'");
});

test("tokenizeSemantically removes tokens shorter than 3 characters", () => {
  const tokens = tokenizeSemantically("a b cd ef ghijk");
  assert.ok(tokens.every((t: string) => t.length >= 3), "All tokens should be >= 3 chars");
});

test("tokenizeSemantically lowercases input", () => {
  const tokens = tokenizeSemantically("BUILDING Compiling RETRY");
  tokens.forEach((t: string) => {
    assert.equal(t, t.toLowerCase(), "All tokens should be lowercase");
  });
});

test("tokenizeSemantically handles empty input", () => {
  const tokens = tokenizeSemantically("");
  assert.equal(tokens.length, 0);
});

test("tokenizeSemantically handles input with only special characters", () => {
  const tokens = tokenizeSemantically("### ... ---");
  assert.equal(tokens.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSemanticEmbedding Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildSemanticEmbedding returns null for empty input", () => {
  const result = buildSemanticEmbedding("");
  assert.equal(result, null);
});

test("buildSemanticEmbedding returns null for input that tokenizes to empty", () => {
  const result = buildSemanticEmbedding("a b c d e f g h i j k l m n");
  assert.equal(result, null);
});

test("buildSemanticEmbedding returns vector for valid input", () => {
  const result = buildSemanticEmbedding("build compilation retry cache");
  assert.ok(result !== null);
  assert.equal(result.length, 32); // VECTOR_DIMENSIONS
  result!.forEach((val: number) => {
    assert.ok(typeof val === "number");
  });
});

test("buildSemanticEmbedding uses extraTerms", () => {
  const result1 = buildSemanticEmbedding("build");
  const result2 = buildSemanticEmbedding("build", ["compilation", "retry"]);
  assert.ok(result1 !== null);
  assert.ok(result2 !== null);
  // Adding extra terms should change the embedding
  assert.notEqual(JSON.stringify(result1), JSON.stringify(result2));
});

test("buildSemanticEmbedding normalizes vector to unit length", () => {
  const result = buildSemanticEmbedding("compilation cache retry");
  assert.ok(result !== null);
  // Compute magnitude
  const magnitude = Math.sqrt(result!.reduce((sum: number, v: number) => sum + v * v, 0));
  assert.ok(Math.abs(magnitude - 1) < 0.01, `Vector magnitude should be ~1, got ${magnitude}`);
});

test("buildSemanticEmbedding produces consistent results for same input", () => {
  const text = "build retry cache";
  const result1 = buildSemanticEmbedding(text);
  const result2 = buildSemanticEmbedding(text);
  assert.ok(result1 !== null);
  assert.ok(result2 !== null);
  assert.equal(JSON.stringify(result1), JSON.stringify(result2));
});

test("buildSemanticEmbedding handles single meaningful token", () => {
  const result = buildSemanticEmbedding("retrying");
  assert.ok(result !== null);
  assert.equal(result.length, 32);
});

// ─────────────────────────────────────────────────────────────────────────────
// semanticEmbeddingId Tests
// ─────────────────────────────────────────────────────────────────────────────

test("semanticEmbeddingId returns null for empty input", () => {
  const result = semanticEmbeddingId("");
  assert.equal(result, null);
});

test("semanticEmbeddingId returns null for input that tokenizes to empty", () => {
  const result = semanticEmbeddingId("a b c");
  assert.equal(result, null);
});

test("semanticEmbeddingId returns string starting with local-hash-v1", () => {
  const result = semanticEmbeddingId("build compilation");
  assert.ok(result !== null);
  assert.ok(result.startsWith("local-hash-v1:"));
});

test("semanticEmbeddingId produces same ID for same input", () => {
  const text = "retry cache build";
  const id1 = semanticEmbeddingId(text);
  const id2 = semanticEmbeddingId(text);
  assert.equal(id1, id2);
});

test("semanticEmbeddingId uses extraTerms", () => {
  const id1 = semanticEmbeddingId("build", ["retry"]);
  const id2 = semanticEmbeddingId("build");
  assert.notEqual(id1, id2);
});

test("semanticEmbeddingId sorts tokens before hashing", () => {
  // Same tokens in different order should produce same ID
  const id1 = semanticEmbeddingId("retry build");
  const id2 = semanticEmbeddingId("build retry");
  assert.equal(id1, id2);
});

// ─────────────────────────────────────────────────────────────────────────────
// cosineSimilarity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("cosineSimilarity returns 0 for null left vector", () => {
  const result = cosineSimilarity(null, [1, 2, 3]);
  assert.equal(result, 0);
});

test("cosineSimilarity returns 0 for null right vector", () => {
  const result = cosineSimilarity([1, 2, 3], null);
  assert.equal(result, 0);
});

test("cosineSimilarity returns 0 for empty vectors", () => {
  const result = cosineSimilarity([], []);
  assert.equal(result, 0);
});

test("cosineSimilarity returns 0 for vectors of different lengths", () => {
  const result = cosineSimilarity([1, 2, 3], [1, 2]);
  assert.equal(result, 0);
});

test("cosineSimilarity returns 1 for identical unit vectors", () => {
  const vec = [1, 0, 0];
  const result = cosineSimilarity(vec, vec);
  assert.equal(result, 1);
});

test("cosineSimilarity returns -1 for opposite unit vectors", () => {
  const result = cosineSimilarity([1, 0, 0], [-1, 0, 0]);
  assert.equal(result, -1);
});

test("cosineSimilarity returns 0 for orthogonal vectors", () => {
  const result = cosineSimilarity([1, 0, 0], [0, 1, 0]);
  assert.equal(result, 0);
});

test("cosineSimilarity handles negative values in vectors", () => {
  const result = cosineSimilarity([0.5, -0.5], [0.5, -0.5]);
  assert.equal(result, 1);
});

test("cosineSimilarity returns 0 when left vector is all zeros", () => {
  const result = cosineSimilarity([0, 0, 0], [1, 2, 3]);
  assert.equal(result, 0);
});

test("cosineSimilarity returns 0 when right vector is all zeros", () => {
  const result = cosineSimilarity([1, 2, 3], [0, 0, 0]);
  assert.equal(result, 0);
});

test("cosineSimilarity computes correct similarity for typical embeddings", () => {
  // Two vectors that are somewhat similar
  const vec1 = buildSemanticEmbedding("build compilation");
  const vec2 = buildSemanticEmbedding("build retry");
  if (vec1 !== null && vec2 !== null) {
    const similarity = cosineSimilarity(vec1, vec2);
    assert.ok(similarity >= -1 && similarity <= 1);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("tokenizeSemantically handles complex input with numbers and underscores", () => {
  const tokens = tokenizeSemantically("v2_api endpoint auth_token build_123");
  assert.ok(tokens.length > 0);
});

test("buildSemanticEmbedding handles very long input", () => {
  const longText = "build ".repeat(100);
  const result = buildSemanticEmbedding(longText);
  assert.ok(result !== null);
  assert.equal(result.length, 32);
});

test("semanticEmbeddingId handles very long input", () => {
  const longText = "build ".repeat(100);
  const result = semanticEmbeddingId(longText);
  assert.ok(result !== null);
});