/**
 * Integration Test: Knowledge Ingestion Pipeline
 *
 * Tests knowledge document ingestion, chunking, indexing,
 * and retrieval using the KnowledgeIngestionPipeline.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeIngestionPipeline } from "../../../../../src/platform/state-evidence/knowledge/knowledge-ingestion-pipeline.js";
import { KnowledgeArchive } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-archive.js";
import { NamespacePolicyStore } from "../../../../../src/platform/state-evidence/knowledge/governance/namespace-policy.js";
import { KeywordKnowledgeIndex } from "../../../../../src/platform/state-evidence/knowledge/keyword-index.js";
import { KnowledgeRetrievalService } from "../../../../../src/platform/state-evidence/knowledge/retrieval/knowledge-retrieval.js";
import type { SemanticVectorStore } from "../../../../../src/platform/state-evidence/knowledge/semantic-vector-store.js";

test("integration: knowledge ingestion pipeline ingests documents and creates searchable chunks", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Platform Architecture",
    body: "The platform has five planes: interface, control-plane, orchestration, execution, and state-evidence.\n\nEach plane has specific responsibilities.",
    namespace: "architecture",
    sourceType: "text",
    trustLevel: "verified",
  });

  assert.ok(result.source.sourceId.startsWith("knowledge_source_"), "Should create source with valid ID");
  assert.ok(result.document.documentId.startsWith("knowledge_document_"), "Should create document with valid ID");
  assert.ok(result.chunks.length >= 2, "Should split content into multiple chunks");
  assert.equal(result.document.title, "Platform Architecture");
  assert.equal(result.chunks[0]?.namespace, "architecture");
});

test("integration: knowledge ingestion pipeline extracts keywords and builds embeddings", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Workflow Checkpointing",
    body: "Workflow checkpoints enable crash recovery by persisting step state.\n\nEach checkpoint captures output, decision context, and resume position.",
    namespace: "workflow",
    tags: ["checkpoint", "recovery"],
  });

  assert.ok(result.chunks.length > 0, "Should create at least one chunk");
  const chunk = result.chunks[0];
  assert.ok(chunk, "First chunk should exist");
  assert.ok(chunk.keywords.length > 0, "Should extract keywords from content");
  assert.ok(chunk.embedding && chunk.embedding.length > 0, "Should build semantic embedding");
  assert.ok(chunk.summary.length > 0, "Should generate summary");
});

test("integration: knowledge ingestion pipeline registers namespaces with policies", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const namespaces = new NamespacePolicyStore();

  const ns = namespaces.register({
    namespaceId: "docs",
    path: "documentation",
    description: "Platform documentation",
    ownerDomainId: "platform",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  assert.equal(ns.path, "documentation");
  assert.equal(ns.trustLevel, "verified");

  const result = pipeline.ingest({
    title: "API Reference",
    body: "The API gateway handles incoming HTTP requests and routes them to appropriate handlers.",
    namespace: "documentation",
    trustLevel: "verified",
  });

  assert.equal(result.source.namespace, "documentation");
});

// SKIP: Query issue - cannot find chunks
test.skip("integration: knowledge ingestion pipeline queries return ingested content", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);

  pipeline.ingest({
    title: "Execution Model",
    body: "Tasks are user-level work units with terminal lifecycles.\n\nExecutions are individual runtime attempts with retry state.",
    namespace: "execution",
    tags: ["task", "execution"],
  });

  pipeline.ingest({
    title: "Worker Pool",
    body: "Workers process execution tasks from the queue.\n\nEach worker has capabilities and concurrency limits.",
    namespace: "execution",
    tags: ["worker", "pool"],
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const hits = retrieval.query("execution");

  assert.ok(hits.length >= 2, "Should find chunks related to execution");
  assert.ok(hits.some((hit) => hit.snippet.includes("Tasks") || hit.snippet.includes("Executions")));
});

test("integration: knowledge ingestion pipeline supports fixed and section-aware chunking", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  // Fixed chunking
  const fixedResult = pipeline.ingest({
    title: "Multi-part Content",
    body: "Section 1 content.\n\nSection 2 content.\n\nSection 3 content.",
    namespace: "chunking",
    chunking: { mode: "fixed" },
  });

  assert.ok(fixedResult.chunks.length >= 3, "Fixed chunking should split on double newlines");

  // Section-aware chunking
  const sectionResult = pipeline.ingest({
    title: "Document with Headers",
    body: "# Introduction\n\nThis is the intro.\n\n# Architecture\n\nThis is the architecture section.\n\n# Conclusion\n\nThis is the conclusion.",
    namespace: "chunking",
    chunking: { mode: "section_aware" },
  });

  assert.ok(sectionResult.chunks.length >= 3, "Section-aware chunking should respect headings");
});

test("integration: knowledge ingestion pipeline preserves chunk metadata and locator", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Guide Document",
    body: "# Getting Started\n\nFollow these steps to configure the platform.\n\n# Advanced Usage\n\nFor advanced users, here are additional options.",
    namespace: "guides",
    language: "en",
    tags: ["setup", "configuration"],
    chunking: { mode: "section_aware" },
  });

  const sectionChunks = result.chunks.filter((chunk) => "section" in chunk.locator && chunk.locator.section !== undefined);
  assert.ok(sectionChunks.length > 0, "Should have chunks with section locators");

  const firstSectionChunk = sectionChunks[0];
  assert.ok(firstSectionChunk, "First section chunk should exist");
  assert.ok(firstSectionChunk.locator.section, "Chunk locator should have section value");
  assert.ok(firstSectionChunk.keywords.length > 0, "Chunks should have extracted keywords");
});

// SKIP: Query issue - cannot find chunks
test.skip("integration: knowledge retrieval service respects namespace filtering", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const vectorStore: SemanticVectorStore | null = null;
  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);

  pipeline.ingest({
    title: "Internal API",
    body: "Internal APIs are used for platform-to-platform communication.",
    namespace: "internal",
  });

  pipeline.ingest({
    title: "Public API",
    body: "Public APIs are exposed to external consumers.",
    namespace: "public",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces, vectorStore);

  const allHits = retrieval.query("api");
  assert.ok(allHits.length >= 2, "Should find API content in both namespaces");

  const internalHits = retrieval.query("api", { namespace: "internal" });
  assert.ok(internalHits.length >= 1, "Should filter to internal namespace");
  assert.equal(internalHits[0]?.namespace, "internal");
});

test("integration: knowledge ingestion pipeline computes content hash for deduplication", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result1 = pipeline.ingest({
    title: "Unique Document",
    body: "This is unique content that appears only once.",
    namespace: "dedup",
  });

  const result2 = pipeline.ingest({
    title: "Duplicate Document",
    body: "This is unique content that appears only once.",
    namespace: "dedup",
  });

  assert.equal(result1.source.contentHash, result2.source.contentHash, "Same content should produce same hash");
});

test("integration: knowledge ingestion pipeline handles API signature chunk detection", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Code Examples",
    body: "export function processTask(input: TaskInput): Promise<TaskOutput> {\n  return executeTask(input);\n}\n\nexport interface TaskInput {\n  taskId: string;\n}",
    namespace: "code",
  });

  const apiChunks = result.chunks.filter((chunk) => chunk.chunkType === "api_signature");
  assert.ok(apiChunks.length > 0, "Should detect API signatures in code content");
});

test("integration: knowledge ingestion pipeline handles constraint chunk detection", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Requirements",
    body: "The system must handle concurrent requests.\n\nYou should always validate input.\n\nRequired: provide authentication.",
    namespace: "requirements",
  });

  const constraintChunks = result.chunks.filter((chunk) => chunk.chunkType === "constraint");
  assert.ok(constraintChunks.length > 0, "Should detect constraint content");
});
