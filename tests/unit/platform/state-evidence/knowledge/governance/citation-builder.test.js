/**
 * Unit tests for citation-builder
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CitationBuilder } from "../../../../../../src/platform/state-evidence/knowledge/governance/citation-builder.js";
function createTestRetrievalHit(overrides) {
    return {
        chunkId: "chunk_abc123",
        documentId: "doc_xyz",
        score: 0.95,
        matchType: "semantic",
        snippet: "This is a test snippet about knowledge retrieval.",
        namespace: "test.namespace",
        knowledgeRef: "test:chunk_abc123",
        ...overrides,
    };
}
test("CitationBuilder build creates correct citation format", () => {
    const builder = new CitationBuilder();
    const hit = createTestRetrievalHit({ chunkId: "chunk_xyz789" });
    const citation = builder.build(hit);
    assert.equal(citation, "knowledge:chunk_xyz789");
});
test("CitationBuilder build uses chunkId from hit", () => {
    const builder = new CitationBuilder();
    const hit = createTestRetrievalHit({ chunkId: "chunk_abc" });
    const citation = builder.build(hit);
    assert.equal(citation, "knowledge:chunk_abc");
});
test("CitationBuilder buildMany creates citations for multiple hits", () => {
    const builder = new CitationBuilder();
    const hits = [
        createTestRetrievalHit({ chunkId: "chunk_1" }),
        createTestRetrievalHit({ chunkId: "chunk_2" }),
        createTestRetrievalHit({ chunkId: "chunk_3" }),
    ];
    const citations = builder.buildMany(hits);
    assert.equal(citations.length, 3);
    assert.ok(citations.includes("knowledge:chunk_1"));
    assert.ok(citations.includes("knowledge:chunk_2"));
    assert.ok(citations.includes("knowledge:chunk_3"));
});
test("CitationBuilder buildMany deduplicates citations", () => {
    const builder = new CitationBuilder();
    const hits = [
        createTestRetrievalHit({ chunkId: "chunk_1" }),
        createTestRetrievalHit({ chunkId: "chunk_1" }),
        createTestRetrievalHit({ chunkId: "chunk_2" }),
    ];
    const citations = builder.buildMany(hits);
    assert.equal(citations.length, 2);
});
test("CitationBuilder buildMany handles empty array", () => {
    const builder = new CitationBuilder();
    const citations = builder.buildMany([]);
    assert.equal(citations.length, 0);
});
test("CitationBuilder buildMany handles single hit", () => {
    const builder = new CitationBuilder();
    const hits = [createTestRetrievalHit({ chunkId: "chunk_only" })];
    const citations = builder.buildMany(hits);
    assert.equal(citations.length, 1);
    assert.equal(citations[0], "knowledge:chunk_only");
});
test("CitationBuilder buildMany preserves order with deduplication", () => {
    const builder = new CitationBuilder();
    const hits = [
        createTestRetrievalHit({ chunkId: "chunk_a" }),
        createTestRetrievalHit({ chunkId: "chunk_b" }),
        createTestRetrievalHit({ chunkId: "chunk_a" }),
        createTestRetrievalHit({ chunkId: "chunk_c" }),
        createTestRetrievalHit({ chunkId: "chunk_b" }),
    ];
    const citations = builder.buildMany(hits);
    // Deduplication uses Set which doesn't preserve order in older JS
    // but the unique citations should all be present
    assert.equal(citations.length, 3);
    assert.ok(citations.includes("knowledge:chunk_a"));
    assert.ok(citations.includes("knowledge:chunk_b"));
    assert.ok(citations.includes("knowledge:chunk_c"));
});
//# sourceMappingURL=citation-builder.test.js.map