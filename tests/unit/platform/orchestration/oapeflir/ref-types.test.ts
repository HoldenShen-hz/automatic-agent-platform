/**
 * Ref Types Unit Tests
 *
 * Tests for RefIdSchema, parseRefId, and KnowledgeRef interface.
 * Module: src/platform/orchestration/oapeflir/ref-types.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  RefIdSchema,
  parseRefId,
  type RefId,
  type EvidenceRef,
  type ArtifactRef,
  type MemoryRef,
  type KnowledgeRef,
} from "../../../../../src/platform/orchestration/oapeflir/ref-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// RefIdSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RefIdSchema parses valid evidence ref", () => {
  const result = RefIdSchema.parse("evidence:sig_123");
  assert.equal(result, "evidence:sig_123");
});

test("RefIdSchema parses valid artifact ref", () => {
  const result = RefIdSchema.parse("artifact:art_456");
  assert.equal(result, "artifact:art_456");
});

test("RefIdSchema parses valid memory ref", () => {
  const result = RefIdSchema.parse("memory:mem_789");
  assert.equal(result, "memory:mem_789");
});

test("RefIdSchema parses knowledge ref", () => {
  const result = RefIdSchema.parse("knowledge:know_abc");
  assert.equal(result, "knowledge:know_abc");
});

test("RefIdSchema accepts underscores and hyphens in id", () => {
  assert.ok(RefIdSchema.parse("artifact:my_artifact-id_123"));
  assert.ok(RefIdSchema.parse("evidence:test-case-1"));
  assert.ok(RefIdSchema.parse("memory:mem_ref_test"));
});

test("RefIdSchema accepts single character refType and id", () => {
  assert.ok(RefIdSchema.parse("a:b"));
});

test("RefIdSchema accepts refType with underscores", () => {
  assert.ok(RefIdSchema.parse("evidence_record:sig123"));
});

test("RefIdSchema rejects empty string", () => {
  assert.throws(() => RefIdSchema.parse(""));
});

test("RefIdSchema rejects missing colon", () => {
  assert.throws(() => RefIdSchema.parse("artifactabc123"));
  assert.throws(() => RefIdSchema.parse("no-colon-here"));
});

test("RefIdSchema rejects uppercase in refType", () => {
  assert.throws(() => RefIdSchema.parse("Artifact:abc123"));
  assert.throws(() => RefIdSchema.parse("EVIDENCE:sig123"));
  assert.throws(() => RefIdSchema.parse("Memory:mem001"));
});

test("RefIdSchema rejects ref starting with number", () => {
  assert.throws(() => RefIdSchema.parse("123:abc"));
});

test("RefIdSchema rejects refType with numbers", () => {
  assert.throws(() => RefIdSchema.parse("artifact123:abc"));
});

test("RefIdSchema rejects missing id after colon", () => {
  assert.throws(() => RefIdSchema.parse("evidence:"));
  assert.throws(() => RefIdSchema.parse("artifact:"));
});

test("RefIdSchema rejects missing refType before colon", () => {
  assert.throws(() => RefIdSchema.parse(":abc123"));
});

test("RefIdSchema rejects whitespace in ref", () => {
  assert.throws(() => RefIdSchema.parse("artifact:abc 123"));
  assert.throws(() => RefIdSchema.parse("artifact: abc123"));
  assert.throws(() => RefIdSchema.parse(" artifact:abc123"));
});

test("RefIdSchema rejects special characters in id", () => {
  assert.throws(() => RefIdSchema.parse("artifact:abc@123"));
  assert.throws(() => RefIdSchema.parse("artifact:abc#123"));
  assert.throws(() => RefIdSchema.parse("artifact:abc$123"));
  assert.throws(() => RefIdSchema.parse("evidence:sig!456"));
  assert.throws(() => RefIdSchema.parse("memory:mem%789"));
});

test("RefIdSchema rejects non-string input", () => {
  assert.throws(() => RefIdSchema.parse(null));
  assert.throws(() => RefIdSchema.parse(undefined));
  assert.throws(() => RefIdSchema.parse(123));
  assert.throws(() => RefIdSchema.parse({}));
  assert.throws(() => RefIdSchema.parse([]));
  assert.throws(() => RefIdSchema.parse(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// parseRefId Tests
// ─────────────────────────────────────────────────────────────────────────────

test("parseRefId returns RefId for valid input", () => {
  const result = parseRefId("evidence:test");
  assert.equal(result, "evidence:test");
});

test("parseRefId returns parsed artifact ref", () => {
  const result = parseRefId("artifact:art_xyz");
  assert.equal(result, "artifact:art_xyz");
});

test("parseRefId returns parsed memory ref", () => {
  const result = parseRefId("memory:mem_abc");
  assert.equal(result, "memory:mem_abc");
});

test("parseRefId throws for invalid string", () => {
  assert.throws(() => parseRefId("invalid"));
});

test("parseRefId throws for empty string", () => {
  assert.throws(() => parseRefId(""));
});

test("parseRefId throws for uppercase refType", () => {
  assert.throws(() => parseRefId("EVIDENCE:test"));
});

test("parseRefId throws for non-string input", () => {
  assert.throws(() => parseRefId(123 as any));
  assert.throws(() => parseRefId(null));
  assert.throws(() => parseRefId(undefined));
  assert.throws(() => parseRefId({} as any));
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Alias Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RefId type accepts valid string values", () => {
  const ref: RefId = "artifact:test_123";
  assert.equal(ref, "artifact:test_123");
});

test("EvidenceRef is assignable and is a string", () => {
  const ref: EvidenceRef = "evidence:sig_abc";
  assert.equal(typeof ref, "string");
  assert.ok(ref.startsWith("evidence:"));
});

test("ArtifactRef is assignable and is a string", () => {
  const ref: ArtifactRef = "artifact:art_def";
  assert.equal(typeof ref, "string");
  assert.ok(ref.startsWith("artifact:"));
});

test("MemoryRef is assignable and is a string", () => {
  const ref: MemoryRef = "memory:mem_ghi";
  assert.equal(typeof ref, "string");
  assert.ok(ref.startsWith("memory:"));
});

// ─────────────────────────────────────────────────────────────────────────────
// KnowledgeRef Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgeRef has required fields", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:xyz",
    refType: "knowledge",
    namespace: "docs",
    chunkId: "c1",
    documentId: "d1",
    score: 0.95,
    matchType: "semantic",
  };

  assert.equal(ref.knowledgeRef, "knowledge:xyz");
  assert.equal(ref.refType, "knowledge");
  assert.equal(ref.namespace, "docs");
  assert.equal(ref.chunkId, "c1");
  assert.equal(ref.documentId, "d1");
  assert.equal(ref.score, 0.95);
  assert.equal(ref.matchType, "semantic");
});

test("KnowledgeRef with semantic matchType", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:semantic-doc",
    refType: "knowledge",
    namespace: "api",
    chunkId: "chunk-1",
    documentId: "doc-semantic",
    score: 0.99,
    matchType: "semantic",
  };

  assert.equal(ref.matchType, "semantic");
  assert.equal(ref.score, 0.99);
});

test("KnowledgeRef with keyword matchType", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:keyword-doc",
    refType: "knowledge",
    namespace: "search",
    chunkId: "chunk-2",
    documentId: "doc-keyword",
    score: 0.75,
    matchType: "keyword",
  };

  assert.equal(ref.matchType, "keyword");
  assert.equal(ref.score, 0.75);
});

test("KnowledgeRef with structural matchType", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:structural-doc",
    refType: "knowledge",
    namespace: "schema",
    chunkId: "chunk-3",
    documentId: "doc-structural",
    score: 0.88,
    matchType: "structural",
  };

  assert.equal(ref.matchType, "structural");
  assert.equal(ref.score, 0.88);
});

test("KnowledgeRef score can be 0", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:zero-score",
    refType: "knowledge",
    namespace: "docs",
    chunkId: "c0",
    documentId: "d0",
    score: 0,
    matchType: "semantic",
  };

  assert.equal(ref.score, 0);
});

test("KnowledgeRef score can be 1", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:perfect-score",
    refType: "knowledge",
    namespace: "docs",
    chunkId: "c1",
    documentId: "d1",
    score: 1,
    matchType: "semantic",
  };

  assert.equal(ref.score, 1);
});

test("KnowledgeRef refType discriminator is always 'knowledge'", () => {
  const ref: KnowledgeRef = {
    knowledgeRef: "knowledge:test",
    refType: "knowledge",
    namespace: "test",
    chunkId: "c1",
    documentId: "d1",
    score: 0.5,
    matchType: "keyword",
  };

  assert.equal(ref.refType, "knowledge");
  assert.notEqual(ref.refType, "evidence");
  assert.notEqual(ref.refType, "artifact");
});

test("KnowledgeRef is distinct from string-based RefId types", () => {
  const kr: KnowledgeRef = {
    knowledgeRef: "knowledge:test",
    refType: "knowledge",
    namespace: "docs",
    chunkId: "c1",
    documentId: "d1",
    score: 0.9,
    matchType: "semantic",
  };

  const memoryRef: MemoryRef = "memory:test";

  assert.equal(typeof kr, "object");
  assert.equal(typeof memoryRef, "string");
});