import assert from "node:assert/strict";
import test from "node:test";

// These should be re-exported from the memory index
import type {
  MemoryService,
  MemoryRetrievalService,
  MemoryProvider,
  MemoryConsolidationSummary,
  MemoryQualityReport,
  MemoryRecallQuery,
  ExperienceCacheService,
  ExperienceRecord,
  SimilarExperienceQuery,
} from "../../../../../src/platform/five-plane-state-evidence/memory/index.js";

test("MemoryService type can be referenced", () => {
  // Verify the type exists and can be used in type annotations
  const serviceType: MemoryService = {} as MemoryService;
  assert.ok(serviceType !== null);
});

test("MemoryRetrievalService type can be referenced", () => {
  const serviceType: MemoryRetrievalService = {} as MemoryRetrievalService;
  assert.ok(serviceType !== null);
});

test("MemoryProvider type can be referenced", () => {
  const providerType: MemoryProvider = {} as MemoryProvider;
  assert.ok(providerType !== null);
});

test("MemoryConsolidationSummary type can be referenced", () => {
  const summary: MemoryConsolidationSummary = {
    summaryText: "Consolidated memory content",
    averageQualityScore: 0.85,
    sourceMemoryIds: ["mem_1", "mem_2"],
    sourceCount: 2,
    structuredContent: {
      schemaVersion: "memory.v2",
      workContext: null,
      topOfMind: [],
      recentHistory: [],
      longTermBackground: [],
      facts: [],
      metadata: {},
    },
    lossReport: {
      consolidatedMemoryCount: 1,
      sourceMemoryCount: 2,
      excludedMemories: [],
      droppedContent: [],
      truncationTimestamp: "2026-04-14T00:00:00.000Z",
    },
  };
  assert.equal(summary.averageQualityScore, 0.85);
  assert.equal(summary.sourceCount, 2);
});

test("MemoryQualityReport type can be referenced", () => {
  const report: MemoryQualityReport = {
    generatedAt: "2026-04-14T00:00:00.000Z",
    totalCount: 10,
    activeCount: 8,
    expiredCount: 1,
    revokedCount: 0,
    recalledCount: 2,
    neverRecalledCount: 5,
    averageQualityScore: 0.85,
    byScope: [],
    byLayer: [],
    byClassification: [],
  };
  assert.equal(report.totalCount, 10);
  assert.equal(report.averageQualityScore, 0.85);
});

test("MemoryRecallQuery type can be referenced", () => {
  const query: MemoryRecallQuery = {
    taskId: "task_1",
    memoryLayers: ["layer_3"],
    includeExpired: false,
    includeRevoked: false,
  };
  assert.equal(query.taskId, "task_1");
});

test("ExperienceCacheService type can be referenced", () => {
  const serviceType: ExperienceCacheService = {} as ExperienceCacheService;
  assert.ok(serviceType !== null);
});

test("ExperienceRecord type can be referenced", () => {
  const record: ExperienceRecord = {
    id: "exp_1",
    taskId: "task_1",
    sessionId: "sess_1",
    agentId: "agent_1",
    executionId: "exec_1",
    taskContext: "context",
    taskIntent: "intent",
    toolsUsed: [],
    outcome: "succeeded",
    finalErrorCode: null,
    qualityScore: 0.9,
    createdAt: "2026-04-14T00:00:00.000Z",
    hitCount: 0,
    lastAccessedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "exp_1");
  assert.equal(record.outcome, "succeeded");
});

test("SimilarExperienceQuery type can be referenced", () => {
  const query: SimilarExperienceQuery = {
    taskContext: "fixing a bug",
    toolNames: ["read", "edit"],
    limit: 5,
  };
  assert.equal(query.taskContext, "fixing a bug");
  assert.deepEqual(query.toolNames, ["read", "edit"]);
});
