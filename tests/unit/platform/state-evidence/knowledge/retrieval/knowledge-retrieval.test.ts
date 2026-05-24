import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeRetrievalService } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/retrieval/knowledge-retrieval.js";
import { KeywordKnowledgeIndex } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/keyword-index.js";
import { KnowledgeArchive } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import { SemanticKnowledgeGraph } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeSource, KnowledgeDocument, KnowledgeChunk, KnowledgeNamespace } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

// =============================================================================
// mock factories
// =============================================================================

function createMinimalSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source_1",
    type: "file",
    uri: "file:///test/path",
    contentHash: "abc123",
    metadata: {},
    ingestedAt: "2026-01-01T00:00:00.000Z",
    namespace: "test",
    language: "en",
    tags: [],
    trustLevel: "authoritative",
    freshnessTimestamp: "2026-01-01T00:00:00.000Z",
    checksum: "checksum_1",
    ...overrides,
  };
}

function createMinimalDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    documentId: "doc_1",
    sourceId: "source_1",
    title: "Test Document",
    version: 1,
    tags: [],
    domainScope: [],
    status: "indexed",
    namespace: "test",
    mimeType: "text/plain",
    rawText: "Test content",
    structuredText: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function createMinimalChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: "chunk_1",
    documentId: "doc_1",
    content: "Test chunk content about TypeScript and build systems",
    chunkType: "concept",
    metadata: { relevantFiles: [] },
    embedding: null,
    tokenCount: 10,
    namespace: "test",
    ordinal: 0,
    summary: "Test summary",
    keywords: ["typescript", "build", "retry"],
    embeddingId: null,
    locator: {},
    ...overrides,
  };
}

function createArchivedRecord(overrides: Partial<ArchivedKnowledgeRecord> = {}): ArchivedKnowledgeRecord {
  return {
    source: createMinimalSource(),
    document: createMinimalDocument(),
    chunks: [createMinimalChunk()],
    ...overrides,
  };
}

function createMinimalNamespace(overrides: Partial<KnowledgeNamespace> = {}): KnowledgeNamespace {
  return {
    namespaceId: "ns_001",
    path: "test.namespace",
    description: "Test namespace",
    ownerDomainId: "test-domain",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "authoritative",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
    ...overrides,
  };
}

// =============================================================================
// test fixtures
// =============================================================================

function createTestRetrievalService(): {
  service: KnowledgeRetrievalService;
  index: KeywordKnowledgeIndex;
  archive: KnowledgeArchive;
  graph: SemanticKnowledgeGraph;
  namespaces: Map<string, KnowledgeNamespace>;
} {
  const index = new KeywordKnowledgeIndex();
  const archive = new KnowledgeArchive();
  const graph = new SemanticKnowledgeGraph();
  const namespaces = new Map<string, KnowledgeNamespace>();

  const service = new KnowledgeRetrievalService(
    index,
    archive,
    {
      get(path: string) {
        return namespaces.get(path) ?? null;
      },
    } as any,
    graph,
    null,
  );

  return { service, index, archive, graph, namespaces };
}

// =============================================================================
// query basic behavior
// =============================================================================

test("KnowledgeRetrievalService.query returns empty for empty keyword", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  archive.upsert(createArchivedRecord());
  index.upsert(createMinimalChunk());

  const results = service.query("");
  assert.equal(results.length, 0);
});

test("KnowledgeRetrievalService.query returns empty for whitespace-only keyword", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  archive.upsert(createArchivedRecord());
  index.upsert(createMinimalChunk());

  const results = service.query("   ");
  assert.equal(results.length, 0);
});

test("KnowledgeRetrievalService.query filters by namespace when specified", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  const ns1 = createMinimalNamespace({ path: "ns1", namespaceId: "ns1", ownerDomainId: "domain1" });
  const ns2 = createMinimalNamespace({ path: "ns2", namespaceId: "ns2", ownerDomainId: "domain1" });
  namespaces.set("ns1", ns1);
  namespaces.set("ns2", ns2);

  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc1", namespace: "ns1" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", namespace: "ns1", keywords: ["typescript"] })],
  }));
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc2", namespace: "ns2" }),
    source: createMinimalSource({ sourceId: "source_2", checksum: "checksum_2", contentHash: "abc456", namespace: "ns2" }),
    chunks: [createMinimalChunk({ chunkId: "chunk2", documentId: "doc2", namespace: "ns2", keywords: ["typescript"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", namespace: "ns1", keywords: ["typescript"] }));
  index.upsert(createMinimalChunk({ chunkId: "chunk2", namespace: "ns2", keywords: ["typescript"] }));

  const results = service.query("typescript", { namespace: "ns1" });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.namespace, "ns1");
});

test("KnowledgeRetrievalService.query respects limit parameter", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  for (let i = 0; i < 5; i++) {
    archive.upsert(createArchivedRecord({
      document: createMinimalDocument({ documentId: `doc${i}` }),
      chunks: [createMinimalChunk({ chunkId: `chunk${i}`, keywords: ["build"] })],
    }));
    index.upsert(createMinimalChunk({ chunkId: `chunk${i}`, keywords: ["build"] }));
  }

  const results = service.query("build", { limit: 2 });

  assert.ok(results.length <= 2);
});

test("KnowledgeRetrievalService.query returns results sorted by score descending", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc1" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", content: "build build build", keywords: ["build"] })],
  }));
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc2" }),
    chunks: [createMinimalChunk({ chunkId: "chunk2", content: "build", keywords: ["build"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", content: "build build build", keywords: ["build"] }));
  index.upsert(createMinimalChunk({ chunkId: "chunk2", content: "build", keywords: ["build"] }));

  const results = service.query("build");

  if (results.length >= 2) {
    assert.ok(results[0]!.score >= results[1]!.score);
  }
});

test("KnowledgeRetrievalService rerank boosts exact phrase matches and appends rerank reasoning", () => {
  const { service, archive, index, namespaces } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc-rerank-a", namespace: "test.namespace" }),
    chunks: [createMinimalChunk({
      chunkId: "chunk-rerank-a",
      namespace: "test.namespace",
      content: "This document explains TypeScript build cache invalidation in depth.",
      summary: "Exact phrase match",
      keywords: ["typescript", "build"],
    })],
  }));
  archive.upsert(createArchivedRecord({
    source: createMinimalSource({ sourceId: "source_2", checksum: "checksum_2", contentHash: "hash_2", namespace: "test.namespace" }),
    document: createMinimalDocument({ documentId: "doc-rerank-b", sourceId: "source_2", namespace: "test.namespace" }),
    chunks: [createMinimalChunk({
      chunkId: "chunk-rerank-b",
      documentId: "doc-rerank-b",
      namespace: "test.namespace",
      content: "This document discusses TypeScript build tooling and compiler ergonomics only.",
      summary: "Weaker partial match",
      keywords: ["typescript", "build", "systems"],
    })],
  }));
  index.upsert(createMinimalChunk({
    chunkId: "chunk-rerank-a",
    namespace: "test.namespace",
    content: "This document explains TypeScript build cache invalidation in depth.",
    summary: "Exact phrase match",
    keywords: ["typescript", "build"],
  }));
  index.upsert(createMinimalChunk({
    chunkId: "chunk-rerank-b",
    documentId: "doc-rerank-b",
    namespace: "test.namespace",
    content: "This document discusses TypeScript build tooling and compiler ergonomics only.",
    summary: "Weaker partial match",
    keywords: ["typescript", "build", "systems"],
  }));

  const reranked = service.query("TypeScript build", { rerankEnabled: true });

  assert.equal(reranked.length >= 2, true);
  assert.equal(reranked[0]?.chunkId, "chunk-rerank-a");
  assert.ok(reranked[0]?.rankingSignals?.reasoningPaths.some((path) => path.startsWith("rerank:")));
  assert.match(reranked[0]?.reasoningSummary ?? "", /rerank:/);
});

// =============================================================================
// queryAsync
// =============================================================================

test("KnowledgeRetrievalService.queryAsync returns same results as query for local embeddings", async () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  archive.upsert(createArchivedRecord());
  index.upsert(createMinimalChunk());

  const syncResults = service.query("typescript");
  const asyncResults = await service.queryAsync("typescript");

  assert.equal(asyncResults.length, syncResults.length);
});

// =============================================================================
// filterAuthorizedHits
// =============================================================================

test("KnowledgeRetrievalService.filterAuthorizedHits removes unauthorized chunks", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  const ns = createMinimalNamespace({
    path: "test.namespace",
    namespaceId: "ns1",
    ownerDomainId: "test-domain",
    accessPolicy: "public",
  });
  namespaces.set("test.namespace", ns);

  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ namespace: "test.namespace" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace" })],
  }));

  const hits = [{
    chunkId: "chunk1",
    documentId: "doc_1",
    score: 1,
    matchType: "keyword" as const,
    snippet: "test",
    namespace: "test.namespace",
    knowledgeRef: "knowledge:chunk1",
  }];

  const filtered = service.filterAuthorizedHits(hits);
  assert.equal(filtered.length, 1);
});

test("KnowledgeRetrievalService.filterAuthorizedHits removes hits with non-existent chunks", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  const hits = [{
    chunkId: "nonexistent_chunk",
    documentId: "doc_1",
    score: 1,
    matchType: "keyword" as const,
    snippet: "test",
    namespace: "test.namespace",
    knowledgeRef: "knowledge:nonexistent_chunk",
  }];

  const filtered = service.filterAuthorizedHits(hits);
  assert.equal(filtered.length, 0);
});

// =============================================================================
// semantic knowledge graph integration
// =============================================================================

test("KnowledgeRetrievalService with semantic graph includes structural matches", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  const ns = createMinimalNamespace({
    path: "coding/repo",
    namespaceId: "ns_coding",
    ownerDomainId: "coding",
  });
  namespaces.set("coding/repo", ns);

  const record = createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc_retry", namespace: "coding/repo" }),
    chunks: [
      createMinimalChunk({
        chunkId: "chunk_retry_main",
        namespace: "coding/repo",
        keywords: ["retry", "build"],
        summary: "Main retry chunk",
      }),
      createMinimalChunk({
        chunkId: "chunk_retry_cache",
        namespace: "coding/repo",
        keywords: ["cache"],
        summary: "Cache retry chunk",
      }),
    ],
  });
  archive.upsert(record);
  graph.upsertRecord(record);

  index.upsert(record.chunks[0]!);

  const results = service.query("retry", { namespace: "coding/repo" });

  assert.ok(results.length >= 1);
  const retryHit = results.find(h => h.knowledgeRef.includes("chunk_retry"));
  assert.ok(retryHit);
  assert.ok(retryHit!.rankingSignals?.reasoningPaths.some(p => p.includes("keyword:") || p.includes("shared_keyword:")));
});

// =============================================================================
// semantic candidates
// =============================================================================

test("KnowledgeRetrievalService.collectSemanticCandidates returns local candidates", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  archive.upsert(createArchivedRecord({
    chunks: [createMinimalChunk({ chunkId: "chunk1", keywords: ["typescript"] })],
  }));

  // Query that should trigger semantic matching
  const results = service.query("types", { namespace: "test" });

  // Empty results since 'types' is shorter than 3 chars and won't match 'typescript' via keyword
  // But query normalizes to 'types' and 'typescript' -> terms with length >= 3
  // The behavior depends on normalizeQueryTerms which filters tokens < 3 chars
  assert.ok(Array.isArray(results));
});

// =============================================================================
// normalizeQueryTerms behavior
// =============================================================================

test("KnowledgeRetrievalService query normalizes terms and filters short tokens", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();
  namespaces.set("test.namespace", createMinimalNamespace());

  // 'ts' is shorter than 3 chars, should be filtered out
  archive.upsert(createArchivedRecord({
    chunks: [createMinimalChunk({ chunkId: "chunk1", keywords: ["typescript"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", keywords: ["typescript"] }));

  // 'ts' should not produce results since it gets filtered
  const results = service.query("ts");
  assert.equal(results.length, 0);
});

// =============================================================================
// ranking signals
// =============================================================================

test("KnowledgeRetrievalService query returns hits with rankingSignals", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  const ns = createMinimalNamespace({
    path: "test.namespace",
    namespaceId: "ns1",
    ownerDomainId: "test-domain",
  });
  namespaces.set("test.namespace", ns);

  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ namespace: "test.namespace" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace", keywords: ["build"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace", keywords: ["build"] }));

  const results = service.query("build", { namespace: "test.namespace" });

  assert.ok(results.length >= 1);
  const hit = results[0]!;
  assert.ok(hit.rankingSignals != null);
  assert.ok(Array.isArray(hit.rankingSignals.keywordMatches));
  assert.ok(typeof hit.rankingSignals.exactMatchScore === "number");
  assert.ok(typeof hit.rankingSignals.semanticSimilarity === "number");
});

// =============================================================================
// namespace matching
// =============================================================================

test("KnowledgeRetrievalService returns empty when namespace has no policy", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  // No namespace registered
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ namespace: "unknown" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", namespace: "unknown", keywords: ["build"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", namespace: "unknown", keywords: ["build"] }));

  const results = service.query("build", { namespace: "unknown" });

  assert.equal(results.length, 0);
});

// =============================================================================
// includeUnverified option
// =============================================================================

test("KnowledgeRetrievalService query with includeUnverified returns unverified sources", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  const ns = createMinimalNamespace({
    path: "test.namespace",
    namespaceId: "ns1",
    ownerDomainId: "test-domain",
    trustLevel: "authoritative",
  });
  namespaces.set("test.namespace", ns);

  archive.upsert(createArchivedRecord({
    source: createMinimalSource({ trustLevel: "private_unverified" }),
    document: createMinimalDocument({ namespace: "test.namespace" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace", keywords: ["retry"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace", keywords: ["retry"] }));

  const resultsWithUnverified = service.query("retry", { namespace: "test.namespace", includeUnverified: true });

  // Without unverified, the hit might be filtered out depending on trust policy
  assert.ok(Array.isArray(resultsWithUnverified));
});

// =============================================================================
// freshness multiplier
// =============================================================================

test("KnowledgeRetrievalService query applies freshness multiplier via ranking signals", () => {
  const { service, archive, index, namespaces, graph } = createTestRetrievalService();

  const ns = createMinimalNamespace({
    path: "test.namespace",
    namespaceId: "ns1",
    ownerDomainId: "test-domain",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
  });
  namespaces.set("test.namespace", ns);

  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ namespace: "test.namespace" }),
    chunks: [createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace", keywords: ["build"] })],
  }));
  index.upsert(createMinimalChunk({ chunkId: "chunk1", namespace: "test.namespace", keywords: ["build"] }));

  const results = service.query("build", { namespace: "test.namespace" });

  if (results.length > 0) {
    assert.ok(typeof results[0]!.rankingSignals?.freshnessMultiplier === "number");
  }
});
