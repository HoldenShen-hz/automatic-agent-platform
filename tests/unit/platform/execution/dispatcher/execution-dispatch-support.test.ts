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
} from "../../../../../src/platform/execution/dispatcher/execution-dispatch-support.js";
import type { WorkerPlacement, DispatchWorkerEvaluation, DispatchTarget, WorkerIsolationLevel } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// normalizeStringArray
// ---------------------------------------------------------------------------

test("normalizeStringArray trims whitespace and removes empty strings", () => {
  const result = normalizeStringArray(["  alpha  ", "beta", "  gamma", "delta", "  "]);
  assert.deepStrictEqual(result, ["alpha", "beta", "delta", "gamma"]);
});

test("normalizeStringArray returns sorted unique values", () => {
  const result = normalizeStringArray(["z", "a", "m", "a", "z"]);
  assert.deepStrictEqual(result, ["a", "m", "z"]);
});

test("normalizeStringArray handles empty array", () => {
  const result = normalizeStringArray([]);
  assert.deepStrictEqual(result, []);
});

test("normalizeStringArray handles all empty strings", () => {
  const result = normalizeStringArray(["  ", "", "   "]);
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray filters non-string elements", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray returns empty array for invalid JSON", () => {
  const result = parseJsonArray("not json");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray calls onError callback on parse failure", () => {
  const errors: string[] = [];
  parseJsonArray("invalid", (msg) => errors.push(msg));
  assert.equal(errors.length, 1);
});

test("parseJsonArray handles empty string", () => {
  const result = parseJsonArray("");
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// resolveDispatchTarget
// ---------------------------------------------------------------------------

test("resolveDispatchTarget returns local_only for local_only", () => {
  assert.equal(resolveDispatchTarget("local_only"), "local_only");
});

test("resolveDispatchTarget returns prefer_remote for prefer_remote", () => {
  assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
});

test("resolveDispatchTarget returns require_remote for require_remote", () => {
  assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
});

test("resolveDispatchTarget defaults to any for unknown values", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
  assert.equal(resolveDispatchTarget(null), "any");
  assert.equal(resolveDispatchTarget("any" as DispatchTarget), "any");
});

// ---------------------------------------------------------------------------
// resolveRequiredIsolationLevel
// ---------------------------------------------------------------------------

test("resolveRequiredIsolationLevel returns hardened for hardened", () => {
  assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
});

test("resolveRequiredIsolationLevel returns strict for strict", () => {
  assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
});

test("resolveRequiredIsolationLevel defaults to standard for null/undefined", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel defaults to standard for unknown values", () => {
  assert.equal(resolveRequiredIsolationLevel("standard"), "standard");
});

// ---------------------------------------------------------------------------
// resolveRequiredRepoVersion
// ---------------------------------------------------------------------------

test("resolveRequiredRepoVersion returns trimmed non-empty string", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.0.0  "), "v1.0.0");
});

test("resolveRequiredRepoVersion returns null for empty string", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for non-string", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

// ---------------------------------------------------------------------------
// meetsIsolationRequirement
// ---------------------------------------------------------------------------

test("meetsIsolationRequirement standard >= standard", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened >= standard", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict >= standard", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement standard !>= hardened", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement hardened >= hardened", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

test("meetsIsolationRequirement strict >= hardened", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement hardened !>= strict", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

// ---------------------------------------------------------------------------
// resolveRemoteAvailability
// ---------------------------------------------------------------------------

function makeEvaluation(placement: WorkerPlacement, accepted: boolean, rejectionReason: DispatchWorkerEvaluation["rejectionReason"] = null): DispatchWorkerEvaluation {
  return {
    workerId: "w1",
    status: "idle",
    schedulingStatus: "idle",
    placement,
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "consistent",
    workspaceSyncStatus: "synced",
    queueAffinity: null,
    availableSlots: 1,
    accepted,
    rejectionReason,
    missingCapabilities: [],
  };
}

test("resolveRemoteAvailability returns null for non-remote dispatch targets", () => {
  const evaluations = [makeEvaluation("local", true)];
  assert.equal(resolveRemoteAvailability("any", evaluations), null);
  assert.equal(resolveRemoteAvailability("local_only", evaluations), null);
});

test("resolveRemoteAvailability returns unavailable when no remote evaluations", () => {
  const evaluations = [makeEvaluation("local", true)];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
  assert.equal(resolveRemoteAvailability("require_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability returns healthy when all remote accepted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", true),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "healthy");
});

test("resolveRemoteAvailability returns partial_available when some remote accepted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_degraded_filtered"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "partial_available");
});

test("resolveRemoteAvailability returns degraded when any degraded rejection", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_degraded_filtered"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "degraded");
});

test("resolveRemoteAvailability returns unavailable when all rejected with untrusted", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_untrusted"),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

test("resolveRemoteAvailability skips placement_mismatch rejections", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_placement_mismatch"),
  ];
  assert.equal(resolveRemoteAvailability("prefer_remote", evaluations), "unavailable");
});

// ---------------------------------------------------------------------------
// resolveRemoteRepoVersionReason
// ---------------------------------------------------------------------------

test("resolveRemoteRepoVersionReason returns null when no required version", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, null), null);
});

test("resolveRemoteRepoVersionReason returns null when not prefer/require remote", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteRepoVersionReason("any", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when some accepted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns null when not all repo_version_mismatch", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
    makeEvaluation("remote", false, "worker_unavailable"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v1"), null);
});

test("resolveRemoteRepoVersionReason returns remote.repo_version_mismatch for require_remote", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("require_remote", evaluations, "v1"), "remote.repo_version_mismatch");
});

test("resolveRemoteRepoVersionReason returns remote.fallback_local.repo_version_mismatch for prefer_remote", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
    makeEvaluation("remote", false, "worker_repo_version_mismatch"),
  ];
  assert.equal(resolveRemoteRepoVersionReason("prefer_remote", evaluations, "v1"), "remote.fallback_local.repo_version_mismatch");
});

// ---------------------------------------------------------------------------
// resolveRemoteSessionReason
// ---------------------------------------------------------------------------

test("resolveRemoteSessionReason returns null when not prefer/require remote", () => {
  const evaluations = [makeEvaluation("remote", true)];
  assert.equal(resolveRemoteSessionReason("any", evaluations), null);
});

test("resolveRemoteSessionReason returns null when some accepted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("prefer_remote", evaluations), null);
});

test("resolveRemoteSessionReason returns remote.session_unready for require_remote", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_remote_session_unready"),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("require_remote", evaluations), "remote.session_unready");
});

test("resolveRemoteSessionReason returns remote.fallback_local.session_unready for prefer_remote", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_remote_session_unready"),
    makeEvaluation("remote", false, "worker_remote_session_unready"),
  ];
  assert.equal(resolveRemoteSessionReason("prefer_remote", evaluations), "remote.fallback_local.session_unready");
});

// ---------------------------------------------------------------------------
// resolveRemoteTrustReason
// ---------------------------------------------------------------------------

test("resolveRemoteTrustReason returns null for non-remote dispatch targets", () => {
  const evaluations = [makeEvaluation("remote", false, "worker_untrusted")];
  assert.equal(resolveRemoteTrustReason("any", evaluations), null);
});

test("resolveRemoteTrustReason returns null when some accepted", () => {
  const evaluations = [
    makeEvaluation("remote", true),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("prefer_remote", evaluations), null);
});

test("resolveRemoteTrustReason returns remote.untrusted for require_remote", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_untrusted"),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("require_remote", evaluations), "remote.untrusted");
});

test("resolveRemoteTrustReason returns remote.fallback_local.untrusted for prefer_remote", () => {
  const evaluations = [
    makeEvaluation("remote", false, "worker_untrusted"),
    makeEvaluation("remote", false, "worker_untrusted"),
  ];
  assert.equal(resolveRemoteTrustReason("prefer_remote", evaluations), "remote.fallback_local.untrusted");
});

// ---------------------------------------------------------------------------
// selectWorkersForDispatch
// ---------------------------------------------------------------------------

test("selectWorkersForDispatch returns all workers for non-prefer_remote", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("any", workers as any, null, null, null, null);
  assert.deepStrictEqual(result.workers, workers);
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch returns remote workers when available for prefer_remote", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "remote" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 1);
  assert.equal(result.workers[0]!.workerId, "w2");
  assert.equal(result.fallbackApplied, false);
});

test("selectWorkersForDispatch falls back to local when no remote workers for prefer_remote", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
    { workerId: "w2", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, null, null);
  assert.equal(result.workers.length, 2);
  assert.equal(result.fallbackApplied, true);
});

test("selectWorkersForDispatch uses remoteTrustReason when provided", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, "remote.untrusted", null, null);
  assert.equal(result.reasonCode, "remote.untrusted");
});

test("selectWorkersForDispatch uses remoteSessionReason when trust reason not available", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, null, null, "remote.session_unready", null);
  assert.equal(result.reasonCode, "remote.session_unready");
});

test("selectWorkersForDispatch uses remoteAvailability when no specific reason", () => {
  const workers = [
    { workerId: "w1", placement: "local" as const },
  ];
  const result = selectWorkersForDispatch("prefer_remote", workers as any, "degraded", null, null, null);
  assert.equal(result.reasonCode, "remote.fallback_local.degraded");
});

test("selectWorkersForDispatch returns null reasonCode when no local workers", () => {
  const workers: any[] = [];
  const result = selectWorkersForDispatch("prefer_remote", workers, null, null, null, null);
  assert.equal(result.workers.length, 0);
  assert.equal(result.reasonCode, null);
  assert.equal(result.fallbackApplied, false);
});

// ---------------------------------------------------------------------------
// isElevatedPriority
// ---------------------------------------------------------------------------

test("isElevatedPriority returns true for high", () => {
  assert.equal(isElevatedPriority("high"), true);
});

test("isElevatedPriority returns true for urgent", () => {
  assert.equal(isElevatedPriority("urgent"), true);
});

test("isElevatedPriority returns false for normal", () => {
  assert.equal(isElevatedPriority("normal"), false);
});

test("isElevatedPriority returns false for low", () => {
  assert.equal(isElevatedPriority("low"), false);
});