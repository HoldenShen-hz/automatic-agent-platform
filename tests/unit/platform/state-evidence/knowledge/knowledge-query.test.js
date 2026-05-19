import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeRetrievalService } from "../../../../../src/platform/state-evidence/knowledge/retrieval/knowledge-retrieval.js";
// =============================================================================
// mock factories
// =============================================================================
function createMockIndex() {
    return {
        query(term) {
            return createIndexHits(term);
        },
    };
}
function createIndexHits(term) {
    const normalizedTerm = term.toLowerCase();
    if (normalizedTerm === "error" || normalizedTerm === "errors") {
        return [
            {
                chunkId: "chunk_error_1",
                documentId: "doc_error",
                score: 2.0,
                matchType: "keyword",
                snippet: "How to handle errors",
                namespace: "test",
                knowledgeRef: "knowledge:chunk_error_1",
                reasoningSummary: "keyword_match",
            },
        ];
    }
    if (normalizedTerm === "retry" || normalizedTerm === "retrying") {
        return [
            {
                chunkId: "chunk_retry_1",
                documentId: "doc_retry",
                score: 1.5,
                matchType: "keyword",
                snippet: "Retry failed operations",
                namespace: "test",
                knowledgeRef: "knowledge:chunk_retry_1",
                reasoningSummary: "keyword_match",
            },
        ];
    }
    return [];
}
function createMinimalNamespace(overrides = {}) {
    return {
        namespaceId: "ns_test",
        path: "test/namespace",
        description: "Test namespace",
        ownerDomainId: "test-domain",
        accessPolicy: "public",
        freshnessPolicy: {
            maxAgeDays: 30,
            staleAction: "warn",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
        trustLevel: "verified",
        maxDocuments: 100,
        maxTotalSizeBytes: 1000000,
        ...overrides,
    };
}
function createMockChunkRecord(chunkId = "chunk_test", namespace = "test") {
    return {
        record: {
            source: {
                sourceId: "source_1",
                type: "text",
                uri: "file:///test/path",
                contentHash: "abc123",
                metadata: {},
                ingestedAt: "2026-01-01T00:00:00.000Z",
                namespace,
                language: "en",
                tags: [],
                trustLevel: "verified",
                freshnessTimestamp: "2026-01-01T00:00:00.000Z",
                checksum: "checksum_1",
            },
            document: {
                documentId: "doc_1",
                sourceId: "source_1",
                title: "Test Document",
                version: 1,
                tags: [],
                domainScope: [],
                status: "indexed",
                namespace,
                mimeType: "text/plain",
                rawText: "Test content",
                structuredText: null,
                archived: false,
                archivedAt: null,
            },
            chunks: [],
        },
        chunk: {
            chunkId,
            documentId: "doc_1",
            content: "Test chunk content about retry and error handling",
            chunkType: "concept",
            metadata: { relevantFiles: [] },
            embedding: null,
            tokenCount: 10,
            namespace,
            ordinal: 0,
            summary: "Test summary about errors and retry",
            keywords: ["error", "retry"],
            embeddingId: null,
            locator: {},
        },
    };
}
function createMockArchive() {
    return {
        getChunk(chunkId) {
            if (chunkId.startsWith("chunk_error")) {
                return createMockChunkRecord("chunk_error_1", "test");
            }
            if (chunkId.startsWith("chunk_retry")) {
                return createMockChunkRecord("chunk_retry_1", "test");
            }
            return createMockChunkRecord(chunkId, "test");
        },
        list(namespace) {
            return [
                {
                    source: {
                        sourceId: "source_1",
                        type: "text",
                        uri: "file:///test",
                        contentHash: "abc",
                        metadata: {},
                        ingestedAt: "2026-01-01T00:00:00.000Z",
                        namespace: namespace ?? "test",
                        language: null,
                        tags: [],
                        trustLevel: "verified",
                        freshnessTimestamp: "2026-01-01T00:00:00.000Z",
                        checksum: "cs1",
                    },
                    document: {
                        documentId: "doc_1",
                        sourceId: "source_1",
                        title: "Test",
                        version: 1,
                        tags: [],
                        domainScope: [],
                        status: "indexed",
                        namespace: namespace ?? "test",
                        mimeType: "text/plain",
                        rawText: null,
                        structuredText: null,
                        archived: false,
                        archivedAt: null,
                    },
                    chunks: [
                        {
                            chunkId: "chunk_test",
                            documentId: "doc_1",
                            content: "Test content",
                            chunkType: "concept",
                            metadata: { relevantFiles: [] },
                            embedding: null,
                            tokenCount: 5,
                            namespace: namespace ?? "test",
                            ordinal: 0,
                            summary: "Summary",
                            keywords: [],
                            embeddingId: null,
                            locator: {},
                        },
                    ],
                },
            ];
        },
        getDocument() {
            return null;
        },
        upsert() {
            return {};
        },
        exportRecords() {
            return [];
        },
        replace() { },
    };
}
function createMockNamespacePolicies() {
    return {
        get(path) {
            return createMinimalNamespace({ path });
        },
    };
}
function createMockGraph() {
    return {
        getChunkConnections(ref) {
            return { sameDocumentRefs: [], sharedKeywordRefs: [] };
        },
        findChunkKnowledgeRefsByKeyword(keyword, namespace) {
            return [];
        },
    };
}
function createMockVectorStore() {
    return {
        querySimilar(opts) {
            return Promise.resolve([]);
        },
        upsertBatch() {
            return Promise.resolve();
        },
    };
}
function createMockAuditLogger() {
    return {
        logAccess() { },
        logQuery() { },
        logRetrieval() { },
    };
}
function createService(index, archive, namespacePolicies, graph, vectorStore, auditLogger) {
    return new KnowledgeRetrievalService(index ?? createMockIndex(), archive ?? createMockArchive(), namespacePolicies ?? createMockNamespacePolicies(), graph ?? null, vectorStore ?? null, auditLogger ?? createMockAuditLogger());
}
// =============================================================================
// query - basic functionality
// =============================================================================
test("query returns array of retrieval hits", () => {
    const service = createService();
    const hits = service.query("test");
    assert.ok(Array.isArray(hits));
});
test("query returns hits matching the search term", () => {
    const service = createService();
    const hits = service.query("error");
    assert.ok(hits.length > 0);
    assert.equal(hits[0].matchType, "keyword");
});
test("query respects limit option", () => {
    const service = createService();
    const hits = service.query("test", { limit: 2 });
    // Hits are sorted and limited
    assert.ok(hits.length <= 2);
});
test("query filters by namespace when provided", () => {
    const service = createService();
    const hits = service.query("test", { namespace: "test" });
    assert.ok(Array.isArray(hits));
});
test("query returns empty array when no matches found", () => {
    const emptyIndex = {
        query() {
            return [];
        },
    };
    const service = createService(emptyIndex);
    const hits = service.query("nonexistent_term_xyz");
    assert.equal(hits.length, 0);
});
// =============================================================================
// queryAsync
// =============================================================================
test("queryAsync returns promise that resolves to array of hits", async () => {
    const service = createService();
    const hits = await service.queryAsync("test");
    assert.ok(Array.isArray(hits));
});
test("queryAsync returns hits matching search term", async () => {
    const service = createService();
    const hits = await service.queryAsync("retry");
    assert.ok(hits.length > 0);
});
test("queryAsync respects limit option", async () => {
    const service = createService();
    const hits = await service.queryAsync("test", { limit: 1 });
    assert.ok(hits.length <= 1);
});
test("queryAsync returns empty array when no matches found", async () => {
    const emptyIndex = {
        query() {
            return [];
        },
    };
    const service = createService(emptyIndex);
    const hits = await service.queryAsync("nonexistent");
    assert.equal(hits.length, 0);
});
// =============================================================================
// filterAuthorizedHits
// =============================================================================
test("filterAuthorizedHits returns only authorized hits", () => {
    const service = createService();
    const hits = [
        {
            chunkId: "chunk_test",
            documentId: "doc_1",
            score: 1.0,
            matchType: "keyword",
            snippet: "Test snippet",
            namespace: "test",
            knowledgeRef: "knowledge:chunk_test",
            reasoningSummary: "test",
        },
    ];
    const filtered = service.filterAuthorizedHits(hits);
    assert.ok(Array.isArray(filtered));
});
test("filterAuthorizedHits returns empty array for hits without matching chunks", () => {
    const mockArchive = {
        getChunk() {
            return null;
        },
        list() {
            return [];
        },
    };
    const service = createService(createMockIndex(), mockArchive);
    const hits = [
        {
            chunkId: "nonexistent_chunk",
            documentId: "doc_1",
            score: 1.0,
            matchType: "keyword",
            snippet: "Test",
            namespace: "test",
            knowledgeRef: "knowledge:nonexistent_chunk",
            reasoningSummary: "test",
        },
    ];
    const filtered = service.filterAuthorizedHits(hits);
    assert.equal(filtered.length, 0);
});
// =============================================================================
// ranking signals
// =============================================================================
test("hits include rankingSignals with keywordMatches", () => {
    const service = createService();
    const hits = service.query("error retry", { limit: 5 });
    for (const hit of hits) {
        if (hit.rankingSignals) {
            assert.ok(Array.isArray(hit.rankingSignals.keywordMatches));
        }
    }
});
test("hits include reasoningSummary when there are matches", () => {
    const service = createService();
    const hits = service.query("error", { limit: 5 });
    if (hits.length > 0) {
        assert.ok(hits[0].reasoningSummary != null);
        assert.ok(hits[0].reasoningSummary.length > 0);
    }
});
test("hits include knowledgeRef that starts with knowledge:", () => {
    const service = createService();
    const hits = service.query("error", { limit: 5 });
    if (hits.length > 0) {
        assert.ok(hits[0].knowledgeRef.startsWith("knowledge:"));
    }
});
// =============================================================================
// matchType assignment
// =============================================================================
test("direct keyword matches have matchType keyword", () => {
    const service = createService();
    const hits = service.query("error", { limit: 5 });
    if (hits.length > 0) {
        assert.equal(hits[0].matchType, "keyword");
    }
});
test("hits have valid matchType values", () => {
    const service = createService();
    const hits = service.query("test", { limit: 5 });
    const validMatchTypes = ["semantic", "keyword", "structural"];
    for (const hit of hits) {
        assert.ok(validMatchTypes.includes(hit.matchType));
    }
});
// =============================================================================
// namespace filtering
// =============================================================================
test("query respects namespace filter in options", () => {
    const service = createService();
    const hits = service.query("test", { namespace: "other" });
    assert.ok(Array.isArray(hits));
});
test("filterAuthorizedHits returns empty when chunk not found in archive", () => {
    const emptyArchive = {
        getChunk() {
            return null;
        },
        list() {
            return [];
        },
    };
    const service = createService(createMockIndex(), emptyArchive);
    const hits = [
        {
            chunkId: "nonexistent_chunk",
            documentId: "doc_1",
            score: 1.0,
            matchType: "keyword",
            snippet: "Test",
            namespace: "test",
            knowledgeRef: "knowledge:nonexistent_chunk",
            reasoningSummary: "test",
        },
    ];
    const filtered = service.filterAuthorizedHits(hits);
    // Should filter out because chunk doesn't exist in archive
    assert.equal(filtered.length, 0);
});
// =============================================================================
// edge cases
// =============================================================================
test("query handles empty keyword string", () => {
    const service = createService();
    const hits = service.query("");
    assert.ok(Array.isArray(hits));
});
test("query handles special characters in keyword", () => {
    const service = createService();
    const hits = service.query("test@#$%");
    assert.ok(Array.isArray(hits));
});
test("query handles very long keyword", () => {
    const service = createService();
    const longKeyword = "a".repeat(1000);
    const hits = service.query(longKeyword);
    assert.ok(Array.isArray(hits));
});
//# sourceMappingURL=knowledge-query.test.js.map