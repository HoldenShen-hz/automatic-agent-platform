import test from "node:test";
import assert from "node:assert/strict";

import { RefIdSchema, parseRefId } from "../../../../../src/platform/five-plane-orchestration/oapeflir/ref-types.js";
import type { EvidenceRef, ArtifactRef, MemoryRef, KnowledgeRef } from "../../../../../src/platform/five-plane-orchestration/oapeflir/ref-types.js";

test("RefId type creates valid reference IDs", () => {
  const evidenceRef: EvidenceRef = "evidence:sig_123";
  assert.equal(evidenceRef.startsWith("evidence:"), true);

  const artifactRef: ArtifactRef = "artifact:art_456";
  assert.equal(artifactRef.startsWith("artifact:"), true);

  const memoryRef: MemoryRef = "memory:mem_789";
  assert.equal(memoryRef.startsWith("memory:"), true);
});

test("Reference types are distinct by prefix", () => {
  const evidenceRef: EvidenceRef = "evidence:test";
  const artifactRef: ArtifactRef = "artifact:test";
  const memoryRef: MemoryRef = "memory:test";

  // String-based refs are distinct because their prefixes differ
  assert.notEqual(evidenceRef, artifactRef);
  assert.notEqual(artifactRef, memoryRef);

  // KnowledgeRef is a structured interface, not a string
  const knowledgeRef: KnowledgeRef = {
    knowledgeRef: "knowledge:test",
    refType: "knowledge",
    namespace: "test",
    chunkId: "c1",
    documentId: "d1",
    score: 0.9,
    matchType: "semantic",
  };
  assert.equal(typeof knowledgeRef, "object");
  assert.equal(typeof memoryRef, "string");
});

test("Reference IDs can contain various characters", () => {
  const ref: EvidenceRef = "evidence:uuid-v4-style-id-1234";
  assert.equal(ref.includes("uuid-v4-style-id-1234"), true);
});

test("KnowledgeRef interface has required fields", () => {
  const knowledgeRef: KnowledgeRef = {
    knowledgeRef: "knowledge:know_abc",
    refType: "knowledge",
    namespace: "docs",
    chunkId: "chunk_1",
    documentId: "doc_1",
    score: 0.95,
    matchType: "semantic",
  };

  assert.equal(knowledgeRef.knowledgeRef, "knowledge:know_abc");
  assert.equal(knowledgeRef.refType, "knowledge");
  assert.equal(knowledgeRef.namespace, "docs");
  assert.equal(knowledgeRef.chunkId, "chunk_1");
  assert.equal(knowledgeRef.documentId, "doc_1");
  assert.equal(knowledgeRef.score, 0.95);
  assert.equal(knowledgeRef.matchType, "semantic");
});

test("KnowledgeRef supports different match types", () => {
  const semanticRef: KnowledgeRef = {
    knowledgeRef: "knowledge:semantic",
    refType: "knowledge",
    namespace: "test",
    chunkId: "c1",
    documentId: "d1",
    score: 0.9,
    matchType: "semantic",
  };

  const keywordRef: KnowledgeRef = {
    knowledgeRef: "knowledge:keyword",
    refType: "knowledge",
    namespace: "test",
    chunkId: "c2",
    documentId: "d2",
    score: 0.8,
    matchType: "keyword",
  };

  const structuralRef: KnowledgeRef = {
    knowledgeRef: "knowledge:structural",
    refType: "knowledge",
    namespace: "test",
    chunkId: "c3",
    documentId: "d3",
    score: 0.7,
    matchType: "structural",
  };

  assert.equal(semanticRef.matchType, "semantic");
  assert.equal(keywordRef.matchType, "keyword");
  assert.equal(structuralRef.matchType, "structural");
});

test("RefIdSchema.parse accepts valid ref IDs", () => {
  const validRefs = [
    "evidence:sig_123",
    "artifact:art_456",
    "memory:mem_789",
    "knowledge:know_abc",
    "evidence:uuid-v4-style-id-1234",
    "artifact:a",
    "memory:A1_B2-c3",
  ];

  for (const ref of validRefs) {
    assert.doesNotThrow(() => RefIdSchema.parse(ref), `Should accept: ${ref}`);
    assert.equal(RefIdSchema.parse(ref), ref);
  }
});

test("RefIdSchema.parse rejects invalid ref IDs", () => {
  const invalidRefs = [
    "", // empty
    "invalid", // missing colon
    ":no_prefix", // missing ref type
    "evidence:", // missing id
    "Evidence:Sig_123", // uppercase ref type (must be lowercase)
    "evidence/sig_123", // wrong separator (slash instead of colon)
    "evidence-sig_123", // wrong separator (dash instead of colon)
    "123:evidence", // ref type starts with number
    "evidence:sig@123", // invalid character in id
    "evidence:sig 123", // space in id
    "evidence:sig\t123", // tab in id
  ];

  for (const ref of invalidRefs) {
    assert.throws(() => RefIdSchema.parse(ref), `Should reject: ${ref}`);
  }
});

test("RefIdSchema.parse rejects non-string inputs", () => {
  assert.throws(() => RefIdSchema.parse(null));
  assert.throws(() => RefIdSchema.parse(undefined));
  assert.throws(() => RefIdSchema.parse(123));
  assert.throws(() => RefIdSchema.parse({}));
  assert.throws(() => RefIdSchema.parse([]));
});

test("parseRefId calls RefIdSchema.parse and returns RefId", () => {
  const result = parseRefId("evidence:test_123");
  assert.equal(result, "evidence:test_123");
  assert.doesNotThrow(() => parseRefId("artifact:art_xyz"));
});

test("parseRefId propagates schema errors for invalid input", () => {
  assert.throws(() => parseRefId("invalid"));
  assert.throws(() => parseRefId(""));
  assert.throws(() => parseRefId("EVIDENCE:test")); // uppercase ref type
});
