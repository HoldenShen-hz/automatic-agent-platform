import assert from "node:assert/strict";
import test from "node:test";

import {
  extractMemorySnippet,
  hasExplicitMemoryBoundary,
  buildMemoryConsolidationSummary,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-consolidation.js";
import type { MemoryRecord, MemoryLayer } from "../../../../../src/platform/contracts/types/domain.js";

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_test",
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3" as MemoryLayer,
    scope: "project",
    contentJson: '{"text":"test content","facts":[]}',
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: null,
    hitCount: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
    ...overrides,
  };
}

test("hasExplicitMemoryBoundary returns false for empty query", () => {
  const query = {};
  assert.equal(hasExplicitMemoryBoundary(query), false);
});

test("hasExplicitMemoryBoundary returns true for taskId", () => {
  const query = { taskId: "task_123" };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

test("hasExplicitMemoryBoundary returns true for sessionId", () => {
  const query = { sessionId: "sess_123" };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

test("hasExplicitMemoryBoundary returns true for agentId", () => {
  const query = { agentId: "agent_123" };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

test("hasExplicitMemoryBoundary returns true for executionId", () => {
  const query = { executionId: "exec_123" };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

test("hasExplicitMemoryBoundary returns true for non-empty scopes", () => {
  const query = { scopes: ["session"] };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

test("hasExplicitMemoryBoundary returns false for empty scopes array", () => {
  const query = { scopes: [] };
  assert.equal(hasExplicitMemoryBoundary(query), false);
});

test("hasExplicitMemoryBoundary returns true for scopes with empty strings", () => {
  // The implementation only checks scopes.length > 0, not whether strings are empty
  const query = { scopes: [""] };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

test("extractMemorySnippet handles simple contentJson", () => {
  const record = {
    contentJson: '{"text": "Hello world"}',
  };
  const result = extractMemorySnippet(record);
  assert.ok(result.length > 0);
});

test("extractMemorySnippet handles empty contentJson", () => {
  const record = {
    contentJson: "{}",
  };
  const result = extractMemorySnippet(record);
  assert.equal(result, "{}");
});

test("hasExplicitMemoryBoundary returns true for multiple fields", () => {
  const query = { taskId: "task_123", sessionId: "sess_123" };
  assert.equal(hasExplicitMemoryBoundary(query), true);
});

// =============================================================================
// buildMemoryConsolidationSummary tests
// =============================================================================

test("buildMemoryConsolidationSummary sorts by createdAt ascending (localeCompare branch)", () => {
  // Records with different createdAt values - covers line 44 return left.createdAt.localeCompare(right.createdAt)
  const records = [
    createMemoryRecord({ id: "mem_2", createdAt: "2026-04-02T00:00:00.000Z" }),
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // Should be sorted by createdAt ascending, so mem_1 comes first
  assert.equal(result.sourceMemoryIds[0], "mem_1");
  assert.equal(result.sourceMemoryIds[1], "mem_2");
});

test("buildMemoryConsolidationSummary sorts by id when createdAt is equal (id localeCompare branch)", () => {
  // Records with same createdAt but different id - covers lines 41-43 return left.id.localeCompare(right.id)
  const records = [
    createMemoryRecord({ id: "mem_z", createdAt: "2026-04-01T00:00:00.000Z" }),
    createMemoryRecord({ id: "mem_a", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // Should be sorted by id ascending when createdAt is equal
  assert.equal(result.sourceMemoryIds[0], "mem_a");
  assert.equal(result.sourceMemoryIds[1], "mem_z");
});

test("buildMemoryConsolidationSummary calculates average quality score", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.8 }),
    createMemoryRecord({ id: "mem_2", qualityScore: 0.6 }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  assert.equal(result.averageQualityScore, 0.7);
});

test("buildMemoryConsolidationSummary returns null average when no quality scores", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", qualityScore: null }),
    createMemoryRecord({ id: "mem_2", qualityScore: null }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  assert.equal(result.averageQualityScore, null);
});

test("buildMemoryConsolidationSummary filters out non-finite quality scores", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", qualityScore: 0.8 }),
    createMemoryRecord({ id: "mem_2", qualityScore: NaN }),
    createMemoryRecord({ id: "mem_3", qualityScore: Infinity }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // Only 0.8 is finite, so average should be 0.8
  assert.equal(result.averageQualityScore, 0.8);
});

test("buildMemoryConsolidationSummary returns correct source count", () => {
  const records = [
    createMemoryRecord({ id: "mem_1" }),
    createMemoryRecord({ id: "mem_2" }),
    createMemoryRecord({ id: "mem_3" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  assert.equal(result.sourceCount, 3);
  assert.equal(result.sourceMemoryIds.length, 3);
});

test("buildMemoryConsolidationSummary includes targetLayer in summaryText", () => {
  const records = [
    createMemoryRecord({ id: "mem_1" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_7");

  assert.ok(result.summaryText.includes("layer_7"));
  assert.ok(result.summaryText.includes("Consolidated 1 memories"));
});

test("buildMemoryConsolidationSummary produces structured content with facts", () => {
  // Use structured content with facts to ensure snippets and facts are generated
  const records = [
    createMemoryRecord({
      id: "mem_1",
      createdAt: "2026-04-01T00:00:00.000Z",
      contentJson: JSON.stringify({
        workContext: "Working on authentication module",
        facts: [{ content: "Auth failed for invalid token", category: "error", confidence: 0.9 }],
      }),
    }),
    createMemoryRecord({
      id: "mem_2",
      createdAt: "2026-04-02T00:00:00.000Z",
      contentJson: JSON.stringify({
        workContext: "Fixed authentication issue",
        facts: [{ content: "Token validation was broken", category: "fix", confidence: 0.95 }],
      }),
    }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // Verify summary includes Window info (covers line 58)
  assert.ok(result.summaryText.includes("Window"));
  // Verify Highlights are included (covers line 60 ternary)
  assert.ok(result.summaryText.includes("Highlights"));
  // Verify structured content has longTermBackground (covers lines 71-72)
  assert.ok(result.structuredContent.longTermBackground.length > 0);
});

test("buildMemoryConsolidationSummary with single record has same start and end window", () => {
  const records = [
    createMemoryRecord({ id: "mem_1", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // Single record - Window should show same timestamp twice
  assert.ok(result.summaryText.includes("2026-04-01T00:00:00.000Z"));
});

test("buildMemoryConsolidationSummary handles empty records array", () => {
  // Covers line 58 branch where ordered[0] is undefined (?? "unknown")
  // Covers line 60 branch where snippets.length === 0 (ternary else branch)
  // Covers lines 71-72 branches where ordered[0] and ordered.at(-1) are undefined
  const records: MemoryRecord[] = [];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  assert.equal(result.sourceCount, 0);
  assert.equal(result.sourceMemoryIds.length, 0);
  assert.equal(result.averageQualityScore, null);
  assert.ok(result.summaryText.includes("unknown"));
  assert.ok(result.summaryText.includes("Consolidated 0 memories"));
  // The Highlights branch should not be included when snippets is empty
  assert.ok(!result.summaryText.includes("Highlights"));
});

test("buildMemoryConsolidationSummary handles records with whitespace-only content", () => {
  // When all records have content that produces empty snippets after trimming
  // Covers line 60 ternary branch where snippets.length === 0
  const records = [
    createMemoryRecord({ id: "mem_1", contentJson: "   " }),
    createMemoryRecord({ id: "mem_2", contentJson: "\n\t" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // snippets will be empty due to trim().length === 0 filter
  assert.ok(!result.summaryText.includes("Highlights"));
  // But window should still be present
  assert.ok(result.summaryText.includes("Window"));
});

test("buildMemoryConsolidationSummary handles records with empty classifications", () => {
  // When classifications array is empty, join returns "" and || "unknown" kicks in
  // Covers line 59 branch and line 72 branch where join returns empty
  const records = [
    createMemoryRecord({ id: "mem_1", classification: "" }),
    createMemoryRecord({ id: "mem_2", classification: "" }),
  ];

  const result = buildMemoryConsolidationSummary(records, "layer_5");

  // classifications.join(", ") returns "" so || "unknown" is used
  assert.ok(result.summaryText.includes("unknown"));
  assert.ok(result.structuredContent.longTermBackground.some(item => item.includes("unknown")));
});
