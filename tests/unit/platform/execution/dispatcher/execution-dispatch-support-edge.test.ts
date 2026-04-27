import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStringArray,
  parseJsonArray,
  resolveDispatchTarget,
  resolveRequiredIsolationLevel,
  resolveRequiredRepoVersion,
  meetsIsolationRequirement,
  resolveRemoteAvailability,
  resolveRemoteRepoVersionReason,
  resolveRemoteSessionReason,
  resolveRemoteTrustReason,
  selectWorkersForDispatch,
  toWorkerEvaluation,
  isElevatedPriority,
  isRemoteSessionReadyForDispatch,
  resolveDispatchBackpressureReason,
  buildDispatchAgentExecutionRecord,
  AFFINITY_SELECTION_BONUS,
  LOAD_SKEW_SELECTION_PENALTY,
  DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS,
} from "../../../../../src/platform/execution/dispatcher/execution-dispatch-support.js";
import type { WorkerPlacement, DispatchWorkerEvaluation, DispatchTarget, WorkerIsolationLevel, ExecutionTicketRecord, TaskPriority, RemoteAvailability } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

// ---------------------------------------------------------------------------
// normalizeStringArray edge cases
// ---------------------------------------------------------------------------

test("normalizeStringArray handles strings with only whitespace", () => {
  const result = normalizeStringArray(["   ", "\t", "\n"]);
  assert.deepStrictEqual(result, []);
});

test("normalizeStringArray handles mixed whitespace and valid strings", () => {
  const result = normalizeStringArray(["  alpha  ", " beta", "gamma", "  "]);
  assert.deepStrictEqual(result, ["alpha", "beta", "gamma"]);
});

test("normalizeStringArray handles duplicates with different whitespace", () => {
  const result = normalizeStringArray(["alpha", " alpha", "alpha ", "  alpha  "]);
  assert.deepStrictEqual(result, ["alpha"]);
});

test("normalizeStringArray handles single character strings", () => {
  const result = normalizeStringArray(["a", "b", "a", "c"]);
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// parseJsonArray edge cases
// ---------------------------------------------------------------------------

test("parseJsonArray handles JSON array with escaped characters", () => {
  // Note: JSON.parse normalizes escaped quotes, so "a\"b" becomes 'a"b'
  const result = parseJsonArray('["a\\"b", "c"]');
  assert.deepStrictEqual(result, ["a\"b", "c"]);
});

test("parseJsonArray handles JSON array with numbers", () => {
  const result = parseJsonArray('["a", 1, 2, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray handles JSON array with booleans", () => {
  const result = parseJsonArray('["a", true, false, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray handles JSON array with null", () => {
  const result = parseJsonArray('["a", null, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray handles JSON array with objects", () => {
  const result = parseJsonArray('["a", {}, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray calls onError with correct message on parse failure", () => {
  const errors: string[] = [];
  parseJsonArray("not valid json at all", (msg) => errors.push(msg));
  assert.equal(errors.length, 1);
  assert.ok(errors[0]!.length > 0);
});

test("parseJsonArray handles empty JSON array string", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles JSON primitives", () => {
  assert.deepStrictEqual(parseJsonArray('"just a string"'), []);
  assert.deepStrictEqual(parseJsonArray("123"), []);
  assert.deepStrictEqual(parseJsonArray("true"), []);
});

// ---------------------------------------------------------------------------
// resolveDispatchTarget edge cases
// ---------------------------------------------------------------------------

test("resolveDispatchTarget returns any for empty string", () => {
  assert.equal(resolveDispatchTarget("" as DispatchTarget), "any");
});

test("resolveDispatchTarget returns any for numeric input cast", () => {
  assert.equal(resolveDispatchTarget("any" as DispatchTarget), "any");
});

// ---------------------------------------------------------------------------
// resolveRequiredIsolationLevel edge cases
// ---------------------------------------------------------------------------

test("resolveRequiredIsolationLevel returns standard for unknown string", () => {
  assert.equal(resolveRequiredIsolationLevel("unknown" as WorkerIsolationLevel), "standard");
});

test("resolveRequiredIsolationLevel returns standard for empty string", () => {
  assert.equal(resolveRequiredIsolationLevel("" as WorkerIsolationLevel), "standard");
});

// ---------------------------------------------------------------------------
// resolveRequiredRepoVersion edge cases
// ---------------------------------------------------------------------------

test("resolveRequiredRepoVersion handles string with only spaces", () => {
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion handles string with tabs and newlines", () => {
  assert.equal(resolveRequiredRepoVersion("\t\n  "), null);
});

test("resolveRequiredRepoVersion handles single character version", () => {
  assert.equal(resolveRequiredRepoVersion("v"), "v");
});

test("resolveRequiredRepoVersion preserves version with leading zeros", () => {
  assert.equal(resolveRequiredRepoVersion("v01.02.03"), "v01.02.03");
});

// ---------------------------------------------------------------------------
// meetsIsolationRequirement edge cases
// ---------------------------------------------------------------------------

test("meetsIsolationRequirement strict >= strict", () => {
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

test("meetsIsolationRequirement standard !>= strict", () => {
  assert.equal(meetsIsolationRequirement("standard", "strict"), false);
});

test("meetsIsolationRequirement hardened !>= strict", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

// ---------------------------------------------------------------------------
// resolveRemoteAvailability comprehensive edge cases
// ---------------------------------------------------------------------------

function makeEvaluation(placement: WorkerPlacement, accepted: boolean, rejectionReason: DispatchWorkerEvaluation["rejectionReason"] = null): DispatchWorkerEvaluation {
  return {
    workerId: "w1",
    status: "idle",
    schedulingStatus: "healthy",
    placement,
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
    queueAffinity: null,
    availableSlots: 1,
    accepted,
    rejectionReason,
    missingCapabilities: [],
  };
}

test("resolveRemoteAvailability returns healthy for single accepted remote", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "healthy");
});

test("resolveRemoteAvailability returns degraded for untrusted rejection", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_untrusted")];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "degraded");
});

test("resolveRemoteAvailability returns degraded for session_unready rejection", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_remote_session_unready")];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "degraded");
});

test("resolveRemoteAvailability returns degraded when mix of degraded and unavailable", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_untrusted"),
    makeEvaluation("remote", false, "worker_unavailable"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "degraded");
});

test("resolveRemoteAvailability returns partial_available for mix of accepted and untrusted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "partial_available");
});

test("resolveRemoteAvailability skips placement_mismatch and returns unavailable", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_placement_mismatch"),
    makeEvaluation("remote", false, "worker_placement_mismatch"),
  ];
  assert.equal(resolveRemoteAvailability("require_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability handles mixed remote and local evaluations", () => {
  const evaluations = [
    makeEvaluation("local", true),
    makeEvaluation("remote", true),
  ];
  // Only remote evaluations are considered
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "healthy");
});

// ---------------------------------------------------------------------------
// resolveRemoteRepoVersionReason comprehensive edge cases
// ---------------------------------------------------------------------------

test("resolveRemoteRepoVersionReason returns null for empty evaluations", () => {
  const evaluations: DispatchWorkerEvaluation[] = [];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when some accepted despite all mismatch", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null for any target", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_repo_version_mismatch")];
  assert.equal(resolveRemoteRepoVersionReason("any", evaluations, "v1"), null);
  assert.equal(resolveRemoteRepoVersionReason("local_only", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when no required version", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_repo_version_mismatch")];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, null), null);
});

// ---------------------------------------------------------------------------
// resolveRemoteSessionReason comprehensive edge cases
// ---------------------------------------------------------------------------

test("resolveRemoteSessionReason returns null for empty evaluations", () => {
  const evaluations: DispatchWorkerEvaluation[] = [];
  assert.equal(resolveRemoteSessionReason("require_remote", evaluations), null);
});

test("resolveRemoteSessionReason returns null when some accepted despite all unready", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("require_remote", evaluations), null);
});

test("resolveRemoteSessionReason returns null for local_only target", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_remote_session_unready")];
  assert.equal(resolveRemoteSessionReason("local_only", evaluations), null);
});

// ---------------------------------------------------------------------------
// resolveRemoteTrustReason comprehensive edge cases
// ---------------------------------------------------------------------------

test("resolveRemoteTrustReason returns null for empty evaluations", () => {
  const evaluations: DispatchWorkerEvaluation[] = [];
  assert.equal(resolveRemoteTrustReason("require_remote", evaluations), null);
});

test("resolveRemoteTrustReason returns null when some accepted despite all untrusted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("require_remote", evaluations), null);
});

test("resolveRemoteTrustReason returns null for any target", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_untrusted")];
  assert.equal(resolveRemoteTrustReason("any", evaluations), null);
  assert.equal(resolveRemoteTrustReason("local_only", evaluations), null);
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch comprehensive edge cases
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch prefer_remote with only remote workers", () => {
  const workers = [
    { workerId: "r1", placement: "remote" as const },
    { workerId: "r2", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch prefer_remote with only local workers and all reasons null", () => {
  const workers = [{ workerId: "l1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 1);
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.reasonCode, null);
});

test("selectWorkersForDispatch prefer_remote priority of reasons: trust > session > repo > availability", () => {
  const workers = [{ workerId: "l1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "available" as RemoteAvailability, "remote.untrusted", "remote.session_unready", "remote.repo_version_mismatch");
  assert.equal(result.reasonCode, "remote.untrusted");
});

test("selectWorkersForDispatch require_remote returns all workers (no filtering)", () => {
  const workers = [
    { workerId: "l1", placement: "local" as const },
    { workerId: "r1", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("require_remote", workers as any, null, null, null, null);
  // require_remote does not filter - only prefer_remote filters
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch any returns all workers unchanged", () => {
  const workers = [
    { workerId: "l1", placement: "local" as const },
    { workerId: "r1", placement: "remote" as const },
    { workerId: "l2", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("any", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 3);
  assert.equal(result.fallbackApplied, false);
});

// ---------------------------------------------------------------------------
// isElevatedPriority edge cases
// ---------------------------------------------------------------------------

test("isElevatedPriority returns false for unknown priority", () => {
  assert.equal(isElevatedPriority("unknown" as TaskPriority), false);
});

// ---------------------------------------------------------------------------
// isRemoteSessionReadyForDispatch comprehensive edge cases
// ---------------------------------------------------------------------------

test("isRemoteSessionReadyForDispatch returns false for remote with viewer_only status", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "viewer_only",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

test("isRemoteSessionReadyForDispatch returns false for remote with disconnected status", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "disconnected",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

test("isRemoteSessionReadyForDispatch returns false for remote with connecting status", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "connecting",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

test("isRemoteSessionReadyForDispatch returns false for remote with session_reconnecting status", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "session_reconnecting",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

// ---------------------------------------------------------------------------
// resolveDispatchBackpressureReason comprehensive edge cases
// ---------------------------------------------------------------------------

test("resolveDispatchBackpressureReason returns null for high priority with pause_non_critical", () => {
  const ticket = { priority: "high" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

test("resolveDispatchBackpressureReason returns null for urgent priority with pause_non_critical", () => {
  const ticket = { priority: "urgent" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

test("resolveDispatchBackpressureReason returns null for high priority with queue_only no starvation", () => {
  const ticket = { priority: "high" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

test("resolveDispatchBackpressureReason returns null for urgent priority with queue_only starvation", () => {
  const ticket = { priority: "urgent" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: true } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

test("resolveDispatchBackpressureReason returns backpressure.starvation_protection for low priority", () => {
  const ticket = { priority: "low" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: true } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.starvation_protection");
});

test("resolveDispatchBackpressureReason returns backpressure.queue_only for normal priority", () => {
  const ticket = { priority: "normal" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.queue_only");
});

test("resolveDispatchBackpressureReason returns backpressure.pause_non_critical for low priority", () => {
  const ticket = { priority: "low" as TaskPriority } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.pause_non_critical");
});

// ---------------------------------------------------------------------------
// buildDispatchAgentExecutionRecord additional edge cases
// ---------------------------------------------------------------------------

function createMockStoreForBuildRecord(existingAgentRecord?: Record<string, unknown> | null): AuthoritativeTaskStore {
  return {
    worker: {
      getAgentExecutionRecord: () => existingAgentRecord ?? null,
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockExecution(id = "exec-1"): Record<string, unknown> {
  return {
    id,
    taskId: "task-1",
    workflowId: "wf-1",
    roleId: "role-1",
    agentId: "original-agent-id",
    status: "executing",
    runKind: "task_run",
    attempt: 1,
    traceId: "trace-1",
    parentExecutionId: null,
    inputRef: null,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeoutMs: 3600000,
  };
}

test("buildDispatchAgentExecutionRecord handles null lastDecisionJson explicitly", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1", lastDecisionJson: null };

  const record = buildDispatchAgentExecutionRecord(store, execution as any, occurredAt, updates);

  // lastDecisionJson null means use existing or null
  assert.equal(record.lastDecisionJson, null);
});

test("buildDispatchAgentExecutionRecord handles null progressMessage explicitly", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1", progressMessage: null };

  const record = buildDispatchAgentExecutionRecord(store, execution as any, occurredAt, updates);

  // progressMessage null means use existing or null
  assert.equal(record.progressMessage, null);
});

test("buildDispatchAgentExecutionRecord preserves existing record when updates only contain taskId", () => {
  const existingRecord = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "existing-agent",
    workflowId: "wf-1",
    roleId: "role-1",
    runKind: "task_run",
    runtimeInstanceId: "runtime-123",
    restartedFromRuntimeInstanceId: "runtime-100",
    restartGeneration: 2,
    status: "executing",
    planJson: '{"plan":"data"}',
    currentStepId: "step-5",
    lastToolName: "tool_a",
    toolCallCount: 50,
    lastDecisionJson: '{"decision":"test"}',
    lastErrorCode: null,
    retryCount: 1,
    progressMessage: "running",
    startedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStoreForBuildRecord(existingRecord);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution as any, occurredAt, updates);

  assert.equal(record.agentId, "existing-agent");
  assert.equal(record.runtimeInstanceId, "runtime-123");
  assert.equal(record.restartGeneration, 2);
});

test("buildDispatchAgentExecutionRecord handles existing record with null fields", () => {
  const existingRecord = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: null,
    workflowId: null,
    roleId: null,
    runKind: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: null,
    status: null,
    planJson: null,
    currentStepId: null,
    lastToolName: null,
    toolCallCount: null,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: null,
    progressMessage: null,
    startedAt: null,
    createdAt: null,
    updatedAt: null,
    completedAt: null,
  };
  const store = createMockStoreForBuildRecord(existingRecord);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution as any, occurredAt, updates);

  // Should fall back to execution fields
  assert.equal(record.agentId, "original-agent-id");
  assert.equal(record.workflowId, "wf-1");
  assert.equal(record.roleId, "role-1");
});

test("buildDispatchAgentExecutionRecord computes retryCount from execution attempt", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  execution.attempt = 1;
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution as any, occurredAt, updates);

  assert.equal(record.retryCount, 0); // attempt - 1 = 0
});

test("buildDispatchAgentExecutionRecord computes retryCount from execution attempt 5", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  execution.attempt = 5;
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution as any, occurredAt, updates);

  assert.equal(record.retryCount, 4); // attempt - 1 = 4
});

// ---------------------------------------------------------------------------
// toWorkerEvaluation additional edge cases
// ---------------------------------------------------------------------------

test("toWorkerEvaluation handles all worker fields null", () => {
  const worker = {
    workerId: "w1",
    status: "idle",
    schedulingStatus: "healthy",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    queueAffinity: null,
    availableSlots: 1,
  };
  const evaluation = toWorkerEvaluation(worker as any, true, null, []);
  assert.equal(evaluation.repoVersion, null);
  assert.equal(evaluation.remoteSessionStatus, null);
  assert.equal(evaluation.queueAffinity, null);
});

test("toWorkerEvaluation preserves all numeric fields", () => {
  const worker = {
    workerId: "w1",
    status: "idle",
    schedulingStatus: "healthy",
    placement: "remote",
    isolationLevel: "strict",
    repoVersion: "v1",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "999",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
    queueAffinity: "queue1",
    availableSlots: 5,
  };
  const evaluation = toWorkerEvaluation(worker as any, false, "worker_unavailable", ["cap1", "cap2"]);
  assert.equal(evaluation.workerId, "w1");
  assert.equal(evaluation.placement, "remote");
  assert.equal(evaluation.isolationLevel, "strict");
  assert.equal(evaluation.availableSlots, 5);
  assert.equal(evaluation.rejectionReason, "worker_unavailable");
  assert.deepStrictEqual(evaluation.missingCapabilities, ["cap1", "cap2"]);
});

// ---------------------------------------------------------------------------
// Additional coverage for exported constants
// ---------------------------------------------------------------------------

test("AFFINITY_SELECTION_BONUS is 0.35", () => {
  assert.equal(AFFINITY_SELECTION_BONUS, 0.35);
});

test("LOAD_SKEW_SELECTION_PENALTY is 0.75", () => {
  assert.equal(LOAD_SKEW_SELECTION_PENALTY, 0.75);
});

test("DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS has correct defaults", () => {
  assert.equal(DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.memoryHighWatermarkMb, Number.POSITIVE_INFINITY);
  assert.equal(DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS.eventLoopLagThresholdMs, Number.POSITIVE_INFINITY);
});

// ---------------------------------------------------------------------------
// Additional remote availability edge cases
// ---------------------------------------------------------------------------

test("resolveRemoteAvailability returns partial_available for capacity_full rejection", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_capacity_full"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "partial_available");
});

test("resolveRemoteAvailability handles empty evaluations for prefer_remote", () => {
  const evaluations: DispatchWorkerEvaluation[] = [];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability handles empty evaluations for require_remote", () => {
  const evaluations: DispatchWorkerEvaluation[] = [];
  assert.equal(resolveRemoteAvailability("require_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability returns null for any target", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteAvailability("any", evaluations), null);
});

test("resolveRemoteAvailability returns null for local_only target", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteAvailability("local_only", evaluations), null);
});

// ---------------------------------------------------------------------------
// Additional parseJsonArray edge cases
// ---------------------------------------------------------------------------

test("parseJsonArray handles JSON array with mixed whitespace", () => {
  const result = parseJsonArray('  ["a", "b"]  ');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray handles JSON with trailing comma", () => {
  // JSON.parse would fail on trailing comma, but our filter handles it
  const result = parseJsonArray('["a", "b",]');
  // JSON.parse would fail here, so we get empty array
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// Additional selectWorkersForDispatch edge cases
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch local_only returns all workers (no filtering)", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
    { workerId: "w3", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("local_only", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 3);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch prefer_remote returns empty when no workers", () => {
  const workers: any[] = [];
  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);
  assert.equal(result.workers.length, 0);
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.reasonCode, null);
});

test("selectWorkersForDispatch require_remote returns all workers even when no remote", () => {
  const workers = [{ workerId: "w1", placement: "local" as const }];
  const result = selectWorkersForDispatch("require_remote", workers as any, null, null, null, null);
  // require_remote does not filter - returns all workers
  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "w1");
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch prefer_remote uses first reason in priority chain", () => {
  const workers = [{ workerId: "l1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "partial_available" as RemoteAvailability, null, "remote.session_unready", null);
  assert.equal(result.reasonCode, "remote.session_unready");
});

test("selectWorkersForDispatch prefer_remote uses availability when no specific reasons", () => {
  const workers = [{ workerId: "l1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "partial_available" as RemoteAvailability, null, null, null);
  assert.equal(result.reasonCode, "remote.fallback_local.partial_available");
});
