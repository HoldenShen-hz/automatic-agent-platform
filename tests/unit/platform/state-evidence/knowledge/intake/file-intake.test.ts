import assert from "node:assert/strict";
import test from "node:test";

import { FileKnowledgeIntake } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/intake/file-intake.js";
import type { ChunkingConfig, TrustLevel } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

test("FileKnowledgeIntake can be instantiated", () => {
  const intake = new FileKnowledgeIntake();
  assert.ok(intake, "intake should be truthy");
});

test("FileKnowledgeIntake.ingest returns a result with source, document, and chunks", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/workspace/my-project/README.md",
    content: "This is the project README",
    namespace: "my-project",
  });
  assert.ok(result, "result should be truthy");
  assert.ok(result.source, "result.source should exist");
  assert.ok(result.document, "result.document should exist");
  assert.ok(Array.isArray(result.chunks), "result.chunks should be an array");
});

test("FileKnowledgeIntake.ingest derives title from the file path basename", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/workspace/my-project/docs/api-guide.md",
    content: "API documentation content",
    namespace: "my-project",
  });
  assert.equal(result.document.title, "api-guide.md");
});

test("FileKnowledgeIntake.ingest defaults sourceType to file when not provided", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "test content",
    namespace: "test-ns",
  });
  assert.equal(result.source.type, "file");
});

test("FileKnowledgeIntake.ingest accepts explicit sourceType", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "test content",
    namespace: "test-ns",
    sourceType: "code_snippet",
  });
  assert.equal(result.source.type, "code_snippet");
});

test("FileKnowledgeIntake.ingest accepts trustLevel", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "test content",
    namespace: "test-ns",
    trustLevel: "official" as TrustLevel,
  });
  assert.equal(result.source.trustLevel, "official");
});

test("FileKnowledgeIntake.ingest accepts tags", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "test content",
    namespace: "test-ns",
    tags: ["documentation", "getting-started"],
  });
  assert.ok(result.source.tags.includes("documentation"));
  assert.ok(result.source.tags.includes("getting-started"));
  assert.ok(result.document.tags.includes("documentation"));
});

test("FileKnowledgeIntake.ingest accepts chunking configuration", () => {
  const intake = new FileKnowledgeIntake();
  const chunking: ChunkingConfig = {
    mode: "section_aware",
    sectionConfig: {
      headingLevels: [1, 2, 3],
      codeBoundaries: ["function", "class"],
      maxTokensPerSection: 500,
    },
  };
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "test content",
    namespace: "test-ns",
    chunking,
  });
  assert.ok(result.source.chunking, "chunking should be stored in source");
  assert.equal(result.source.chunking?.mode, "section_aware");
});

test("FileKnowledgeIntake.ingest sets correct URI in source", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/workspace/my-project/src/index.ts",
    content: "export const foo = 'bar';",
    namespace: "my-project",
  });
  assert.equal(result.source.uri, "/workspace/my-project/src/index.ts");
});

test("FileKnowledgeIntake.ingest preserves body content in document rawText", () => {
  const intake = new FileKnowledgeIntake();
  const content = "This is the raw document content that should be preserved";
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content,
    namespace: "test-ns",
  });
  assert.equal(result.document.rawText, content);
});

test("FileKnowledgeIntake.ingest sets namespace on document", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "content",
    namespace: "my-namespace",
  });
  assert.equal(result.document.namespace, "my-namespace");
  assert.equal(result.source.namespace, "my-namespace");
});

test("FileKnowledgeIntake.ingest creates non-empty chunks", () => {
  const intake = new FileKnowledgeIntake();
  const result = intake.ingest({
    path: "/tmp/test.txt",
    content: "First paragraph\n\nSecond paragraph",
    namespace: "test-ns",
  });
  assert.ok(result.chunks.length > 0, "should have at least one chunk");
  for (const chunk of result.chunks) {
    assert.ok(chunk.chunkId, "chunk should have chunkId");
    assert.ok(chunk.content.length > 0, "chunk content should not be empty");
    assert.ok(chunk.keywords.length > 0, "chunk should have keywords");
  }
});
