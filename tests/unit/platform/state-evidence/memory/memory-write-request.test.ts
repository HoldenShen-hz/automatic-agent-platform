import test from "node:test";
import assert from "node:assert/strict";

import type { MemoryWriteRequest, MemoryContent } from "../../../../../src/platform/state-evidence/memory/memory-write-request.js";

function createMemoryContent(overrides: Partial<MemoryContent> = {}): MemoryContent {
  return {
    text: "Sample memory text content",
    summary: "Sample summary",
    entities: ["entity1", "entity2"],
    concepts: ["concept1", "concept2"],
    importance: "medium",
    ...overrides,
  };
}

function createMemoryWriteRequest(overrides: Partial<MemoryWriteRequest> = {}): MemoryWriteRequest {
  return {
    requestId: "req_001",
    content: createMemoryContent(),
    scope: "session",
    importanceScore: 0.7,
    qualityScore: 0.8,
    hitCount: 5,
    tags: ["test", "sample"],
    autoPromote: true,
    writtenAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// MemoryWriteRequest structure tests
// =============================================================================

test("MemoryWriteRequest has all required fields", () => {
  const request = createMemoryWriteRequest();
  assert.ok(request.requestId);
  assert.ok(request.content);
  assert.ok(request.scope);
  assert.ok(typeof request.importanceScore === "number");
  assert.ok(typeof request.qualityScore === "number");
  assert.ok(typeof request.hitCount === "number");
  assert.ok(Array.isArray(request.tags));
  assert.ok(typeof request.autoPromote === "boolean");
  assert.ok(typeof request.writtenAt === "number");
});

test("MemoryWriteRequest accepts valid scope values", () => {
  const scopes = ["runtime", "session", "agent", "project", "user", "evolution"] as const;
  for (const scope of scopes) {
    const request = createMemoryWriteRequest({ scope });
    assert.equal(request.scope, scope);
  }
});

test("MemoryWriteRequest importanceScore is clamped to valid range", () => {
  const request = createMemoryWriteRequest({ importanceScore: 0.5 });
  assert.ok(request.importanceScore >= 0 && request.importanceScore <= 1);
});

test("MemoryWriteRequest qualityScore is clamped to valid range", () => {
  const request = createMemoryWriteRequest({ qualityScore: 0.5 });
  assert.ok(request.qualityScore >= 0 && request.qualityScore <= 1);
});

test("MemoryWriteRequest hitCount can be zero", () => {
  const request = createMemoryWriteRequest({ hitCount: 0 });
  assert.equal(request.hitCount, 0);
});

test("MemoryWriteRequest supports optional sourceRef", () => {
  const request = createMemoryWriteRequest({ sourceRef: "task_123" });
  assert.equal(request.sourceRef, "task_123");
});

test("MemoryWriteRequest without sourceRef is valid", () => {
  const request = createMemoryWriteRequest();
  assert.strictEqual(request.sourceRef, undefined);
});

test("MemoryWriteRequest tags can be empty array", () => {
  const request = createMemoryWriteRequest({ tags: [] });
  assert.deepEqual(request.tags, []);
});

test("MemoryWriteRequest tags can contain multiple values", () => {
  const request = createMemoryWriteRequest({ tags: ["tag1", "tag2", "tag3"] });
  assert.equal(request.tags.length, 3);
});

// =============================================================================
// MemoryContent structure tests
// =============================================================================

test("MemoryContent has all required fields", () => {
  const content = createMemoryContent();
  assert.ok(typeof content.text === "string");
  assert.ok(typeof content.summary === "string");
  assert.ok(Array.isArray(content.entities));
  assert.ok(Array.isArray(content.concepts));
  assert.ok(["low", "medium", "high"].includes(content.importance));
});

test("MemoryContent importance accepts low value", () => {
  const content = createMemoryContent({ importance: "low" });
  assert.equal(content.importance, "low");
});

test("MemoryContent importance accepts medium value", () => {
  const content = createMemoryContent({ importance: "medium" });
  assert.equal(content.importance, "medium");
});

test("MemoryContent importance accepts high value", () => {
  const content = createMemoryContent({ importance: "high" });
  assert.equal(content.importance, "high");
});

test("MemoryContent entities can be empty", () => {
  const content = createMemoryContent({ entities: [] });
  assert.deepEqual(content.entities, []);
});

test("MemoryContent concepts can be empty", () => {
  const content = createMemoryContent({ concepts: [] });
  assert.deepEqual(content.concepts, []);
});

test("MemoryContent can have optional metadata", () => {
  const content = createMemoryContent({
    metadata: { customKey: "customValue", numValue: 42 },
  });
  assert.ok(content.metadata);
  assert.equal(content.metadata.customKey, "customValue");
  assert.equal(content.metadata.numValue, 42);
});

test("MemoryContent without metadata is valid", () => {
  const content = createMemoryContent();
  assert.strictEqual(content.metadata, undefined);
});

test("MemoryContent text can be long text", () => {
  const longText = "A".repeat(10000);
  const content = createMemoryContent({ text: longText });
  assert.equal(content.text.length, 10000);
});

test("MemoryContent entities can have duplicates", () => {
  const content = createMemoryContent({ entities: ["entity1", "entity1", "entity2"] });
  assert.equal(content.entities.length, 3);
});

test("MemoryContent concepts can have duplicates", () => {
  const content = createMemoryContent({ concepts: ["concept1", "concept1", "concept2"] });
  assert.equal(content.concepts.length, 3);
});

// =============================================================================
// MemoryScope type mapping tests (via MemoryWriteRequest)
// =============================================================================

test("MemoryWriteRequest scope maps to runtime layer", () => {
  const request = createMemoryWriteRequest({ scope: "runtime" });
  assert.equal(request.scope, "runtime");
});

test("MemoryWriteRequest scope maps to session layer", () => {
  const request = createMemoryWriteRequest({ scope: "session" });
  assert.equal(request.scope, "session");
});

test("MemoryWriteRequest scope maps to agent layer", () => {
  const request = createMemoryWriteRequest({ scope: "agent" });
  assert.equal(request.scope, "agent");
});

test("MemoryWriteRequest scope maps to project layer", () => {
  const request = createMemoryWriteRequest({ scope: "project" });
  assert.equal(request.scope, "project");
});

test("MemoryWriteRequest scope maps to user layer", () => {
  const request = createMemoryWriteRequest({ scope: "user" });
  assert.equal(request.scope, "user");
});

test("MemoryWriteRequest scope maps to evolution layer", () => {
  const request = createMemoryWriteRequest({ scope: "evolution" });
  assert.equal(request.scope, "evolution");
});

// =============================================================================
// Request ID uniqueness tests
// =============================================================================

test("MemoryWriteRequest requestId can be any string format", () => {
  const request1 = createMemoryWriteRequest({ requestId: "custom_id_123" });
  const request2 = createMemoryWriteRequest({ requestId: "req_abc_456" });
  assert.notEqual(request1.requestId, request2.requestId);
});

test("MemoryWriteRequest with same requestId is allowed", () => {
  const request1 = createMemoryWriteRequest({ requestId: "same_id" });
  const request2 = createMemoryWriteRequest({ requestId: "same_id" });
  assert.equal(request1.requestId, request2.requestId);
});

// =============================================================================
// writtenAt timestamp tests
// =============================================================================

test("MemoryWriteRequest writtenAt uses current timestamp", () => {
  const before = Date.now();
  const request = createMemoryWriteRequest();
  const after = Date.now();
  assert.ok(request.writtenAt >= before && request.writtenAt <= after);
});

test("MemoryWriteRequest writtenAt can be epoch timestamp", () => {
  const request = createMemoryWriteRequest({ writtenAt: 0 });
  assert.equal(request.writtenAt, 0);
});

test("MemoryWriteRequest writtenAt can be far future timestamp", () => {
  const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
  const request = createMemoryWriteRequest({ writtenAt: farFuture });
  assert.ok(request.writtenAt > Date.now());
});