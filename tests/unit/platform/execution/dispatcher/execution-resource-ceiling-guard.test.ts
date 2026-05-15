import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionResourceCeilingGuard,
  type ExecutionResourceCeilingOptions,
  type ExecutionResourceUsageSample,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";

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

// ---------------------------------------------------------------------------
// Edge cases for evaluate
// ---------------------------------------------------------------------------

test("ExecutionResourceCeilingGuard evaluate treats Infinity maxToolCalls as default limit", () => {
  // Infinity is not finite, so it falls back to default (64)
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: Infinity });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 100, // Exceeds default 64
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  // Infinity falls back to default 64, so 100 > 64 produces a finding
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "tool_calls");
});

test("ExecutionResourceCeilingGuard evaluate treats Infinity maxMemoryMb as default limit", () => {
  // Infinity is not finite, so it falls back to default (2048)
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: Infinity });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: 3000, // Exceeds default 2048
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  // Infinity falls back to default 2048, so 3000 > 2048 produces a finding
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "memory_mb");
});

test("ExecutionResourceCeilingGuard evaluate treats Infinity maxElapsedMs as default limit", () => {
  // Infinity is not finite, so it falls back to default (900000 = 15 min)
  const startedAt = new Date(Date.now() - 1000000).toISOString(); // 1000 seconds ago
  const now = new Date().toISOString();
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: Infinity });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt,
    now,
  };
  const findings = guard.evaluate(sample);
  // Infinity falls back to default 900000ms, so elapsed > 900000 produces a finding
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
});

test("ExecutionResourceCeilingGuard evaluate handles null toolCallCount (no data)", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: null,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles null memoryMb (no data)", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: null,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles non-finite startedAt date", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: "not-a-date",
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles non-finite now date", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: new Date(Date.now() - 2000).toISOString(),
    now: "not-a-date",
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate truncates fractional tool call count", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 10.9,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.actual, 10);
});

test("ExecutionResourceCeilingGuard evaluate truncates fractional memory value", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: 512.7,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.actual, 512);
});

test("ExecutionResourceCeilingGuard evaluate boundary: exactly at tool call limit is OK", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 10,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate boundary: exactly at memory limit is OK", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: 512,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate boundary: exactly at elapsed limit is OK", () => {
  const startedAt = new Date(Date.now() - 300000).toISOString();
  const now = new Date(startedAt).getTime() + 300000;
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt,
    now: new Date(now).toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate elapsed time uses max of zero for negative elapsed", () => {
  // When now is before startedAt, elapsed should be 0, not negative
  const startedAt = new Date(Date.now() + 10000).toISOString(); // Future date
  const now = new Date().toISOString();
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt,
    now,
  };
  const findings = guard.evaluate(sample);
  // Even though we set maxElapsedMs to 1, elapsed should be 0 (max(0, negative))
  // so no finding should be produced since 0 is not > 1
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard firstFinding returns tool_calls finding first when both exceeded", () => {
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
});

test("ExecutionResourceCeilingGuard evaluate includes runtimeInstanceId in finding when present", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 15,
    runtimeInstanceId: "runtime-abc",
    currentStepId: "step-1",
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.runtimeInstanceId, "runtime-abc");
  assert.equal(findings[0]!.currentStepId, "step-1");
});

test("ExecutionResourceCeilingGuard evaluate includes null runtimeInstanceId when not present", () => {
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
  assert.equal(findings[0]!.runtimeInstanceId, null);
  assert.equal(findings[0]!.currentStepId, null);
});

test("ExecutionResourceCeilingGuard evaluate uses provided observedAt timestamp", () => {
  const customTime = "2024-06-15T10:30:00.000Z";
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 15,
    now: customTime,
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.observedAt, customTime);
});

test("ExecutionResourceCeilingGuard evaluate finding message contains executionId", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-specific-123",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 15,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.ok(findings[0]!.message.includes("exec-specific-123"));
});

test("ExecutionResourceCeilingGuard evaluate finding message contains actual and limit values", () => {
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
  assert.ok(findings[0]!.message.includes("15 > 10"));
});
