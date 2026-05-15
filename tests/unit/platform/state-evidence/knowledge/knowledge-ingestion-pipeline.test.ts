import test from "node:test";
import assert from "node:assert/strict";

import { AstStructuralIndex } from "../../../../../src/platform/five-plane-state-evidence/knowledge/indexing/ast-index.js";
import { KnowledgeIngestionPipeline } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-ingestion-pipeline.js";

test("KnowledgeIngestionPipeline ingests documents and serves keyword queries", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns_1",
    path: "ops/incident",
    description: "Ops incident knowledge",
    ownerDomainId: "ops",
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
  const result = pipeline.ingest({
    title: "Deployment Recovery",
    body: "Rollback immediately on canary failure.\n\nEscalate provider outages to the operator.",
    namespace: "ops/incident",
    sourceType: "text",
    trustLevel: "verified",
  });

  assert.equal(result.chunks.length, 2);
  assert.ok(pipeline.query("rollback", { domainId: "ops" }).length >= 1);
  assert.equal(result.source.trustLevel, "authoritative");
  assert.equal(pipeline.query("rollback", { domainId: "coding" }).length >= 1, true);
  assert.equal(result.document.status, "indexed");
});

test("KnowledgeIngestionPipeline handles empty query results", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns_2",
    path: "ops/empty",
    description: "Empty namespace",
    ownerDomainId: "ops",
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

  const results = pipeline.query("nonexistent_term", { domainId: "ops" });
  assert.equal(results.length, 0);
});

test("KnowledgeIngestionPipeline ingests single-chunk document", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns_3",
    path: "ops/single",
    description: "Single chunk",
    ownerDomainId: "ops",
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

  const result = pipeline.ingest({
    title: "Short Note",
    body: "This is a short document.",
    namespace: "ops/single",
    sourceType: "text",
    trustLevel: "verified",
  });

  assert.ok(result.chunks.length >= 1);
});

test("KnowledgeIngestionPipeline supports section_aware chunking and AST indexing", () => {
  const astIndex = new AstStructuralIndex();
  const pipeline = new KnowledgeIngestionPipeline(undefined, undefined, undefined, astIndex);
  pipeline.registerNamespace({
    namespaceId: "ns_4",
    path: "coding/repo",
    description: "Coding knowledge",
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

  const result = pipeline.ingest({
    title: "Repo Notes",
    body: "# Overview\nUse rollout gates.\n\n## API\nexport function deployCanary() {\n  return true;\n}\n",
    namespace: "coding/repo",
    sourceType: "file",
    uri: "src/repo-notes.ts",
    language: "typescript",
    trustLevel: "verified",
    chunking: {
      mode: "section_aware",
      sectionConfig: {
        headingLevels: [1, 2],
        codeBoundaries: ["function"],
        maxTokensPerSection: 200,
      },
    },
  });

  assert.equal(result.chunks.length, 2);
  assert.equal(result.chunks[0]?.locator.section, "Overview");
  const symbols = astIndex.query({ query: "deployCanary", namespace: "coding/repo" });
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0]?.symbolName, "deployCanary");
});

test("KnowledgeIngestionPipeline keeps private_unverified documents quarantined and out of retrieval", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  pipeline.registerNamespace({
    namespaceId: "ns_5",
    path: "ops/quarantine",
    description: "Quarantine knowledge",
    ownerDomainId: "ops",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "team_reviewed",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const result = pipeline.ingest({
    title: "Unverified note",
    body: "Rollback draft note for unverified intake.",
    namespace: "ops/quarantine",
    trustLevel: "private_unverified",
  });

  assert.equal(result.document.status, "draft");
  assert.equal(result.source.metadata.ingestionLifecycle, "quarantined");
  assert.equal(pipeline.query("rollback", { domainId: "ops", includeUnverified: true }).length, 0);
});
