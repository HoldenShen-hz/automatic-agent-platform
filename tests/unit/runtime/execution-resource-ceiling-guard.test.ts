import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionResourceCeilingGuard } from "../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";

test("execution resource ceiling guard reports tool, memory, and elapsed limit breaches [execution-resource-ceiling-guard]", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 2,
    maxMemoryMb: 128,
    maxElapsedMs: 5_000,
  });

  const findings = guard.evaluate({
    executionId: "exec-limit",
    taskId: "task-limit",
    agentId: "agent-limit",
    status: "executing",
    runtimeInstanceId: "runtime-limit-1",
    currentStepId: "step-limit",
    toolCallCount: 3,
    memoryMb: 256,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:10.000Z",
  });

  assert.deepEqual(
    findings.map((finding) => finding.reasonCode),
    [
      "agent.resource_limit.tool_calls_exceeded",
      "agent.resource_limit.memory_exceeded",
      "agent.resource_limit.elapsed_exceeded",
    ],
  );
  assert.equal(findings[0]?.currentStepId, "step-limit");
  assert.equal(findings[1]?.actual, 256);
  assert.equal(findings[2]?.limit, 5_000);
});

test("execution resource ceiling guard returns no findings when usage remains within limits [execution-resource-ceiling-guard]", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 4,
    maxMemoryMb: 512,
    maxElapsedMs: 30_000,
  });

  const findings = guard.evaluate({
    executionId: "exec-ok",
    taskId: "task-ok",
    agentId: "agent-ok",
    status: "executing",
    toolCallCount: 4,
    memoryMb: 512,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:30.000Z",
  });

  assert.deepEqual(findings, []);
  assert.equal(
    guard.firstFinding({
      executionId: "exec-ok",
      taskId: "task-ok",
      agentId: "agent-ok",
      status: "executing",
      toolCallCount: 1,
      startedAt: "2026-04-04T10:00:00.000Z",
      now: "2026-04-04T10:00:01.000Z",
    }),
    null,
  );
});

test("execution resource ceiling guard boundary: exactly at tool call limit [execution-resource-ceiling-guard]", () => {
  // Tests boundary at DEFAULT_MAX_TOOL_CALLS = 64
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 64, // exactly at default
    maxMemoryMb: 2048,
    maxElapsedMs: 900000,
  });

  const findingsAtLimit = guard.evaluate({
    executionId: "exec-64",
    taskId: "task-64",
    agentId: "agent-64",
    status: "executing",
    toolCallCount: 64, // exactly at limit
    memoryMb: 1024,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:01.000Z",
  });
  assert.deepEqual(findingsAtLimit, [], "64 tool calls should be within limit of 64");

  const findingsOverLimit = guard.evaluate({
    executionId: "exec-65",
    taskId: "task-65",
    agentId: "agent-65",
    status: "executing",
    toolCallCount: 65, // one over
    memoryMb: 1024,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:01.000Z",
  });
  assert.equal(findingsOverLimit.length, 1);
  assert.equal(findingsOverLimit[0]?.reasonCode, "agent.resource_limit.tool_calls_exceeded");
});

test("execution resource ceiling guard boundary: exactly at memory limit [execution-resource-ceiling-guard]", () => {
  // Tests boundary at DEFAULT_MAX_MEMORY_MB = 2048
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 64,
    maxMemoryMb: 2048, // exactly at default
    maxElapsedMs: 900000,
  });

  const findingsAtLimit = guard.evaluate({
    executionId: "exec-mem-ok",
    taskId: "task-mem-ok",
    agentId: "agent-mem-ok",
    status: "executing",
    toolCallCount: 1,
    memoryMb: 2048, // exactly at limit
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:01.000Z",
  });
  assert.deepEqual(findingsAtLimit, [], "2048MB should be within limit of 2048MB");

  const findingsOverLimit = guard.evaluate({
    executionId: "exec-mem-ov",
    taskId: "task-mem-ov",
    agentId: "agent-mem-ov",
    status: "executing",
    toolCallCount: 1,
    memoryMb: 2049, // one over
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:01.000Z",
  });
  assert.equal(findingsOverLimit.length, 1);
  assert.equal(findingsOverLimit[0]?.reasonCode, "agent.resource_limit.memory_exceeded");
});

test("execution resource ceiling guard boundary: exactly at elapsed limit [execution-resource-ceiling-guard]", () => {
  // Tests boundary at DEFAULT_MAX_ELAPSED_MS = 900000 (15 minutes)
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 64,
    maxMemoryMb: 2048,
    maxElapsedMs: 900000, // exactly at default
  });

  const findingsAtLimit = guard.evaluate({
    executionId: "exec-elapsed-ok",
    taskId: "task-elapsed-ok",
    agentId: "agent-elapsed-ok",
    status: "executing",
    toolCallCount: 1,
    memoryMb: 512,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:15:00.000Z", // exactly 15 minutes later
  });
  assert.deepEqual(findingsAtLimit, [], "900000ms should be within limit of 900000ms");

  const findingsOverLimit = guard.evaluate({
    executionId: "exec-elapsed-ov",
    taskId: "task-elapsed-ov",
    agentId: "agent-elapsed-ov",
    status: "executing",
    toolCallCount: 1,
    memoryMb: 512,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:15:01.000Z", // 1ms over
  });
  assert.equal(findingsOverLimit.length, 1);
  assert.equal(findingsOverLimit[0]?.reasonCode, "agent.resource_limit.elapsed_exceeded");
});

test("execution resource ceiling guard firstFinding returns first breach [execution-resource-ceiling-guard]", () => {
  const guard = new ExecutionResourceCeilingGuard({
    maxToolCalls: 2,
    maxMemoryMb: 128,
    maxElapsedMs: 5000,
  });

  const finding = guard.firstFinding({
    executionId: "exec-first",
    taskId: "task-first",
    agentId: "agent-first",
    status: "executing",
    toolCallCount: 3, // exceeds
    memoryMb: 256, // also exceeds
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:10.000Z",
  });

  assert.ok(finding);
  assert.equal(finding.reasonCode, "agent.resource_limit.tool_calls_exceeded");
});

test("execution resource ceiling guard returns no findings when at zero usage [execution-resource-ceiling-guard]", () => {
  const guard = new ExecutionResourceCeilingGuard();
  const findings = guard.evaluate({
    executionId: "exec-zero",
    taskId: "task-zero",
    agentId: "agent-zero",
    status: "executing",
    toolCallCount: 0,
    memoryMb: 0,
    startedAt: "2026-04-04T10:00:00.000Z",
    now: "2026-04-04T10:00:00.000Z", // no elapsed time
  });

  assert.deepEqual(findings, []);
});

test("execution resource ceiling guard loads defaults from centralized env parsing [execution-resource-ceiling-guard]", () => {
  const previousToolCalls = process.env.AA_MAX_AGENT_TOOL_CALLS;
  const previousMemory = process.env.AA_MAX_AGENT_MEMORY_MB;
  const previousElapsed = process.env.AA_MAX_AGENT_ELAPSED_MS;

  try {
    process.env.AA_MAX_AGENT_TOOL_CALLS = "2";
    process.env.AA_MAX_AGENT_MEMORY_MB = "64";
    process.env.AA_MAX_AGENT_ELAPSED_MS = "1000";

    const guard = new ExecutionResourceCeilingGuard();
    const findings = guard.evaluate({
      executionId: "exec-env",
      taskId: "task-env",
      agentId: "agent-env",
      status: "executing",
      toolCallCount: 3,
      memoryMb: 65,
      startedAt: "2026-04-04T10:00:00.000Z",
      now: "2026-04-04T10:00:02.000Z",
    });

    assert.deepEqual(
      findings.map((finding) => finding.reasonCode),
      [
        "agent.resource_limit.tool_calls_exceeded",
        "agent.resource_limit.memory_exceeded",
        "agent.resource_limit.elapsed_exceeded",
      ],
    );
  } finally {
    if (previousToolCalls == null) {
      delete process.env.AA_MAX_AGENT_TOOL_CALLS;
    } else {
      process.env.AA_MAX_AGENT_TOOL_CALLS = previousToolCalls;
    }
    if (previousMemory == null) {
      delete process.env.AA_MAX_AGENT_MEMORY_MB;
    } else {
      process.env.AA_MAX_AGENT_MEMORY_MB = previousMemory;
    }
    if (previousElapsed == null) {
      delete process.env.AA_MAX_AGENT_ELAPSED_MS;
    } else {
      process.env.AA_MAX_AGENT_ELAPSED_MS = previousElapsed;
    }
  }
});
