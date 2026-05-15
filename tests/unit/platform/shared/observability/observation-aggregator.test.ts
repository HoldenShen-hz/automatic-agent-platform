import test from "node:test";
import assert from "node:assert/strict";

import { ObservationAggregator } from "../../../../../src/platform/shared/observability/observation-aggregator.js";
import { parseTaskSituation } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";
import { parseSystemSituation } from "../../../../../src/platform/shared/observability/system-situation-model.js";
import type { TaskSituation } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";
import type { SystemSituation } from "../../../../../src/platform/shared/observability/system-situation-model.js";

function createMockTaskSituation(): TaskSituation {
  return parseTaskSituation({
    taskId: "task_test_1",
    timestamp: Date.now(),
    objective: "test objective",
    currentPhase: "planning",
    userIntent: {
      raw: "test",
      normalized: "test",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/tmp",
      fileCount: 5,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "v22.0.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: ["read"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  });
}

function createMockSystemSituation(): SystemSituation {
  return parseSystemSituation({
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 1,
      recentCalls: 100,
    },
    resourceUtilization: {
      memoryRssMb: 256,
      activeProcesses: 4,
    },
    queueBacklog: {
      size: 5,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 0,
    },
    findings: [],
    observedAt: Date.now(),
  });
}

test("ObservationAggregator.aggregate merges task and system situations", () => {
  const aggregator = new ObservationAggregator();
  const task = createMockTaskSituation();
  const system = createMockSystemSituation();

  const result = aggregator.aggregate(task, system);

  assert.equal(result.task.taskId, "task_test_1");
  assert.equal(result.system.healthStatus, "ok");
  assert.ok(result.observedAt >= 0);
});

test("ObservationAggregator.aggregate sets observedAt timestamp", () => {
  const aggregator = new ObservationAggregator();
  const before = Date.now();
  const result = aggregator.aggregate(createMockTaskSituation(), createMockSystemSituation());
  const after = Date.now();

  assert.ok(result.observedAt >= before);
  assert.ok(result.observedAt <= after);
});

test("ObservationAggregator preserves task fields after aggregation", () => {
  const aggregator = new ObservationAggregator();
  const task = createMockTaskSituation();
  const system = createMockSystemSituation();

  const result = aggregator.aggregate(task, system);

  assert.equal(result.task.taskId, task.taskId);
  assert.equal(result.task.objective, task.objective);
  assert.equal(result.task.currentPhase, task.currentPhase);
});

test("ObservationAggregator strips blacklisted fields from task situation", () => {
  const aggregator = new ObservationAggregator();
  const taskWithBlacklisted = parseTaskSituation({
    taskId: "task_blacklist_test",
    timestamp: Date.now(),
    objective: "test",
    currentPhase: "planning",
    userIntent: { raw: "test", normalized: "test", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/tmp", fileCount: 0, relevantFiles: [] },
    environmentContext: { nodeVersion: "v22", platform: "darwin", workingDirectory: "/tmp", availableTools: [] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [] },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
    // These are blacklisted fields that should be stripped
    recommendedWorkflow: "test_workflow",
    riskLevel: "low",
    approvalRequired: false,
  });

  const result = aggregator.aggregate(taskWithBlacklisted, createMockSystemSituation());

  // Blacklisted fields should be stripped
  assert.ok(!("recommendedWorkflow" in result.task));
  assert.ok(!("riskLevel" in result.task));
  assert.ok(!("approvalRequired" in result.task));
});

test("ObservationAggregator accepts valid task situation", () => {
  const aggregator = new ObservationAggregator();
  const validTask = parseTaskSituation({
    taskId: "task_valid",
    timestamp: Date.now(),
    objective: "valid task",
    currentPhase: "executing",
    userIntent: { raw: "valid", normalized: "valid", confidence: 0.8 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/project", fileCount: 10, relevantFiles: [{ path: "/project/a.ts" }] },
    environmentContext: { nodeVersion: "v22", platform: "linux", workingDirectory: "/project", availableTools: ["read", "write"] },
    historicalContext: { previousTaskIds: ["task_1"], relatedMemoryRefs: [] },
    relevantMemory: ["mem_1"],
    fileRefs: ["file:///a.ts"],
    metrics: { executionTimeMs: 100 },
  });

  const result = aggregator.aggregate(validTask, createMockSystemSituation());

  assert.equal(result.task.taskId, "task_valid");
  assert.equal(result.task.currentPhase, "executing");
});
