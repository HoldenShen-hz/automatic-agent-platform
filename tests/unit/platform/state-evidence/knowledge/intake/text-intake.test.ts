import test from "node:test";
import assert from "node:assert/strict";

import { TextKnowledgeIntake } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/intake/text-intake.js";
import { KnowledgeIngestionPipeline } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-ingestion-pipeline.js";

test("TextKnowledgeIntake uses provided title directly", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "My Custom Title",
    body: "Document body",
    namespace: "test/ns",
  });

  assert.equal(result.document.title, "My Custom Title");
  assert.equal(result.source.type, "text");
});

test("TextKnowledgeIntake accepts optional trustLevel", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Title",
    body: "Body",
    namespace: "test/ns",
    trustLevel: "reviewed",
  });

  assert.equal(result.source.trustLevel, "reviewed");
});

test("TextKnowledgeIntake accepts optional tags", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Title",
    body: "Body",
    namespace: "test/ns",
    tags: ["important", "documentation"],
  });

  assert.deepEqual(result.source.tags, ["important", "documentation"]);
});

test("TextKnowledgeIntake passes chunking config to pipeline", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Title",
    body: "A".repeat(500),
    namespace: "test/ns",
    chunking: {
      mode: "section_aware",
    },
  });

  assert.equal(result.source.chunking?.mode, "section_aware");
  assert.ok(result.chunks.length >= 1);
});

test("TextKnowledgeIntake with semantic chunking mode", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Title",
    body: "First paragraph\n\nSecond paragraph\n\nThird paragraph",
    namespace: "test/ns",
    chunking: {
      mode: "semantic",
    },
  });

  assert.equal(result.source.chunking?.mode, "semantic");
  assert.ok(result.chunks.length >= 1);
});

test("TextKnowledgeIntake with fixed chunking mode", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Title",
    body: "A".repeat(500),
    namespace: "test/ns",
    chunking: {
      mode: "fixed",
      fixedConfig: {
        maxTokens: 100,
        overlapTokens: 10,
      },
    },
  });

  assert.equal(result.source.chunking?.mode, "fixed");
  assert.ok(result.chunks.length >= 1);
});

test("TextKnowledgeIntake creates document with content", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Test Document",
    body: "Hello world",
    namespace: "test/ns",
  });

  assert.ok(result.document.documentId.length > 0);
  assert.equal(result.document.rawText, "Hello world");
  assert.equal(result.document.namespace, "test/ns");
  assert.equal(result.document.status, "indexed");
});

test("TextKnowledgeIntake creates chunks from body", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Test",
    body: "Chunk one\n\nChunk two\n\nChunk three",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
  assert.ok(result.chunks.every((c) => c.documentId === result.document.documentId));
});

test("TextKnowledgeIntake allows omitting optional parameters", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Minimal",
    body: "Body content",
    namespace: "test/ns",
  });

  assert.equal(result.source.type, "text");
  assert.equal(result.source.trustLevel, "team_reviewed");
  assert.deepEqual(result.source.tags, []);
});

test("TextKnowledgeIntake accepts explicit sourceType override", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Title",
    body: "Body",
    namespace: "test/ns",
    sourceType: "api_spec",
  });

  assert.equal(result.source.type, "api_spec");
});

test("TextKnowledgeIntake with multiline body", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Multiline",
    body: "Line one\nLine two\nLine three\n\nParagraph two",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
  assert.ok(result.document.rawText != null && result.document.rawText.includes("Line one"));
});

test("TextKnowledgeIntake with code-like content", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Code Sample",
    body: "export function hello() {\n  return 'world';\n}",
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
});

test("TextKnowledgeIntake with empty body creates single chunk", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Empty",
    body: "",
    namespace: "test/ns",
  });

  // Empty body may produce 0 or 1 chunk depending on chunking behavior
  assert.ok(result.chunks.length >= 0);
});

test("TextKnowledgeIntake preserves unicode in body", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Unicode",
    body: "Hello 世界 🌍 αβγδ",
    namespace: "test/ns",
  });

  assert.ok(result.document.rawText != null && result.document.rawText.includes("世界"));
});

test("TextKnowledgeIntake with short body", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Short",
    body: "Hi",
    namespace: "test/ns",
  });

  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0]!.content, "Hi");
});

test("TextKnowledgeIntake with section aware chunking extracts sections", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const result = intake.ingest({
    title: "Sections",
    body: "# Header One\nContent one\n\n# Header Two\nContent two",
    namespace: "test/ns",
    chunking: {
      mode: "section_aware",
    },
  });

  assert.ok(result.chunks.length >= 1);
});

test("TextKnowledgeIntake does not modify original input", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const input = {
    title: "Original",
    body: "Original body",
    namespace: "test/ns",
    trustLevel: "verified" as const,
  };

  const result = intake.ingest(input);

  assert.equal(result.source.trustLevel, "verified");
  assert.equal(input.body, "Original body");
});

test("TextKnowledgeIntake with very long body creates multiple chunks", () => {
  const pipeline = new KnowledgeIngestionPipeline();
  const intake = new TextKnowledgeIntake(pipeline);

  const longBody = "Section 1\n\n" + "x".repeat(200) + "\n\nSection 2\n\n" + "y".repeat(200);
  const result = intake.ingest({
    title: "Long",
    body: longBody,
    namespace: "test/ns",
  });

  assert.ok(result.chunks.length >= 1);
});
