import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgePlaneService } from "../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";

test("Knowledge retrieval applies graph-aware semantic reranking and structural neighbors", () => {
  const plane = new KnowledgePlaneService();

  plane.registerNamespace({
    namespaceId: "ns_coding_repo",
    path: "coding/repo",
    description: "Coding repo knowledge",
    ownerDomainId: "coding",
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

  const verified = plane.ingest({
    title: "Retry playbook",
    body: "Retry the build after clearing stale caches.\n\nInspect dependency lockfiles before escalating persistent failures.",
    namespace: "coding/repo",
    sourceType: "text",
    trustLevel: "verified",
  });
  const community = plane.ingest({
    title: "Community retry tip",
    body: "Retry long-running jobs once before escalating to incident response.",
    namespace: "coding/repo",
    sourceType: "text",
    trustLevel: "community",
  });

  const hits = plane.query("retry build", {
    namespace: "coding/repo",
    limit: 5,
  });

  assert.ok(hits.length >= 3);
  const directHit = hits.find((hit) => hit.knowledgeRef === `knowledge:${verified.chunks[0]!.chunkId}`);
  const structuralHit = hits.find((hit) => hit.knowledgeRef === `knowledge:${verified.chunks[1]!.chunkId}`);
  const communityHit = hits.find((hit) => hit.knowledgeRef === `knowledge:${community.chunks[0]!.chunkId}`);

  assert.ok(directHit);
  assert.equal(directHit?.matchType, "keyword");
  assert.ok(directHit?.rankingSignals?.keywordMatches.includes("retry"));
  assert.ok(directHit?.reasoningSummary?.includes("keyword:"));

  assert.ok(structuralHit);
  assert.equal(structuralHit?.matchType, "structural");
  assert.ok((structuralHit?.rankingSignals?.sameDocumentNeighborCount ?? 0) > 0);
  assert.ok(structuralHit?.reasoningSummary?.includes("same_document:"));

  assert.ok(communityHit);
  assert.ok((directHit?.score ?? 0) > (communityHit?.score ?? 0));
});

test("Knowledge retrieval returns lightweight semantic matches from local embeddings", () => {
  const plane = new KnowledgePlaneService();

  plane.registerNamespace({
    namespaceId: "ns_shared_common",
    path: "shared/common",
    description: "Shared common knowledge",
    ownerDomainId: "shared",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 90,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "reviewed",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const semanticDoc = plane.ingest({
    title: "Build diagnostics",
    body: "Build failures usually recover after clearing stale caches and re-running the pipeline once.",
    namespace: "shared/common",
    sourceType: "text",
    trustLevel: "reviewed",
  });

  const hits = plane.query("compilation", {
    namespace: "shared/common",
    limit: 5,
  });

  const semanticHit = hits.find((hit) => hit.knowledgeRef === `knowledge:${semanticDoc.chunks[0]!.chunkId}`);
  assert.ok(semanticHit);
  assert.equal(semanticHit?.matchType, "semantic");
  assert.ok((semanticHit?.rankingSignals?.semanticSimilarity ?? 0) >= 0.18);
  assert.ok(semanticHit?.reasoningSummary?.includes("semantic:"));
});

test("Knowledge retrieval returns empty results for unregistered namespace", () => {
  const plane = new KnowledgePlaneService();

  plane.registerNamespace({
    namespaceId: "ns_registered",
    path: "registered/namespace",
    description: "Registered namespace",
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

  const hits = plane.query("retry build", {
    namespace: "unregistered/namespace",
    limit: 5,
  });

  assert.equal(hits.length, 0);
});
