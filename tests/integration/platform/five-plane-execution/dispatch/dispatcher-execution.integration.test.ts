/**
 * Integration Tests: Dispatcher + Execution Engine
 *
 * Tests end-to-end task execution flow through dispatcher and execution engine.
 * Verifies dispatch, execution, and completion with real store operations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { ExecutionDispatchService } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { TransitionService } from "../../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("execution: dispatch service creates and claims ticket with worker", () => {
  const ctx = createIntegrationContext("aa-disp-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);
    const workers = new WorkerRegistryService(ctx.store);
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    const taskId = "disp-task-001";
    const executionId = "disp-exec-001";
    const traceId = "trace-disp";
    const now = nowIso();

    // Seed task and execution
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Dispatch test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-disp",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Register a worker
    workers.recordHeartbeat({
      workerId: "worker-disp-001",
      status: "idle",
      capabilities: ["bash", "read"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Create dispatch ticket
    const ticket = dispatch.createTicket({
      executionId,
      queueName: "default",
      requiredCapabilities: ["bash", "read"],
      occurredAt: nowIso(),
    });

    assert.equal(ticket.outcome, "created");
    assert.ok(ticket.ticket, "Ticket should be created");
    assert.equal(ticket.ticket?.executionId, executionId);

    // Dispatch to worker
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(dispatched.outcome, "dispatched");
    assert.equal(dispatched.worker?.workerId, "worker-disp-001");

    // Verify ticket is claimed
    const tickets = ctx.store.listExecutionTicketsByExecution(executionId);
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0]?.status, "claimed");
    assert.equal(tickets[0]?.assignedWorkerId, "worker-disp-001");
  } finally {
    ctx.cleanup();
  }
});

test("execution: dispatch service queues when no workers available", () => {
  const ctx = createIntegrationContext("aa-disp-queue-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    const taskId = "disp-queue-task-001";
    const executionId = "disp-queue-exec-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Queue test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-queue",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-queue",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create ticket without any workers
    const ticket = dispatch.createTicket({
      executionId,
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(ticket.outcome, "created");

    // Dispatch should return no_worker
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(dispatched.outcome, "no_worker");

    // Ticket should still be in pending state
    const tickets = ctx.store.listExecutionTicketsByExecution(executionId);
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0]?.status, "pending");
  } finally {
    ctx.cleanup();
  }
});

test("execution: transition execution through dispatch lifecycle", () => {
  const ctx = createIntegrationContext("aa-disp-lifecycle-");
  try {
    const repository = createRuntimeLifecycleRepository(ctx.store);
    const transitions = new TransitionService(ctx.db, ctx.store, repository);
    const workers = new WorkerRegistryService(ctx.store);
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    const taskId = "disp-lifecycle-task-001";
    const executionId = "disp-lifecycle-exec-001";
    const sessionId = "disp-lifecycle-sess-001";
    const now = nowIso();

    // Seed all entities
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Lifecycle test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: JSON.stringify({}),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-lifecycle",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-lifecycle",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Register worker and claim execution
    workers.recordHeartbeat({
      workerId: "worker-lifecycle",
      status: "busy",
      capabilities: ["bash", "read"],
      runningExecutionIds: [executionId],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Complete execution successfully
    transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "execution.completed",
      traceId: "trace-lifecycle",
      actorType: "system",
      occurredAt: nowIso(),
    });

    // Cascade to terminal state
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "dispatch_lifecycle_complete" }),
      outputsJson: JSON.stringify({}),
      context: {
        reasonCode: "task.completed",
        traceId: "trace-lifecycle",
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify final states
    const task = ctx.store.getTask(taskId);
    const workflow = ctx.store.getWorkflowState(taskId);
    const session = ctx.store.getSession(sessionId);
    const execution = ctx.store.getExecution(executionId);

    assert.equal(task?.status, "done", "Task should be done");
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(session?.status, "completed", "Session should be completed");
    assert.equal(execution?.status, "succeeded", "Execution should be succeeded");
  } finally {
    ctx.cleanup();
  }
});

test("execution: dispatch with capability matching selects correct worker", () => {
  const ctx = createIntegrationContext("aa-disp-cap-");
  try {
    const workers = new WorkerRegistryService(ctx.store);
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    const taskId = "disp-cap-task-001";
    const executionId = "disp-cap-exec-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Capability test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-cap",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-cap",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Register two workers with different capabilities
    workers.recordHeartbeat({
      workerId: "worker-bash-only",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    workers.recordHeartbeat({
      workerId: "worker-full",
      status: "idle",
      capabilities: ["bash", "python", "read", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 3,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Create ticket requiring bash and python
    const ticket = dispatch.createTicket({
      executionId,
      queueName: "default",
      requiredCapabilities: ["bash", "python"],
      occurredAt: nowIso(),
    });

    assert.equal(ticket.outcome, "created");

    // Dispatch should select worker-full (has all required capabilities)
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(dispatched.outcome, "dispatched");
    assert.equal(dispatched.worker?.workerId, "worker-full");
  } finally {
    ctx.cleanup();
  }
});

test("execution: dispatch returns existing ticket on duplicate create", () => {
  const ctx = createIntegrationContext("aa-disp-dup-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    const taskId = "disp-dup-task-001";
    const executionId = "disp-dup-exec-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Duplicate test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-dup",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-dup",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create first ticket
    const first = dispatch.createTicket({
      executionId,
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(first.outcome, "created");

    // Create second ticket for same execution
    const second = dispatch.createTicket({
      executionId,
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket?.id, first.ticket?.id);
  } finally {
    ctx.cleanup();
  }
});

test("execution: worker with no matching capabilities is skipped", () => {
  const ctx = createIntegrationContext("aa-disp-skip-");
  try {
    const workers = new WorkerRegistryService(ctx.store);
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    const taskId = "disp-skip-task-001";
    const executionId = "disp-skip-exec-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Skip test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-skip",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-skip",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Register worker with incompatible capabilities
    workers.recordHeartbeat({
      workerId: "worker-python-only",
      status: "idle",
      capabilities: ["python"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Create ticket requiring bash (not available)
    const ticket = dispatch.createTicket({
      executionId,
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(ticket.outcome, "created");

    // Dispatch should fail to find matching worker
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(dispatched.outcome, "no_worker");
  } finally {
    ctx.cleanup();
  }
});