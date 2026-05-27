import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionResourceCeilingGuard,
  type ExecutionResourceCeilingOptions,
  type ExecutionResourceUsageSample,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";

// ---------------------------------------------------------------------------
// Additional edge cases for ExecutionResourceCeilingGuard
// ---------------------------------------------------------------------------

test("ExecutionResourceCeilingGuard evaluate handles very large tool call count [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: Number.MAX_SAFE_INTEGER,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "tool_calls");
});

test("ExecutionResourceCeilingGuard evaluate handles very large memory value [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: Number.MAX_SAFE_INTEGER,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "memory_mb");
});

test("ExecutionResourceCeilingGuard evaluate handles very old startedAt date [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1000 }); // 1 second
  const veryOldDate = new Date(0).toISOString(); // Unix epoch
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: veryOldDate,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
});

test("ExecutionResourceCeilingGuard evaluate handles future startedAt date [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1 });
  const futureDate = new Date(Date.now() + 100000).toISOString();
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: futureDate,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  // Elapsed would be negative, clamped to 0, so no finding
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles negative elapsed (clock skew) [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: new Date(Date.now() + 10000).toISOString(), // Future
    now: new Date().toISOString(), // Now is before startedAt
  };
  const findings = guard.evaluate(sample);
  // Math.max(0, negative) = 0, so 0 > 1000 is false
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate finds all three violations simultaneously [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 5,
    maxMemoryMb: 256,
    maxElapsedMs: 1000,
  });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 100,
    memoryMb: 4096,
    startedAt: new Date(Date.now() - 10000).toISOString(),
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 3);
  const dimensions = findings.map(f => f.dimension);
  assert.ok(dimensions.includes("tool_calls"));
  assert.ok(dimensions.includes("memory_mb"));
  assert.ok(dimensions.includes("elapsed_ms"));
});

test("ExecutionResourceCeilingGuard firstFinding returns memory when tool calls not exceeded [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 100,
    maxMemoryMb: 256,
  });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 50,
    memoryMb: 4096,
    now: new Date().toISOString(),
  };
  const finding = guard.firstFinding(sample);
  assert.ok(finding != null);
  assert.equal(finding.dimension, "memory_mb");
});

test("ExecutionResourceCeilingGuard firstFinding returns elapsed when neither tool nor memory exceeded [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 100,
    maxMemoryMb: 4096,
    maxElapsedMs: 1000,
  });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 50,
    memoryMb: 1024,
    startedAt: new Date(Date.now() - 10000).toISOString(),
    now: new Date().toISOString(),
  };
  const finding = guard.firstFinding(sample);
  assert.ok(finding != null);
  assert.equal(finding.dimension, "elapsed_ms");
});

test("ExecutionResourceCeilingGuard finding message format for tool calls [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-abc-123",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 25,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  const msg = findings[0]!.message;
  assert.ok(msg.includes("exec-abc-123"));
  assert.ok(msg.includes("25 > 10"));
  assert.ok(msg.includes("tool-call"));
});

test("ExecutionResourceCeilingGuard finding message format for memory [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-xyz",
    agentId: "agent-1",
    status: "running",
    memoryMb: 1024,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  const msg = findings[0]!.message;
  assert.ok(msg.includes("exec-1"));
  assert.ok(msg.includes("1024MB > 512MB"));
});

test("ExecutionResourceCeilingGuard finding message format for elapsed [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 60000 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-elapsed",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: new Date(Date.now() - 120000).toISOString(),
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  const msg = findings[0]!.message;
  assert.ok(msg.includes("exec-elapsed"));
  assert.ok(msg.includes("ms"));
});

test("ExecutionResourceCeilingGuard evaluate handles zero values as boundary case [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 0 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 0,
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  // 0 is not > 0, so no finding (falls back to default)
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles undefined toolCallCount vs null [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sampleWithUndefined: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    // toolCallCount is undefined (not present)
    now: new Date().toISOString(),
  };
  const sampleWithNull: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: null,
    now: new Date().toISOString(),
  };
  // Both should behave the same - no finding due to missing data
  const findingsUndefined = guard.evaluate(sampleWithUndefined);
  const findingsNull = guard.evaluate(sampleWithNull);
  assert.equal(findingsUndefined.length, 0);
  assert.equal(findingsNull.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles undefined memoryMb vs null [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
  const sampleWithUndefined: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    // memoryMb is undefined
    now: new Date().toISOString(),
  };
  const sampleWithNull: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    memoryMb: null,
    now: new Date().toISOString(),
  };
  const findingsUndefined = guard.evaluate(sampleWithUndefined);
  const findingsNull = guard.evaluate(sampleWithNull);
  assert.equal(findingsUndefined.length, 0);
  assert.equal(findingsNull.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate handles undefined startedAt vs null [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1000 });
  const sampleWithUndefined: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    now: new Date().toISOString(),
  };
  const sampleWithNull: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    startedAt: null,
    now: new Date().toISOString(),
  };
  const findingsUndefined = guard.evaluate(sampleWithUndefined);
  const findingsNull = guard.evaluate(sampleWithNull);
  assert.equal(findingsUndefined.length, 0);
  assert.equal(findingsNull.length, 0);
});

test("ExecutionResourceCeilingGuard finding includes all required fields [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-test",
    taskId: "task-test",
    agentId: "agent-test",
    status: "running",
    toolCallCount: 20,
    runtimeInstanceId: "runtime-123",
    currentStepId: "step-5",
    now: "2024-01-15T10:00:00.000Z",
  };
  const findings = guard.evaluate(sample);
  assert.equal(findings.length, 1);
  const finding = findings[0]!;
  assert.equal(finding.executionId, "exec-test");
  assert.equal(finding.taskId, "task-test");
  assert.equal(finding.agentId, "agent-test");
  assert.equal(finding.status, "running");
  assert.equal(finding.runtimeInstanceId, "runtime-123");
  assert.equal(finding.currentStepId, "step-5");
  assert.equal(finding.observedAt, "2024-01-15T10:00:00.000Z");
  assert.equal(finding.dimension, "tool_calls");
  assert.equal(finding.reasonCode, "agent.resource_limit.tool_calls_exceeded");
  assert.equal(finding.actual, 20);
  assert.equal(finding.limit, 10);
  assert.equal(finding.unit, "count");
});

test("ExecutionResourceCeilingGuard finding reasonCode is correct for each dimension [execution-resource-ceiling-guard-edge]", () => {
  const elapsedStartedAt = new Date(Date.now() - 10000).toISOString();

  const toolFinding = new ExecutionResourceCeilingGuard({ maxToolCalls: 1 }).evaluate({
    executionId: "e", taskId: "t", agentId: "a", status: "running", toolCallCount: 10, now: new Date().toISOString(),
  })[0]!;
  assert.equal(toolFinding.reasonCode, "agent.resource_limit.tool_calls_exceeded");

  const memoryFinding = new ExecutionResourceCeilingGuard({ maxMemoryMb: 1 }).evaluate({
    executionId: "e", taskId: "t", agentId: "a", status: "running", memoryMb: 100, now: new Date().toISOString(),
  })[0]!;
  assert.equal(memoryFinding.reasonCode, "agent.resource_limit.memory_exceeded");

  const elapsedFinding = new ExecutionResourceCeilingGuard({ maxElapsedMs: 1 }).evaluate({
    executionId: "e", taskId: "t", agentId: "a", status: "running", startedAt: elapsedStartedAt, now: new Date().toISOString(),
  })[0]!;
  assert.equal(elapsedFinding.reasonCode, "agent.resource_limit.elapsed_exceeded");
});

test("ExecutionResourceCeilingGuard firstFinding returns null for empty findings [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 50,
    now: new Date().toISOString(),
  };
  const finding = guard.firstFinding(sample);
  assert.equal(finding, null);
});

test("ExecutionResourceCeilingGuard constructor uses default when undefined passed [execution-resource-ceiling-guard-edge]", () => {
  // Passing undefined should use defaults
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: undefined,
    maxMemoryMb: undefined,
    maxElapsedMs: undefined,
  } as unknown as ExecutionResourceCeilingOptions);
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 64, // Default max is 64
    memoryMb: 2048, // Default max is 2048
    startedAt: new Date(Date.now() - 900000).toISOString(), // 15 min, default max is 15 min
    now: new Date().toISOString(),
  };
  const findings = guard.evaluate(sample);
  // All at boundary - should be no finding
  assert.equal(findings.length, 0);
});

test("ExecutionResourceCeilingGuard evaluate uses default now when not provided [execution-resource-ceiling-guard-edge]", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
  const sample: ExecutionResourceUsageSample = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    toolCallCount: 20,
    // no "now" provided
  };
  const before = Date.now();
  const findings = guard.evaluate(sample);
  const after = Date.now();
  assert.equal(findings.length, 1);
  const observedAtMs = Date.parse(findings[0]!.observedAt);
  assert.ok(observedAtMs >= before);
  assert.ok(observedAtMs <= after);
});
