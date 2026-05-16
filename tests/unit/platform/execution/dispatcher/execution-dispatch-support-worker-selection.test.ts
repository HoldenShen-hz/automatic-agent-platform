import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRemoteAvailability,
  resolveRemoteRepoVersionReason,
  resolveRemoteSessionReason,
  resolveRemoteTrustReason,
  selectWorkersForDispatch,
  toWorkerEvaluation,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import type { DispatchWorkerEvaluation, WorkerIsolationLevel, WorkerPlacement } from "../../../../../src/platform/contracts/types/domain.js";

function makeEvaluation(
  placement: WorkerPlacement,
  accepted: boolean,
  rejectionReason: DispatchWorkerEvaluation["rejectionReason"] = null,
): DispatchWorkerEvaluation {
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

function createMockWorkerView(overrides: Partial<{
  workerId: string;
  status: string;
  schedulingStatus: string;
  placement: WorkerPlacement;
  isolationLevel: WorkerIsolationLevel;
  repoVersion: string | null;
  remoteSessionStatus: string | null;
  lastAcknowledgedStreamOffset: string | null;
  sessionConsistencyCheckStatus: string | null;
  workspaceSyncStatus: string | null;
  queueAffinity: string | null;
  availableSlots: number;
}> = {}): any {
  return {
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
    ...overrides,
  };
}

test("toWorkerEvaluation creates evaluation with all worker fields", () => {
  const worker = createMockWorkerView({
    workerId: "worker-42",
    status: "busy",
    schedulingStatus: "degraded",
    placement: "remote",
    isolationLevel: "hardened",
    repoVersion: "v2.0",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "500",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
    queueAffinity: "queue-a",
    availableSlots: 2,
  });
  const evaluation = toWorkerEvaluation(worker, true, null, []);
  assert.equal(evaluation.workerId, "worker-42");
  assert.equal(evaluation.status, "busy");
  assert.equal(evaluation.schedulingStatus, "degraded");
  assert.equal(evaluation.placement, "remote");
  assert.equal(evaluation.isolationLevel, "hardened");
  assert.equal(evaluation.repoVersion, "v2.0");
  assert.equal(evaluation.remoteSessionStatus, "connected");
  assert.equal(evaluation.lastAcknowledgedStreamOffset, "500");
  assert.equal(evaluation.sessionConsistencyCheckStatus, "passed");
  assert.equal(evaluation.workspaceSyncStatus, "aligned");
  assert.equal(evaluation.queueAffinity, "queue-a");
  assert.equal(evaluation.availableSlots, 2);
  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.rejectionReason, null);
  assert.deepStrictEqual(evaluation.missingCapabilities, []);
});

test("toWorkerEvaluation with accepted false and rejection reason", () => {
  const worker = createMockWorkerView();
  const evaluation = toWorkerEvaluation(worker, false, "worker_capacity_full", ["gpu"]);
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.rejectionReason, "worker_capacity_full");
  assert.deepStrictEqual(evaluation.missingCapabilities, ["gpu"]);
});

test("toWorkerEvaluation includes missing capabilities", () => {
  const worker = createMockWorkerView();
  const evaluation = toWorkerEvaluation(worker, false, null, ["gpu", "large_memory"]);
  assert.deepStrictEqual(evaluation.missingCapabilities, ["gpu", "large_memory"]);
});

test("toWorkerEvaluation with null rejection reason for accepted worker", () => {
  const worker = createMockWorkerView();
  const evaluation = toWorkerEvaluation(worker, true, null, []);
  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.rejectionReason, null);
});

test("selectWorkersForDispatch prefer_remote with mixed local and remote workers", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
    { workerId: "w3", placement: "local" as const },
    { workerId: "w4", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.ok(result.workers.every((worker) => worker.placement === "remote"));
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch prefer_remote falls back to local when remote unavailable with reason", () => {
  const workers = [{ workerId: "w1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "unavailable", null, null, null);
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.reasonCode, "remote.fallback_local.unavailable");
});

test("selectWorkersForDispatch prefer_remote prefers trust reason over availability reason", () => {
  const workers = [{ workerId: "w1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "degraded", "remote.untrusted", null, null);
  assert.equal(result.reasonCode, "remote.untrusted");
});

test("selectWorkersForDispatch prefer_remote prefers session reason over repo version reason", () => {
  const workers = [{ workerId: "w1", placement: "local" as const }];
  const result = selectWorkersForDispatch(
    "prefer_remote",
    workers as any,
    "degraded",
    null,
    "remote.session_unready",
    "remote.repo_version_mismatch",
  );
  assert.equal(result.reasonCode, "remote.session_unready");
});

test("selectWorkersForDispatch prefer_remote uses repo version reason as fallback", () => {
  const workers = [{ workerId: "w1", placement: "local" as const }];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "degraded", null, null, "remote.repo_version_mismatch");
  assert.equal(result.reasonCode, "remote.repo_version_mismatch");
});

test("selectWorkersForDispatch require_remote returns all workers unchanged", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("require_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.reasonCode, null);
});

test("selectWorkersForDispatch local_only returns all workers unchanged", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
    { workerId: "w3", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("local_only", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 3);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch any returns all workers regardless of placement", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("any", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
});

test("resolveRemoteAvailability returns partial_available when reasons vary and not degraded", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_unavailable"),
    makeEvaluation("remote", false, "worker_capacity_full"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "partial_available");
});

test("resolveRemoteAvailability returns null for any target", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteAvailability("any", evaluations), null);
});

test("resolveRemoteAvailability returns null for local_only target", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteAvailability("local_only", evaluations), null);
});

test("resolveRemoteAvailability handles empty evaluations for prefer_remote", () => {
  const evaluations: ReturnType<typeof makeEvaluation>[] = [];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability handles empty evaluations for require_remote", () => {
  const evaluations: ReturnType<typeof makeEvaluation>[] = [];
  assert.equal(resolveRemoteAvailability("require_remote", evaluations), "unavailable");
});

test("resolveRemoteRepoVersionReason returns null when required version matches", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when dispatch target is any", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_repo_version_mismatch")];
  assert.equal(resolveRemoteRepoVersionReason("any", evaluations, "v1"), null);
});

test("resolveRemoteSessionReason returns null when session is ready", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteSessionReason("require_remote", evaluations), null);
});

test("resolveRemoteSessionReason returns null when dispatch target is local_only", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_remote_session_unready")];
  assert.equal(resolveRemoteSessionReason("local_only", evaluations), null);
});

test("resolveRemoteTrustReason returns null when worker is trusted", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteTrustReason("require_remote", evaluations), null);
});

test("resolveRemoteTrustReason returns null when dispatch target is any", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_untrusted")];
  assert.equal(resolveRemoteTrustReason("any", evaluations), null);
});
