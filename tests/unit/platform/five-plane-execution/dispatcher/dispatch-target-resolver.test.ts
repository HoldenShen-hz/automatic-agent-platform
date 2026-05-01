import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveDispatchTarget,
  resolveRequiredIsolationLevel,
  resolveRequiredRepoVersion,
  meetsIsolationRequirement,
  selectWorkersForDispatch,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import type { DispatchTarget, WorkerIsolationLevel, RemoteAvailability } from "../../../../../src/platform/contracts/types/domain/index.js";
import type { RegisteredWorkerView } from "../../../../../src/platform/five-plane-execution/worker-pool/worker/worker-registry-service.js";

function makeWorker(overrides: Partial<RegisteredWorkerView> = {}): RegisteredWorkerView {
  return {
    workerId: "w1",
    status: "idle",
    schedulingStatus: "healthy",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    trusted: false,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 4,
    queueAffinity: null,
    availableSlots: 2,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveDispatchTarget
// ---------------------------------------------------------------------------

test("resolveDispatchTarget returns local_only when target is local_only", () => {
  const result = resolveDispatchTarget("local_only");
  assert.equal(result, "local_only");
});

test("resolveDispatchTarget returns prefer_remote when target is prefer_remote", () => {
  const result = resolveDispatchTarget("prefer_remote");
  assert.equal(result, "prefer_remote");
});

test("resolveDispatchTarget returns require_remote when target is require_remote", () => {
  const result = resolveDispatchTarget("require_remote");
  assert.equal(result, "require_remote");
});

test("resolveDispatchTarget returns any for null input", () => {
  const result = resolveDispatchTarget(null);
  assert.equal(result, "any");
});

test("resolveDispatchTarget returns any for undefined input", () => {
  const result = resolveDispatchTarget(undefined);
  assert.equal(result, "any");
});

test("resolveDispatchTarget returns any for unknown target value", () => {
  const result = resolveDispatchTarget("random" as DispatchTarget);
  assert.equal(result, "any");
});

// ---------------------------------------------------------------------------
// resolveRequiredIsolationLevel
// ---------------------------------------------------------------------------

test("resolveRequiredIsolationLevel returns hardened when specified", () => {
  const result = resolveRequiredIsolationLevel("hardened");
  assert.equal(result, "hardened");
});

test("resolveRequiredIsolationLevel returns strict when specified", () => {
  const result = resolveRequiredIsolationLevel("strict");
  assert.equal(result, "strict");
});

test("resolveRequiredIsolationLevel returns standard for null", () => {
  const result = resolveRequiredIsolationLevel(null);
  assert.equal(result, "standard");
});

test("resolveRequiredIsolationLevel returns standard for undefined", () => {
  const result = resolveRequiredIsolationLevel(undefined);
  assert.equal(result, "standard");
});

test("resolveRequiredIsolationLevel returns standard for unknown value", () => {
  const result = resolveRequiredIsolationLevel("unknown" as WorkerIsolationLevel);
  assert.equal(result, "standard");
});

// ---------------------------------------------------------------------------
// resolveRequiredRepoVersion
// ---------------------------------------------------------------------------

test("resolveRequiredRepoVersion returns trimmed value for non-empty string", () => {
  const result = resolveRequiredRepoVersion("  v1.2.3  ");
  assert.equal(result, "v1.2.3");
});

test("resolveRequiredRepoVersion returns null for whitespace-only string", () => {
  const result = resolveRequiredRepoVersion("   ");
  assert.equal(result, null);
});

test("resolveRequiredRepoVersion returns null for empty string", () => {
  const result = resolveRequiredRepoVersion("");
  assert.equal(result, null);
});

test("resolveRequiredRepoVersion returns null for null input", () => {
  const result = resolveRequiredRepoVersion(null);
  assert.equal(result, null);
});

test("resolveRequiredRepoVersion returns null for undefined input", () => {
  const result = resolveRequiredRepoVersion(undefined);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// meetsIsolationRequirement
// ---------------------------------------------------------------------------

test("meetsIsolationRequirement returns true when worker level equals required", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

test("meetsIsolationRequirement returns true when worker level exceeds required", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement returns false when worker level is below required", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
  assert.equal(meetsIsolationRequirement("standard", "strict"), false);
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch - dispatchTarget routing
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch returns all eligible workers when target is any", () => {
  const workers = [makeWorker({ workerId: "w1" }), makeWorker({ workerId: "w2" })];
  const result = selectWorkersForDispatch("any", workers, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.reasonCode, null);
});

test("selectWorkersForDispatch returns all eligible workers when target is local_only", () => {
  const workers = [makeWorker({ workerId: "w1" }), makeWorker({ workerId: "w2" })];
  const result = selectWorkersForDispatch("local_only", workers, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch returns all eligible workers when target is require_remote", () => {
  const workers = [makeWorker({ workerId: "w1" }), makeWorker({ workerId: "w2" })];
  const result = selectWorkersForDispatch("require_remote", workers, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, false);
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch - prefer_remote with remote workers available
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch filters to remote workers when prefer_remote and remote workers exist", () => {
  const remoteWorker = makeWorker({ workerId: "remote-1", placement: "remote" });
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [remoteWorker, localWorker];

  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);

  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "remote-1");
  assert.equal(result.fallbackApplied, false);
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch - prefer_remote fallback to local
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch falls back to local workers when no remote workers available", () => {
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [localWorker];

  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);

  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "local-1");
  assert.equal(result.fallbackApplied, true);
});

test("selectWorkersForDispatch sets reasonCode from remoteTrustReason when falling back", () => {
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [localWorker];

  const result = selectWorkersForDispatch("prefer_remote", workers, null, "remote.untrusted", null, null);

  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "local-1");
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.reasonCode, "remote.untrusted");
});

test("selectWorkersForDispatch sets reasonCode from remoteSessionReason when falling back", () => {
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [localWorker];

  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, "remote.session_unready", null);

  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "local-1");
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.reasonCode, "remote.session_unready");
});

test("selectWorkersForDispatch sets reasonCode from remoteRepoVersionReason when falling back", () => {
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [localWorker];

  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, "remote.repo_version_mismatch");

  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "local-1");
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.reasonCode, "remote.repo_version_mismatch");
});

test("selectWorkersForDispatch uses first available reasonCode when multiple reasons exist", () => {
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [localWorker];

  const result = selectWorkersForDispatch(
    "prefer_remote",
    workers,
    null,
    "remote.untrusted",
    "remote.session_unready",
    "remote.repo_version_mismatch",
  );

  assert.equal(result.reasonCode, "remote.untrusted");
});

test("selectWorkersForDispatch sets reasonCode from remoteAvailability when falling back and no specific reason", () => {
  const localWorker = makeWorker({ workerId: "local-1", placement: "local" });
  const workers = [localWorker];

  const result = selectWorkersForDispatch("prefer_remote", workers, "degraded" as RemoteAvailability, null, null, null);

  assert.equal(result.workers.length, 1);
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.reasonCode, "remote.fallback_local.degraded");
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch - prefer_remote with no local workers
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch returns empty workers and null reasonCode when prefer_remote with no remote and no local", () => {
  const workers: RegisteredWorkerView[] = [];
  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);
  assert.equal(result.workers.length, 0);
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.reasonCode, null);
});

// ---------------------------------------------------------------------------
// Worker selection considers all required constraints (isolation)
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch does not filter by isolation - returns all eligible workers", () => {
  // Note: isolation filtering is handled by meetsIsolationRequirement separately
  // selectWorkersForDispatch filters only by placement for prefer_remote
  const remoteWorker = makeWorker({ workerId: "remote-1", placement: "remote", isolationLevel: "standard" });
  const localWorker = makeWorker({ workerId: "local-1", placement: "local", isolationLevel: "hardened" });
  const workers = [remoteWorker, localWorker];

  const result = selectWorkersForDispatch("any", workers, null, null, null, null);

  // With "any" target, all workers should be returned regardless of isolation
  assert.equal(result.workers.length, 2);
});
