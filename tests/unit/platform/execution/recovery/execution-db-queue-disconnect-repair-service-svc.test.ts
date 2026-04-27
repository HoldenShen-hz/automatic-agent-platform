import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDbQueueDisconnectRepairService } from "../../../../../src/platform/execution/recovery/execution-db-queue-disconnect-repair-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AgentExecutionRecord } from "../../../../../src/platform/contracts/types/domain/worker-types.js";

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockStore(overrides: {
  executions?: Array<{
    id: string;
    taskId: string;
    status: "created" | "prechecking" | "blocked" | "executing" | "completed" | "failed" | "cancelled";
    attempt: number;
    traceId?: string;
  }>;
  tasks?: Array<{ id: string; status: string; priority: string }>;
  tickets?: Array<{ id: string; executionId: string; attempt: number; status: string }>;
  leases?: Array<{ executionId: string; attempt: number; status: string }>;
  agentExecutions?: Array<{ executionId: string; planJson?: string | null }>;
  operations?: {
    loadExecutionAuthoritativeView?: (executionId: string) => {
      task?: { id: string; status: string; priority: string };
    } | null;
  };
  event?: { insertEvent?: () => void };
} = {}): AuthoritativeTaskStore {
  const executions = overrides.executions ?? [];
  const tasks = overrides.tasks ?? [];
  const tickets = overrides.tickets ?? [];
  const leases = overrides.leases ?? [];
  const agentExecutions = overrides.agentExecutions ?? [];

  return {
    dispatch: {
      getExecution: (id: string) => executions.find((e) => e.id === id) ?? null,
      listExecutionsByStatuses: (statuses: string[]) => executions.filter((e) => statuses.includes(e.status)),
      getSession: () => null,
      repairTicket: () => null,
    },
    task: {
      getTask: (id: string) => tasks.find((t) => t.id === id) ?? null,
    },
    worker: {
      getActiveExecutionTicket: (executionId: string, attempt: number) =>
        tickets.find((t) => t.executionId === executionId && t.attempt === attempt && t.status === "pending") ?? null,
      getActiveExecutionLease: (executionId: string) => leases.find((l) => l.executionId === executionId) ?? null,
      getAgentExecutionRecord: (executionId: string) =>
        agentExecutions.find((a) => a.executionId === executionId) as AgentExecutionRecord | undefined,
    },
    operations: {
      loadExecutionAuthoritativeView: (executionId: string) =>
        overrides.operations?.loadExecutionAuthoritativeView?.(executionId) ?? null,
      loadTaskSnapshot: () => ({
        task: { id: "task-1", status: "pending", errorCode: null },
        execution: null,
        workflow: null,
        session: null,
      }),
    },
    event: {
      insertEvent: overrides.event?.insertEvent ?? (() => {}),
      getEvent: () => null,
      countPendingTier1Acks: () => 0,
      ensureEventConsumerAckPending: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

test("ExecutionDbQueueDisconnectRepairService can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  assert.ok(service != null);
});

test("ExecutionDbQueueDisconnectRepairService.scan returns empty when no executions", () => {
  const db = createMockDb();
  const store = createMockStore({ executions: [] });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.deepEqual(issues, []);
});

test("ExecutionDbQueueDisconnectRepairService.scan returns empty when all executions have tickets", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
    ],
    tickets: [
      { id: "ticket-1", executionId: "exec-1", attempt: 1, status: "pending" },
    ],
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.deepEqual(issues, []);
});

test("ExecutionDbQueueDisconnectRepairService.scan returns empty when executions have active leases", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "executing", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "in_progress", priority: "normal" },
    ],
    leases: [
      { executionId: "exec-1", attempt: 1, status: "active" },
    ],
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.deepEqual(issues, []);
});

test("ExecutionDbQueueDisconnectRepairService.scan returns empty when task is terminal", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "done", priority: "normal" },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "done", priority: "normal" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.deepEqual(issues, []);
});

test("ExecutionDbQueueDisconnectRepairService.scan detects execution with missing ticket", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "high" },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "high" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.executionId, "exec-1");
  assert.equal(issues[0]!.taskId, "task-1");
  assert.equal(issues[0]!.issueType, "missing_dispatch_ticket");
  assert.equal(issues[0]!.reasonCode, "missing_active_dispatch_ticket");
  assert.equal(issues[0]!.repairTemplate.priority, "high");
});

test("ExecutionDbQueueDisconnectRepairService.scan recovers template from agent execution plan", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
    ],
    agentExecutions: [
      {
        executionId: "exec-1",
        planJson: JSON.stringify({
          priority: "urgent",
          queueName: "fast-lane",
          dispatchTarget: "prefer_remote",
          requiredIsolationLevel: "strict",
        }),
      },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "normal" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.recoveredFromPlan, true);
  assert.equal(issues[0]!.repairTemplate.priority, "urgent");
  assert.equal(issues[0]!.repairTemplate.queueName, "fast-lane");
  assert.equal(issues[0]!.repairTemplate.dispatchTarget, "prefer_remote");
  assert.equal(issues[0]!.repairTemplate.requiredIsolationLevel, "strict");
});

test("ExecutionDbQueueDisconnectRepairService.scan handles prechecking status", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "prechecking", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "normal" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.executionStatus, "prechecking");
});

test("ExecutionDbQueueDisconnectRepairService.scan handles blocked status", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "blocked", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "normal" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.executionStatus, "blocked");
});

test("ExecutionDbQueueDisconnectRepairService.scan detects multiple disconnected executions", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
      { id: "exec-2", taskId: "task-2", status: "prechecking", attempt: 1 },
      { id: "exec-3", taskId: "task-3", status: "blocked", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
      { id: "task-2", status: "pending", priority: "high" },
      { id: "task-3", status: "pending", priority: "low" },
    ],
    operations: {
      loadExecutionAuthoritativeView: (execId: string) => ({
        task: {
          id: `task-${execId.split("-")[1]}`,
          status: "pending",
          priority: "normal",
        },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 3);
});

test("ExecutionDbQueueDisconnectRepairService.scan returns empty when view task is missing", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => null,
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.deepEqual(issues, []);
});

test("ExecutionDbQueueDisconnectRepairService.scan filters failed and cancelled tasks", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
      { id: "exec-2", taskId: "task-2", status: "created", attempt: 1 },
      { id: "exec-3", taskId: "task-3", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "done", priority: "normal" },
      { id: "task-2", status: "failed", priority: "normal" },
      { id: "task-3", status: "cancelled", priority: "normal" },
    ],
    operations: {
      loadExecutionAuthoritativeView: (execId: string) => {
        const taskNum = execId.split("-")[1];
        return {
          task: { id: `task-${taskNum}`, status: ["done", "failed", "cancelled"][parseInt(taskNum!) - 1], priority: "normal" },
        };
      },
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.deepEqual(issues, []);
});

test("ExecutionDbQueueDisconnectRepairService.scan handles empty planJson", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "normal" },
    ],
    agentExecutions: [
      { executionId: "exec-1", planJson: null },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "normal" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.recoveredFromPlan, false);
  // Should use task priority as fallback
  assert.equal(issues[0]!.repairTemplate.priority, "normal");
});

test("ExecutionDbQueueDisconnectRepairService.scan handles malformed planJson", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "low" },
    ],
    agentExecutions: [
      { executionId: "exec-1", planJson: "{ invalid json" },
    ],
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "low" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.recoveredFromPlan, false);
  // Should use task priority as fallback
  assert.equal(issues[0]!.repairTemplate.priority, "low");
});

test("ExecutionDbQueueDisconnectRepairService.scan handles missing agent execution record", () => {
  const db = createMockDb();
  const store = createMockStore({
    executions: [
      { id: "exec-1", taskId: "task-1", status: "created", attempt: 1 },
    ],
    tasks: [
      { id: "task-1", status: "pending", priority: "high" },
    ],
    agentExecutions: [], // No agent execution record
    operations: {
      loadExecutionAuthoritativeView: () => ({
        task: { id: "task-1", status: "pending", priority: "high" },
      }),
    },
  });
  const service = new ExecutionDbQueueDisconnectRepairService(db, store);

  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.recoveredFromPlan, false);
  // Should use task priority as fallback
  assert.equal(issues[0]!.repairTemplate.priority, "high");
});
