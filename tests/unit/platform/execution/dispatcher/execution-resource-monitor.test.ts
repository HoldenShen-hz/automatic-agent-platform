import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionResourceMonitor } from "../../../../../src/platform/execution/dispatcher/execution-resource-monitor.js";
import { ExecutionResourceCeilingGuard } from "../../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { ExecutionResourceUsageSample } from "../../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";

// ---------------------------------------------------------------------------
// Helper types and builders
// ---------------------------------------------------------------------------

interface MockActiveExecutionActivity {
  executionId: string;
  workerId?: string;
}

function createMockStore(
  activeActivities: MockActiveExecutionActivity[] = [],
  executions: Map<string, { id: string; taskId: string; agentId: string; status: string; startedAt?: string; createdAt: string }> = new Map(),
  agentExecRecords: Map<string, { agentId: string; runtimeInstanceId?: string; currentStepId?: string; startedAt?: string; toolCallCount?: number }> = new Map(),
  workerSnapshots: Map<string, { runtimeInstanceId?: string; currentStepId?: string; memoryMb?: number }> = new Map(),
): AuthoritativeTaskStore {
  return {
    operations: {
      listActiveExecutionActivity: () => activeActivities,
    },
    dispatch: {
      getExecution: (id: string) => executions.get(id) ?? null,
    },
    worker: {
      getAgentExecutionRecord: (executionId: string) => agentExecRecords.get(executionId) ?? null,
      getWorkerSnapshot: (agentId: string) => workerSnapshots.get(agentId) ?? null,
    },
  } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// ExecutionResourceMonitor detect() - basic behavior
// ---------------------------------------------------------------------------

test("ExecutionResourceMonitor detect returns empty array when no active executions", () => {
  const store = createMockStore([]);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect returns empty when no executions exceed ceiling", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt: new Date(Date.now() - 10000).toISOString(), createdAt: new Date().toISOString() }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100, maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect finds executions exceeding tool call ceiling", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt: new Date(Date.now() - 10000).toISOString(), createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: 150 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "tool_calls");
  assert.equal(findings[0]!.actual, 150);
  assert.equal(findings[0]!.limit, 100);
});

test("ExecutionResourceMonitor detect finds executions exceeding memory ceiling", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const workerSnapshots = new Map([
    ["agent-1", { memoryMb: 4096 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, new Map(), workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 2048 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "memory_mb");
  assert.equal(findings[0]!.actual, 4096);
});

test("ExecutionResourceMonitor detect finds executions exceeding elapsed time ceiling", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 }); // 5 minutes
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
});

test("ExecutionResourceMonitor detect skips executions not found in store", () => {
  const store = createMockStore([{ executionId: "nonexistent" }], new Map());
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect uses custom now timestamp", () => {
  const startedAt = new Date(Date.now() - 10000).toISOString();
  const customNow = new Date(Date.now() - 600000).toISOString(); // 10 min ago, same as startedAt
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 }); // 5 min limit
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect({ now: customNow });
  // With startedAt and now being the same (both 10 min ago), elapsed would be ~0, so no finding
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect handles missing startedAt gracefully", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  // No startedAt means no elapsed time check
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect uses agent execution record for agentId", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "exec-agent-id", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "actual-agent-id", toolCallCount: 150 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  // Should use agentId from agentExecutionRecord (actual-agent-id) not execution (exec-agent-id)
  assert.equal(findings[0]!.agentId, "actual-agent-id");
});

test("ExecutionResourceMonitor detect uses worker snapshot for runtime info", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", runtimeInstanceId: "runtime-from-agent", currentStepId: "step-from-agent" }],
  ]);
  const workerSnapshots = new Map([
    ["agent-1", { runtimeInstanceId: "runtime-from-worker", currentStepId: "step-from-worker", memoryMb: 4096 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords, workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 2048 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  // agentExecution record takes precedence over worker snapshot
  assert.equal(findings[0]!.runtimeInstanceId, "runtime-from-agent");
  assert.equal(findings[0]!.currentStepId, "step-from-agent");
});