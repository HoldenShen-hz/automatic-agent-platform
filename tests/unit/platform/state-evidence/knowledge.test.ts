import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeArchive } from "../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import { CitationBuilder } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/citation-builder.js";
import { FreshnessTracker } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/freshness-tracker.js";
import { KnowledgeAccessControl } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/access-control.js";
import { NamespacePolicyStore } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/namespace-policy.js";
import { SourceTrustPolicyRegistry } from "../../../../src/platform/five-plane-state-evidence/knowledge/governance/source-trust-policy.js";
import { KeywordKnowledgeIndex } from "../../../../src/platform/five-plane-state-evidence/knowledge/keyword-index.js";
import { KnowledgeIngestionPipeline } from "../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-ingestion-pipeline.js";
import {
  buildSemanticEmbedding,
  cosineSimilarity,
  semanticEmbeddingId,
  tokenizeSemantically,
} from "../../../../src/platform/five-plane-state-evidence/knowledge/semantic-embedding.js";
import type {
  KnowledgeChunk,
  KnowledgeNamespace,
  KnowledgeSource,
  RetrievalHit,
} from "../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function createNamespace(overrides: Partial<KnowledgeNamespace> = {}): KnowledgeNamespace {
  return {
    namespaceId: "ns:test",
    path: "test/ns",
    description: "test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "authoritative",
    maxDocuments: 100,
    maxTotalSizeBytes: 1_000_000,
    ...overrides,
  };
}

function createSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source:test",
    type: "text",
    uri: "memory://test/doc",
    contentHash: "hash:test",
    metadata: {},
    ingestedAt: new Date().toISOString(),
    namespace: "test/ns",
    language: null,
    tags: [],
    trustLevel: "authoritative",
    freshnessTimestamp: new Date().toISOString(),
    checksum: "hash:test",
    ...overrides,
  };
}

function createHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: "chunk:test",
    documentId: "document:test",
    score: 1,
    matchType: "keyword",
    snippet: "retry cache summary",
    namespace: "test/ns",
    knowledgeRef: "knowledge:chunk:test",
    ...overrides,
  };
}

test("semantic tokenization and embeddings normalize related terms into stable vectors", () => {
  const tokens = tokenizeSemantically("Building builds retries cache failures");
  const embedding = buildSemanticEmbedding("build retry cache");

  assert.equal(tokens.includes("build"), true);
  assert.equal(tokens.includes("retry"), true);
  assert.equal(tokens.includes("failure"), true);
  assert.equal(embedding?.length, 32);
  assert.equal(semanticEmbeddingId("build retry cache")?.startsWith("local-hash-v1:"), true);
  assert.equal(cosineSimilarity(embedding, embedding), 1);
});

test("KeywordKnowledgeIndex scores hits by keyword occurrence and can be reset", () => {
  const index = new KeywordKnowledgeIndex();
  const chunk: KnowledgeChunk = {
    chunkId: "chunk:1",
    documentId: "document:1",
    content: "build build retry cache",
    chunkType: "concept",
    metadata: { relevantFiles: [] },
    embedding: null,
    tokenCount: 4,
    namespace: "test/ns",
    ordinal: 0,
    summary: "build retry cache",
    keywords: ["build", "retry"],
    embeddingId: null,
    locator: {},
  };

  index.upsert(chunk);
  assert.equal(index.query("build")[0]?.score, 2);

  index.reset();
  assert.equal(index.query("build").length, 0);
});

test("KnowledgeArchive tracks current and historical versions by document id", () => {
  const archive = new KnowledgeArchive();
  const baseRecord = {
    source: createSource({ checksum: "checksum:v1" }),
    document: {
      documentId: "document:test",
      sourceId: "source:test",
      title: "Test Document",
      version: 1,
      tags: [],
      domainScope: [],
      status: "indexed" as const,
      namespace: "test/ns",
      mimeType: "text/plain",
      rawText: "v1",
      structuredText: null,
      archived: false,
      archivedAt: null,
    },
    chunks: [{
      chunkId: "chunk:v1",
      documentId: "document:test",
      content: "v1 content",
      chunkType: "concept" as const,
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 2,
      namespace: "test/ns",
      ordinal: 0,
      summary: "v1",
      keywords: ["v1"],
      embeddingId: null,
      locator: {},
    }],
  };

  archive.upsert(baseRecord);
  archive.upsert({
    ...baseRecord,
    source: createSource({ checksum: "checksum:v2" }),
    document: { ...baseRecord.document, version: 2, rawText: "v2" },
    chunks: [{ ...baseRecord.chunks[0]!, chunkId: "chunk:v2", content: "v2 content", summary: "v2" }],
  });

  assert.equal(archive.listVersions("document:test").length, 2);
  assert.deepEqual(archive.diffDocumentVersions("document:test", 1, 2)?.addedChunkIds, ["chunk:v2"]);
});

test("NamespacePolicyStore validates conflicts and keeps canonical trust-level warnings", () => {
  const store = new NamespacePolicyStore({ strictIsolation: true });
  const registered = store.register(createNamespace());
  const validation = store.validate(createNamespace({
    path: "test/ns.child",
    accessPolicy: "restricted",
    trustLevel: "private_unverified",
  }));

  assert.equal(registered.path, "test/ns");
  assert.equal(validation.valid, true);
  assert.equal(validation.warnings.some((warning) => warning.includes("unverified")), true);
  assert.equal(store.detectPathConflicts("test/ns.child")[0]?.resolution, "reject");
});

test("FreshnessTracker demotes stale authoritative knowledge and CitationBuilder deduplicates refs", () => {
  const tracker = new FreshnessTracker();
  const citations = new CitationBuilder();
  const source = createSource({ freshnessTimestamp: "2020-01-01T00:00:00.000Z" });
  const namespace = createNamespace({
    freshnessPolicy: {
      maxAgeDays: 1,
      staleAction: "demote",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
  });

  const assessment = tracker.assess(source, namespace, new Date("2020-01-10T00:00:00.000Z"));
  const built = citations.buildMany([createHit(), createHit()]);

  assert.equal(assessment.stale, true);
  assert.equal(assessment.action, "demote");
  assert.equal(assessment.effectiveTrustLevel, "official");
  assert.deepEqual(built, ["knowledge:chunk:test"]);
});

test("KnowledgeAccessControl distinguishes public reads from restricted cross-domain access", () => {
  const access = new KnowledgeAccessControl();
  const publicNamespace = createNamespace();
  const restrictedNamespace = createNamespace({
    path: "test/restricted",
    accessPolicy: "restricted",
  });

  const publicDecision = access.checkAccess(publicNamespace, {
    action: "read",
    principal: {
      principalId: "user:1",
      domainId: "other",
      roles: [],
    },
  });
  const restrictedDecision = access.checkAccess(restrictedNamespace, {
    action: "read",
    principal: {
      principalId: "user:2",
      domainId: "other",
      roles: [],
    },
  });

  assert.equal(publicDecision.allowed, true);
  assert.equal(publicDecision.reasonCode, "knowledge.access.public");
  assert.equal(restrictedDecision.allowed, false);
  assert.equal(restrictedDecision.reasonCode, "knowledge.access.cross_domain_denied");
});

test("SourceTrustPolicyRegistry exposes the current canonical trust policy weights", () => {
  const registry = new SourceTrustPolicyRegistry();

  assert.equal(registry.get("authoritative").maxRetrievalWeight, 1);
  assert.equal(registry.get("official").maxRetrievalWeight, 0.85);
  assert.equal(registry.get("team_reviewed").maxRetrievalWeight, 0.65);
  assert.equal(registry.get("private_unverified").humanReviewRequired, true);
});

test("KnowledgeIngestionPipeline indexes authoritative knowledge into archive and keyword retrieval", () => {
  const index = new KeywordKnowledgeIndex();
  const archive = new KnowledgeArchive();
  const namespaces = new NamespacePolicyStore();
  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);

  namespaces.register(createNamespace());
  const result = pipeline.ingest({
    title: "Retry Cache Playbook",
    body: "Build retry cache guidance.\n\nAlways clear stale lockfiles before rebuilding.",
    namespace: "test/ns",
    sourceType: "text",
    trustLevel: "authoritative",
    tags: ["build", "cache"],
  });

  const archiveRecord = archive.getDocument(result.document.documentId);
  const hits = index.query("cache");

  assert.equal(result.document.status, "indexed");
  assert.equal(archiveRecord?.source.trustLevel, "authoritative");
  assert.equal(result.chunks.length > 0, true);
  assert.equal(hits.length > 0, true);
});
