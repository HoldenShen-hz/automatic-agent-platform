import test from "node:test";
import assert from "node:assert/strict";
import { KeywordKnowledgeIndex } from "../../../../../src/platform/state-evidence/knowledge/keyword-index.js";
function makeChunk(overrides = {}) {
    return {
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: "This is about TypeScript and Node.js development",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 10,
        namespace: "test-ns",
        ordinal: 0,
        summary: "TypeScript development basics",
        keywords: ["typescript", "node", "development"],
        embeddingId: null,
        locator: {},
        ...overrides,
    };
}
test("KeywordKnowledgeIndex.upsert adds chunk and updates inverted index", () => {
    const index = new KeywordKnowledgeIndex();
    const chunk = makeChunk();
    index.upsert(chunk);
    const results = index.query("typescript");
    assert.equal(results.length, 1);
    assert.equal(results[0].chunkId, "chunk_1");
});
test("KeywordKnowledgeIndex.query returns empty for unknown keyword", () => {
    const index = new KeywordKnowledgeIndex();
    const chunk = makeChunk();
    index.upsert(chunk);
    const results = index.query("unknownkeyword");
    assert.equal(results.length, 0);
});
test("KeywordKnowledgeIndex.query is case insensitive", () => {
    const index = new KeywordKnowledgeIndex();
    const chunk = makeChunk();
    index.upsert(chunk);
    assert.equal(index.query("TYPESCRIPT").length, 1);
    assert.equal(index.query("TypeScript").length, 1);
    assert.equal(index.query("typescript").length, 1);
});
test("KeywordKnowledgeIndex.query returns multiple chunks for shared keyword", () => {
    const index = new KeywordKnowledgeIndex();
    index.upsert(makeChunk({ chunkId: "chunk_1", keywords: ["typescript"] }));
    index.upsert(makeChunk({ chunkId: "chunk_2", keywords: ["typescript"] }));
    const results = index.query("typescript");
    assert.equal(results.length, 2);
});
test("KeywordKnowledgeIndex.query returns results sorted by score descending", () => {
    const index = new KeywordKnowledgeIndex();
    index.upsert(makeChunk({
        chunkId: "chunk_1",
        content: "TypeScript TypeScript TypeScript",
        keywords: ["typescript"],
        summary: "Repeated keyword",
    }));
    index.upsert(makeChunk({
        chunkId: "chunk_2",
        content: "TypeScript",
        keywords: ["typescript"],
        summary: "Single keyword",
    }));
    const results = index.query("typescript");
    assert.equal(results[0].chunkId, "chunk_1");
    assert.equal(results[0].score, 3);
    assert.equal(results[1].chunkId, "chunk_2");
    assert.equal(results[1].score, 1);
});
test("KeywordKnowledgeIndex.query constructs correct RetrievalHit structure", () => {
    const index = new KeywordKnowledgeIndex();
    const chunk = makeChunk({ summary: "Test summary" });
    index.upsert(chunk);
    const results = index.query("typescript");
    assert.equal(results[0].chunkId, "chunk_1");
    assert.equal(results[0].documentId, "doc_1");
    assert.equal(results[0].matchType, "keyword");
    assert.equal(results[0].snippet, "Test summary");
    assert.equal(results[0].knowledgeRef, "knowledge:chunk_1");
    assert.equal(results[0].namespace, "test-ns");
});
test("KeywordKnowledgeIndex.reset clears all data", () => {
    const index = new KeywordKnowledgeIndex();
    index.upsert(makeChunk());
    index.upsert(makeChunk({ chunkId: "chunk_2", keywords: ["node"] }));
    index.reset();
    assert.equal(index.query("typescript").length, 0);
    assert.equal(index.query("node").length, 0);
});
test("KeywordKnowledgeIndex handles chunk with no keywords", () => {
    const index = new KeywordKnowledgeIndex();
    const chunk = makeChunk({ keywords: [] });
    index.upsert(chunk);
    const results = index.query("typescript");
    assert.equal(results.length, 0);
});
test("KeywordKnowledgeIndex handles chunk with special characters in keywords", () => {
    const index = new KeywordKnowledgeIndex();
    const chunk = makeChunk({ keywords: ["C++", "node.js", "TypeScript"] });
    index.upsert(chunk);
    assert.equal(index.query("c++").length, 1);
    assert.equal(index.query("node.js").length, 1);
});
//# sourceMappingURL=keyword-index.test.js.map