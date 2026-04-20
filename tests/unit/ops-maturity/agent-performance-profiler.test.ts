import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentPerformanceProfiler,
  ExecutionRecord,
  AgentCapabilityProfile,
} from "../../../src/ops-maturity/agent-lifecycle/agent-performance-profiler.js";

function makeRecord(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    executionId: `exec_${Math.random().toString(36).slice(2, 8)}`,
    agentId: "agent_ops_1",
    versionId: "v1.0.0",
    taskId: "task_1",
    taskType: "triage",
    status: "success",
    durationMs: 1500,
    costUsd: 0.05,
    errorCode: null,
    completedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

test("AgentPerformanceProfiler.recordExecution stores records", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord());
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics.length, 1);
  assert.equal(profile.taskTypeMetrics[0]?.taskType, "triage");
});

test("AgentPerformanceProfiler aggregates multiple executions", () => {
  const profiler = new AgentPerformanceProfiler();
  for (let i = 0; i < 5; i++) {
    profiler.recordExecution(makeRecord({ status: "success", durationMs: 1000 + i * 100 }));
  }
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics[0]?.totalExecutions, 5);
  assert.equal(profile.taskTypeMetrics[0]?.successCount, 5);
  assert.equal(profile.taskTypeMetrics[0]?.successRate, 1.0);
});

test("AgentPerformanceProfiler calculates success rate correctly", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ status: "success" }));
  profiler.recordExecution(makeRecord({ status: "success" }));
  profiler.recordExecution(makeRecord({ status: "failed" }));
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics[0]?.successRate, 2 / 3);
  assert.equal(profile.taskTypeMetrics[0]?.failureCount, 1);
});

test("AgentPerformanceProfiler identifies recommended task types (successRate >= 0.9)", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ taskType: "triage", status: "success" }));
  profiler.recordExecution(makeRecord({ taskType: "triage", status: "success" }));
  profiler.recordExecution(makeRecord({ taskType: "rollback", status: "success" }));
  profiler.recordExecution(makeRecord({ taskType: "rollback", status: "failed" }));
  profiler.recordExecution(makeRecord({ taskType: "rollback", status: "failed" }));
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.recommendedFor.includes("triage"), true);
  assert.equal(profile.notRecommendedFor.includes("rollback"), true);
});

test("AgentPerformanceProfiler computes overall success rate", () => {
  const profiler = new AgentPerformanceProfiler();
  for (let i = 0; i < 3; i++) profiler.recordExecution(makeRecord({ status: "success" }));
  for (let i = 0; i < 2; i++) profiler.recordExecution(makeRecord({ status: "failed" }));
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.overallSuccessRate, 3 / 5);
});

test("AgentPerformanceProfiler calculates p95 duration correctly", () => {
  const profiler = new AgentPerformanceProfiler();
  for (let i = 0; i < 20; i++) {
    profiler.recordExecution(makeRecord({ durationMs: (i + 1) * 100 }));
  }
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  const p95 = profile.taskTypeMetrics[0]?.p95DurationMs ?? 0;
  assert.ok(p95 >= 1900);
});

test("AgentPerformanceProfiler.getProfile returns cached profile", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ status: "success" }));
  profiler.computeProfile("agent_ops_1", "v1.0.0");
  const cached = profiler.getProfile("agent_ops_1", "v1.0.0");
  assert.ok(cached !== null);
  assert.equal(cached?.agentId, "agent_ops_1");
});

test("AgentPerformanceProfiler.getProfile returns null for missing profile", () => {
  const profiler = new AgentPerformanceProfiler();
  const result = profiler.getProfile("unknown_agent", "v1.0.0");
  assert.equal(result, null);
});

test("AgentPerformanceProfiler.getTopPerformingTaskType returns highest success rate task", () => {
  const profiler = new AgentPerformanceProfiler();
  // triage: 1 success / 1 total = 100%
  profiler.recordExecution(makeRecord({ taskType: "triage", status: "success" }));
  // rollback: 1 success / 2 total = 50%
  profiler.recordExecution(makeRecord({ taskType: "rollback", status: "success" }));
  profiler.recordExecution(makeRecord({ taskType: "rollback", status: "failed" }));
  profiler.computeProfile("agent_ops_1", "v1.0.0");
  const top = profiler.getTopPerformingTaskType("agent_ops_1", "v1.0.0");
  assert.equal(top, "triage");
});

test("AgentPerformanceProfiler.getTopPerformingTaskType returns null when no profile", () => {
  const profiler = new AgentPerformanceProfiler();
  assert.equal(profiler.getTopPerformingTaskType("unknown", "v1.0.0"), null);
});

test("AgentPerformanceProfiler handles empty records", () => {
  const profiler = new AgentPerformanceProfiler();
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics.length, 0);
  assert.equal(profile.overallSuccessRate, 0);
  assert.equal(profile.recommendedFor.length, 0);
});

test("AgentPerformanceProfiler tracks multiple agents separately", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ agentId: "agent_a", versionId: "v1.0.0", taskType: "task_a" }));
  profiler.recordExecution(makeRecord({ agentId: "agent_b", versionId: "v1.0.0", taskType: "task_b" }));
  profiler.computeProfile("agent_a", "v1.0.0");
  profiler.computeProfile("agent_b", "v1.0.0");
  const profileA = profiler.getProfile("agent_a", "v1.0.0");
  const profileB = profiler.getProfile("agent_b", "v1.0.0");
  assert.ok(profileA !== null);
  assert.ok(profileB !== null);
  assert.equal(profileA?.taskTypeMetrics[0]?.taskType, "task_a");
  assert.equal(profileB?.taskTypeMetrics[0]?.taskType, "task_b");
});

test("AgentPerformanceProfiler tracks multiple versions for same agent", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ versionId: "v1.0.0", status: "success" }));
  profiler.recordExecution(makeRecord({ versionId: "v2.0.0", status: "failed" }));
  profiler.computeProfile("agent_ops_1", "v1.0.0");
  profiler.computeProfile("agent_ops_1", "v2.0.0");
  const profileV1 = profiler.getProfile("agent_ops_1", "v1.0.0");
  const profileV2 = profiler.getProfile("agent_ops_1", "v2.0.0");
  assert.ok(profileV1 !== null);
  assert.ok(profileV2 !== null);
  assert.equal(profileV1?.overallSuccessRate, 1.0);
  assert.equal(profileV2?.overallSuccessRate, 0.0);
});

test("AgentPerformanceProfiler.computProfile handles zero executions gracefully", () => {
  const profiler = new AgentPerformanceProfiler();
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  // no throw, returns empty profile
  assert.equal(profile.taskTypeMetrics.length, 0);
  assert.equal(profile.overallSuccessRate, 0);
});

test("AgentPerformanceProfiler.computeProfile handles zero duration records", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ durationMs: 0 }));
  profiler.recordExecution(makeRecord({ durationMs: 0 }));
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics[0]?.avgDurationMs, 0);
  assert.equal(profile.taskTypeMetrics[0]?.p95DurationMs, 0);
});

test("AgentPerformanceProfiler.computeProfile handles zero cost records", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ costUsd: 0 }));
  profiler.recordExecution(makeRecord({ costUsd: 0 }));
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics[0]?.avgCostUsd, 0);
  assert.equal(profile.taskTypeMetrics[0]?.totalCostUsd, 0);
});

test("AgentPerformanceProfiler.computeProfile calculates avgCostUsd correctly", () => {
  const profiler = new AgentPerformanceProfiler();
  profiler.recordExecution(makeRecord({ costUsd: 0.01 }));
  profiler.recordExecution(makeRecord({ costUsd: 0.02 }));
  profiler.recordExecution(makeRecord({ costUsd: 0.03 }));
  const profile = profiler.computeProfile("agent_ops_1", "v1.0.0");
  assert.equal(profile.taskTypeMetrics[0]?.avgCostUsd, 0.02);
  assert.equal(profile.taskTypeMetrics[0]?.totalCostUsd, 0.06);
});