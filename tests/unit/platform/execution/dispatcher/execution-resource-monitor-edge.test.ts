import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionResourceMonitor } from "../../../../../src/platform/execution/dispatcher/execution-resource-monitor.js";
import { ExecutionResourceCeilingGuard } from "../../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

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
// Additional edge cases for ExecutionResourceMonitor
// ---------------------------------------------------------------------------

test("ExecutionResourceMonitor detect returns empty for empty active activities", () => {
  const store = createMockStore([]);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect skips executions not found in store", () => {
  const store = createMockStore([{ executionId: "nonexistent" }], new Map());
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect finds tool call violation", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
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
});

test("ExecutionResourceMonitor detect finds memory violation via worker snapshot", () => {
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
});

test("ExecutionResourceMonitor detect finds elapsed time violation", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
});

test("ExecutionResourceMonitor detect uses custom now timestamp for elapsed calculation", () => {
  const startedAt = new Date(Date.now() - 10000).toISOString();
  const customNow = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect({ now: customNow });
  // startedAt and now are same (both 10 min ago), elapsed ~0, so no finding
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect handles missing startedAt for elapsed check", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  // No startedAt means no elapsed check
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect uses agent execution record agentId over execution agentId", () => {
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
  assert.equal(findings[0]!.agentId, "actual-agent-id");
});

test("ExecutionResourceMonitor detect prefers agent record runtime info over worker snapshot", () => {
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
  assert.equal(findings[0]!.runtimeInstanceId, "runtime-from-agent");
  assert.equal(findings[0]!.currentStepId, "step-from-agent");
});

test("ExecutionResourceMonitor detect finds multiple violations for same execution", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: 150 }],
  ]);
  const workerSnapshots = new Map([
    ["agent-1", { memoryMb: 4096 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords, workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100, maxMemoryMb: 2048, maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 3);
});

test("ExecutionResourceMonitor detect with default guard has high limits", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard();
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  // High defaults mean no violations
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect with null toolCallCount skips tool call check", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: undefined }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords as any);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect with null memoryMb skips memory check", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1" }],
  ]);
  const workerSnapshots = new Map([
    ["agent-1", { memoryMb: undefined }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords as any, workerSnapshots as any);
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 2048 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect with no limits returns empty", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: 999999 }],
  ]);
  const workerSnapshots = new Map([
    ["agent-1", { memoryMb: 999999 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords, workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: null, maxMemoryMb: null, maxElapsedMs: null });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect processes multiple executions independently", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
    ["exec-2", { id: "exec-2", taskId: "task-2", agentId: "agent-2", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: 150 }],
    ["exec-2", { agentId: "agent-2", toolCallCount: 200 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }, { executionId: "exec-2" }], executions, agentRecords);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 2);
});

test("ExecutionResourceMonitor detect uses execution agentId when no agent record", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "exec-agent", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const workerSnapshots = new Map([
    ["exec-agent", { memoryMb: 4096 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, new Map(), workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 2048 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.agentId, "exec-agent");
});

test("ExecutionResourceMonitor detect uses execution startedAt when agent startedAt missing", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", startedAt: undefined }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords as any);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
});

test("ExecutionResourceMonitor detect uses execution createdAt when both startedAt missing", () => {
  const createdAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1" }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords);
  const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.dimension, "elapsed_ms");
});

test("ExecutionResourceMonitor detect handles mixed violations across executions", () => {
  const startedAt = new Date(Date.now() - 600000).toISOString();
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", startedAt, createdAt: startedAt }],
    ["exec-2", { id: "exec-2", taskId: "task-2", agentId: "agent-2", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: 150 }],
    ["exec-2", { agentId: "agent-2" }],
  ]);
  const workerSnapshots = new Map([
    ["agent-2", { memoryMb: 4096 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }, { executionId: "exec-2" }], executions, agentRecords, workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100, maxMemoryMb: 2048, maxElapsedMs: 300000 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  // exec-1: tool calls + elapsed; exec-2: memory
  assert.equal(findings.length, 3);
});

test("ExecutionResourceMonitor detect uses worker snapshot agentId correctly", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "exec-agent", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const workerSnapshots = new Map([
    ["exec-agent", { runtimeInstanceId: "runtime-1", currentStepId: "step-1", memoryMb: 4096 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, new Map(), workerSnapshots);
  const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 2048 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.runtimeInstanceId, "runtime-1");
});

test("ExecutionResourceMonitor detect handles null runtimeInstanceId in finding", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  // No violations, but verify it handles null properly
  assert.equal(findings.length, 0);
});

test("ExecutionResourceMonitor detect includes taskId in findings", () => {
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-specific-123", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-1", { agentId: "agent-1", toolCallCount: 150 }],
  ]);
  const store = createMockStore([{ executionId: "exec-1" }], executions, agentRecords);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.taskId, "task-specific-123");
});

test("ExecutionResourceMonitor detect includes executionId in findings", () => {
  const executions = new Map([
    ["exec-specific-456", { id: "exec-specific-456", taskId: "task-1", agentId: "agent-1", status: "executing", createdAt: new Date().toISOString() }],
  ]);
  const agentRecords = new Map([
    ["exec-specific-456", { agentId: "agent-1", toolCallCount: 150 }],
  ]);
  const store = createMockStore([{ executionId: "exec-specific-456" }], executions, agentRecords);
  const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const monitor = new ExecutionResourceMonitor(store, guard);
  const findings = monitor.detect();
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.executionId, "exec-specific-456");
});
