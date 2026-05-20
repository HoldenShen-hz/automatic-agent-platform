import assert from "node:assert/strict";
import test from "node:test";

import {
  tokenizeSemantically,
  buildSemanticEmbedding,
  semanticEmbeddingId,
  cosineSimilarity,
} from "../../../../src/platform/five-plane-state-evidence/knowledge/semantic-embedding.js";
import { KeywordKnowledgeIndex } from "../../../../src/platform/five-plane-state-evidence/knowledge/keyword-index.js";
import { KnowledgeArchive } from "../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import { NamespacePolicyStore } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/namespace-policy.js";
import { KnowledgeRetrievalService } from "../../../../src/platform/five-plane-state-evidence/knowledge/retrieval/knowledge-retrieval.js";
import { SemanticKnowledgeGraph } from "../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import { FreshnessTracker } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/freshness-tracker.js";
import { CitationBuilder } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/citation-builder.js";
import { KnowledgeAccessControl } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/access-control.js";
import { SourceTrustPolicyRegistry } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/source-trust-policy.js";
import { KnowledgeAuditLogger } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/knowledge-audit-logger.js";
import { KnowledgeIngestionPipeline } from "../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-ingestion-pipeline.js";
import type { SemanticVectorStore } from "../../../../src/platform/five-plane-state-evidence/knowledge/semantic-vector-store.js";
import type {
  KnowledgeChunk,
  KnowledgeSource,
  RetrievalHit,
} from "../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function makeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: "chunk_test",
    documentId: "doc_test",
    content: "Build retry cache lockfile",
    chunkType: "concept",
    metadata: { relevantFiles: [] },
    embedding: null,
    tokenCount: 5,
    namespace: "test/ns",
    ordinal: 0,
    summary: "Build retry cache lockfile summary",
    keywords: ["build", "retry", "cache"],
    embeddingId: null,
    locator: {},
    ...overrides,
  };
}

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source_test",
    type: "text",
    uri: "memory://test/doc",
    contentHash: "abc123",
    metadata: {},
    ingestedAt: new Date().toISOString(),
    namespace: "test/ns",
    language: null,
    tags: [],
    trustLevel: "verified",
    freshnessTimestamp: new Date().toISOString(),
    checksum: "abc123",
    ...overrides,
  };
}

function makeDocument(overrides: Partial<{ documentId: string; namespace: string; version: number }> = {}) {
  return {
    documentId: "doc_test",
    sourceId: "source_test",
    title: "Test Document",
    version: 1,
    tags: [],
    domainScope: [],
    status: "indexed" as const,
    namespace: "test/ns",
    mimeType: "text/plain",
    rawText: null,
    structuredText: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Semantic Embedding
// ─────────────────────────────────────────────────────────

test("tokenizeSemantically extracts and normalizes tokens", () => {
  const tokens = tokenizeSemantically("Building builds compilation");
  assert.ok(tokens.includes("build"), "should normalize building/builds/compilation to build");
});

test("tokenizeSemantically applies synonym mapping", () => {
  const tokens = tokenizeSemantically("retries retrying failures");
  assert.ok(tokens.includes("retry"), "retries and retrying should map to retry");
  assert.ok(tokens.includes("failure"), "failures should map to failure");
});

test("tokenizeSemantically filters short tokens", () => {
  const tokens = tokenizeSemantically("a an the is at on");
  assert.ok(!tokens.includes("a"), "should filter 2-letter tokens");
  assert.ok(!tokens.includes("an"), "should filter 2-letter tokens");
});

test("tokenizeSemantically removes duplicates", () => {
  const tokens = tokenizeSemantically("build build build");
  assert.equal(tokens.filter((t: string) => t === "build").length, 1, "should dedupe tokens");
});

test("tokenizeSemantically keeps CJK tokens for multilingual knowledge", () => {
  const tokens = tokenizeSemantically("构建失败 需要 清理缓存");
  assert.ok(tokens.includes("构建失败"));
  assert.ok(tokens.includes("清理缓存"));
});

test("buildSemanticEmbedding returns null for empty input", () => {
  const result = buildSemanticEmbedding("");
  assert.equal(result, null);
});

test("buildSemanticEmbedding returns null for input with only short tokens", () => {
  const result = buildSemanticEmbedding("a an is");
  assert.equal(result, null);
});

test("buildSemanticEmbedding produces 32-dim vector", () => {
  const embedding = buildSemanticEmbedding("build retry cache");
  assert.ok(embedding, "should produce embedding");
  assert.equal(embedding!.length, 32, "should be 32 dimensions");
});

test("buildSemanticEmbedding includes extra terms", () => {
  const base = buildSemanticEmbedding("build");
  const withExtra = buildSemanticEmbedding("build", ["retry", "cache"]);
  assert.notEqual(base, null);
  assert.notEqual(withExtra, null);
  assert.notDeepEqual(base, withExtra, "extra terms should change embedding");
});

test("buildSemanticEmbedding normalizes vector", () => {
  const embedding = buildSemanticEmbedding("test input");
  assert.ok(embedding, "should produce embedding");
  const magnitude = Math.sqrt(embedding!.reduce((sum: number, v: number) => sum + v * v, 0));
  assert.ok(Math.abs(magnitude - 1) < 0.01, "should be normalized to unit length");
});

test("semanticEmbeddingId generates stable IDs", () => {
  const id1 = semanticEmbeddingId("build retry");
  const id2 = semanticEmbeddingId("build retry");
  assert.equal(id1, id2, "same input should produce same ID");
  assert.ok(id1?.startsWith("local-hash-v1:"), "ID should have prefix");
});

test("semanticEmbeddingId returns null for empty input", () => {
  assert.equal(semanticEmbeddingId(""), null);
  assert.equal(semanticEmbeddingId("a b"), null); // all tokens too short
});

test("cosineSimilarity returns 0 for null inputs", () => {
  assert.equal(cosineSimilarity(null, null), 0);
  assert.equal(cosineSimilarity(null, [1, 2, 3]), 0);
  assert.equal(cosineSimilarity([1, 2, 3], null), 0);
});

test("cosineSimilarity returns 0 for mismatched lengths", () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2]), 0);
});

test("cosineSimilarity returns 1 for identical vectors", () => {
  const vec = [0.5, 0.5, 0.5, 0.5];
  assert.equal(cosineSimilarity(vec, vec), 1);
});

test("cosineSimilarity returns -1 for opposite vectors", () => {
  const vec1 = [1, 0, 0];
  const vec2 = [-1, 0, 0];
  assert.equal(cosineSimilarity(vec1, vec2), -1);
});

test("cosineSimilarity returns 0 for orthogonal vectors", () => {
  const vec1 = [1, 0, 0];
  const vec2 = [0, 1, 0];
  assert.equal(cosineSimilarity(vec1, vec2), 0);
});

test("cosineSimilarity handles empty vectors", () => {
  assert.equal(cosineSimilarity([], []), 0);
});

// ─────────────────────────────────────────────────────────
// KeywordKnowledgeIndex
// ─────────────────────────────────────────────────────────

test("KeywordKnowledgeIndex.upsert adds chunk to index", () => {
  const index = new KeywordKnowledgeIndex();
  const chunk = makeChunk({ chunkId: "c1", keywords: ["build", "retry"] });
  index.upsert(chunk);

  const hits = index.query("build");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.chunkId, "c1");
});

test("KeywordKnowledgeIndex.upsert allows multiple chunks per keyword", () => {
  const index = new KeywordKnowledgeIndex();
  index.upsert(makeChunk({ chunkId: "c1", keywords: ["build"] }));
  index.upsert(makeChunk({ chunkId: "c2", keywords: ["build"] }));

  const hits = index.query("build");
  assert.equal(hits.length, 2);
});

test("KeywordKnowledgeIndex.query is case-insensitive", () => {
  const index = new KeywordKnowledgeIndex();
  index.upsert(makeChunk({ chunkId: "c1", keywords: ["BUILD"] }));

  const hits = index.query("build");
  assert.equal(hits.length, 1);
});

test("KeywordKnowledgeIndex.query scores by occurrence count", () => {
  const index = new KeywordKnowledgeIndex();
  index.upsert(makeChunk({
    chunkId: "c1",
    content: "build build build retry",
    keywords: ["build"],
  }));

  const hits = index.query("build");
  assert.equal(hits[0]!.score, 3);
});

test("KeywordKnowledgeIndex.reset clears index", () => {
  const index = new KeywordKnowledgeIndex();
  index.upsert(makeChunk({ chunkId: "c1", keywords: ["build"] }));
  index.reset();

  const hits = index.query("build");
  assert.equal(hits.length, 0);
});

// ─────────────────────────────────────────────────────────
// KnowledgeArchive
// ─────────────────────────────────────────────────────────

test("KnowledgeArchive.upsert stores and returns record", () => {
  const archive = new KnowledgeArchive();
  const source = makeSource();
  const chunk = makeChunk();

  const record = archive.upsert({ source, document: makeDocument(), chunks: [chunk] });
  assert.equal(record.source, source);
});

test("KnowledgeArchive.upsert is idempotent on duplicate checksum", () => {
  const archive = new KnowledgeArchive();
  const doc1 = makeDocument({ documentId: "d1" });
  const doc2 = makeDocument({ documentId: "d2" });
  // Use same checksum to trigger version increment
  const source1 = makeSource({ checksum: "same" });
  const source2 = makeSource({ checksum: "same" });

  archive.upsert({ source: source1, document: doc1, chunks: [] });
  const updated = archive.upsert({ source: source2, document: doc2, chunks: [] });

  assert.equal(updated.document.documentId, "d1");
  assert.equal(updated.document.version, 1);
});

test("KnowledgeArchive.getChunk retrieves chunk record", () => {
  const archive = new KnowledgeArchive();
  const chunk = makeChunk({ chunkId: "c1" });
  archive.upsert({ source: makeSource(), document: makeDocument(), chunks: [chunk] });

  const record = archive.getChunk("c1");
  assert.ok(record);
  assert.equal(record!.chunk.chunkId, "c1");
});

test("KnowledgeArchive.list filters by namespace", () => {
  const archive = new KnowledgeArchive();
  archive.upsert({ source: makeSource({ namespace: "ns1" }), document: makeDocument({ documentId: "d1", namespace: "ns1" }), chunks: [] });
  archive.upsert({ source: makeSource({ namespace: "ns2" }), document: makeDocument({ documentId: "d2", namespace: "ns2" }), chunks: [] });

  const ns1Records = archive.list("ns1");
  assert.equal(ns1Records.length, 1);
  assert.equal(ns1Records[0]!.document.documentId, "d1");
});

test("KnowledgeArchive.exportRecords returns distinct records", () => {
  const archive = new KnowledgeArchive();
  // Use unique checksums so both records are stored
  archive.upsert({ source: makeSource({ checksum: "checksum1" }), document: makeDocument({ documentId: "d1" }), chunks: [] });
  archive.upsert({ source: makeSource({ checksum: "checksum2" }), document: makeDocument({ documentId: "d2" }), chunks: [] });

  const records = archive.exportRecords();
  assert.equal(records.length, 2);
});

test("KnowledgeArchive.replace clears and repopulates", () => {
  const archive = new KnowledgeArchive();
  archive.upsert({ source: makeSource(), document: makeDocument({ documentId: "d1" }), chunks: [] });

  archive.replace([]);
  assert.equal(archive.exportRecords().length, 0);
});

// ─────────────────────────────────────────────────────────
// NamespacePolicyStore
// ─────────────────────────────────────────────────────────

test("NamespacePolicyStore.register stores namespace", () => {
  const store = new NamespacePolicyStore();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "manual" as const,
      refreshIntervalHours: null,
    },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  store.register(ns);
  const retrieved = store.get("test/ns");
  assert.ok(retrieved);
  assert.equal(retrieved!.path, "test/ns");
});

test("NamespacePolicyStore.get returns null for unknown namespace", () => {
  const store = new NamespacePolicyStore();
  assert.equal(store.get("unknown"), null);
});

test("NamespacePolicyStore.list returns all namespaces", () => {
  const store = new NamespacePolicyStore();
  store.register({
    namespaceId: "ns1", path: "test/a", description: "A", ownerDomainId: "test",
    accessPolicy: "public", freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified", maxDocuments: 100, maxTotalSizeBytes: 1000000,
  });
  store.register({
    namespaceId: "ns2", path: "test/b", description: "B", ownerDomainId: "test",
    accessPolicy: "public", freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "reviewed", maxDocuments: 100, maxTotalSizeBytes: 1000000,
  });

  const all = store.list();
  assert.equal(all.length, 2);
});

test("NamespacePolicyStore.validate rejects invalid namespace", () => {
  const store = new NamespacePolicyStore();
  const result = store.validate(null);
  assert.ok(!result.valid);
  assert.ok(result.errors.length > 0);
});

test("NamespacePolicyStore.validate rejects empty path", () => {
  const store = new NamespacePolicyStore();
  const result = store.validate({ path: "", freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" } });
  assert.ok(!result.valid);
});

test("NamespacePolicyStore.validate accepts valid namespace", () => {
  const store = new NamespacePolicyStore();
  const result = store.validate({
    namespaceId: "ns1",
    path: "valid/path",
    description: "Valid",
    ownerDomainId: "test",
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
  });
  assert.ok(result.valid);
});

test("NamespacePolicyStore.isStale detects stale namespace", () => {
  const store = new NamespacePolicyStore();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "manual" as const,
      refreshIntervalHours: null,
    },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };
  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  assert.ok(store.isStale(ns, oldDate));
});

// ─────────────────────────────────────────────────────────
// FreshnessTracker
// ─────────────────────────────────────────────────────────

test("FreshnessTracker.assess returns not stale for fresh source", () => {
  const tracker = new FreshnessTracker();
  const source = makeSource({ freshnessTimestamp: new Date().toISOString() });
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "manual" as const,
      refreshIntervalHours: null,
    },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const assessment = tracker.assess(source, ns);
  assert.ok(!assessment.stale);
  assert.equal(assessment.action, null);
});

test("FreshnessTracker.assess returns stale for old source", () => {
  const tracker = new FreshnessTracker();
  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const source = makeSource({ freshnessTimestamp: oldDate });
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "manual" as const,
      refreshIntervalHours: null,
    },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const assessment = tracker.assess(source, ns);
  assert.ok(assessment.stale);
  assert.equal(assessment.action, "warn");
});

test("FreshnessTracker.assess demotes verified trust on stale", () => {
  const tracker = new FreshnessTracker();
  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const source = makeSource({ trustLevel: "verified", freshnessTimestamp: oldDate });
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "demote" as const,
      refreshStrategy: "manual" as const,
      refreshIntervalHours: null,
    },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const assessment = tracker.assess(source, ns);
  assert.equal(assessment.effectiveTrustLevel, "reviewed");
});

// ─────────────────────────────────────────────────────────
// CitationBuilder
// ─────────────────────────────────────────────────────────

test("CitationBuilder.build formats knowledge ref", () => {
  const builder = new CitationBuilder();
  const hit: RetrievalHit = {
    chunkId: "chunk123",
    documentId: "doc456",
    score: 1.5,
    matchType: "keyword",
    snippet: "Test snippet",
    namespace: "test/ns",
    knowledgeRef: "knowledge:chunk123",
  };

  const ref = builder.build(hit);
  assert.equal(ref, "knowledge:chunk123");
});

test("CitationBuilder.buildMany deduplicates", () => {
  const builder = new CitationBuilder();
  const hits: RetrievalHit[] = [
    { chunkId: "c1", documentId: "d1", score: 1, matchType: "keyword", snippet: "s1", namespace: "ns1", knowledgeRef: "knowledge:c1" },
    { chunkId: "c2", documentId: "d1", score: 1, matchType: "keyword", snippet: "s2", namespace: "ns1", knowledgeRef: "knowledge:c2" },
    { chunkId: "c1", documentId: "d1", score: 1, matchType: "keyword", snippet: "s1", namespace: "ns1", knowledgeRef: "knowledge:c1" },
  ];

  const refs = builder.buildMany(hits);
  assert.equal(refs.length, 2);
});

// ─────────────────────────────────────────────────────────
// KnowledgeAccessControl
// ─────────────────────────────────────────────────────────

test("KnowledgeAccessControl.canRead allows public namespace", () => {
  const ac = new KnowledgeAccessControl();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" as const, refreshStrategy: "manual" as const, refreshIntervalHours: null },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  assert.ok(ac.canRead(ns, null));
});

test("KnowledgeAccessControl.canRead denies restricted namespace without permission", () => {
  const ac = new KnowledgeAccessControl();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "other",
    accessPolicy: "restricted" as const,
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" as const, refreshStrategy: "manual" as const, refreshIntervalHours: null },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  assert.ok(!ac.canRead(ns, "test"));
});

test("KnowledgeAccessControl.checkAccess allows admin role", () => {
  const ac = new KnowledgeAccessControl();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" as const, refreshStrategy: "manual" as const, refreshIntervalHours: null },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const decision = ac.checkAccess(ns, {
    action: "admin",
    principal: { principalId: "admin1", domainId: "test", roles: ["admin"] },
  });

  assert.ok(decision.allowed);
});

test("KnowledgeAccessControl.checkAccess same domain read with reader role", () => {
  const ac = new KnowledgeAccessControl();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public" as const,
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" as const, refreshStrategy: "manual" as const, refreshIntervalHours: null },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const decision = ac.checkAccess(ns, {
    action: "read",
    principal: { principalId: "user1", domainId: "test", roles: ["reader"] },
  });

  assert.ok(decision.allowed);
  assert.ok(!decision.crossDomain);
});

test("KnowledgeAccessControl.checkAccess restricted namespace denies cross-domain read", () => {
  const ac = new KnowledgeAccessControl();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "owner",
    accessPolicy: "restricted" as const,
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" as const, refreshStrategy: "manual" as const, refreshIntervalHours: null },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const decision = ac.checkAccess(ns, {
    action: "read",
    principal: { principalId: "user1", domainId: "other", roles: ["reader"] },
  });

  assert.ok(!decision.allowed);
  assert.ok(decision.crossDomain);
});

test("KnowledgeAccessControl.checkAccess allows cross_domain_reader for cross-domain read", () => {
  const ac = new KnowledgeAccessControl();
  const ns = {
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "owner",
    accessPolicy: "public" as const,
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn" as const, refreshStrategy: "manual" as const, refreshIntervalHours: null },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  };

  const decision = ac.checkAccess(ns, {
    action: "read",
    principal: { principalId: "user1", domainId: "other", roles: ["cross_domain_reader"] },
  });

  assert.ok(decision.allowed);
  assert.ok(decision.crossDomain);
});

// ─────────────────────────────────────────────────────────
// SourceTrustPolicyRegistry
// ─────────────────────────────────────────────────────────

test("SourceTrustPolicyRegistry.get returns verified policy", () => {
  const registry = new SourceTrustPolicyRegistry();
  const policy = registry.get("verified");

  assert.equal(policy.level, "verified");
  assert.ok(policy.allowedInFinalResponse);
  assert.equal(policy.maxRetrievalWeight, 1);
});

test("SourceTrustPolicyRegistry.get returns unverified policy", () => {
  const registry = new SourceTrustPolicyRegistry();
  const policy = registry.get("unverified");

  assert.ok(!policy.allowedInFinalResponse);
  assert.ok(policy.humanReviewRequired);
  assert.equal(policy.maxRetrievalWeight, 0.3);
});

test("SourceTrustPolicyRegistry.get returns reviewed policy", () => {
  const registry = new SourceTrustPolicyRegistry();
  const policy = registry.get("reviewed");

  assert.ok(policy.allowedInFinalResponse);
  assert.ok(!policy.humanReviewRequired);
  assert.equal(policy.maxRetrievalWeight, 0.8);
});

// ─────────────────────────────────────────────────────────
// KnowledgeAuditLogger
// ─────────────────────────────────────────────────────────

test("KnowledgeAuditLogger.logAccess records decision", () => {
  const logger = new KnowledgeAuditLogger();
  const decision = {
    allowed: true,
    action: "read" as const,
    principalId: "user1",
    principalDomainId: "test",
    namespace: "test/ns",
    ownerDomainId: "test",
    crossDomain: false,
    reasonCode: "knowledge.access.public",
  };

  logger.logAccess(decision);
  const recent = logger.recent(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0]!.data?.namespace, "test/ns");
});

test("KnowledgeAuditLogger.recent respects limit", () => {
  const logger = new KnowledgeAuditLogger();
  const decision = {
    allowed: true,
    action: "read" as const,
    principalId: "user1",
    principalDomainId: null,
    namespace: "ns",
    ownerDomainId: "test",
    crossDomain: false,
    reasonCode: "test",
  };

  for (let i = 0; i < 10; i++) {
    logger.logAccess({ ...decision, namespace: `ns${i}` });
  }

  const recent = logger.recent(5);
  assert.equal(recent.length, 5);
});

// ─────────────────────────────────────────────────────────
// SemanticKnowledgeGraph
// ─────────────────────────────────────────────────────────

test("SemanticKnowledgeGraph.upsertRecord adds nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  const source = makeSource({ namespace: "test/ns" });
  const chunk = makeChunk({ namespace: "test/ns", keywords: ["build", "retry"] });

  graph.upsertRecord({ source, document: makeDocument({ namespace: "test/ns" }), chunks: [chunk] });

  // Without namespace filter, should get all nodes
  const inspection = graph.inspect({});
  assert.ok(inspection.nodes.length >= 2, `expected >= 2 nodes, got ${inspection.nodes.length}`);
  const nodeTypes = inspection.nodes.map((n) => n.nodeType);
  assert.ok(nodeTypes.includes("namespace"), "should have namespace node");
  assert.ok(nodeTypes.includes("document"), "should have document node");
});

test("SemanticKnowledgeGraph.getChunkConnections returns connections", () => {
  const graph = new SemanticKnowledgeGraph();
  const source = makeSource({ namespace: "test/ns" });
  const chunk = makeChunk({ namespace: "test/ns", keywords: ["build", "retry"] });

  graph.upsertRecord({ source, document: makeDocument({ namespace: "test/ns" }), chunks: [chunk] });

  const connections = graph.getChunkConnections("knowledge:chunk_test");
  assert.ok(connections);
  assert.ok(connections!.keywords.includes("build"));
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword finds chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  const source = makeSource({ namespace: "test/ns" });
  const chunk = makeChunk({ chunkId: "c1", namespace: "test/ns", keywords: ["build"] });

  graph.upsertRecord({ source, document: makeDocument({ namespace: "test/ns" }), chunks: [chunk] });

  const refs = graph.findChunkKnowledgeRefsByKeyword("build", "test/ns");
  assert.ok(refs.length > 0);
});

test("SemanticKnowledgeGraph.replace clears and rebuilds", () => {
  const graph = new SemanticKnowledgeGraph();
  const source = makeSource({ namespace: "test/ns" });
  graph.upsertRecord({ source, document: makeDocument({ namespace: "test/ns" }), chunks: [] });

  graph.replace([]);
  const inspection = graph.inspect({});
  assert.equal(inspection.nodes.length, 0);
});

// ─────────────────────────────────────────────────────────
// KnowledgeRetrievalService
// ─────────────────────────────────────────────────────────

test("KnowledgeRetrievalService.query returns keyword hits from index", () => {
  const index = new KeywordKnowledgeIndex();
  const archive = new KnowledgeArchive();
  const namespaces = new NamespacePolicyStore();
  const chunk = makeChunk({ chunkId: "c1", keywords: ["build"], namespace: "test" });

  // Register namespace
  namespaces.register({
    namespaceId: "ns1",
    path: "test",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  archive.upsert({ source: makeSource(), document: makeDocument({ namespace: "test" }), chunks: [chunk] });
  index.upsert(chunk);

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);

  const hits = retrieval.query("build", { namespace: "test" });
  assert.ok(hits.length > 0, "should find hits for 'build' keyword");
});

test("KnowledgeRetrievalService.filterAuthorizedHits removes unauthorized", () => {
  const index = new KeywordKnowledgeIndex();
  const archive = new KnowledgeArchive();
  const namespaces = new NamespacePolicyStore();
  const chunk = makeChunk({ chunkId: "c1", keywords: ["build"], namespace: "test" });

  namespaces.register({
    namespaceId: "ns1",
    path: "test",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  archive.upsert({ source: makeSource(), document: makeDocument({ namespace: "test" }), chunks: [chunk] });
  index.upsert(chunk);

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);

  const hits: RetrievalHit[] = [
    { chunkId: "c1", documentId: "d1", score: 1, matchType: "keyword", snippet: "s1", namespace: "test", knowledgeRef: "knowledge:c1" },
    { chunkId: "unknown", documentId: "d2", score: 1, matchType: "keyword", snippet: "s2", namespace: "test", knowledgeRef: "knowledge:unknown" },
  ];

  const filtered = retrieval.filterAuthorizedHits(hits);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.chunkId, "c1");
});

test("KnowledgeRetrievalService.queryAsync falls back to local semantic search when vector store fails", async () => {
  const index = new KeywordKnowledgeIndex();
  const archive = new KnowledgeArchive();
  const namespaces = new NamespacePolicyStore();
  const content = "Build failures recover after clearing stale caches before retrying the pipeline";
  const chunk = makeChunk({
    chunkId: "semantic-fallback",
    keywords: [],
    namespace: "test",
    content,
    summary: content,
    embedding: buildSemanticEmbedding(content),
  });
  const failingVectorStore: SemanticVectorStore = {
    backend: "local_hash",
    upsertChunks: async () => undefined,
    querySimilar: async () => {
      throw new Error("vector unavailable");
    },
    inspect: () => ({ backend: "local_hash", ready: false, details: {} }),
  };

  namespaces.register({
    namespaceId: "ns1",
    path: "test",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });
  archive.upsert({ source: makeSource(), document: makeDocument({ namespace: "test" }), chunks: [chunk] });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces, null, failingVectorStore);
  const hits = await retrieval.queryAsync("compilation cache retry", { namespace: "test" });

  assert.equal(hits[0]?.chunkId, "semantic-fallback");
});

// ─────────────────────────────────────────────────────────
// KnowledgeIngestionPipeline
// ─────────────────────────────────────────────────────────

test("KnowledgeIngestionPipeline.ingest creates chunks", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const result = pipeline.ingest({
    title: "Test Doc",
    body: "Build retry cache lockfile",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
  assert.ok(result.source.sourceId.length > 0);
  assert.equal(result.document.title, "Test Doc");
});

test("KnowledgeIngestionPipeline.ingest extracts keywords", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const result = pipeline.ingest({
    title: "Build Retry",
    body: "Build failures usually recover after clearing stale caches",
    namespace: "test/ns",
  });

  const chunk = result.chunks[0]!;
  assert.ok(chunk.keywords.length > 0, "should extract keywords");
});

test("KnowledgeIngestionPipeline.query delegates to retrieval", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns1",
    path: "test/ns",
    description: "Test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: { maxAgeDays: 30, staleAction: "warn", refreshStrategy: "manual", refreshIntervalHours: null },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  pipeline.ingest({ title: "Test", body: "Build retry cache lockfile", namespace: "test/ns" });

  const hits = pipeline.query("build", { namespace: "test/ns" });
  assert.ok(Array.isArray(hits));
});
