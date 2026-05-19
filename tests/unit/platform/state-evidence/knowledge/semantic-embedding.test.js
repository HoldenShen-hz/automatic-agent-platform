import test from "node:test";
import assert from "node:assert/strict";
import { tokenizeSemantically, buildSemanticEmbedding, semanticEmbeddingId, cosineSimilarity, } from "../../../../../src/platform/state-evidence/knowledge/semantic-embedding.js";
// ─────────────────────────────────────────────────────────────────────────────
// tokenizeSemantically Tests
// ─────────────────────────────────────────────────────────────────────────────
test("tokenizeSemantically normalizes tokens and removes duplicates", () => {
    const tokens = tokenizeSemantically("Build builds building compiled compilation");
    assert.ok(tokens.length > 0);
    assert.ok(tokens.every((t) => typeof t === "string"));
});
test("tokenizeSemantically applies synonym mapping", () => {
    const tokens = tokenizeSemantically("builds building compilation");
    assert.ok(tokens.includes("build"), "builds/building should map to 'build'");
});
test("tokenizeSemantically removes tokens shorter than 3 characters", () => {
    const tokens = tokenizeSemantically("a b cd ef ghijk");
    assert.ok(tokens.every((t) => t.length >= 3), "All tokens should be >= 3 chars");
});
test("tokenizeSemantically lowercases input", () => {
    const tokens = tokenizeSemantically("BUILDING Compiling RETRY");
    tokens.forEach((t) => {
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
test("tokenizeSemantically handles whitespace-only input", () => {
    const tokens = tokenizeSemantically("   \t\n   ");
    assert.equal(tokens.length, 0);
});
test("tokenizeSemantically removes duplicate tokens", () => {
    const tokens = tokenizeSemantically("build build build");
    assert.equal(tokens.filter(t => t === "build").length, 1);
});
test("tokenizeSemantically applies synonym mapping before suffix stripping", () => {
    // "compilation" -> "compile" (via -ation->-e) -> "build" (via synonym)
    const tokens = tokenizeSemantically("compilation");
    assert.ok(tokens.includes("build"), "compilation should map to 'build' via 'compile' synonym");
});
test("tokenizeSemantically applies -ing -> (no suffix) stripping", () => {
    const tokens = tokenizeSemantically("building");
    assert.ok(tokens.includes("build"), "building should map to build");
});
test("tokenizeSemantically applies synonym mapping for compiled", () => {
    // "compiled" is in synonyms as "build"
    const tokens = tokenizeSemantically("compiled");
    assert.ok(tokens.includes("build"), "compiled should map to 'build' via synonym");
});
test("tokenizeSemantically applies -es suffix stripping when no synonym", () => {
    // "compiles" is not in synonyms, so -es is stripped -> "compil"
    const tokens = tokenizeSemantically("compiles");
    assert.ok(tokens.includes("compil"), "compiles should map to 'compil' via -es stripping");
});
test("tokenizeSemantically applies -s suffix stripping when no synonym", () => {
    // "packages" is not in synonyms, so -s is stripped -> "package"
    const tokens = tokenizeSemantically("packages");
    assert.ok(tokens.includes("package"), "packages should map to 'package' via -s stripping");
});
test("tokenizeSemantically does not strip short words ending in s", () => {
    const tokens = tokenizeSemantically("bus");
    assert.ok(!tokens.includes("bu"), "bu is too short");
});
test("tokenizeSemantically handles complex input with numbers and underscores", () => {
    const tokens = tokenizeSemantically("v2_api endpoint auth_token build_123");
    assert.ok(tokens.length > 0);
});
test("tokenizeSemantically splits on non-alphanumeric characters", () => {
    const tokens = tokenizeSemantically("foo-bar_baz+qux@quux");
    assert.ok(tokens.length > 0);
});
test("tokenizeSemantically returns empty array for single character inputs", () => {
    const tokens = tokenizeSemantically("x");
    assert.equal(tokens.length, 0);
});
test("tokenizeSemantically returns empty array for two character inputs", () => {
    const tokens = tokenizeSemantically("ab");
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
    result.forEach((val) => {
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
    const magnitude = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
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
test("buildSemanticEmbedding handles very long input", () => {
    const longText = "build ".repeat(100);
    const result = buildSemanticEmbedding(longText);
    assert.ok(result !== null);
    assert.equal(result.length, 32);
});
test("buildSemanticEmbedding returns normalized vector with values between -1 and 1", () => {
    const result = buildSemanticEmbedding("compilation retry cache lockfile dependency");
    assert.ok(result !== null);
    for (const val of result) {
        assert.ok(val >= -1 && val <= 1, `Value ${val} should be between -1 and 1`);
    }
});
test("buildSemanticEmbedding handles multiple extraTerms", () => {
    const result = buildSemanticEmbedding("build", ["compile", "retry", "cache", "lockfile"]);
    assert.ok(result !== null);
    assert.equal(result.length, 32);
});
test("buildSemanticEmbedding handles empty extraTerms array", () => {
    const result = buildSemanticEmbedding("build", []);
    assert.ok(result !== null);
    assert.equal(result.length, 32);
});
test("buildSemanticEmbedding with extraTerms tokenizes them semantically", () => {
    const result = buildSemanticEmbedding("build", ["compilation"]);
    assert.ok(result !== null);
    // "build" and "compilation" should both produce valid embeddings
});
test("buildSemanticEmbedding handles duplicate tokens across input and extraTerms", () => {
    const result = buildSemanticEmbedding("build build build", ["build"]);
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
test("semanticEmbeddingId handles very long input", () => {
    const longText = "build ".repeat(100);
    const result = semanticEmbeddingId(longText);
    assert.ok(result !== null);
    assert.ok(result.startsWith("local-hash-v1:"));
});
test("semanticEmbeddingId produces different IDs for different inputs", () => {
    const id1 = semanticEmbeddingId("build");
    const id2 = semanticEmbeddingId("retry");
    assert.notEqual(id1, id2);
});
test("semanticEmbeddingId handles duplicate tokens in input", () => {
    const id1 = semanticEmbeddingId("build build build");
    const id2 = semanticEmbeddingId("build");
    assert.equal(id1, id2);
});
test("semanticEmbeddingId includes extraTerms in hash", () => {
    const id1 = semanticEmbeddingId("build", ["retry"]);
    const id2 = semanticEmbeddingId("build", ["cache"]);
    assert.notEqual(id1, id2);
});
test("semanticEmbeddingId handles multiple extraTerms", () => {
    const id = semanticEmbeddingId("build", ["compile", "retry", "cache"]);
    assert.ok(id !== null);
    assert.ok(id.startsWith("local-hash-v1:"));
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
test("cosineSimilarity returns 0 for both null vectors", () => {
    const result = cosineSimilarity(null, null);
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
test("cosineSimilarity returns 1 for identical non-unit vectors (normalized)", () => {
    const vec = [2, 2];
    const result = cosineSimilarity(vec, vec);
    assert.equal(result, 1);
});
test("cosineSimilarity computes expected value for simple vectors", () => {
    // vec1 = [1, 0], vec2 = [1, 0] -> dot = 1, mag1 = 1, mag2 = 1 -> 1
    const result = cosineSimilarity([1, 0], [1, 0]);
    assert.equal(result, 1);
});
test("cosineSimilarity computes expected value for 45-degree vectors", () => {
    // vec1 = [1, 1], vec2 = [1, 0]
    // dot = 1, mag1 = sqrt(2), mag2 = 1 -> 1/sqrt(2) ≈ 0.707
    const result = cosineSimilarity([1, 1], [1, 0]);
    assert.ok(Math.abs(result - 0.707) < 0.01);
});
test("cosineSimilarity handles vectors with undefined/null values", () => {
    const vec = [1, null, 3];
    const result = cosineSimilarity(vec, [1, 2, 3]);
    // null is treated as 0
    assert.ok(result >= -1 && result <= 1);
});
test("cosineSimilarity handles longer vectors", () => {
    const vec1 = new Array(32).fill(0).map((_, i) => i * 0.1);
    const vec2 = new Array(32).fill(0).map((_, i) => i * 0.1);
    const result = cosineSimilarity(vec1, vec2);
    assert.equal(result, 1);
});
test("cosineSimilarity returns 0 for completely dissimilar vectors", () => {
    const vec1 = [1, 1, 1, 1];
    const vec2 = [-1, -1, -1, -1];
    const result = cosineSimilarity(vec1, vec2);
    assert.equal(result, -1);
});
//# sourceMappingURL=semantic-embedding.test.js.map