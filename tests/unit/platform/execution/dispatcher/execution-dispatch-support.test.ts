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
  isElevatedPriority,
  isRemoteSessionReadyForDispatch,
  buildDispatchAgentExecutionRecord,
  resolveDispatchBackpressureReason,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import type { WorkerPlacement, DispatchWorkerEvaluation, DispatchTarget, ExecutionTicketRecord, ExecutionRecord, AgentExecutionRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// ---------------------------------------------------------------------------
// normalizeStringArray
// ---------------------------------------------------------------------------

test("normalizeStringArray trims whitespace and removes empty strings [execution-dispatch-support]", () => {
  const result = normalizeStringArray(["  alpha  ", "beta", "  gamma", "delta", "  "]);
  assert.deepStrictEqual(result, ["alpha", "beta", "delta", "gamma"]);
});

test("normalizeStringArray returns sorted unique values [execution-dispatch-support]", () => {
  const result = normalizeStringArray(["z", "a", "m", "a", "z"]);
  assert.deepStrictEqual(result, ["a", "m", "z"]);
});

test("normalizeStringArray handles empty array [execution-dispatch-support]", () => {
  const result = normalizeStringArray([]);
  assert.deepStrictEqual(result, []);
});

test("normalizeStringArray handles all empty strings [execution-dispatch-support]", () => {
  const result = normalizeStringArray(["  ", "", "   "]);
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array [execution-dispatch-support]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray filters non-string elements [execution-dispatch-support]", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray returns empty array for invalid JSON [execution-dispatch-support]", () => {
  const result = parseJsonArray("not json");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [execution-dispatch-support]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray calls onError callback on parse failure [execution-dispatch-support]", () => {
  const errors: string[] = [];
  parseJsonArray("invalid", (msg) => errors.push(msg));
  assert.equal(errors.length, 1);
});

test("parseJsonArray handles empty string [execution-dispatch-support]", () => {
  const result = parseJsonArray("");
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// resolveDispatchTarget
// ---------------------------------------------------------------------------

test("resolveDispatchTarget returns local_only for local_only [execution-dispatch-support]", () => {
  assert.equal(resolveDispatchTarget("local_only"), "local_only");
});

test("resolveDispatchTarget returns prefer_remote for prefer_remote [execution-dispatch-support]", () => {
  assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
});

test("resolveDispatchTarget returns require_remote for require_remote [execution-dispatch-support]", () => {
  assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
});

test("resolveDispatchTarget defaults to any for unknown values [execution-dispatch-support]", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
  assert.equal(resolveDispatchTarget(null), "any");
  assert.equal(resolveDispatchTarget("any" as DispatchTarget), "any");
});

// ---------------------------------------------------------------------------
// resolveRequiredIsolationLevel
// ---------------------------------------------------------------------------

test("resolveRequiredIsolationLevel returns hardened for hardened [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
});

test("resolveRequiredIsolationLevel returns strict for strict [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
});

test("resolveRequiredIsolationLevel defaults to standard for null/undefined [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel defaults to standard for unknown values [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredIsolationLevel("standard"), "standard");
});

// ---------------------------------------------------------------------------
// resolveRequiredRepoVersion
// ---------------------------------------------------------------------------

test("resolveRequiredRepoVersion returns trimmed non-empty string [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.0.0  "), "v1.0.0");
});

test("resolveRequiredRepoVersion returns null for empty string [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for non-string [execution-dispatch-support]", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

// ---------------------------------------------------------------------------
// meetsIsolationRequirement
// ---------------------------------------------------------------------------

test("meetsIsolationRequirement standard >= standard [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened >= standard [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict >= standard [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement standard !>= hardened [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement hardened >= hardened [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

test("meetsIsolationRequirement strict >= hardened [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement hardened !>= strict [execution-dispatch-support]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

// ---------------------------------------------------------------------------
// resolveRemoteAvailability
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

test("resolveRemoteAvailability returns null for non-remote dispatch targets [execution-dispatch-support]", () => {
  const evaluations = [makeEvaluation("local", true)];
  assert.equal(resolveRemoteAvailability("any", evaluations), null);
  assert.equal(resolveRemoteAvailability("local_only", evaluations), null);
});

test("resolveRemoteAvailability returns unavailable when no remote evaluations [execution-dispatch-support]", () => {
  const evaluations = [makeEvaluation("local", true)];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
  assert.equal(resolveRemoteAvailability("require_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability returns healthy when all remote accepted [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", true),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "healthy");
});

test("resolveRemoteAvailability returns partial_available when some remote accepted [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_degraded_filtered"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "partial_available");
});

test("resolveRemoteAvailability returns degraded when any degraded rejection [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_degraded_filtered"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "degraded");
});

test("resolveRemoteAvailability returns unavailable when all rejected with unavailable/draining/offline/quarantined [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_unavailable"),
    makeEvaluation("remote", false, "worker_draining"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability skips placement_mismatch rejections [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_placement_mismatch"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

// ---------------------------------------------------------------------------
// resolveRemoteRepoVersionReason
// ---------------------------------------------------------------------------

test("resolveRemoteRepoVersionReason returns null when no required version [execution-dispatch-support]", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, null), null);
});

test("resolveRemoteRepoVersionReason returns null when not prefer/require remote [execution-dispatch-support]", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteRepoVersionReason("any", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when some accepted [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when not all repo_version_mismatch [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
    makeEvaluation("remote", false, "worker_unavailable"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns remote.repo_version_mismatch for require_remote [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, "v1"), "remote.repo_version_mismatch");
});

test("resolveRemoteRepoVersionReason returns remote.fallback_local.repo_version_mismatch for prefer_remote [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v1"), "remote.fallback_local.repo_version_mismatch");
});

// ---------------------------------------------------------------------------
// resolveRemoteSessionReason
// ---------------------------------------------------------------------------

test("resolveRemoteSessionReason returns null when not prefer/require remote [execution-dispatch-support]", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteSessionReason("any", evaluations), null);
});

test("resolveRemoteSessionReason returns null when some accepted [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("prefer_remote", evaluations), null);
});

test("resolveRemoteSessionReason returns remote.session_unready for require_remote [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_remote_session_unready"),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("require_remote", evaluations), "remote.session_unready");
});

test("resolveRemoteSessionReason returns remote.fallback_local.session_unready for prefer_remote [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_remote_session_unready"),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("prefer_remote", evaluations), "remote.fallback_local.session_unready");
});

// ---------------------------------------------------------------------------
// resolveRemoteTrustReason
// ---------------------------------------------------------------------------

test("resolveRemoteTrustReason returns null for non-remote dispatch targets [execution-dispatch-support]", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_untrusted")];
  assert.equal(resolveRemoteTrustReason("any", evaluations), null);
});

test("resolveRemoteTrustReason returns null when some accepted [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("prefer_remote", evaluations), null);
});

test("resolveRemoteTrustReason returns remote.untrusted for require_remote [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_untrusted"),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("require_remote", evaluations), "remote.untrusted");
});

test("resolveRemoteTrustReason returns remote.fallback_local.untrusted for prefer_remote [execution-dispatch-support]", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_untrusted"),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("prefer_remote", evaluations), "remote.fallback_local.untrusted");
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch returns all workers for non-prefer_remote [execution-dispatch-support]", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("any", workers as any, null, null, null, null);
  assert.deepStrictEqual(result.workers, workers);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch returns remote workers when available for prefer_remote [execution-dispatch-support]", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "w2");
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch falls back to local when no remote workers for prefer_remote [execution-dispatch-support]", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, true);
});

test("selectWorkersForDispatch uses remoteTrustReason when provided [execution-dispatch-support]", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, "remote.untrusted", null, null);
  assert.equal(result.reasonCode, "remote.untrusted");
});

test("selectWorkersForDispatch uses remoteSessionReason when trust reason not available [execution-dispatch-support]", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, "remote.session_unready", null);
  assert.equal(result.reasonCode, "remote.session_unready");
});

test("selectWorkersForDispatch uses remoteAvailability when no specific reason [execution-dispatch-support]", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "degraded", null, null, null);
  assert.equal(result.reasonCode, "remote.fallback_local.degraded");
});

test("selectWorkersForDispatch returns null reasonCode when no local workers [execution-dispatch-support]", () => {
  const workers: any[] = [];
  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);
  assert.equal(result.workers.length, 0);
  assert.equal(result.reasonCode, null);
  assert.equal(result.fallbackApplied, false);
});

// ---------------------------------------------------------------------------
// isElevatedPriority
// ---------------------------------------------------------------------------

test("isElevatedPriority returns true for high [execution-dispatch-support]", () => {
  assert.equal(isElevatedPriority("high"), true);
});

test("isElevatedPriority returns true for urgent [execution-dispatch-support]", () => {
  assert.equal(isElevatedPriority("urgent"), true);
});

test("isElevatedPriority returns false for normal [execution-dispatch-support]", () => {
  assert.equal(isElevatedPriority("normal"), false);
});

test("isElevatedPriority returns false for low [execution-dispatch-support]", () => {
  assert.equal(isElevatedPriority("low"), false);
});

// ---------------------------------------------------------------------------
// isRemoteSessionReadyForDispatch
// ---------------------------------------------------------------------------

test("isRemoteSessionReadyForDispatch returns true for local placement [execution-dispatch-support]", () => {
  const worker = {
    workerId: "w1",
    placement: "local" as const,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), true);
});

test("isRemoteSessionReadyForDispatch returns true for remote with connected status and no block reason [execution-dispatch-support]", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), true);
});

test("isRemoteSessionReadyForDispatch returns false for remote with viewer_only status [execution-dispatch-support]", () => {
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

test("isRemoteSessionReadyForDispatch returns false for remote with consistency mismatch [execution-dispatch-support]", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "mismatch" as const,
    workspaceSyncStatus: "aligned",
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

test("isRemoteSessionReadyForDispatch returns false for remote with workspace sync conflict [execution-dispatch-support]", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "conflict" as const,
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

test("isRemoteSessionReadyForDispatch returns false for remote with missing stream offset [execution-dispatch-support]", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  };
  assert.equal(isRemoteSessionReadyForDispatch(worker as any), false);
});

// ---------------------------------------------------------------------------
// resolveDispatchBackpressureReason
// ---------------------------------------------------------------------------

test("resolveDispatchBackpressureReason returns null when snapshot is null [execution-dispatch-support]", () => {
  const ticket = { priority: "low" as const } as ExecutionTicketRecord;
  assert.equal(resolveDispatchBackpressureReason(ticket, null), null);
});

test("resolveDispatchBackpressureReason returns null when degradationMode is ok [execution-dispatch-support]", () => {
  const ticket = { priority: "low" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "ok", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

test("resolveDispatchBackpressureReason returns read_only_mode for read_only_operations_only [execution-dispatch-support]", () => {
  const ticket = { priority: "low" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "read_only_operations_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.read_only_mode");
});

test("resolveDispatchBackpressureReason returns pause_non_critical for elevated priority with pause_non_critical [execution-dispatch-support]", () => {
  const ticket = { priority: "urgent" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

test("resolveDispatchBackpressureReason returns pause_non_critical for non-elevated priority with pause_non_critical [execution-dispatch-support]", () => {
  const ticket = { priority: "normal" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.pause_non_critical");
});

test("resolveDispatchBackpressureReason returns starvation_protection for low priority with queue_only and starvation [execution-dispatch-support]", () => {
  const ticket = { priority: "low" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: true } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.starvation_protection");
});

test("resolveDispatchBackpressureReason returns queue_only for non-elevated priority with queue_only and no starvation [execution-dispatch-support]", () => {
  const ticket = { priority: "normal" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), "backpressure.queue_only");
});

test("resolveDispatchBackpressureReason returns null for elevated priority with queue_only and no starvation [execution-dispatch-support]", () => {
  const ticket = { priority: "high" as const } as ExecutionTicketRecord;
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot as any), null);
});

// ---------------------------------------------------------------------------
// buildDispatchAgentExecutionRecord
// ---------------------------------------------------------------------------

function createMockStoreForBuildRecord(
  existingAgentRecord?: AgentExecutionRecord | null,
): AuthoritativeTaskStore {
  return {
    worker: {
      getAgentExecutionRecord: () => existingAgentRecord ?? null,
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockExecution(id = "exec-1"): ExecutionRecord {
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

test("buildDispatchAgentExecutionRecord creates new record when no existing record [execution-dispatch-support]", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.executionId, "exec-1");
  assert.equal(record.taskId, "task-1");
  assert.equal(record.agentId, "original-agent-id");
  assert.equal(record.workflowId, "wf-1");
  assert.equal(record.roleId, "role-1");
  assert.equal(record.runKind, "task_run");
  assert.equal(record.runtimeInstanceId, null);
  assert.equal(record.restartGeneration, 0);
  assert.equal(record.toolCallCount, 0);
  assert.equal(record.retryCount, 0);
});

test("buildDispatchAgentExecutionRecord preserves existing values when no updates [execution-dispatch-support]", () => {
  const existingRecord: AgentExecutionRecord = {
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

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.agentId, "existing-agent");
  assert.equal(record.runtimeInstanceId, "runtime-123");
  assert.equal(record.restartGeneration, 2);
  assert.equal(record.toolCallCount, 50);
  assert.equal(record.currentStepId, "step-5");
});

test("buildDispatchAgentExecutionRecord applies status update [execution-dispatch-support]", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1", status: "completed" };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.status, "completed");
});

test("buildDispatchAgentExecutionRecord applies planJson update [execution-dispatch-support]", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1", planJson: '{"new":"plan"}' };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.planJson, '{"new":"plan"}');
});

test("buildDispatchAgentExecutionRecord applies lastDecisionJson update [execution-dispatch-support]", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1", lastDecisionJson: '{"decision":"new"}' };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.lastDecisionJson, '{"decision":"new"}');
});

test("buildDispatchAgentExecutionRecord applies progressMessage update [execution-dispatch-support]", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1", progressMessage: "new progress" };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.progressMessage, "new progress");
});

test("buildDispatchAgentExecutionRecord uses existing startedAt when present [execution-dispatch-support]", () => {
  const existingRecord: AgentExecutionRecord = {
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    workflowId: "wf-1",
    roleId: "role-1",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
  };
  const store = createMockStoreForBuildRecord(existingRecord);
  const execution = createMockExecution();
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.startedAt, "2024-01-01T00:00:00.000Z");
});

test("buildDispatchAgentExecutionRecord sets retryCount from execution attempt [execution-dispatch-support]", () => {
  const store = createMockStoreForBuildRecord(null);
  const execution = createMockExecution();
  execution.attempt = 3;
  const occurredAt = new Date().toISOString();
  const updates = { taskId: "task-1" };

  const record = buildDispatchAgentExecutionRecord(store, execution, occurredAt, updates);

  assert.equal(record.retryCount, 2); // attempt - 1
});
