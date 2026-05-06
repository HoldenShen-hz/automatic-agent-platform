import assert from "node:assert/strict";
import test from "node:test";

import { AgentPerformanceProfiler, type ExecutionRecord } from "../../../../src/ops-maturity/agent-lifecycle/agent-performance-profiler.js";

test("AgentPerformanceProfiler: eviction retains the most recently active agent when cleanup runs", () => {
  const profiler = new AgentPerformanceProfiler();
  const internal = profiler as unknown as {
    recordCleanupAt: number;
    executionRecords: Map<string, ExecutionRecord[]>;
  };
  const hotTimestamp = "2026-05-06T10:00:00.000Z";
  const coldTimestamp = "2026-05-05T10:00:00.000Z";

  for (let i = 0; i < 1001; i++) {
    profiler.recordExecution({
      executionId: `exec_${i}`,
      agentId: `agent_${i}`,
      versionId: "v1",
      taskId: `task_${i}`,
      taskType: "test_task",
      status: "success",
      durationMs: 100,
      costUsd: 0.01,
      errorCode: null,
      completedAt: i === 0 ? hotTimestamp : coldTimestamp,
    });
  }
  internal.recordCleanupAt = 0;
  profiler.recordExecution({
    executionId: "exec_trigger",
    agentId: "agent_trigger",
    versionId: "v1",
    taskId: "task_trigger",
    taskType: "test_task",
    status: "success",
    durationMs: 100,
    costUsd: 0.01,
    errorCode: null,
    completedAt: coldTimestamp,
  });

  assert.ok(internal.executionRecords.has("agent_0:v1"));
  assert.ok(internal.executionRecords.size < 1002);
});

test("AgentPerformanceProfiler: computeProfile groups by taskType correctly", () => {
  const profiler = new AgentPerformanceProfiler();

  profiler.recordExecution({
    executionId: "exec_1",
    agentId: "agent_x",
    versionId: "v1",
    taskId: "task_1",
    taskType: "type_a",
    status: "success",
    durationMs: 100,
    costUsd: 0.05,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });

  profiler.recordExecution({
    executionId: "exec_2",
    agentId: "agent_x",
    versionId: "v1",
    taskId: "task_2",
    taskType: "type_b",
    status: "success",
    durationMs: 200,
    costUsd: 0.10,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });

  const profile = profiler.computeProfile("agent_x", "v1");
  assert.equal(profile.taskTypeMetrics.length, 2);

  const typeA = profile.taskTypeMetrics.find((m) => m.taskType === "type_a");
  const typeB = profile.taskTypeMetrics.find((m) => m.taskType === "type_b");

  assert.ok(typeA !== undefined);
  assert.ok(typeB !== undefined);
  assert.equal(typeA!.totalExecutions, 1);
  assert.equal(typeB!.totalExecutions, 1);
});

test("AgentPerformanceProfiler: recommendedFor includes high success rate tasks", () => {
  const profiler = new AgentPerformanceProfiler();

  // 10 successful executions
  for (let i = 0; i < 10; i++) {
    profiler.recordExecution({
      executionId: `exec_success_${i}`,
      agentId: "agent_success",
      versionId: "v1",
      taskId: `task_${i}`,
      taskType: "high_success_task",
      status: "success",
      durationMs: 100,
      costUsd: 0.05,
      errorCode: null,
      completedAt: new Date().toISOString(),
    });
  }

  // 2 failed executions for another task type
  for (let i = 0; i < 2; i++) {
    profiler.recordExecution({
      executionId: `exec_fail_${i}`,
      agentId: "agent_success",
      versionId: "v1",
      taskId: `task_fail_${i}`,
      taskType: "low_success_task",
      status: "failed",
      durationMs: 100,
      costUsd: 0.05,
      errorCode: "ERR_1",
      completedAt: new Date().toISOString(),
    });
  }

  const profile = profiler.computeProfile("agent_success", "v1");

  // high_success_task has 100% success rate (>=90%) -> recommended
  assert.ok(profile.recommendedFor.includes("high_success_task"));
  // low_success_task has 0% success rate (<60%) -> not recommended
  assert.ok(profile.notRecommendedFor.includes("low_success_task"));
});

test("AgentPerformanceProfiler: p95DurationMs calculated correctly", () => {
  const profiler = new AgentPerformanceProfiler();

  // Add 20 executions with increasing durations
  for (let i = 0; i < 20; i++) {
    profiler.recordExecution({
      executionId: `exec_${i}`,
      agentId: "agent_p95",
      versionId: "v1",
      taskId: `task_${i}`,
      taskType: "p95_task",
      status: "success",
      durationMs: (i + 1) * 100, // 100, 200, 300, ... 2000
      costUsd: 0.05,
      errorCode: null,
      completedAt: new Date().toISOString(),
    });
  }

  const profile = profiler.computeProfile("agent_p95", "v1");
  const metrics = profile.taskTypeMetrics.find((m) => m.taskType === "p95_task");

  // p95 index = Math.floor(20 * 0.95) = 19, duration at index 19 = 2000
  assert.equal(metrics!.p95DurationMs, 2000);
  assert.equal(metrics!.avgDurationMs, 1050); // (100+200+...+2000)/20 = 1050
});

test("AgentPerformanceProfiler: strengths and weaknesses sorted by success rate", () => {
  const profiler = new AgentPerformanceProfiler();

  // Best performer
  for (let i = 0; i < 10; i++) {
    profiler.recordExecution({
      executionId: `exec_best_${i}`,
      agentId: "agent_rank",
      versionId: "v1",
      taskId: `task_best_${i}`,
      taskType: "best_task",
      status: "success",
      durationMs: 100,
      costUsd: 0.05,
      errorCode: null,
      completedAt: new Date().toISOString(),
    });
  }

  // Medium performer
  for (let i = 0; i < 10; i++) {
    profiler.recordExecution({
      executionId: `exec_med_${i}`,
      agentId: "agent_rank",
      versionId: "v1",
      taskId: `task_med_${i}`,
      taskType: "medium_task",
      status: i < 5 ? "success" : "failed", // 50% success
      durationMs: 100,
      costUsd: 0.05,
      errorCode: null,
      completedAt: new Date().toISOString(),
    });
  }

  // Worst performer
  for (let i = 0; i < 5; i++) {
    profiler.recordExecution({
      executionId: `exec_worst_${i}`,
      agentId: "agent_rank",
      versionId: "v1",
      taskId: `task_worst_${i}`,
      taskType: "worst_task",
      status: "failed",
      durationMs: 100,
      costUsd: 0.05,
      errorCode: "ERR",
      completedAt: new Date().toISOString(),
    });
  }

  const profile = profiler.computeProfile("agent_rank", "v1");

  assert.ok(profile.strengths.includes("best_task"));
  // medium might be in neither or weaknesses
  // worst_task should be in weaknesses (0% success)
  assert.ok(
    profile.weaknesses.includes("worst_task") ||
    profile.notRecommendedFor.includes("worst_task"),
  );
});

test("AgentPerformanceProfiler: getTopPerformingTaskType returns highest success rate", () => {
  const profiler = new AgentPerformanceProfiler();

  // Low rate task
  profiler.recordExecution({
    executionId: "exec_low_1",
    agentId: "agent_top",
    versionId: "v1",
    taskId: "task_low",
    taskType: "low_rate",
    status: "failed",
    durationMs: 100,
    costUsd: 0.05,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });

  // High rate task
  profiler.recordExecution({
    executionId: "exec_high_1",
    agentId: "agent_top",
    versionId: "v1",
    taskId: "task_high_1",
    taskType: "high_rate",
    status: "success",
    durationMs: 100,
    costUsd: 0.05,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });
  profiler.recordExecution({
    executionId: "exec_high_2",
    agentId: "agent_top",
    versionId: "v1",
    taskId: "task_high_2",
    taskType: "high_rate",
    status: "success",
    durationMs: 100,
    costUsd: 0.05,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });

  // Compute profile first
  profiler.computeProfile("agent_top", "v1");

  const top = profiler.getTopPerformingTaskType("agent_top", "v1");
  assert.equal(top, "high_rate");
});

test("AgentPerformanceProfiler: getProfile returns cached profile", () => {
  const profiler = new AgentPerformanceProfiler();

  profiler.recordExecution({
    executionId: "exec_1",
    agentId: "agent_cache",
    versionId: "v1",
    taskId: "task_1",
    taskType: "cache_task",
    status: "success",
    durationMs: 100,
    costUsd: 0.05,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });

  const computed = profiler.computeProfile("agent_cache", "v1");
  const retrieved = profiler.getProfile("agent_cache", "v1");

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.agentId, "agent_cache");
  assert.equal(retrieved!.versionId, "v1");
  // Should be the same object reference
  assert.equal(computed, retrieved);
});

test("AgentPerformanceProfiler: handles cancelled status", () => {
  const profiler = new AgentPerformanceProfiler();

  profiler.recordExecution({
    executionId: "exec_cancel_1",
    agentId: "agent_cancel",
    versionId: "v1",
    taskId: "task_cancel",
    taskType: "cancel_task",
    status: "cancelled",
    durationMs: 50,
    costUsd: 0.02,
    errorCode: null,
    completedAt: new Date().toISOString(),
  });

  const profile = profiler.computeProfile("agent_cancel", "v1");

  // Cancelled is not a success
  assert.equal(profile.overallSuccessRate, 0);
});
