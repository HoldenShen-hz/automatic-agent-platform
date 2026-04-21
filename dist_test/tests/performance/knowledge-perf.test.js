/**
 * Performance Test: Knowledge Query Service
 * G4 Benchmark — knowledge-query-service.query() Quick <100ms, Standard <500ms
 *
 * Design targets (§7.4):
 * - Quick query: <100ms P99
 * - Standard query: <500ms P99
 */
import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeQueryService, QueryLevel, } from "../../src/platform/state-evidence/knowledge/knowledge-query-service.js";
function createMockRetrievalService() {
    return {
        query(keyword) {
            return createHits(keyword, 10);
        },
        queryAsync(keyword) {
            return Promise.resolve(createHits(keyword, 10));
        },
    };
}
function createHits(keyword, count) {
    return Array.from({ length: count }, (_, i) => ({
        chunkId: `chunk_${keyword}_${i}`,
        documentId: `doc_${keyword}`,
        score: 0.5 + i * 0.1,
        matchType: "keyword",
        snippet: `This is a longer snippet that contains useful information about ${keyword} with some additional text to simulate real content part ${i}. It provides context and details that would appear in a real knowledge retrieval result.`,
        namespace: "test",
        knowledgeRef: `knowledge:doc_${keyword}:chunk_${i}`,
        reasoningSummary: `match for ${keyword}`,
    }));
}
function createMockSemanticGraph() {
    return {
        getChunkConnections: () => ({ sameDocumentRefs: [], sharedKeywordRefs: [] }),
        findChunkKnowledgeRefsByKeyword: () => [],
    };
}
test("performance: KnowledgeQueryService Quick query P99 < 100ms", async () => {
    const retrievalService = createMockRetrievalService();
    const service = new KnowledgeQueryService(retrievalService);
    const latencies = [];
    const iterations = 500;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.queryAsync("authentication", { namespace: "docs" }, QueryLevel.Quick);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    const p50 = latencies[Math.floor(iterations * 0.5)];
    assert.ok(p99 < 100, `KnowledgeQueryService (Quick) P99 latency ${p99.toFixed(3)}ms exceeds 100ms target`);
    assert.ok(p50 < 50, `KnowledgeQueryService (Quick) P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`);
});
test("performance: KnowledgeQueryService Standard query P99 < 500ms", async () => {
    const retrievalService = createMockRetrievalService();
    const service = new KnowledgeQueryService(retrievalService);
    const latencies = [];
    const iterations = 500;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await service.queryAsync("api-design-patterns", { namespace: "docs" }, QueryLevel.Standard);
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    const p50 = latencies[Math.floor(iterations * 0.5)];
    assert.ok(p99 < 500, `KnowledgeQueryService (Standard) P99 latency ${p99.toFixed(3)}ms exceeds 500ms target`);
    assert.ok(p50 < 200, `KnowledgeQueryService (Standard) P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`);
});
test("performance: KnowledgeQueryService async queryAdaptive P99 < 300ms", () => {
    const retrievalService = createMockRetrievalService();
    const service = new KnowledgeQueryService(retrievalService);
    const latencies = [];
    const iterations = 300;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        service.queryAdaptive("testing", { namespace: "docs" });
        latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    assert.ok(p99 < 300, `KnowledgeQueryService (async adaptive) P99 latency ${p99.toFixed(3)}ms exceeds 300ms target`);
});
//# sourceMappingURL=knowledge-perf.test.js.map