/**
 * Golden Test: Observation Aggregator Output Structure
 *
 * Verifies observation aggregator produces consistent unified observations
 * combining task-level and system-level situations with R2 constraint enforcement.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ObservationAggregator, type UnifiedObservation } from "../../src/platform/shared/observability/observation-aggregator.js";
import { assertGolden } from "../helpers/golden.js";
import { TaskSituationBuilder } from "../../src/platform/shared/observability/task-situation-builder.js";
import type { TaskSituation } from "../../src/platform/orchestration/oapeflir/types/task-situation.js";
import type { SystemSituation } from "../../src/platform/shared/observability/system-situation-model.js";

test("golden: observation aggregator produces unified observation with required fields", () => {
  const aggregator = new ObservationAggregator();
  const situationBuilder = new TaskSituationBuilder();

  const taskSituation = situationBuilder.build({
    taskId: "observe_task_001",
    objective: "Process data",
    currentPhase: "executing",
  });

  const systemSituation: SystemSituation = {
    healthStatus: "ok",
    observedAt: Date.now(),
  };

  const observation = aggregator.aggregate(taskSituation, systemSituation);

  // Verify structure
  assert.ok(observation, "Observation should exist");
  assert.ok(observation.task, "Should have task");
  assert.ok(observation.system, "Should have system");
  assert.ok(typeof observation.observedAt === "number", "observedAt should be number");

  assertGolden("observation-aggregator-basic", {
    hasTask: observation.task !== undefined,
    hasSystem: observation.system !== undefined,
    observedAtIsNumber: typeof observation.observedAt === "number",
    taskId: observation.task.taskId,
  });
});

test("golden: observation aggregator preserves system health status", () => {
  const aggregator = new ObservationAggregator();
  const situationBuilder = new TaskSituationBuilder();

  const taskSituation = situationBuilder.build({
    taskId: "observe_health_001",
    objective: "Health check",
    currentPhase: "executing",
  });

  const systemSituation: SystemSituation = {
    healthStatus: "degraded",
    providerHealth: {
      status: "degraded",
      successRate: 0.85,
      recentCalls: 100,
    },
    observedAt: Date.now(),
  };

  const observation = aggregator.aggregate(taskSituation, systemSituation);

  assert.equal(observation.system.healthStatus, "degraded");
  assert.equal(observation.system.providerHealth.status, "degraded");

  assertGolden("observation-aggregator-system", {
    healthStatus: observation.system.healthStatus,
    providerStatus: observation.system.providerHealth.status,
  });
});

test("golden: observation aggregator strips blacklisted fields (R2 constraint)", () => {
  const aggregator = new ObservationAggregator();

  // Create a task situation with blacklisted fields
  const taskSituationWithBlacklist = {
    taskId: "observe_blacklist_001",
    timestamp: Date.now(),
    objective: "Test blacklisted fields",
    currentPhase: "executing" as const,
    userIntent: {
      raw: "Test",
      normalized: "test",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/test",
      fileCount: 0,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "v20.0.0",
      platform: "linux",
      workingDirectory: "/test",
      availableTools: [],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
    // Blacklisted fields that should be stripped
    recommendedWorkflow: "agent_minimal",
    riskLevel: "high",
    approvalRequired: true,
    modelClass: "claude-sonnet",
    recommendedActions: ["action1", "action2"],
  } as unknown as TaskSituation;

  const systemSituation: SystemSituation = {
    healthStatus: "ok",
    observedAt: Date.now(),
  };

  const observation = aggregator.aggregate(taskSituationWithBlacklist, systemSituation);

  // Verify blacklisted fields are stripped
  assert.ok(!("recommendedWorkflow" in observation.task), "recommendedWorkflow should be stripped");
  assert.ok(!("riskLevel" in observation.task), "riskLevel should be stripped");
  assert.ok(!("approvalRequired" in observation.task), "approvalRequired should be stripped");
  assert.ok(!("modelClass" in observation.task), "modelClass should be stripped");
  assert.ok(!("recommendedActions" in observation.task), "recommendedActions should be stripped");

  assertGolden("observation-aggregator-r2-blacklist", {
    hasRecommendedWorkflow: "recommendedWorkflow" in observation.task,
    hasRiskLevel: "riskLevel" in observation.task,
    hasApprovalRequired: "approvalRequired" in observation.task,
    hasModelClass: "modelClass" in observation.task,
    hasRecommendedActions: "recommendedActions" in observation.task,
  });
});

test("golden: observation aggregator with full system situation", () => {
  const aggregator = new ObservationAggregator();
  const situationBuilder = new TaskSituationBuilder();

  const taskSituation = situationBuilder.build({
    taskId: "observe_full_001",
    objective: "Full integration test",
    currentPhase: "executing",
  });

  const systemSituation: SystemSituation = {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 0.99,
      recentCalls: 1000,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 45.5,
      activeProcesses: 8,
    },
    queueBacklog: {
      size: 10,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 5,
    },
    findings: [],
    observedAt: Date.now(),
  };

  const observation = aggregator.aggregate(taskSituation, systemSituation);

  assert.ok(observation.system.providerHealth, "Should have providerHealth");
  assert.ok(observation.system.resourceUtilization, "Should have resourceUtilization");
  assert.ok(observation.system.queueBacklog, "Should have queueBacklog");
  assert.ok(observation.system.eventBusBacklog, "Should have eventBusBacklog");

  assertGolden("observation-aggregator-full-system", {
    healthStatus: observation.system.healthStatus,
    providerSuccessRate: observation.system.providerHealth.successRate,
    memoryMb: observation.system.resourceUtilization.memoryRssMb,
    cpuPercent: observation.system.resourceUtilization.cpuPercent,
    queueSize: observation.system.queueBacklog.size,
    tier1Acks: observation.system.eventBusBacklog.tier1PendingAcks,
  });
});
