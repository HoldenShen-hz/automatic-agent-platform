import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMemoryContent,
  parseStructuredMemoryContent,
  stringifyStructuredMemoryContent,
  extractStructuredMemoryText,
  buildFactProvenanceFromRecord,
  type StructuredMemoryContent,
  type StructuredMemoryFactProvenance,
} from "../../../../../src/platform/state-evidence/memory/memory-schema.js";

test("normalizeMemoryContent handles string input as workContext", () => {
  const result = normalizeMemoryContent({ content: "This is my work context" });
  assert.equal(result.schemaVersion, "memory.v2");
  assert.equal(result.workContext, "This is my work context");
  assert.ok(result.topOfMind.includes("This is my work context"));
});

test("normalizeMemoryContent trims whitespace from string input", () => {
  const result = normalizeMemoryContent({ content: "  trimmed  " });
  assert.equal(result.workContext, "trimmed");
});

test("normalizeMemoryContent returns empty result for empty string", () => {
  const result = normalizeMemoryContent({ content: "" });
  assert.equal(result.workContext, null);
  assert.deepEqual(result.topOfMind, []);
});

test("normalizeMemoryContent handles structured object input", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: "context here",
      topOfMind: ["important 1", "important 2"],
      recentHistory: [],
      longTermBackground: [],
      facts: [],
    },
  });
  assert.equal(result.workContext, "context here");
  assert.equal(result.topOfMind.length, 2);
});

test("normalizeMemoryContent extracts facts from structured input", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [
        { content: "Fact 1", category: "test", confidence: 0.9, provenance: { source: "test", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
      ],
    },
  });
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0]!.content, "Fact 1");
});

test("normalizeMemoryContent deduplicates facts", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [
        { content: "Same fact", category: "a", confidence: null, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
        { content: "Same fact", category: "a", confidence: null, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
      ],
    },
  });
  assert.equal(result.facts.length, 1);
});

test("normalizeMemoryContent applies provenance defaults", () => {
  const result = normalizeMemoryContent({
    content: "test content",
    sessionId: "sess_123",
    agentId: "agent_456",
  });
  assert.equal(result.facts[0]!.provenance.source, "remember");
  assert.equal(result.facts[0]!.provenance.sessionId, "sess_123");
  assert.equal(result.facts[0]!.provenance.agentId, "agent_456");
});

test("parseStructuredMemoryContent parses valid JSON", () => {
  const json = JSON.stringify({
    schemaVersion: "memory.v2",
    workContext: "parsed context",
    topOfMind: [],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
  });
  const result = parseStructuredMemoryContent(json);
  assert.equal(result.workContext, "parsed context");
});

test("parseStructuredMemoryContent handles JSON string as content", () => {
  const result = parseStructuredMemoryContent("plain string content");
  assert.equal(result.workContext, "plain string content");
});

test("parseStructuredMemoryContent handles quoted JSON string", () => {
  // JSON.parse('"hello"') returns the string hello (without quotes)
  const result = parseStructuredMemoryContent('"hello"');
  assert.equal(result.workContext, "hello");
});

test("parseStructuredMemoryContent handles invalid JSON gracefully", () => {
  const result = parseStructuredMemoryContent("not valid json {");
  assert.equal(result.workContext, "not valid json {");
});

test("parseStructuredMemoryContent handles JSON number as fallback", () => {
  // When JSON.parse returns a number (not string or object), it falls through to final fallback
  const result = parseStructuredMemoryContent("123");
  assert.equal(result.workContext, "123");
});

test("parseStructuredMemoryContent handles JSON boolean as fallback", () => {
  // When JSON.parse returns a boolean, it falls through to final fallback
  const result = parseStructuredMemoryContent("true");
  assert.equal(result.workContext, "true");
});

test("parseStructuredMemoryContent handles JSON null as fallback", () => {
  // JSON.parse("null") returns null, which falls through to final return
  // The final return passes contentJson (the original string) to normalizeMemoryContent
  // So "null" string becomes workContext = "null"
  const result = parseStructuredMemoryContent("null");
  assert.equal(result.workContext, "null");
});

test("normalizeMemoryContent handles reasonCode field", () => {
  const result = normalizeMemoryContent({
    content: {
      reasonCode: "ERR_TIMEOUT",
    },
  });
  assert.ok(result.topOfMind.includes("ERR_TIMEOUT"));
  assert.ok(result.facts.some((f: any) => f.content === "ERR_TIMEOUT" && f.category === "reason_code" && f.confidence === 1));
});

test("normalizeMemoryContent handles kind field as fact", () => {
  const result = normalizeMemoryContent({
    content: {
      kind: "recovery_action",
    },
  });
  assert.ok(result.facts.some((f: any) => f.content === "recovery_action" && f.category === "kind" && f.confidence === 1));
});

test("normalizeMemoryContent handles array fields as facts", () => {
  const result = normalizeMemoryContent({
    content: {
      tags: ["urgent", "backend"],
    },
  });
  assert.ok(result.facts.some((f: any) => f.content === "urgent" && f.category === "tags"));
  assert.ok(result.facts.some((f: any) => f.content === "backend" && f.category === "tags"));
});

test("normalizeMemoryContent handles primitive values as facts", () => {
  const result = normalizeMemoryContent({
    content: {
      priority: 1,
      active: true,
    },
  });
  assert.ok(result.facts.some((f: any) => f.content === "priority=1" && f.category === "priority"));
  assert.ok(result.facts.some((f: any) => f.content === "active=true" && f.category === "active"));
});

test("stringifyStructuredMemoryContent serializes to JSON", () => {
  const content: StructuredMemoryContent = {
    schemaVersion: "memory.v2",
    workContext: "test",
    topOfMind: [],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
  };
  const json = stringifyStructuredMemoryContent(content);
  const parsed = JSON.parse(json);
  assert.equal(parsed.schemaVersion, "memory.v2");
  assert.equal(parsed.workContext, "test");
});

test("extractStructuredMemoryText extracts text from all fields", () => {
  const content: StructuredMemoryContent = {
    schemaVersion: "memory.v2",
    workContext: "main context",
    topOfMind: ["top1", "top2"],
    recentHistory: ["recent1"],
    longTermBackground: ["background1"],
    facts: [
      { content: "fact1", category: "cat", confidence: 0.5, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
    ],
  };
  const text = extractStructuredMemoryText(content);
  assert.ok(text.includes("main context"));
  assert.ok(text.includes("top1"));
  assert.ok(text.includes("top2"));
  assert.ok(text.includes("recent1"));
  assert.ok(text.includes("background1"));
  assert.ok(text.includes("fact1"));
});

test("extractStructuredMemoryText deduplicates results", () => {
  const content: StructuredMemoryContent = {
    schemaVersion: "memory.v2",
    workContext: "duplicate",
    topOfMind: ["duplicate"],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
  };
  const text = extractStructuredMemoryText(content);
  const duplicates = text.filter((t: string) => t === "duplicate");
  assert.equal(duplicates.length, 1);
});

test("buildFactProvenanceFromRecord creates provenance from record", () => {
  const provenance = buildFactProvenanceFromRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    agentId: "agent_1",
    executionId: "exec_1",
    classification: "important",
    createdAt: "2024-01-01T00:00:00.000Z",
  }, "test-source");
  assert.equal(provenance.source, "test-source");
  assert.equal(provenance.taskId, "task_1");
  assert.equal(provenance.sessionId, "sess_1");
  assert.equal(provenance.agentId, "agent_1");
  assert.equal(provenance.executionId, "exec_1");
  assert.equal(provenance.classification, "important");
  assert.equal(provenance.observedAt, "2024-01-01T00:00:00.000Z");
});

test("normalizeMemoryContent handles text/note fields as topOfMind", () => {
  const result = normalizeMemoryContent({
    content: {
      text: "some text note",
    },
  });
  assert.ok(result.topOfMind.includes("some text note"));
  assert.ok(result.facts.some((f: { content: string; category: string | null }) => f.content === "some text note" && f.category === "note"));
});

test("normalizeMemoryContent handles summary field as longTermBackground", () => {
  const result = normalizeMemoryContent({
    content: {
      summary: "this is a summary",
    },
  });
  assert.ok(result.longTermBackground.includes("this is a summary"));
});

test("normalizeMemoryContent handles errorMessage field", () => {
  const result = normalizeMemoryContent({
    content: {
      errorMessage: "something went wrong",
    },
  });
  assert.ok(result.recentHistory.includes("something went wrong"));
  assert.ok(result.facts.some((f: { category: string | null }) => f.category === "error_message"));
});

test("normalizeMemoryContent clamps confidence to 0-1 range", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [
        { content: "high", category: "c", confidence: 1.5, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
        { content: "low", category: "c", confidence: -0.5, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
      ],
    },
  });
  assert.equal(result.facts[0]!.confidence, 1);
  assert.equal(result.facts[1]!.confidence, 0);
});

test("normalizeMemoryContent filters null/undefined content in facts", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [
        { content: null, category: null, confidence: null, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
        { content: "valid fact", category: null, confidence: null, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
      ],
    },
  });
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0]!.content, "valid fact");
});

test("normalizeMemoryContent filters null values from topOfMind array via normalizeStringList", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: ["valid item", null as any, undefined as any, "another valid"],
      recentHistory: [],
      longTermBackground: [],
      facts: [],
    },
  });
  // Should filter out null/undefined and produce valid strings
  assert.ok(result.topOfMind.includes("valid item"));
  assert.ok(result.topOfMind.includes("another valid"));
  assert.equal(result.topOfMind.length, 2);
});

test("normalizeMemoryContent filters null values from recentHistory array via normalizeStringList", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [null as any, "valid history", undefined as any],
      longTermBackground: [],
      facts: [],
    },
  });
  assert.ok(result.recentHistory.includes("valid history"));
  assert.equal(result.recentHistory.length, 1);
});

test("normalizeMemoryContent filters null values from longTermBackground array via normalizeStringList", () => {
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [null as any, "valid background", undefined as any],
      facts: [],
    },
  });
  assert.ok(result.longTermBackground.includes("valid background"));
  assert.equal(result.longTermBackground.length, 1);
});

test("normalizeMemoryContent uses defaultSource for provenance when provided", () => {
  const result = normalizeMemoryContent({
    content: "test content",
    defaultSource: "custom_source",
    sessionId: "sess_123",
    agentId: "agent_456",
  });
  assert.equal(result.facts[0]!.provenance.source, "custom_source");
});

test("normalizeMemoryContent uses defaultSource in structured object provenance", () => {
  // Test that defaultSource at input level affects provenance
  const result = normalizeMemoryContent({
    content: "simple content",
    defaultSource: "test_source",
  });
  // provenance.source should use defaultSource, not "remember"
  assert.equal(result.facts[0]!.provenance.source, "test_source");
});

test("normalizeMemoryContent handles string fact in facts array via normalizeFact string branch", () => {
  // Pass a plain string as a fact item to exercise normalizeFact's string handling branch
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [
        "plain string fact" as any,  // String fact to trigger normalizeFact string branch
        { content: "object fact", category: "test", confidence: 0.5, provenance: { source: "s", classification: null, taskId: null, sessionId: null, agentId: null, executionId: null, observedAt: null } },
      ],
    },
  });
  // String fact should be normalized with category=null and fallbackConfidence
  assert.ok(result.facts.length >= 1);
  assert.ok(result.facts.some((f: any) => f.content === "plain string fact" && f.category === null));
  assert.ok(result.facts.some((f: any) => f.content === "object fact"));
});

test("normalizeMemoryContent handles empty string fact via normalizeFact string branch", () => {
  // Empty string after trim should return null from normalizeFact
  const result = normalizeMemoryContent({
    content: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [
        "   " as any,  // Whitespace-only string should be filtered out
      ],
    },
  });
  // Empty string fact should be filtered out
  assert.equal(result.facts.length, 0);
});
