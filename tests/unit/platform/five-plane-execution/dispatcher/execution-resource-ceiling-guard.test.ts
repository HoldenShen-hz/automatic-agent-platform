import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionResourceCeilingGuard,
  type ExecutionResourceUsageSample,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";

function createSample(overrides: Partial<ExecutionResourceUsageSample> = {}): ExecutionResourceUsageSample {
  return {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "running",
    runtimeInstanceId: "runtime-1",
    currentStepId: "step-1",
    toolCallCount: 10,
    memoryMb: 256,
    startedAt: "2026-05-02T00:00:00.000Z",
    now: "2026-05-02T00:01:00.000Z",
    ...overrides,
  };
}

test("ExecutionResourceCeilingGuard returns no findings when all usage stays below configured limits", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 100,
    maxMemoryMb: 1_024,
    maxElapsedMs: 600_000,
  });

  assert.deepEqual(guard.evaluate(createSample()), []);
});

test("ExecutionResourceCeilingGuard reports tool, memory, and elapsed violations with execution metadata", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 5,
    maxMemoryMb: 128,
    maxElapsedMs: 30_000,
  });

  const findings = guard.evaluate(createSample({
    executionId: "exec-over",
    taskId: "task-over",
    agentId: "agent-over",
    toolCallCount: 12,
    memoryMb: 512,
    now: "2026-05-02T00:02:00.000Z",
  }));

  assert.equal(findings.length, 3);

  const toolFinding = findings.find((finding) => finding.dimension === "tool_calls");
  const memoryFinding = findings.find((finding) => finding.dimension === "memory_mb");
  const elapsedFinding = findings.find((finding) => finding.dimension === "elapsed_ms");

  assert.ok(toolFinding);
  assert.ok(memoryFinding);
  assert.ok(elapsedFinding);
  assert.equal(toolFinding.executionId, "exec-over");
  assert.equal(toolFinding.reasonCode, "agent.resource_limit.tool_calls_exceeded");
  assert.equal(memoryFinding.reasonCode, "agent.resource_limit.memory_exceeded");
  assert.equal(elapsedFinding.reasonCode, "agent.resource_limit.elapsed_exceeded");
});

test("ExecutionResourceCeilingGuard ignores null sample values for optional dimensions", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 1,
    maxMemoryMb: 1,
    maxElapsedMs: 1,
  });

  const findings = guard.evaluate(createSample({
    toolCallCount: null,
    memoryMb: null,
    startedAt: null,
  }));

  assert.deepEqual(findings, []);
});

test("ExecutionResourceCeilingGuard firstFinding returns the first triggered limit", () => {
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 2 });

  const finding = guard.firstFinding(createSample({ toolCallCount: 3 }));

  assert.ok(finding);
  assert.equal(finding.dimension, "tool_calls");
  assert.equal(finding.actual, 3);
  assert.equal(finding.limit, 2);
});
