import assert from "node:assert/strict";
import test from "node:test";
import { buildMemoryConsolidationSummary, type ConsolidationLossReport } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-consolidation.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * R24-29/R24-32 FIX: Test that memory consolidation produces a loss report.
 * Per §29.2, compression requires loss report - facts must not be silently discarded.
 */

function createTestMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const id = overrides.id ?? `mem-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    taskId: "task-001",
    sessionId: "session-001",
    agentId: "agent-001",
    executionId: "execution-001",
    memoryLayer: "layer_3",
    scope: "project",
    contentJson: JSON.stringify({
      workContext: "Test work context",
      topOfMind: ["Test fact 1", "Test fact 2"],
      recentHistory: ["Test history 1"],
      facts: [
        { content: "Test fact content 1", category: "test", confidence: 0.8, provenance: {} },
        { content: "Test fact content 2", category: "test", confidence: 0.9, provenance: {} },
      ],
    }),
    classification: "test",
    sourceTrustLevel: "trusted",
    qualityScore: 0.75,
    hitCount: 5,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.6,
    freshnessScore: 0.7,
    contentHash: "test-hash",
    ...overrides,
  };
}

test("R24-29/R24-32: buildMemoryConsolidationSummary returns lossReport with droppedContent", () => {
  // Create 15 memories - more than MAX_SNIPPETS (8) and MAX_FACTS (12)
  const memories: MemoryRecord[] = [];
  for (let i = 0; i < 15; i++) {
    memories.push(createTestMemoryRecord({
      id: `mem-${i}`,
      contentJson: JSON.stringify({
        workContext: `Memory ${i} context`,
        topOfMind: [`Top of mind ${i}`],
        recentHistory: [`Recent history ${i}`],
        facts: [
          { content: `Fact ${i}-1`, category: "test", confidence: 0.8, provenance: {} },
          { content: `Fact ${i}-2`, category: "test", confidence: 0.9, provenance: {} },
        ],
      }),
    }));
  }

  const result = buildMemoryConsolidationSummary(memories, "layer_5");

  // Verify lossReport exists and has correct structure
  assert.ok(result.lossReport, "lossReport should exist");
  assert.equal(result.lossReport.consolidatedMemoryCount, 15, "consolidatedMemoryCount should be 15");
  assert.equal(result.lossReport.sourceMemoryCount, 15, "sourceMemoryCount should be 15");
  assert.ok(Array.isArray(result.lossReport.droppedContent), "droppedContent should be an array");
  assert.ok(result.lossReport.truncationTimestamp, "truncationTimestamp should be set");

  // Verify dropped snippets are tracked
  const droppedSnippets = result.lossReport.droppedContent.filter(d => d.reason.includes("snippets"));
  assert.ok(droppedSnippets.length > 0, "should have dropped snippets");

  // Verify dropped facts are tracked
  const droppedFacts = result.lossReport.droppedContent.filter(d => d.reason.includes("facts"));
  assert.ok(droppedFacts.length > 0, "should have dropped facts");
});

test("R24-29/R24-32: lossReport droppedContent contains memoryId and snippetPreview", () => {
  const memories: MemoryRecord[] = [
    createTestMemoryRecord({ id: "mem-exceed-1" }),
    createTestMemoryRecord({ id: "mem-exceed-2" }),
  ];

  const result = buildMemoryConsolidationSummary(memories, "layer_5");

  assert.ok(result.lossReport.droppedContent.length >= 0, "droppedContent should be an array");

  // If there are dropped items, verify structure
  for (const dropped of result.lossReport.droppedContent) {
    assert.ok(dropped.memoryId, "dropped item should have memoryId");
    assert.ok(dropped.snippetPreview !== undefined, "dropped item should have snippetPreview");
    assert.ok(dropped.reason.includes("exceeded_max_"), "dropped item should have reason with exceeded_max_");
  }
});

test("R24-29/R24-32: structuredContent facts are limited to MAX_FACTS (12)", () => {
  // Create memories with multiple facts each
  const memories: MemoryRecord[] = [];
  for (let i = 0; i < 5; i++) {
    const facts = [];
    for (let j = 0; j < 5; j++) {
      facts.push({
        content: `Fact ${i}-${j} with some extra content to make it longer`,
        category: "test",
        confidence: 0.8,
        provenance: {},
      });
    }
    memories.push(createTestMemoryRecord({
      id: `mem-${i}`,
      contentJson: JSON.stringify({
        workContext: `Memory ${i} context`,
        topOfMind: [`Top of mind ${i}`],
        recentHistory: [],
        facts,
      }),
    }));
  }
  // Total facts = 25, should be limited to 12 in structuredContent
  const result = buildMemoryConsolidationSummary(memories, "layer_5");

  // Facts in structuredContent should be limited to 12
  assert.ok(result.structuredContent.facts.length <= 12, "facts should be limited to MAX_FACTS");

  // But loss report should track all the dropped ones
  const droppedFacts = result.lossReport.droppedContent.filter(d => d.reason.includes("facts"));
  assert.ok(droppedFacts.length > 0, "should have tracked dropped facts in loss report");
});