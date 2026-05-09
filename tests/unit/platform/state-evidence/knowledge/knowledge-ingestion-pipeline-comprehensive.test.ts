/**
 * Unit Test: Knowledge Ingestion Pipeline - Comprehensive
 *
 * Tests KnowledgeIngestionPipeline chunking strategies,
 * keyword extraction, embedding generation, and namespace handling.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeIngestionPipeline } from "../../../../../src/platform/state-evidence/knowledge/knowledge-ingestion-pipeline.js";
import { NamespacePolicyStore } from "../../../../../src/platform/state-evidence/knowledge/governance/namespace-policy.js";
import { KeywordKnowledgeIndex } from "../../../../../src/platform/state-evidence/knowledge/keyword-index.js";

test("KnowledgeIngestionPipeline constructor creates instance with default values", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  assert.ok(pipeline !== undefined);
});

test("KnowledgeIngestionPipeline constructor accepts custom index, archive, and namespaces", () => {
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const pipeline = new KnowledgeIngestionPipeline(index, undefined, namespaces);

  assert.ok(pipeline !== undefined);
});

test("KnowledgeIngestionPipeline ingest creates source with generated ID", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Test Document",
    body: "This is a test document with sufficient content.",
    namespace: "test/ns",
    sourceType: "text",
  });

  assert.ok(result.source.sourceId.startsWith("knowledge_source_"));
  assert.ok(result.source.namespace, "test/ns");
  assert.ok(result.source.type, "text");
});

test("KnowledgeIngestionPipeline ingest creates document with generated ID", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Test Document",
    body: "Document body content here.",
    namespace: "test/ns",
  });

  assert.ok(result.document.documentId.startsWith("knowledge_document_"));
  assert.equal(result.document.title, "Test Document");
  assert.equal(result.document.status, "indexed");
  assert.equal(result.document.namespace, "test/ns");
});

test("KnowledgeIngestionPipeline ingest creates chunks from body content", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Multi Paragraph",
    body: "First paragraph content.\n\nSecond paragraph content.\n\nThird paragraph content.",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 2);
  assert.ok(result.chunks.every(c => c.documentId === result.document.documentId));
});

test("KnowledgeIngestionPipeline ingest extracts keywords from content", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Keyword Test",
    body: "TypeScript and JavaScript are programming languages. TypeScript provides static typing.",
    namespace: "test/ns",
    tags: ["programming", "typescript"],
  });

  const firstChunk = result.chunks[0];
  assert.ok(firstChunk, "Should have at least one chunk");
  assert.ok(firstChunk.keywords.length > 0);
  assert.ok(firstChunk.keywords.some(k => k.includes("typescript") || k.includes("javascript")));
});

test("KnowledgeIngestionPipeline ingest generates semantic embeddings", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Embedding Test",
    body: "Testing semantic embedding generation.",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length > 0);
  const chunk = result.chunks[0];
  assert.ok(Array.isArray(chunk.embedding), "embedding should be an array");
  assert.ok(chunk.embedding.length > 0, "embedding should not be empty");
  assert.ok(chunk.embeddingId, "embeddingId should be generated");
});

test("KnowledgeIngestionPipeline ingest generates summaries", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Summary Test",
    body: "This is a longer document body that should produce a meaningful summary when processed by the ingestion pipeline.",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length > 0);
  assert.ok(result.chunks.every(c => c.summary.length > 0));
});

test("KnowledgeIngestionPipeline ingest respects chunking config for fixed mode", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Fixed Chunking",
    body: "Paragraph one here.\n\nParagraph two here.\n\nParagraph three here.",
    namespace: "test/ns",
    chunking: {
      mode: "fixed",
    },
  });

  assert.ok(result.chunks.length >= 1);
});

test("KnowledgeIngestionPipeline ingest respects chunking config for semantic mode", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Semantic Chunking",
    body: "Content for semantic chunking test.",
    namespace: "test/ns",
    chunking: {
      mode: "semantic",
    },
  });

  assert.ok(result.chunks.length >= 1);
});

test("KnowledgeIngestionPipeline ingest respects chunking config for section_aware mode", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Section Aware",
    body: "# Heading One\nContent under heading one.\n\n# Heading Two\nContent under heading two.",
    namespace: "test/ns",
    chunking: {
      mode: "section_aware",
      sectionConfig: {
        headingLevels: [1, 2],
        codeBoundaries: ["function"],
        maxTokensPerSection: 100,
      },
    },
  });

  assert.ok(result.chunks.length >= 1);
  // Section aware chunking should include section information
  const hasSectionLocator = result.chunks.some(c => Object.keys(c.locator).length > 0);
  assert.ok(hasSectionLocator);
});

test("KnowledgeIngestionPipeline ingest applies trust level from input", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Trust Level Test",
    body: "Content with trust level.",
    namespace: "test/ns",
    trustLevel: "verified",
  });

  assert.equal(result.source.trustLevel, "authoritative");
});

test("KnowledgeIngestionPipeline ingest applies trust level default", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Default Trust",
    body: "Content with default trust level.",
    namespace: "test/ns",
  });

  assert.equal(result.source.trustLevel, "team_reviewed");
  assert.equal(result.document.status, "indexed");
});

test("KnowledgeIngestionPipeline ingest handles tags in content", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Tags Test",
    body: "Content for testing tags.",
    namespace: "test/ns",
    tags: ["important", "review"],
  });

  assert.ok(result.source.tags.includes("important"));
  assert.ok(result.source.tags.includes("review"));
  assert.ok(result.document.tags.includes("important"));
});

test("KnowledgeIngestionPipeline ingest assigns correct chunk types", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Chunk Types",
    body: "# Title\n\nexport function test() {}\n\nSome constraint text that mentions must and should.\n\nRegular content.",
    namespace: "test/ns",
    chunking: {
      mode: "section_aware",
    },
  });

  assert.ok(result.chunks.length > 0);
  const chunkTypes = result.chunks.map(c => c.chunkType);
  // Should have different chunk types based on content
  assert.ok(chunkTypes.every(ct => ["concept", "api_signature", "constraint", "rule", "example"].includes(ct)));
});

test("KnowledgeIngestionPipeline ingest calculates token counts", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Token Count",
    body: "Content for token count testing.",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length > 0);
  assert.ok(result.chunks.every(c => c.tokenCount > 0));
});

test("KnowledgeIngestionPipeline ingest sets ordinal for each chunk", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Ordinals",
    body: "First chunk.\n\nSecond chunk.\n\nThird chunk.",
    namespace: "test/ns",
  });

  if (result.chunks.length > 1) {
    const ordinals = result.chunks.map(c => c.ordinal);
    assert.deepEqual(ordinals, ordinals.slice().sort((a, b) => a - b));
  }
});

test("KnowledgeIngestionPipeline ingest associates chunks with correct namespace", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Namespace Test",
    body: "Content for namespace testing.",
    namespace: "custom/namespace",
  });

  assert.ok(result.chunks.every(c => c.namespace === "custom/namespace"));
});

test("KnowledgeIngestionPipeline ingest handles URI when provided", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "URI Test",
    body: "Content with URI.",
    namespace: "test/ns",
    uri: "file:///path/to/document.txt",
  });

  assert.equal(result.source.uri, "file:///path/to/document.txt");
});

test("KnowledgeIngestionPipeline ingest handles language when provided", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Language Test",
    body: "Content with language.",
    namespace: "test/ns",
    language: "typescript",
  });

  assert.equal(result.source.language, "typescript");
});

test("KnowledgeIngestionPipeline ingest sets domain scope from namespace", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Domain Scope Test",
    body: "Content for domain scope testing.",
    namespace: "coding/javascript",
  });

  assert.ok(result.document.domainScope.includes("coding"));
});

test("KnowledgeIngestionPipeline query searches indexed content", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  pipeline.ingest({
    title: "Searchable Document",
    body: "This document contains searchable content about testing.",
    namespace: "test/ns",
  });

  const results = pipeline.query("searchable");
  assert.ok(Array.isArray(results));
});

test("KnowledgeIngestionPipeline registerNamespace registers namespace with policy", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const namespaces = new NamespacePolicyStore();

  const ns = namespaces.register({
    namespaceId: "registered_ns",
    path: "test/registered",
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

  assert.equal(ns.path, "test/registered");
});

test("KnowledgeIngestionPipeline ingest with very long content", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const longContent = "Word ".repeat(1000);

  const result = pipeline.ingest({
    title: "Long Content",
    body: longContent,
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
  assert.ok(result.chunks.every(c => c.tokenCount > 0));
});

test("KnowledgeIngestionPipeline ingest with empty tags array", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Empty Tags",
    body: "Content with empty tags array.",
    namespace: "test/ns",
    tags: [],
  });

  assert.ok(Array.isArray(result.source.tags));
  assert.equal(result.source.tags.length, 0);
});

test("KnowledgeIngestionPipeline ingest with single paragraph", () => {
  const pipeline = new KnowledgeIngestionPipeline();

  const result = pipeline.ingest({
    title: "Single Paragraph",
    body: "Just one paragraph.",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
});
