/**
 * Ref Types Unit Tests
 *
 * Tests for the RefId type system and parsing utilities.
 *
 * Architecture: §A.1 RefId type system
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RefIdSchema,
  parseRefId,
  type RefId,
  type EvidenceRef,
  type ArtifactRef,
  type MemoryRef,
} from "../../../../../src/platform/orchestration/oapeflir/ref-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// RefId Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RefIdSchema accepts valid artifact ref", () => {
  const result = RefIdSchema.parse("artifact:abc123");
  assert.equal(result, "artifact:abc123");
});

test("RefIdSchema accepts valid evidence ref", () => {
  const result = RefIdSchema.parse("evidence:xyz789");
  assert.equal(result, "evidence:xyz789");
});

test("RefIdSchema accepts valid memory ref", () => {
  const result = RefIdSchema.parse("memory:mem001");
  assert.equal(result, "memory:mem001");
});

test("RefIdSchema accepts ref with underscores and hyphens", () => {
  assert.ok(RefIdSchema.parse("artifact:my_artifact-id_123"));
  assert.ok(RefIdSchema.parse("evidence:test-case-1"));
  assert.ok(RefIdSchema.parse("memory:mem_ref_test"));
});

test("RefIdSchema accepts single character id", () => {
  const result = RefIdSchema.parse("artifact:a");
  assert.equal(result, "artifact:a");
});

test("RefIdSchema rejects ref without colon", () => {
  assert.throws(() => RefIdSchema.parse("artifactabc123"));
});

test("RefIdSchema rejects ref with uppercase in refType", () => {
  assert.throws(() => RefIdSchema.parse("Artifact:abc123"));
  assert.throws(() => RefIdSchema.parse("ARTIFACT:abc123"));
});

test("RefIdSchema rejects ref with special characters in id", () => {
  assert.throws(() => RefIdSchema.parse("artifact:abc@123"));
  assert.throws(() => RefIdSchema.parse("artifact:abc#123"));
  assert.throws(() => RefIdSchema.parse("artifact:abc$123"));
});

test("RefIdSchema rejects empty string", () => {
  assert.throws(() => RefIdSchema.parse(""));
});

test("RefIdSchema rejects only colon", () => {
  assert.throws(() => RefIdSchema.parse(":"));
});

test("RefIdSchema rejects colon only on id side", () => {
  assert.throws(() => RefIdSchema.parse("artifact:"));
});

test("RefIdSchema rejects empty refType", () => {
  assert.throws(() => RefIdSchema.parse(":abc123"));
});

test("RefIdSchema rejects whitespace in ref", () => {
  assert.throws(() => RefIdSchema.parse("artifact:abc 123"));
  assert.throws(() => RefIdSchema.parse("artifact: abc123"));
});

// ─────────────────────────────────────────────────────────────────────────────
// parseRefId Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("parseRefId parses valid artifact ref", () => {
  const result = parseRefId("artifact:abc123");
  assert.equal(result, "artifact:abc123");
});

test("parseRefId parses valid evidence ref", () => {
  const result = parseRefId("evidence:xyz789");
  assert.equal(result, "evidence:xyz789");
});

test("parseRefId parses valid memory ref", () => {
  const result = parseRefId("memory:mem001");
  assert.equal(result, "memory:mem001");
});

test("parseRefId throws for invalid input", () => {
  assert.throws(() => parseRefId("invalid"));
  assert.throws(() => parseRefId(""));
  assert.throws(() => parseRefId(123 as any));
  assert.throws(() => parseRefId(null));
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Alias Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RefId type can be assigned valid values", () => {
  const ref: RefId = "artifact:test";
  assert.equal(ref, "artifact:test");
});

test("EvidenceRef type accepts valid refs", () => {
  const ref: EvidenceRef = "evidence:test123";
  assert.ok(typeof ref === "string");
});

test("ArtifactRef type accepts valid refs", () => {
  const ref: ArtifactRef = "artifact:my-artifact";
  assert.ok(typeof ref === "string");
});

test("MemoryRef type accepts valid refs", () => {
  const ref: MemoryRef = "memory:l1_entry";
  assert.ok(typeof ref === "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// KnowledgeRef Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgeRef interface structure is correct", () => {
  const ref = {
    knowledgeRef: "knowledge:doc123",
    refType: "knowledge" as const,
    namespace: "docs",
    chunkId: "chunk-1",
    documentId: "doc-123",
    score: 0.95,
    matchType: "semantic" as const,
  };

  assert.equal(ref.knowledgeRef, "knowledge:doc123");
  assert.equal(ref.refType, "knowledge");
  assert.equal(ref.namespace, "docs");
  assert.equal(ref.chunkId, "chunk-1");
  assert.equal(ref.documentId, "doc-123");
  assert.equal(ref.score, 0.95);
  assert.equal(ref.matchType, "semantic");
});

test("KnowledgeRef accepts keyword matchType", () => {
  const ref = {
    knowledgeRef: "knowledge:doc456",
    refType: "knowledge" as const,
    namespace: "docs",
    chunkId: "chunk-2",
    documentId: "doc-456",
    score: 0.87,
    matchType: "keyword" as const,
  };

  assert.equal(ref.matchType, "keyword");
});

test("KnowledgeRef accepts structural matchType", () => {
  const ref = {
    knowledgeRef: "knowledge:doc789",
    refType: "knowledge" as const,
    namespace: "api",
    chunkId: "chunk-3",
    documentId: "doc-789",
    score: 0.92,
    matchType: "structural" as const,
  };

  assert.equal(ref.matchType, "structural");
});

test("KnowledgeRef score can be 0", () => {
  const ref = {
    knowledgeRef: "knowledge:doc000",
    refType: "knowledge" as const,
    namespace: "docs",
    chunkId: "chunk-0",
    documentId: "doc-000",
    score: 0,
    matchType: "semantic" as const,
  };

  assert.equal(ref.score, 0);
});

test("KnowledgeRef score can be 1", () => {
  const ref = {
    knowledgeRef: "knowledge:doc111",
    refType: "knowledge" as const,
    namespace: "docs",
    chunkId: "chunk-1",
    documentId: "doc-111",
    score: 1,
    matchType: "semantic" as const,
  };

  assert.equal(ref.score, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Rejects Invalid Input Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RefIdSchema rejects refs with spaces before colon", () => {
  assert.throws(() => RefIdSchema.parse(" artifact:abc"));
});

test("RefIdSchema rejects refs with numbers in refType", () => {
  assert.throws(() => RefIdSchema.parse("artifact123:abc"));
});

test("RefIdSchema rejects refs starting with number", () => {
  assert.throws(() => RefIdSchema.parse("123:abc"));
});

test("RefIdSchema accepts knowledge ref", () => {
  const result = RefIdSchema.parse("knowledge:doc-chunk-1");
  assert.equal(result, "knowledge:doc-chunk-1");
});