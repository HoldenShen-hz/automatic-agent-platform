import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRemoteAvailability,
  resolveRemoteRepoVersionReason,
  resolveRemoteSessionReason,
  resolveRemoteTrustReason,
  selectWorkersForDispatch,
  toWorkerEvaluation,
  resolveDispatchBackpressureReason,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import type {
  DispatchWorkerEvaluation,
  DispatchTarget,
  ExecutionTicketRecord,
} from "../../../../../src/platform/contracts/types/domain.js";

function makeEvaluation(overrides: Partial<DispatchWorkerEvaluation> = {}): DispatchWorkerEvaluation {
  return {
    workerId: "worker-1",
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
    availableSlots: 5,
    accepted: true,
    rejectionReason: null,
    missingCapabilities: [],
    ...overrides,
  };
}

function makeTicket(overrides: Partial<ExecutionTicketRecord> = {}): ExecutionTicketRecord {
  return {
    id: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveRemoteAvailability
// ---------------------------------------------------------------------------

test("resolveRemoteAvailability returns null for any dispatch target", () => {
  const evaluations = [makeEvaluation({ placement: "remote" })];
  assert.equal(resolveRemoteAvailability("any", evaluations), null);
});

test("resolveRemoteAvailability returns unavailable when no remote workers", () => {
  const evaluations = [makeEvaluation({ placement: "local" })];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
  assert.equal(resolveRemoteAvailability("require_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability returns healthy when all remote workers accepted", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: true }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: true }),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "healthy");
});

test("resolveRemoteAvailability returns partial_available when some remote workers rejected", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: true }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_degraded_filtered" }),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "partial_available");
});

test("resolveRemoteAvailability returns degraded when all rejected with degradation reasons", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_degraded_filtered" }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_untrusted" }),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "degraded");
});

test("resolveRemoteAvailability returns unavailable when all workers are administrative non-ready states", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_unavailable" }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_draining" }),
    makeEvaluation({ placement: "remote", workerId: "r3", accepted: false, rejectionReason: "worker_offline" }),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability filters out placement_mismatch workers", () => {
  const evaluations = [
    makeEvaluation({ placement: "local", workerId: "l1", accepted: false, rejectionReason: "worker_placement_mismatch" }),
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: true }),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "healthy");
});

// ---------------------------------------------------------------------------
// resolveRemoteRepoVersionReason
// ---------------------------------------------------------------------------

test("resolveRemoteRepoVersionReason returns null when no required version", () => {
  const evaluations = [makeEvaluation({ placement: "remote" })];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, null), null);
});

test("resolveRemoteRepoVersionReason returns null when some worker accepted", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: true }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_repo_version_mismatch" }),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v2.0"), null);
});

test("resolveRemoteRepoVersionReason returns null when not prefer_remote/require_remote", () => {
  const evaluations = [makeEvaluation({ placement: "remote" })];
  assert.equal(resolveRemoteRepoVersionReason("any", evaluations, "v2.0"), null);
});

test("resolveRemoteRepoVersionReason returns repo_version_mismatch for prefer_remote", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_repo_version_mismatch" }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_repo_version_mismatch" }),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v2.0"), "remote.fallback_local.repo_version_mismatch");
});

test("resolveRemoteRepoVersionReason returns repo_version_mismatch for require_remote", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_repo_version_mismatch" }),
  ];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, "v2.0"), "remote.repo_version_mismatch");
});

// ---------------------------------------------------------------------------
// resolveRemoteSessionReason
// ---------------------------------------------------------------------------

test("resolveRemoteSessionReason returns null when not remote dispatch target", () => {
  const evaluations = [makeEvaluation({ placement: "remote" })];
  assert.equal(resolveRemoteSessionReason("any", evaluations), null);
});

test("resolveRemoteSessionReason returns null when some worker accepted", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: true }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_remote_session_unready" }),
  ];
  assert.equal(resolveRemoteSessionReason("prefer_remote", evaluations), null);
});

test("resolveRemoteSessionReason returns session_unready for prefer_remote", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_remote_session_unready" }),
  ];
  assert.equal(resolveRemoteSessionReason("prefer_remote", evaluations), "remote.fallback_local.session_unready");
});

test("resolveRemoteSessionReason returns session_unready for require_remote", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_remote_session_unready" }),
  ];
  assert.equal(resolveRemoteSessionReason("require_remote", evaluations), "remote.session_unready");
});

// ---------------------------------------------------------------------------
// resolveRemoteTrustReason
// ---------------------------------------------------------------------------

test("resolveRemoteTrustReason returns null for any dispatch target", () => {
  const evaluations = [makeEvaluation({ placement: "remote" })];
  assert.equal(resolveRemoteTrustReason("any", evaluations), null);
});

test("resolveRemoteTrustReason returns null when some worker accepted", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: true }),
    makeEvaluation({ placement: "remote", workerId: "r2", accepted: false, rejectionReason: "worker_untrusted" }),
  ];
  assert.equal(resolveRemoteTrustReason("prefer_remote", evaluations), null);
});

test("resolveRemoteTrustReason returns untrusted for prefer_remote", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_untrusted" }),
  ];
  assert.equal(resolveRemoteTrustReason("prefer_remote", evaluations), "remote.fallback_local.untrusted");
});

test("resolveRemoteTrustReason returns untrusted for require_remote", () => {
  const evaluations = [
    makeEvaluation({ placement: "remote", workerId: "r1", accepted: false, rejectionReason: "worker_untrusted" }),
  ];
  assert.equal(resolveRemoteTrustReason("require_remote", evaluations), "remote.untrusted");
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch returns eligible workers for non-prefer_remote target", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const, availableSlots: 5 },
    { workerId: "w2", placement: "remote" as const, availableSlots: 5 },
  ] as any[];
  const result = selectWorkersForDispatch("any", workers, null, null, null, null);
  assert.deepEqual(result.workers, workers);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch filters to remote workers for prefer_remote", () => {
  const workers = [
    { workerId: "local-1", placement: "local" as const, availableSlots: 5 },
    { workerId: "remote-1", placement: "remote" as const, availableSlots: 5 },
  ] as any[];
  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);
  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0].workerId, "remote-1");
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch falls back to local when no remote workers", () => {
  const workers = [
    { workerId: "local-1", placement: "local" as const, availableSlots: 5 },
  ] as any[];
  const result = selectWorkersForDispatch("prefer_remote", workers, "unavailable", null, null, null);
  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0].workerId, "local-1");
  assert.equal(result.fallbackApplied, true);
  assert.ok(result.reasonCode?.startsWith("remote.fallback_local."));
});

test("selectWorkersForDispatch returns empty when no local workers for fallback", () => {
  const workers = [] as any[];
  const result = selectWorkersForDispatch("prefer_remote", workers, "unavailable", null, null, null);
  assert.equal(result.workers.length, 0);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch uses trust reason when provided", () => {
  const workers = [{ workerId: "local-1", placement: "local" as const, availableSlots: 5 }] as any[];
  const result = selectWorkersForDispatch("prefer_remote", workers, "degraded", "remote.untrusted", null, null);
  assert.equal(result.reasonCode, "remote.untrusted");
});

// ---------------------------------------------------------------------------
// toWorkerEvaluation
// ---------------------------------------------------------------------------

test("toWorkerEvaluation creates evaluation from worker view", () => {
  const worker = {
    workerId: "worker-1",
    status: "idle",
    schedulingStatus: "healthy" as const,
    placement: "local" as const,
    isolationLevel: "standard" as const,
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    queueAffinity: null,
    availableSlots: 5,
  };
  const evaluation = toWorkerEvaluation(worker, true, null, []);
  assert.equal(evaluation.workerId, "worker-1");
  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.placement, "local");
});

test("toWorkerEvaluation includes missing capabilities", () => {
  const worker = {
    workerId: "worker-1",
    status: "idle",
    schedulingStatus: "healthy" as const,
    placement: "local" as const,
    isolationLevel: "standard" as const,
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    queueAffinity: null,
    availableSlots: 5,
  };
  const evaluation = toWorkerEvaluation(worker, false, "worker_capability_mismatch", ["gpu", "large_memory"]);
  assert.deepEqual(evaluation.missingCapabilities, ["gpu", "large_memory"]);
  assert.equal(evaluation.rejectionReason, "worker_capability_mismatch");
});

// ---------------------------------------------------------------------------
// resolveDispatchBackpressureReason
// ---------------------------------------------------------------------------

test("resolveDispatchBackpressureReason returns null when no snapshot", () => {
  const ticket = makeTicket();
  assert.equal(resolveDispatchBackpressureReason(ticket, null), null);
});

test("resolveDispatchBackpressureReason returns read_only_mode reason", () => {
  const ticket = makeTicket({ priority: "low" });
  const snapshot = { degradationMode: "read_only_operations_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot), "backpressure.read_only_mode");
});

test("resolveDispatchBackpressureReason returns pause_non_critical for non-elevated priority", () => {
  const ticket = makeTicket({ priority: "low" });
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot), "backpressure.pause_non_critical");
});

test("resolveDispatchBackpressureReason returns null for elevated priority with pause_non_critical", () => {
  const ticket = makeTicket({ priority: "high" });
  const snapshot = { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot), null);
});

test("resolveDispatchBackpressureReason returns starvation_protection for low priority", () => {
  const ticket = makeTicket({ priority: "low" });
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: true } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot), "backpressure.starvation_protection");
});

test("resolveDispatchBackpressureReason returns queue_only for non-elevated priority", () => {
  const ticket = makeTicket({ priority: "normal" });
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot), "backpressure.queue_only");
});

test("resolveDispatchBackpressureReason returns null for elevated priority with queue_only", () => {
  const ticket = makeTicket({ priority: "urgent" });
  const snapshot = { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } };
  assert.equal(resolveDispatchBackpressureReason(ticket, snapshot), null);
});