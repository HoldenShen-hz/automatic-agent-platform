import test from "node:test";
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

test("TrustLevelSchema accepts valid values", () => {
  assert.equal(TrustLevelSchema.parse("verified"), "authoritative");
  assert.equal(TrustLevelSchema.parse("reviewed"), "official");
  assert.equal(TrustLevelSchema.parse("community"), "team_reviewed");
  assert.equal(TrustLevelSchema.parse("unverified"), "private_unverified");
});

test("TrustLevelSchema rejects invalid values", () => {
  assert.throws(() => TrustLevelSchema.parse("invalid"));
  assert.throws(() => TrustLevelSchema.parse(""));
});

test("KnowledgeNamespaceSchema parses valid namespace", () => {
  const namespace = {
    namespaceId: "ns_001",
    path: "/knowledge/product",
    description: "Product knowledge base",
    ownerDomainId: "product",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "scheduled" as const,
      refreshIntervalHours: 24,
    },
    trustLevel: "verified" as const,
  };

  const result = KnowledgeNamespaceSchema.parse(namespace);

  assert.equal(result.namespaceId, "ns_001");
  assert.equal(result.accessPolicy, "public"); // default
  assert.equal(result.maxDocuments, 1000); // default
  assert.equal(result.maxTotalSizeBytes, 10 * 1024 * 1024); // default
});

test("KnowledgeNamespaceSchema applies defaults correctly", () => {
  const namespace = {
    namespaceId: "ns_001",
    path: "/knowledge/product",
    description: "Product knowledge base",
    ownerDomainId: "product",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "scheduled" as const,
      refreshIntervalHours: 24,
    },
    trustLevel: "verified" as const,
  };

  const result = KnowledgeNamespaceSchema.parse(namespace);

  assert.equal(result.accessPolicy, "public");
  assert.equal(result.maxDocuments, 1000);
  assert.equal(result.maxTotalSizeBytes, 10 * 1024 * 1024);
});

test("ChunkingConfigSchema parses fixed mode config", () => {
  const config = {
    mode: "fixed" as const,
    fixedConfig: {
      maxTokens: 512,
      overlapTokens: 50,
    },
  };

  const result = ChunkingConfigSchema.parse(config);

  assert.equal(result.mode, "fixed");
  assert.equal(result.fixedConfig!.maxTokens, 512);
  assert.equal(result.fixedConfig!.overlapTokens, 50);
});

test("ChunkingConfigSchema parses section_aware mode config", () => {
  const config = {
    mode: "section_aware" as const,
    sectionConfig: {
      headingLevels: [1, 2, 3],
      codeBoundaries: ["function", "class"] as const,
      maxTokensPerSection: 1000,
    },
  };

  const result = ChunkingConfigSchema.parse(config);

  assert.equal(result.mode, "section_aware");
  assert.deepEqual(result.sectionConfig!.headingLevels, [1, 2, 3]);
  assert.deepEqual(result.sectionConfig!.codeBoundaries, ["function", "class"]);
});

test("ChunkingConfigSchema parses semantic mode config", () => {
  const config = {
    mode: "semantic" as const,
    semanticConfig: {
      modelId: "embedding-model-v2",
      minTokens: 50,
      maxTokens: 500,
      coherenceThreshold: 0.85,
    },
  };

  const result = ChunkingConfigSchema.parse(config);

  assert.equal(result.mode, "semantic");
  assert.equal(result.semanticConfig!.modelId, "embedding-model-v2");
  assert.equal(result.semanticConfig!.coherenceThreshold, 0.85);
});

test("KnowledgeSourceSchema parses valid source", () => {
  const source = {
    sourceId: "src_001",
    type: "file" as const,
    uri: "s3://bucket/docs/readme.md",
    contentHash: "abc123",
    metadata: { author: "system" },
    ingestedAt: "2024-01-01T00:00:00.000Z",
    namespace: "ns_001",
    language: "en",
    tags: ["documentation", "readme"],
    trustLevel: "verified" as const,
    freshnessTimestamp: "2024-01-01T00:00:00.000Z",
    checksum: "def456",
  };

  const result = KnowledgeSourceSchema.parse(source);

  assert.equal(result.sourceId, "src_001");
  assert.equal(result.type, "file");
  assert.equal(result.metadata.author, "system");
});

test("KnowledgeSourceSchema applies defaults", () => {
  const source = {
    sourceId: "src_001",
    type: "url" as const,
    uri: "https://example.com",
    contentHash: "abc123",
    ingestedAt: "2024-01-01T00:00:00.000Z",
    namespace: "ns_001",
    trustLevel: "community" as const,
    freshnessTimestamp: "2024-01-01T00:00:00.000Z",
    checksum: "def456",
  };

  const result = KnowledgeSourceSchema.parse(source);

  assert.equal(result.language, null);
  assert.deepEqual(result.tags, []);
});

test("KnowledgeChunkSchema parses valid chunk", () => {
  const chunk = {
    chunkId: "chunk_001",
    documentId: "doc_001",
    content: "This is the chunk content",
    chunkType: "concept" as const,
    metadata: {
      language: "en",
      framework: "react",
    },
    embedding: [0.1, 0.2, 0.3],
    tokenCount: 10,
    namespace: "ns_001",
    ordinal: 0,
    summary: "A brief summary",
    keywords: ["test", "concept"],
    embeddingId: "emb_001",
    locator: {
      page: 1,
      section: "introduction",
      lineStart: 10,
      lineEnd: 15,
    },
  };

  const result = KnowledgeChunkSchema.parse(chunk);

  assert.equal(result.chunkId, "chunk_001");
  assert.equal(result.chunkType, "concept");
  assert.deepEqual(result.embedding, [0.1, 0.2, 0.3]);
});

test("KnowledgeChunkSchema applies metadata defaults", () => {
  const chunk = {
    chunkId: "chunk_001",
    documentId: "doc_001",
    content: "Content",
    chunkType: "rule" as const,
    tokenCount: 5,
    namespace: "ns_001",
    ordinal: 0,
    summary: "Summary",
  };

  const result = KnowledgeChunkSchema.parse(chunk);

  assert.deepEqual(result.metadata.relevantFiles, []);
  assert.equal(result.embedding, null);
  assert.equal(result.embeddingId, null);
});

test("KnowledgeDocumentSchema parses valid document", () => {
  const doc = {
    documentId: "doc_001",
    sourceId: "src_001",
    title: "Test Document",
    version: 1,
    tags: ["test"],
    domainScope: ["product"],
    status: "indexed" as const,
    namespace: "ns_001",
    mimeType: "text/markdown",
    rawText: "Document content",
  };

  const result = KnowledgeDocumentSchema.parse(doc);

  assert.equal(result.documentId, "doc_001");
  assert.equal(result.status, "indexed");
  assert.equal(result.archived, false);
  assert.equal(result.archivedAt, null);
});

test("RetrievalHitSchema parses valid hit", () => {
  const hit = {
    chunkId: "chunk_001",
    documentId: "doc_001",
    score: 0.95,
    matchType: "semantic" as const,
    snippet: "Relevant content snippet",
    namespace: "ns_001",
    knowledgeRef: "doc_001/chunk_001",
    rankingSignals: {
      keywordMatches: ["test"],
      exactMatchScore: 0.8,
      semanticSimilarity: 0.95,
      keywordCoverage: 0.7,
      sharedKeywordNeighborCount: 2,
      sameDocumentNeighborCount: 3,
      trustMultiplier: 1.2,
      freshnessMultiplier: 1.0,
      namespaceBoost: 0.5,
      graphBoost: 0.1,
      reasoningPaths: ["path1", "path2"],
    },
  };

  const result = RetrievalHitSchema.parse(hit);

  assert.equal(result.score, 0.95);
  assert.equal(result.matchType, "semantic");
  assert.equal(result.rankingSignals!.exactMatchScore, 0.8);
});

test("SourceTrustPolicySchema parses valid policy", () => {
  const policy = {
    level: "verified" as const,
    allowedInFinalResponse: true,
    requiresCitation: true,
    maxRetrievalWeight: 0.8,
    humanReviewRequired: false,
  };

  const result = SourceTrustPolicySchema.parse(policy);

  assert.equal(result.level, "authoritative");
  assert.equal(result.allowedInFinalResponse, true);
});

test("KnowledgeNamespaceSchema rejects invalid freshnessPolicy", () => {
  const namespace = {
    namespaceId: "ns_001",
    path: "/knowledge/product",
    description: "Product knowledge base",
    ownerDomainId: "product",
    freshnessPolicy: {
      maxAgeDays: -5, // invalid: must be positive
      staleAction: "warn" as const,
      refreshStrategy: "scheduled" as const,
      refreshIntervalHours: 24,
    },
    trustLevel: "verified" as const,
  };

  assert.throws(() => KnowledgeNamespaceSchema.parse(namespace));
});

test("KnowledgeChunkSchema rejects invalid chunkType", () => {
  const chunk = {
    chunkId: "chunk_001",
    documentId: "doc_001",
    content: "Content",
    chunkType: "invalid_type" as any,
    tokenCount: 5,
    namespace: "ns_001",
    ordinal: 0,
    summary: "Summary",
  };

  assert.throws(() => KnowledgeChunkSchema.parse(chunk));
});

test("RetrievalHitSchema makes rankingSignals optional", () => {
  const hit = {
    chunkId: "chunk_001",
    documentId: "doc_001",
    score: 0.5,
    matchType: "keyword" as const,
    snippet: "Content",
    namespace: "ns_001",
    knowledgeRef: "ref",
  };

  const result = RetrievalHitSchema.parse(hit);

  assert.equal(result.rankingSignals, undefined);
});

test("ChunkingConfigSchema accepts without mode-specific config (configs are optional)", () => {
  const config = {
    mode: "fixed" as const,
    // fixedConfig is optional, so this should parse successfully
  };

  const result = ChunkingConfigSchema.parse(config);
  assert.equal(result.mode, "fixed");
  assert.equal(result.fixedConfig, undefined);
});
