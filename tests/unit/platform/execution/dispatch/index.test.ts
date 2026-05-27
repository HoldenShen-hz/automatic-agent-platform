/**
 * Unit Tests: Dispatch Module Index
 *
 * Tests for the dispatch module's public API surface and type exports.
 * The dispatch module handles tool execution routing and worker dispatch.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import types that are part of the dispatch support public API
import type {
  CreateExecutionTicketInput,
  DispatchExecutionOptions,
  DispatchQueueAvailabilitySnapshot,
  ExecutionTicketDecision,
  DispatchExecutionDecision,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";

// Re-export types from dispatch-types domain
import type {
  ExecutionTicketRecord,
  ExecutionTicketStatus,
  DispatchWorkerEvaluation,
  DispatchDecisionTrace,
  DispatchTarget,
  WorkerIsolationLevel,
  TaskPriority,
} from "../../../../../src/platform/contracts/types/domain.js";

// Import singleton management functions from index
import {
  getToolRegistry,
  resetToolRegistry,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
  type MultiStepToolDefinition,
} from "../../../../../src/platform/five-plane-execution/dispatcher/index.js";

// =============================================================================
// Module Export Verification
// =============================================================================

test("index module exports getToolRegistry function [index]", () => {
  assert.equal(typeof getToolRegistry, "function");
});

test("index module exports resetToolRegistry function [index]", () => {
  assert.equal(typeof resetToolRegistry, "function");
});

test("index module exports executeMultiStepToolCallForTests function [index]", () => {
  assert.equal(typeof executeMultiStepToolCallForTests, "function");
});

test("index module exports resetMultiStepToolRegistryForTests function [index]", () => {
  assert.equal(typeof resetMultiStepToolRegistryForTests, "function");
});

// =============================================================================
// Singleton Behavior
// =============================================================================

test("getToolRegistry returns consistent singleton instance [index]", () => {
  const registry1 = getToolRegistry();
  const registry2 = getToolRegistry();
  assert.strictEqual(registry1, registry2);
});

test("resetToolRegistry clears singleton for fresh instance [index]", () => {
  const registry1 = getToolRegistry();
  resetToolRegistry();
  const registry2 = getToolRegistry();
  assert.notStrictEqual(registry1, registry2);
});

test("resetMultiStepToolRegistryForTests clears singleton [index]", () => {
  const registry1 = getToolRegistry();
  resetMultiStepToolRegistryForTests();
  const registry2 = getToolRegistry();
  assert.notStrictEqual(registry1, registry2);
});

test.afterEach(() => {
  resetMultiStepToolRegistryForTests();
});

// =============================================================================
// ExecutionTicketRecord Type Structure
// =============================================================================

test("ExecutionTicketRecord has correct structure [index]", () => {
  const record: ExecutionTicketRecord = {
    id: "ticket_abc123",
    executionId: "exec_xyz",
    taskId: "task_123",
    priority: "normal",
    queueName: null,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
    dispatchAfter: null,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:00:00.000Z",
  };
  assert.equal(record.id, "ticket_abc123");
  assert.equal(record.executionId, "exec_xyz");
  assert.equal(record.priority, "normal");
  assert.equal(record.status, "pending");
});

test("ExecutionTicketStatus accepts all valid status values [index]", () => {
  const statuses: ExecutionTicketStatus[] = ["pending", "claimed", "consumed", "cancelled", "expired"];
  assert.equal(statuses.length, 5);
});

test("ExecutionTicketRecord with all fields populated [index]", () => {
  const record: ExecutionTicketRecord = {
    id: "ticket_full",
    executionId: "exec_full",
    taskId: "task_full",
    priority: "urgent",
    queueName: "high-priority",
    dispatchTarget: "require_remote",
    requiredIsolationLevel: "strict",
    requiredRepoVersion: "v2.0.0",
    requiredCapabilitiesJson: '["gpu", "large-memory"]',
    dispatchAfter: "2026-04-24T01:00:00.000Z",
    attempt: 2,
    status: "claimed",
    assignedWorkerId: "worker_1",
    leaseId: "lease_abc",
    claimedAt: "2026-04-24T00:30:00.000Z",
    consumedAt: null,
    invalidatedAt: null,
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:30:00.000Z",
  };
  assert.equal(record.priority, "urgent");
  assert.equal(record.queueName, "high-priority");
  assert.equal(record.status, "claimed");
  assert.equal(record.assignedWorkerId, "worker_1");
});

// =============================================================================
// DispatchWorkerEvaluation Type Structure
// =============================================================================

test("DispatchWorkerEvaluation has correct structure for accepted worker [index]", () => {
  const evaluation: DispatchWorkerEvaluation = {
    workerId: "worker_test",
    status: "idle",
    schedulingStatus: "healthy",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: "v1.0.0",
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    queueAffinity: "default",
    availableSlots: 5,
    accepted: true,
    rejectionReason: null,
    missingCapabilities: [],
    affinityMatched: true,
    activeLeaseCount: 2,
    runningExecutionCount: 3,
    saturation: 0.4,
    toolBacklogCount: 1,
    loadScore: 0.35,
    activeLeaseShare: 0.2,
    dispatchScore: 0.85,
    loadSkewPenaltyApplied: false,
  };
  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.rejectionReason, null);
  assert.equal(evaluation.affinityMatched, true);
});

test("DispatchWorkerEvaluation has correct structure for rejected worker [index]", () => {
  const evaluation: DispatchWorkerEvaluation = {
    workerId: "worker_rejected",
    status: "degraded",
    schedulingStatus: "healthy",
    placement: "remote",
    isolationLevel: "standard",
    repoVersion: "v1.0.0",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
    queueAffinity: null,
    availableSlots: 0,
    accepted: false,
    rejectionReason: "worker_capacity_full",
    missingCapabilities: [],
  };
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.rejectionReason, "worker_capacity_full");
  assert.equal(evaluation.availableSlots, 0);
});

// =============================================================================
// DispatchDecisionTrace Type Structure
// =============================================================================

test("DispatchDecisionTrace has correct structure for dispatched outcome [index]", () => {
  const trace: DispatchDecisionTrace = {
    ticketId: "ticket_1",
    executionId: "exec_1",
    taskId: "task_1",
    queueName: "default",
    dispatchTarget: "any",
    remoteAvailability: "healthy",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    preferredWorkerId: null,
    requiredCapabilities: [],
    outcome: "dispatched",
    reasonCode: null,
    selectedWorkerId: "worker_1",
    leaseId: "lease_abc",
    fallbackApplied: false,
    preemption: null,
    evaluations: [],
  };
  assert.equal(trace.outcome, "dispatched");
  assert.equal(trace.selectedWorkerId, "worker_1");
  assert.equal(trace.fallbackApplied, false);
});

test("DispatchDecisionTrace has correct structure for blocked outcome [index]", () => {
  const trace: DispatchDecisionTrace = {
    ticketId: "ticket_2",
    executionId: "exec_2",
    taskId: "task_2",
    queueName: null,
    dispatchTarget: "require_remote",
    remoteAvailability: "unavailable",
    requiredIsolationLevel: "hardened",
    requiredRepoVersion: "v2.0.0",
    preferredWorkerId: null,
    requiredCapabilities: ["special-cap"],
    outcome: "blocked",
    reasonCode: "remote.unavailable",
    selectedWorkerId: null,
    leaseId: null,
    fallbackApplied: false,
    preemption: null,
    evaluations: [],
  };
  assert.equal(trace.outcome, "blocked");
  assert.equal(trace.reasonCode, "remote.unavailable");
});

test("DispatchDecisionTrace with preemption applied [index]", () => {
  const trace: DispatchDecisionTrace = {
    ticketId: "ticket_preempt",
    executionId: "exec_preempt",
    taskId: "task_preempt",
    queueName: "urgent-queue",
    dispatchTarget: "any",
    remoteAvailability: null,
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    preferredWorkerId: null,
    requiredCapabilities: [],
    outcome: "dispatched",
    reasonCode: null,
    selectedWorkerId: "worker_victim",
    leaseId: "lease_new",
    fallbackApplied: false,
    preemption: {
      applied: true,
      triggerPriority: "urgent",
      preemptedExecutionId: "exec_victim",
      preemptedTaskId: "task_victim",
      preemptedWorkerId: "worker_victim",
      previousTicketId: "ticket_victim",
      replacementTicketId: "ticket_preempt",
      recoveryStepId: "step_1",
      reasonCode: "priority_preemption",
    },
    evaluations: [],
  };
  assert.ok(trace.preemption?.applied);
  assert.equal(trace.preemption?.triggerPriority, "urgent");
  assert.equal(trace.preemption?.preemptedExecutionId, "exec_victim");
});

// =============================================================================
// CreateExecutionTicketInput Type Structure
// =============================================================================

test("CreateExecutionTicketInput minimal construction [index]", () => {
  const input: CreateExecutionTicketInput = {
    executionId: "exec_minimal",
  };
  assert.equal(input.executionId, "exec_minimal");
  assert.equal(input.priority, undefined);
  assert.equal(input.queueName, undefined);
});

test("CreateExecutionTicketInput full construction [index]", () => {
  const input: CreateExecutionTicketInput = {
    executionId: "exec_full",
    priority: "high",
    queueName: "priority-queue",
    dispatchTarget: "local_only",
    requiredIsolationLevel: "strict",
    requiredRepoVersion: "v3.0.0",
    requiredCapabilities: ["gpu", "high-memory"],
    dispatchAfter: "2026-04-25T00:00:00.000Z",
    occurredAt: "2026-04-24T00:00:00.000Z",
  };
  assert.equal(input.priority, "high");
  assert.equal(input.queueName, "priority-queue");
  assert.equal(input.dispatchTarget, "local_only");
  assert.deepEqual(input.requiredCapabilities, ["gpu", "high-memory"]);
});

// =============================================================================
// DispatchExecutionOptions Type Structure
// =============================================================================

test("DispatchExecutionOptions minimal construction [index]", () => {
  const input: DispatchExecutionOptions = {
    leaseTtlMs: 30000,
  };
  assert.equal(input.leaseTtlMs, 30000);
});

test("DispatchExecutionOptions full construction [index]", () => {
  const input: DispatchExecutionOptions = {
    queueName: "default",
    preferredWorkerId: "worker_preferred",
    leaseTtlMs: 60000,
    includeDegraded: true,
    occurredAt: "2026-04-24T00:00:00.000Z",
  };
  assert.equal(input.queueName, "default");
  assert.equal(input.preferredWorkerId, "worker_preferred");
  assert.equal(input.includeDegraded, true);
});

// =============================================================================
// DispatchQueueAvailabilitySnapshot Type Structure
// =============================================================================

test("DispatchQueueAvailabilitySnapshot available state [index]", () => {
  const snapshot: DispatchQueueAvailabilitySnapshot = {
    state: "available",
  };
  assert.equal(snapshot.state, "available");
  assert.equal(snapshot.reasonCode, undefined);
});

test("DispatchQueueAvailabilitySnapshot unavailable state with reason [index]", () => {
  const snapshot: DispatchQueueAvailabilitySnapshot = {
    state: "unavailable",
    reasonCode: "queue_maintenance",
  };
  assert.equal(snapshot.state, "unavailable");
  assert.equal(snapshot.reasonCode, "queue_maintenance");
});

test("DispatchQueueAvailabilitySnapshot degraded state [index]", () => {
  const snapshot: DispatchQueueAvailabilitySnapshot = {
    state: "degraded",
    reasonCode: "high_load",
  };
  assert.equal(snapshot.state, "degraded");
  assert.equal(snapshot.reasonCode, "high_load");
});

// =============================================================================
// ExecutionTicketDecision Type Structure
// =============================================================================

test("ExecutionTicketDecision created outcome [index]", () => {
  const decision: ExecutionTicketDecision = {
    outcome: "created",
    ticket: {
      id: "ticket_new",
      executionId: "exec_new",
      taskId: "task_new",
      priority: "normal",
      queueName: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    },
  };
  assert.equal(decision.outcome, "created");
  assert.ok(decision.ticket);
  assert.equal(decision.ticket.id, "ticket_new");
});

test("ExecutionTicketDecision exists outcome [index]", () => {
  const decision: ExecutionTicketDecision = {
    outcome: "exists",
    ticket: {
      id: "ticket_existing",
      executionId: "exec_existing",
      taskId: "task_existing",
      priority: "low",
      queueName: "default",
      requiredCapabilitiesJson: "[]",
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    },
  };
  assert.equal(decision.outcome, "exists");
});

// =============================================================================
// DispatchExecutionDecision Type Structure
// =============================================================================

test("DispatchExecutionDecision no_ticket outcome [index]", () => {
  const decision: DispatchExecutionDecision = {
    outcome: "no_ticket",
    reasonCode: null,
    ticket: null,
    worker: null,
    leaseId: null,
    trace: null,
  };
  assert.equal(decision.outcome, "no_ticket");
  assert.equal(decision.ticket, null);
  assert.equal(decision.worker, null);
});

test("DispatchExecutionDecision no_worker outcome [index]", () => {
  const decision: DispatchExecutionDecision = {
    outcome: "no_worker",
    reasonCode: "no_eligible_workers",
    ticket: {
      id: "ticket_nobody",
      executionId: "exec_nobody",
      taskId: "task_nobody",
      priority: "normal",
      queueName: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    },
    worker: null,
    leaseId: null,
    trace: null,
  };
  assert.equal(decision.outcome, "no_worker");
  assert.equal(decision.reasonCode, "no_eligible_workers");
});

// =============================================================================
// MultiStepToolDefinition Type
// =============================================================================

test("MultiStepToolDefinition structure [index]", () => {
  const toolDef: MultiStepToolDefinition = {
    name: "test_tool",
    description: "A test tool for unit testing",
    inputSchema: {
      type: "object",
      properties: {
        param1: { type: "string" },
        param2: { type: "number" },
      },
      required: ["param1"],
    },
  };
  assert.equal(toolDef.name, "test_tool");
  assert.equal(toolDef.description, "A test tool for unit testing");
  assert.ok(toolDef.inputSchema.properties);
});

test("MultiStepToolDefinition with complex schema [index]", () => {
  const toolDef: MultiStepToolDefinition = {
    name: "complex_tool",
    description: "Tool with complex input schema",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
        },
        config: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            timeout: { type: "integer" },
          },
        },
      },
      required: ["items"],
    },
  };
  // inputSchema is Record<string, unknown> so we need type assertions for property access
  const schema = toolDef.inputSchema as { type: string; properties: { items?: unknown; config?: unknown } };
  assert.ok(schema.properties.items != null, "items property should exist");
  assert.equal((schema.properties.items as { type?: string }).type, "array");
  assert.ok(schema.properties.config != null, "config property should exist");
  assert.equal((schema.properties.config as { type?: string }).type, "object");
});

// =============================================================================
// DispatchTarget Type Verification
// =============================================================================

test("DispatchTarget accepts all valid values [index]", () => {
  const targets: DispatchTarget[] = ["any", "local_only", "prefer_remote", "require_remote"];
  assert.equal(targets.length, 4);
});

// =============================================================================
// WorkerIsolationLevel Type Verification
// =============================================================================

test("WorkerIsolationLevel accepts all valid values [index]", () => {
  const levels: WorkerIsolationLevel[] = ["standard", "hardened", "strict"];
  assert.equal(levels.length, 3);
});

// =============================================================================
// TaskPriority Type Verification
// =============================================================================

test("TaskPriority accepts all standard values [index]", () => {
  const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];
  assert.equal(priorities.length, 4);
});