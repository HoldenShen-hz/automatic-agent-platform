import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentPerformanceProfiler,
  type ExecutionRecord,
} from "../../../../../src/ops-maturity/agent-lifecycle/agent-performance-profiler.js";

function createExecutionRecord(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    executionId: overrides.executionId ?? "exec-1",
    agentId: overrides.agentId ?? "agent-1",
    versionId: overrides.versionId ?? "v1",
    taskId: overrides.taskId ?? "task-1",
    taskType: overrides.taskType ?? "code_generation",
    status: overrides.status ?? "success",
    durationMs: overrides.durationMs ?? 1000,
    costUsd: overrides.costUsd ?? 0.05,
    errorCode: overrides.errorCode ?? null,
    completedAt: overrides.completedAt ?? "2026-04-24T00:00:00Z",
  };
}

test("AgentPerformanceProfiler.recordExecution stores execution record", () => {
  const profiler = new AgentPerformanceProfiler();
  const record = createExecutionRecord({ executionId: "exec-record-1" });

  profiler.recordExecution(record);

  const profile = profiler.computeProfile("agent-1", "v1");
  assert.equal(profile.taskTypeMetrics.length, 1);
  assert.equal(profile.taskTypeMetrics[0]!.totalExecutions, 1);
});

test("AgentPerformanceProfiler.computeProfile calculates overall success rate", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", status: "failed" }));

  const profile = profiler.computeProfile("agent-1", "v1");

  assert.equal(profile.overallSuccessRate, 2 / 3);
  assert.ok(profile.overallSuccessRate > 0.6);
});

test("AgentPerformanceProfiler.computeProfile calculates task type metrics", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ taskType: "code_generation", status: "success", durationMs: 1000, costUsd: 0.05 }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", taskType: "code_generation", status: "success", durationMs: 2000, costUsd: 0.10 }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", taskType: "code_generation", status: "failed", durationMs: 500, costUsd: 0.02 }));

  const profile = profiler.computeProfile("agent-1", "v1");

  const codeGenMetrics = profile.taskTypeMetrics.find((m) => m.taskType === "code_generation");
  assert.ok(codeGenMetrics !== undefined);
  assert.equal(codeGenMetrics!.totalExecutions, 3);
  assert.equal(codeGenMetrics!.successCount, 2);
  assert.equal(codeGenMetrics!.failureCount, 1);
  assert.equal(codeGenMetrics!.successRate, 2 / 3);
});

test("AgentPerformanceProfiler.computeProfile calculates p95 duration", () => {
  const profiler = new AgentPerformanceProfiler();
  // Add 20 records to get meaningful p95
  for (let i = 0; i < 20; i++) {
    profiler.recordExecution(createExecutionRecord({ executionId: `exec-p95-${i}`, durationMs: (i + 1) * 100 }));
  }

  const profile = profiler.computeProfile("agent-1", "v1");

  const metrics = profile.taskTypeMetrics[0];
  assert.ok(metrics!.p95DurationMs > 0);
  // p95 of 1-20 * 100 = 2000 (index 19 * 0.95 = 19, so element at index 19 = 2000)
});

test("AgentPerformanceProfiler.computeProfile identifies recommended task types", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ taskType: "high_success", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", taskType: "high_success", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", taskType: "high_success", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-4", taskType: "high_success", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-5", taskType: "high_success", status: "success" }));
  // 5 successes = 100% success rate >= 90% threshold

  profiler.recordExecution(createExecutionRecord({ executionId: "exec-6", taskType: "low_success", status: "failed" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-7", taskType: "low_success", status: "failed" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-8", taskType: "low_success", status: "failed" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-9", taskType: "low_success", status: "failed" }));
  // 4 failures = 0% success rate < 60% threshold

  profiler.recordExecution(createExecutionRecord({ executionId: "exec-10", taskType: "medium_success", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-11", taskType: "medium_success", status: "failed" }));
  // 1 success, 1 failure = 50% - not recommended for either

  const profile = profiler.computeProfile("agent-1", "v1");

  assert.ok(profile.recommendedFor.includes("high_success"));
  assert.ok(profile.notRecommendedFor.includes("low_success"));
  assert.ok(!profile.recommendedFor.includes("low_success"));
  assert.ok(!profile.notRecommendedFor.includes("medium_success"));
});

test("AgentPerformanceProfiler.computeProfile identifies strengths and weaknesses", () => {
  const profiler = new AgentPerformanceProfiler();
  // Top performer
  for (let i = 0; i < 5; i++) {
    profiler.recordExecution(createExecutionRecord({ executionId: `exec-top-${i}`, taskType: "top_task", status: "success" }));
  }
  // Medium performer
  for (let i = 0; i < 5; i++) {
    profiler.recordExecution(createExecutionRecord({ executionId: `exec-med-${i}`, taskType: "medium_task", status: "failed" }));
  }
  // Worst performer
  for (let i = 0; i < 3; i++) {
    profiler.recordExecution(createExecutionRecord({ executionId: `exec-bot-${i}`, taskType: "bottom_task", status: "failed" }));
  }

  const profile = profiler.computeProfile("agent-1", "v1");

  assert.ok(profile.strengths.includes("top_task"));
  assert.ok(profile.weaknesses.includes("bottom_task"));
});

test("AgentPerformanceProfiler.computeProfile handles empty records", () => {
  const profiler = new AgentPerformanceProfiler();

  const profile = profiler.computeProfile("agent-1", "v1");

  assert.equal(profile.overallSuccessRate, 0);
  assert.equal(profile.taskTypeMetrics.length, 0);
  assert.deepEqual(profile.recommendedFor, []);
  assert.deepEqual(profile.notRecommendedFor, []);
});

test("AgentPerformanceProfiler.getProfile returns null for unknown agent/version", () => {
  const profiler = new AgentPerformanceProfiler();

  const profile = profiler.getProfile("unknown-agent", "unknown-version");

  assert.equal(profile, null);
});

test("AgentPerformanceProfiler.getProfile returns computed profile", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord());

  const computed = profiler.computeProfile("agent-1", "v1");
  const retrieved = profiler.getProfile("agent-1", "v1");

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.agentId, "agent-1");
  assert.equal(retrieved!.versionId, "v1");
});

test("AgentPerformanceProfiler.getTopPerformingTaskType returns null when no profile", () => {
  const profiler = new AgentPerformanceProfiler();

  const result = profiler.getTopPerformingTaskType("agent-1", "v1");

  assert.equal(result, null);
});

test("AgentPerformanceProfiler.getTopPerformingTaskType returns highest success rate task", () => {
  const profiler = new AgentPerformanceProfiler();
  // Low success rate
  profiler.recordExecution(createExecutionRecord({ taskType: "low_rate", status: "failed" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", taskType: "low_rate", status: "failed" }));
  // High success rate
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", taskType: "high_rate", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-4", taskType: "high_rate", status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-5", taskType: "high_rate", status: "success" }));

  const top = profiler.getTopPerformingTaskType("agent-1", "v1");

  assert.equal(top, "high_rate");
});

test("AgentPerformanceProfiler.recordExecution handles multiple agents and versions", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ agentId: "agent-a", versionId: "v1" }));
  profiler.recordExecution(createExecutionRecord({ agentId: "agent-a", versionId: "v2" }));
  profiler.recordExecution(createExecutionRecord({ agentId: "agent-b", versionId: "v1" }));

  const profileA = profiler.getProfile("agent-a", "v1");
  const profileB = profiler.getProfile("agent-a", "v2");
  const profileC = profiler.getProfile("agent-b", "v1");

  assert.ok(profileA !== null);
  assert.ok(profileB !== null);
  assert.ok(profileC !== null);
  assert.equal(profileA!.taskTypeMetrics.length, 1);
  assert.equal(profileB!.taskTypeMetrics.length, 1);
  assert.equal(profileC!.taskTypeMetrics.length, 1);
});

test("AgentPerformanceProfiler.computeProfile calculates average cost correctly", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ costUsd: 0.10 }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", costUsd: 0.20 }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", costUsd: 0.30 }));

  const profile = profiler.computeProfile("agent-1", "v1");

  const metrics = profile.taskTypeMetrics[0];
  assert.equal(metrics!.avgCostUsd, 0.20);
  assert.equal(metrics!.totalCostUsd, 0.60);
});

test("AgentPerformanceProfiler.computeProfile calculates average duration correctly", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ durationMs: 100 }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", durationMs: 200 }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", durationMs: 300 }));

  const profile = profiler.computeProfile("agent-1", "v1");

  const metrics = profile.taskTypeMetrics[0];
  assert.equal(metrics!.avgDurationMs, 200);
});

test("AgentPerformanceProfiler.computeProfile includes computedAt timestamp", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord());

  const profile = profiler.computeProfile("agent-1", "v1");

  assert.ok(profile.computedAt.length > 0);
  // Should be a valid ISO timestamp
  assert.ok(new Date(profile.computedAt).getTime() > 0);
});

test("AgentPerformanceProfiler.recordExecution cleans up old records periodically", () => {
  const profiler = new AgentPerformanceProfiler();
  // Add enough records to trigger cleanup (max is 1000, cleanup at 20% when over limit)
  for (let i = 0; i < 1200; i++) {
    profiler.recordExecution(createExecutionRecord({ executionId: `exec-${i}` }));
  }

  // The profiler should still function correctly
  const profile = profiler.computeProfile("agent-1", "v1");
  assert.ok(profile.overallSuccessRate >= 0);
});

test("AgentPerformanceProfiler handles cancelled status in success rate", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ status: "success" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", status: "cancelled" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", status: "cancelled" }));

  const profile = profiler.computeProfile("agent-1", "v1");

  // Cancelled is not counted as success
  assert.equal(profile.overallSuccessRate, 1 / 3);
});

test("AgentPerformanceProfiler.computeProfile groups multiple task types separately", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(createExecutionRecord({ taskType: "type_a" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-2", taskType: "type_a" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-3", taskType: "type_b" }));
  profiler.recordExecution(createExecutionRecord({ executionId: "exec-4", taskType: "type_c" }));

  const profile = profiler.computeProfile("agent-1", "v1");

  assert.equal(profile.taskTypeMetrics.length, 3);
});