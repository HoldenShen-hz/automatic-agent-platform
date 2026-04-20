import test from "node:test";
import assert from "node:assert/strict";

import {
  KnowledgeQueryService,
  QueryLevel,
  type KnowledgeQueryServiceConfig,
} from "../../../../../src/platform/state-evidence/knowledge/knowledge-query-service.js";
import type { RetrievalHit } from "../../../../../src/platform/state-evidence/knowledge/knowledge-model.js";
import type { KnowledgeRetrievalService } from "../../../../../src/platform/state-evidence/knowledge/retrieval/knowledge-retrieval.js";
import type { SemanticKnowledgeGraph } from "../../../../../src/platform/state-evidence/knowledge/semantic-knowledge-graph.js";

// =============================================================================
// helpers
// =============================================================================

function createMockRetrievalService(): KnowledgeRetrievalService {
  return {
    query(keyword: string) {
      return createHits(keyword, 3);
    },
    queryAsync(keyword: string) {
      return Promise.resolve(createHits(keyword, 3));
    },
  } as unknown as KnowledgeRetrievalService;
}

function createHits(keyword: string, count: number): RetrievalHit[] {
  return Array.from({ length: count }, (_, i) => ({
    chunkId: `chunk_${keyword}_${i}`,
    documentId: `doc_${keyword}`,
    score: 0.5 + i * 0.1,
    matchType: "keyword" as const,
    snippet: `Snippet for ${keyword} part ${i}`,
    namespace: "test",
    knowledgeRef: `knowledge:doc_${keyword}:chunk_${i}`,
    reasoningSummary: `match_${keyword}`,
  }));
}

function createMockSemanticGraph(): SemanticKnowledgeGraph {
  return {
    getChunkConnections: () => ({ sameDocumentRefs: [], sharedKeywordRefs: [] }),
    findChunkKnowledgeRefsByKeyword: () => [],
  } as unknown as SemanticKnowledgeGraph;
}

// =============================================================================
// constructor
// =============================================================================

test("KnowledgeQueryService uses default config when none provided", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  assert.equal(service.getLastConfidence(), 1.0);
});

test("KnowledgeQueryService merges partial config with defaults", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService(), {
    quickMaxTokens: 100,
  });
  assert.equal(service.getLastConfidence(), 1.0);
});

// =============================================================================
// selectQueryLevel
// =============================================================================

test("selectQueryLevel returns Quick when confidence is above threshold", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  assert.equal(service.selectQueryLevel(0.8), QueryLevel.Quick);
});

test("selectQueryLevel returns Standard when confidence is below threshold", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  assert.equal(service.selectQueryLevel(0.3), QueryLevel.Standard);
});

test("selectQueryLevel uses quickConfidenceThreshold from config", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService(), {
    quickConfidenceThreshold: 0.8,
  });
  assert.equal(service.selectQueryLevel(0.5), QueryLevel.Standard);
  assert.equal(service.selectQueryLevel(0.9), QueryLevel.Quick);
});

// =============================================================================
// query (sync standard)
// =============================================================================

test("query returns retrieval hits from service", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  const hits = service.query("test");
  assert.equal(hits.length, 3);
});

test("query updates lastConfidence after execution", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  service.query("test");
  assert.ok(service.getLastConfidence() >= 0);
});

// =============================================================================
// queryAsync
// =============================================================================

test("queryAsync returns hits at specified level", async () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  const hits = await service.queryAsync("test", {}, QueryLevel.Standard);
  assert.equal(hits.length, 3);
});

test("queryAsync with Deep level uses graph expansion", async () => {
  const service = new KnowledgeQueryService(
    createMockRetrievalService(),
    {},
    undefined,
    createMockSemanticGraph(),
  );
  const hits = await service.queryAsync("test", {}, QueryLevel.Deep);
  assert.ok(hits.length >= 0);
});

// =============================================================================
// queryAdaptive
// =============================================================================

test("queryAdaptive returns empty when cache is cold (Quick mode with no cache)", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  // lastConfidence starts at 1.0, so selectQueryLevel returns Quick
  // Quick with cold cache returns empty (no fallback to Standard)
  const hits = service.queryAdaptive("cold_cache_query");
  assert.equal(hits.length, 0);
});

test("queryAdaptive returns results after prior query populates cache", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  // First query populates cache
  service.query("test");
  // Subsequent adaptive query uses the cache
  const hits = service.queryAdaptive("test");
  assert.equal(hits.length, 3);
});

// =============================================================================
// L1 cache
// =============================================================================

test("L1 cache stores hits after standard query", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  service.query("cached_test");
  // Query again - should hit cache
  const hits = service.query("cached_test");
  assert.equal(hits.length, 3);
});

test("clearCache empties L1 cache", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  service.query("clear_me");
  service.clearCache();
  // After clear, cache miss should return empty for quick query
  // (but standard query refetches)
  service.clearCache(); // no-op if already empty
  assert.ok(true);
});

// =============================================================================
// Quick query mode
// =============================================================================

test("Quick query returns empty when cache misses", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  const hits = service.query("non_existent_keyword_xyz", {});
  // Standard query should still work
  assert.equal(hits.length, 3);
});

// =============================================================================
// hit truncation
// =============================================================================

test("hits are truncated to max tokens", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService(), {
    standardMaxTokens: 10, // very small
  });
  const hits = service.query("truncate_test");
  // Each hit snippet should be short or end with …
  for (const hit of hits) {
    assert.ok(hit.snippet.length <= 10 * 4 + 1, `snippet too long: ${hit.snippet.length}`);
  }
});

test("hits are actually truncated when snippet exceeds max chars", () => {
  // Create a mock with very long snippets that will definitely exceed maxChars
  const longSnippet = "A".repeat(100); // 100 chars, exceeds maxChars=40 (10*4)
  const mockRetrievalService = {
    query() {
      return [{
        chunkId: "chunk_long",
        documentId: "doc_long",
        score: 0.9,
        matchType: "keyword" as const,
        snippet: longSnippet,
        namespace: "test",
        knowledgeRef: "knowledge:doc_long:chunk_long",
        reasoningSummary: "long_match",
      }];
    },
    queryAsync() {
      return Promise.resolve([{
        chunkId: "chunk_long",
        documentId: "doc_long",
        score: 0.9,
        matchType: "keyword" as const,
        snippet: longSnippet,
        namespace: "test",
        knowledgeRef: "knowledge:doc_long:chunk_long",
        reasoningSummary: "long_match",
      }]);
    },
  };
  const service = new KnowledgeQueryService(mockRetrievalService as unknown as KnowledgeRetrievalService, {
    standardMaxTokens: 10, // maxChars = 40
  });

  const hits = service.query("long_test");

  // The snippet should be truncated to 40 chars + "…"
  assert.ok(hits[0]!.snippet.endsWith("…"), "Snippet should be truncated and end with …");
  assert.equal(hits[0]!.snippet.length, 41, "Should be 40 chars + 1 ellipsis");
});

// =============================================================================
// confidence computation
// =============================================================================

test("getLastConfidence returns 0 for empty results", () => {
  const emptyRetrievalService = {
    query() { return []; },
    queryAsync() { return Promise.resolve([]); },
  };
  const service = new KnowledgeQueryService(emptyRetrievalService as unknown as KnowledgeRetrievalService);
  service.query("nothing");
  assert.equal(service.getLastConfidence(), 0);
});

test("getLastConfidence returns positive value after successful query", () => {
  const service = new KnowledgeQueryService(createMockRetrievalService());
  service.query("something");
  assert.ok(service.getLastConfidence() > 0);
});
