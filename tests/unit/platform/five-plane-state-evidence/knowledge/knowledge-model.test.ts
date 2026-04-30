/**
 * Unit tests for knowledge-model module
 *
 * Tests Zod schemas and types for knowledge plane entities.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TrustLevelSchema,
  KnowledgeNamespaceSchema,
  ChunkingConfigSchema,
  KnowledgeSourceSchema,
  KnowledgeChunkSchema,
  KnowledgeDocumentSchema,
  RetrievalHitSchema,
  SourceTrustPolicySchema,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

test("TrustLevelSchema accepts valid trust levels", () => {
  assert.equal(TrustLevelSchema.parse("private_unverified"), "private_unverified");
  assert.equal(TrustLevelSchema.parse("team_reviewed"), "team_reviewed");
  assert.equal(TrustLevelSchema.parse("official"), "official");
  assert.equal(TrustLevelSchema.parse("authoritative"), "authoritative");
});

test("TrustLevelSchema rejects invalid trust levels", () => {
  assert.throws(() => TrustLevelSchema.parse("invalid"));
  assert.throws(() => TrustLevelSchema.parse(""));
  assert.throws(() => TrustLevelSchema.parse("PRIVATE_UNVERIFIED"));
});

test("KnowledgeNamespaceSchema parses valid namespace", () => {
  const namespace = KnowledgeNamespaceSchema.parse({
    namespaceId: "ns-123",
    path: "/knowledge/test",
    description: "Test namespace",
    ownerDomainId: "domain-1",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "team_reviewed",
  });

  assert.equal(namespace.namespaceId, "ns-123");
  assert.equal(namespace.accessPolicy, "public"); // default
  assert.equal(namespace.maxDocuments, 1000); // default
});

test("KnowledgeNamespaceSchema applies defaults", () => {
  const namespace = KnowledgeNamespaceSchema.parse({
    namespaceId: "ns-123",
    path: "/knowledge/test",
    description: "Test namespace",
    ownerDomainId: "domain-1",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "team_reviewed",
  });

  assert.equal(namespace.accessPolicy, "public");
  assert.equal(namespace.maxDocuments, 1000);
  assert.equal(namespace.maxTotalSizeBytes, 10 * 1024 * 1024);
});

test("KnowledgeNamespaceSchema rejects invalid namespaceId", () => {
  assert.throws(() =>
    KnowledgeNamespaceSchema.parse({
      namespaceId: "",
      path: "/knowledge/test",
      description: "Test namespace",
      ownerDomainId: "domain-1",
      freshnessPolicy: {
        maxAgeDays: 30,
        staleAction: "warn",
        refreshStrategy: "manual",
        refreshIntervalHours: null,
      },
      trustLevel: "team_reviewed",
    })
  );
});

test("ChunkingConfigSchema parses fixed mode", () => {
  const config = ChunkingConfigSchema.parse({
    mode: "fixed",
    fixedConfig: {
      maxTokens: 512,
      overlapTokens: 50,
    },
  });

  assert.equal(config.mode, "fixed");
  assert.equal(config.fixedConfig?.maxTokens, 512);
  assert.equal(config.fixedConfig?.overlapTokens, 50);
});

test("ChunkingConfigSchema parses semantic mode", () => {
  const config = ChunkingConfigSchema.parse({
    mode: "semantic",
    semanticConfig: {
      modelId: "embed-v3",
      minTokens: 100,
      maxTokens: 512,
      coherenceThreshold: 0.8,
    },
  });

  assert.equal(config.mode, "semantic");
  assert.equal(config.semanticConfig?.modelId, "embed-v3");
  assert.equal(config.semanticConfig?.coherenceThreshold, 0.8);
});

test("ChunkingConfigSchema rejects invalid mode", () => {
  assert.throws(() =>
    ChunkingConfigSchema.parse({
      mode: "invalid",
    })
  );
});

test("KnowledgeSourceSchema parses valid source", () => {
  const source = KnowledgeSourceSchema.parse({
    sourceId: "src-1",
    type: "text",
    uri: "https://example.com/doc",
    contentHash: "abc123",
    metadata: { author: "test" },
    ingestedAt: "2024-01-01T00:00:00Z",
    namespace: "ns-1",
    trustLevel: "team_reviewed",
    freshnessTimestamp: "2024-01-01T00:00:00Z",
    checksum: "def456",
  });

  assert.equal(source.sourceId, "src-1");
  assert.equal(source.type, "text");
  assert.deepEqual(source.metadata, { author: "test" });
});

test("KnowledgeSourceSchema applies defaults for optional fields", () => {
  const source = KnowledgeSourceSchema.parse({
    sourceId: "src-1",
    type: "text",
    uri: "https://example.com/doc",
    contentHash: "abc123",
    ingestedAt: "2024-01-01T00:00:00Z",
    namespace: "ns-1",
    trustLevel: "team_reviewed",
    freshnessTimestamp: "2024-01-01T00:00:00Z",
    checksum: "def456",
  });

  assert.equal(source.language, null);
  assert.deepEqual(source.tags, []);
});

test("KnowledgeSourceSchema rejects invalid type", () => {
  assert.throws(() =>
    KnowledgeSourceSchema.parse({
      sourceId: "src-1",
      type: "invalid_type",
      uri: "https://example.com/doc",
      contentHash: "abc123",
      ingestedAt: "2024-01-01T00:00:00Z",
      namespace: "ns-1",
      trustLevel: "team_reviewed",
      freshnessTimestamp: "2024-01-01T00:00:00Z",
      checksum: "def456",
    })
  );
});

test("KnowledgeChunkSchema parses valid chunk", () => {
  const chunk = KnowledgeChunkSchema.parse({
    chunkId: "chunk-1",
    documentId: "doc-1",
    content: "This is test content",
    chunkType: "concept",
    metadata: {
      language: "en",
      framework: "typescript",
      relevantFiles: ["test.ts"],
    },
    embedding: [0.1, 0.2, 0.3],
    tokenCount: 10,
    namespace: "ns-1",
    ordinal: 0,
    summary: "Test summary",
    keywords: ["test", "example"],
    embeddingId: "emb-1",
    locator: {
      page: 1,
      section: "intro",
      lineStart: 1,
      lineEnd: 10,
    },
  });

  assert.equal(chunk.chunkId, "chunk-1");
  assert.equal(chunk.chunkType, "concept");
  assert.deepEqual(chunk.embedding, [0.1, 0.2, 0.3]);
  assert.deepEqual(chunk.keywords, ["test", "example"]);
});

test("KnowledgeChunkSchema applies defaults for optional fields", () => {
  const chunk = KnowledgeChunkSchema.parse({
    chunkId: "chunk-1",
    documentId: "doc-1",
    content: "Test content",
    chunkType: "rule",
    metadata: {},
    tokenCount: 5,
    namespace: "ns-1",
    ordinal: 0,
    summary: "Summary",
    keywords: [],
  });

  assert.equal(chunk.embedding, null);
  assert.equal(chunk.embeddingId, null);
  assert.deepEqual(chunk.metadata.relevantFiles, []);
  assert.deepEqual(chunk.locator, {});
});

test("KnowledgeChunkSchema accepts all chunk types", () => {
  const chunkTypes = ["concept", "rule", "constraint", "example", "api_signature", "error_pattern"] as const;

  for (const chunkType of chunkTypes) {
    const chunk = KnowledgeChunkSchema.parse({
      chunkId: `chunk-${chunkType}`,
      documentId: "doc-1",
      content: "Test content",
      chunkType,
      metadata: {},
      tokenCount: 5,
      namespace: "ns-1",
      ordinal: 0,
      summary: "Summary",
      keywords: [],
    });
    assert.equal(chunk.chunkType, chunkType);
  }
});

test("KnowledgeDocumentSchema parses valid document", () => {
  const doc = KnowledgeDocumentSchema.parse({
    documentId: "doc-1",
    sourceId: "src-1",
    title: "Test Document",
    version: 1,
    tags: ["tag1", "tag2"],
    domainScope: ["domain1"],
    status: "indexed",
    namespace: "ns-1",
    mimeType: "text/plain",
    rawText: "Full text content",
    structuredText: { sections: [] },
    archived: false,
    archivedAt: null,
  });

  assert.equal(doc.documentId, "doc-1");
  assert.equal(doc.status, "indexed");
  assert.deepEqual(doc.structuredText, { sections: [] });
});

test("KnowledgeDocumentSchema applies defaults", () => {
  const doc = KnowledgeDocumentSchema.parse({
    documentId: "doc-1",
    sourceId: "src-1",
    title: "Test Document",
    version: 1,
    namespace: "ns-1",
    mimeType: "text/plain",
  });

  assert.deepEqual(doc.tags, []);
  assert.deepEqual(doc.domainScope, []);
  assert.equal(doc.status, "draft");
  assert.equal(doc.rawText, null);
  assert.equal(doc.structuredText, null);
  assert.equal(doc.archived, false);
  assert.equal(doc.archivedAt, null);
});

test("KnowledgeDocumentSchema accepts all status values", () => {
  const statuses = ["draft", "indexed", "archived", "deprecated"] as const;

  for (const status of statuses) {
    const doc = KnowledgeDocumentSchema.parse({
      documentId: `doc-${status}`,
      sourceId: "src-1",
      title: "Test Document",
      version: 1,
      namespace: "ns-1",
      mimeType: "text/plain",
      status,
    });
    assert.equal(doc.status, status);
  }
});

test("RetrievalHitSchema parses valid retrieval hit", () => {
  const hit = RetrievalHitSchema.parse({
    chunkId: "chunk-1",
    documentId: "doc-1",
    score: 0.95,
    matchType: "semantic",
    snippet: "Relevant content...",
    namespace: "ns-1",
    knowledgeRef: "knowledge:chunk-1",
    reasoningSummary: "Matches query intent",
    rankingSignals: {
      keywordMatches: ["test"],
      exactMatchScore: 0.5,
      semanticSimilarity: 0.9,
      keywordCoverage: 0.8,
      sharedKeywordNeighborCount: 3,
      sameDocumentNeighborCount: 2,
      trustMultiplier: 1.2,
      freshnessMultiplier: 1.0,
      namespaceBoost: 0.1,
      graphBoost: 0.3,
      reasoningPaths: ["path1", "path2"],
    },
  });

  assert.equal(hit.chunkId, "chunk-1");
  assert.equal(hit.matchType, "semantic");
  assert.ok(hit.rankingSignals?.semanticSimilarity === 0.9);
});

test("RetrievalHitSchema applies defaults for optional fields", () => {
  const hit = RetrievalHitSchema.parse({
    chunkId: "chunk-1",
    documentId: "doc-1",
    score: 0.8,
    matchType: "keyword",
    snippet: "Content snippet",
    namespace: "ns-1",
    knowledgeRef: "knowledge:chunk-1",
  });

  assert.equal(hit.reasoningSummary, undefined);
  assert.equal(hit.rankingSignals, undefined);
});

test("RetrievalHitSchema accepts all match types", () => {
  const matchTypes = ["semantic", "keyword", "structural"] as const;

  for (const matchType of matchTypes) {
    const hit = RetrievalHitSchema.parse({
      chunkId: "chunk-1",
      documentId: "doc-1",
      score: 0.8,
      matchType,
      snippet: "Content",
      namespace: "ns-1",
      knowledgeRef: "knowledge:chunk-1",
    });
    assert.equal(hit.matchType, matchType);
  }
});

test("SourceTrustPolicySchema parses valid policy", () => {
  const policy = SourceTrustPolicySchema.parse({
    level: "official",
    allowedInFinalResponse: true,
    requiresCitation: true,
    maxRetrievalWeight: 0.8,
    humanReviewRequired: false,
  });

  assert.equal(policy.level, "official");
  assert.equal(policy.maxRetrievalWeight, 0.8);
});

test("SourceTrustPolicySchema validates maxRetrievalWeight range", () => {
  assert.throws(() =>
    SourceTrustPolicySchema.parse({
      level: "official",
      allowedInFinalResponse: true,
      requiresCitation: true,
      maxRetrievalWeight: 1.5, // > 1.0
      humanReviewRequired: false,
    })
  );

  assert.throws(() =>
    SourceTrustPolicySchema.parse({
      level: "official",
      allowedInFinalResponse: true,
      requiresCitation: true,
      maxRetrievalWeight: -0.1, // < 0
      humanReviewRequired: false,
    })
  );
});
