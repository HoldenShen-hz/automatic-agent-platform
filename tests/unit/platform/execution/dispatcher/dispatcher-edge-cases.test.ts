import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStringArray,
  parseJsonArray,
  resolveDispatchTarget,
  resolveRequiredIsolationLevel,
  resolveRequiredRepoVersion,
  meetsIsolationRequirement,
  isElevatedPriority,
  isRemoteSessionReadyForDispatch,
} from "../../../../../src/platform/execution/dispatcher/execution-dispatch-support.js";
import type { RegisteredWorkerView } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import type { ExecutionStatus } from "../../../../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// normalizeStringArray
// ---------------------------------------------------------------------------

test("normalizeStringArray returns empty array for empty input", () => {
  const result = normalizeStringArray([]);
  assert.deepStrictEqual(result, []);
});

test("normalizeStringArray trims whitespace and sorts", () => {
  const result = normalizeStringArray([" banana", "apple ", "  cherry"]);
  assert.deepStrictEqual(result, ["apple", "banana", "cherry"]);
});

test("normalizeStringArray removes duplicates", () => {
  const result = normalizeStringArray(["a", " b ", "a", "b", "  a  "]);
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("normalizeStringArray removes empty strings", () => {
  const result = normalizeStringArray(["a", "", "  ", "b"]);
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("normalizeStringArray handles all whitespace strings", () => {
  const result = normalizeStringArray([" ", "\t", "\n", "a"]);
  assert.deepStrictEqual(result, ["a"]);
});

test("normalizeStringArray returns empty for all empty strings", () => {
  const result = normalizeStringArray(["", "  ", "\t", "\n"]);
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty for invalid JSON", () => {
  const result = parseJsonArray("not json");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty for non-array JSON", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray filters non-string elements", () => {
  const result = parseJsonArray('["a", 1, null, "b", true, "c"]');
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray calls onError callback on parse failure", () => {
  let errorMessage = "";
  parseJsonArray("invalid", (msg) => { errorMessage = msg; });
  assert.ok(errorMessage.length > 0);
});

test("parseJsonArray does not call onError on valid JSON", () => {
  let errorCalled = false;
  parseJsonArray('["a"]', () => { errorCalled = true; });
  assert.equal(errorCalled, false);
});

test("parseJsonArray handles empty array", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles array with empty strings", () => {
  const result = parseJsonArray('["a", "", "b"]');
  assert.deepStrictEqual(result, ["a", "", "b"]);
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

test("resolveDispatchTarget returns any for undefined", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
});

test("resolveDispatchTarget returns any for null", () => {
  assert.equal(resolveDispatchTarget(null), "any");
});

test("resolveDispatchTarget returns any for invalid value", () => {
  assert.equal(resolveDispatchTarget("invalid" as any), "any");
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

test("resolveRequiredIsolationLevel returns standard for undefined", () => {
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel returns standard for null", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
});

test("resolveRequiredIsolationLevel returns standard for invalid value", () => {
  assert.equal(resolveRequiredIsolationLevel("invalid" as any), "standard");
});

// ---------------------------------------------------------------------------
// resolveRequiredRepoVersion
// ---------------------------------------------------------------------------

test("resolveRequiredRepoVersion returns trimmed non-empty string", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.0.0  "), "v1.0.0");
});

test("resolveRequiredRepoVersion returns null for undefined", () => {
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

test("resolveRequiredRepoVersion returns null for null", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
});

test("resolveRequiredRepoVersion returns null for empty string", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
});

test("resolveRequiredRepoVersion returns null for whitespace only", () => {
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for non-string", () => {
  assert.equal(resolveRequiredRepoVersion(123 as any), null);
});

// ---------------------------------------------------------------------------
// meetsIsolationRequirement
// ---------------------------------------------------------------------------

test("meetsIsolationRequirement standard worker meets standard requirement", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened worker meets standard requirement", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict worker meets standard requirement", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement hardened worker meets hardened requirement", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

test("meetsIsolationRequirement strict worker meets hardened requirement", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement standard worker does not meet hardened requirement", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement standard worker does not meet strict requirement", () => {
  assert.equal(meetsIsolationRequirement("standard", "strict"), false);
});

test("meetsIsolationRequirement hardened worker does not meet strict requirement", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

test("meetsIsolationRequirement strict worker meets strict requirement", () => {
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
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

// ---------------------------------------------------------------------------
// isRemoteSessionReadyForDispatch - local placement always ready
// ---------------------------------------------------------------------------

test("isRemoteSessionReadyForDispatch local placement returns true", () => {
  const worker = {
    workerId: "w1",
    placement: "local" as const,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    status: "idle" as const,
    schedulingStatus: "healthy" as const,
    isolationLevel: "standard" as const,
    repoVersion: null,
    trusted: true,
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: null,
    availableSlots: 5,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncCheckedAt: null,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
  } as unknown as RegisteredWorkerView;
  assert.equal(isRemoteSessionReadyForDispatch(worker), true);
});

test("isRemoteSessionReadyForDispatch remote without connected status returns false", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: "connecting" as const,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    status: "idle" as const,
    schedulingStatus: "healthy" as const,
    isolationLevel: "standard" as const,
    repoVersion: null,
    trusted: true,
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: null,
    availableSlots: 5,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncCheckedAt: null,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
  } as unknown as RegisteredWorkerView;
  assert.equal(isRemoteSessionReadyForDispatch(worker), false);
});

test("isRemoteSessionReadyForDispatch remote with null session status returns false", () => {
  const worker = {
    workerId: "w1",
    placement: "remote" as const,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    status: "idle" as const,
    schedulingStatus: "healthy" as const,
    isolationLevel: "standard" as const,
    repoVersion: null,
    trusted: true,
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: null,
    availableSlots: 5,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncCheckedAt: null,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
  } as unknown as RegisteredWorkerView;
  assert.equal(isRemoteSessionReadyForDispatch(worker), false);
});
