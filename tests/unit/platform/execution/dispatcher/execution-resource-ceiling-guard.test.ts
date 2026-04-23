import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionResourceCeilingGuard,
  type ExecutionResourceCeilingOptions,
  type ExecutionResourceUsageSample,
} from "../../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";

test("ExecutionResourceCeilingGuard evaluate returns empty array when no limits exceeded", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100, maxMemoryMb: 2048, maxElapsedMs: 900000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 50,
    memoryMb: 1024,
    startedAt: new Date(Date.now() - 60000).toISOString(),
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate detects tool call ceiling exceeded", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 15,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "tool_calls");
  assert.equal(findings[0]!.reasonCode, "agent.resource_limit.tool_calls_exceeded");
  assert.equal(findings[0]!.actual, 15);
  assert.equal(findings[0]!.limit, 10);
  assert.equal(findings[0]!.unit, "count");
});

test("ExecutionResourceCeilingGuard evaluate detects memory ceiling exceeded", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: 1024,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "memory_mb");
  assert.equal(findings[0]!.reasonCode, "agent.resource_limit.memory_exceeded");
  assert.equal(findings[0]!.actual, 1024);
  assert.equal(findings[0]!.limit, 512);
  assert.equal(findings[0]!.unit, "mb");
});

test("ExecutionResourceCeilingGuard evaluate detects elapsed time ceiling exceeded", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const now = new Date().toISOString();
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 }); // 5 minutes
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt,
    now,
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
  assert.equal(findings[0]!.reasonCode, "agent.resource_limit.elapsed_exceeded");
  assert.equal(findings[0]!.unit, "ms");
});

test("ExecutionResourceCeilingGuard evaluate returns multiple findings when multiple limits exceeded", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const now = new Date().toISOString();
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 5, maxMemoryMb: 256, maxElapsedMs: 300000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 10,
    memoryMb: 512,
    startedAt,
    now,
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 3);
});

test("ExecutionResourceCeilingGuard evaluate ignores null limits", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: null, maxMemoryMb: null, maxElapsedMs: null });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 999999,
    memoryMb: 999999,
    startedAt: new Date(Date.now() - 999999999).toISOString(),
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles missing startedAt for elapsed check", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: null,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard firstFinding returns first finding or null", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 5, maxMemoryMb: 5 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 10,
    memoryMb: 10,
    now: new Date().toISOString(),
  };
  const finding = guard.firstFinding(sample);
  assert.notEqual(finding, null);
  assert.equal(finding!.dimension, "tool_calls");

  const emptySample: ExecutionResourceUsageSample = {
    executionId: "exec-2",
    taskId: "task-2",
    agentId: "agent-2",
    status: "running",
    now: new Date().toISOString(),
  };
  assert.equal(guard.firstFinding(emptySample), null);
});

test("ExecutionResourceCeilingGuard constructor applies defaults for invalid values", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: -1, maxMemoryMb: 0, maxElapsedMs: NaN } as ExecutionResourceCeilingOptions);
  const sampleAtLimit: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 64,
    memoryMb: 2048,
    startedAt: new Date(Date.now() - 900000).toISOString(),
    now: new Date().toISOString(),
  };
  // Default maxToolCalls=64, maxMemoryMb=2048, maxElapsedMs=900000 (15min)
  const findings = guard.evaluate(sampleAtLimit);
  assert.equal(findings.length, 0);
});
