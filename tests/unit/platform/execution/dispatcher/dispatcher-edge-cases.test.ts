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
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import type { RegisteredWorkerView } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import type { ExecutionStatus } from "../../../../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// normalizeStringArray
// ---------------------------------------------------------------------------

test("normalizeStringArray returns empty array for empty input [dispatcher-edge-cases]", () => {
  const result = normalizeStringArray([]);
  assert.deepStrictEqual(result, []);
});

test("normalizeStringArray trims whitespace and sorts [dispatcher-edge-cases]", () => {
  const result = normalizeStringArray([" banana", "apple ", "  cherry"]);
  assert.deepStrictEqual(result, ["apple", "banana", "cherry"]);
});

test("normalizeStringArray removes duplicates [dispatcher-edge-cases]", () => {
  const result = normalizeStringArray(["a", " b ", "a", "b", "  a  "]);
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("normalizeStringArray removes empty strings [dispatcher-edge-cases]", () => {
  const result = normalizeStringArray(["a", "", "  ", "b"]);
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("normalizeStringArray handles all whitespace strings [dispatcher-edge-cases]", () => {
  const result = normalizeStringArray([" ", "\t", "\n", "a"]);
  assert.deepStrictEqual(result, ["a"]);
});

test("normalizeStringArray returns empty for all empty strings [dispatcher-edge-cases]", () => {
  const result = normalizeStringArray(["", "  ", "\t", "\n"]);
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array [dispatcher-edge-cases]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty for invalid JSON [dispatcher-edge-cases]", () => {
  const result = parseJsonArray("not json");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty for non-array JSON [dispatcher-edge-cases]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray filters non-string elements [dispatcher-edge-cases]", () => {
  const result = parseJsonArray('["a", 1, null, "b", true, "c"]');
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray calls onError callback on parse failure [dispatcher-edge-cases]", () => {
  let errorMessage = "";
  parseJsonArray("invalid", (msg) => { errorMessage = msg; });
  assert.ok(errorMessage.length > 0);
});

test("parseJsonArray does not call onError on valid JSON [dispatcher-edge-cases]", () => {
  let errorCalled = false;
  parseJsonArray('["a"]', () => { errorCalled = true; });
  assert.equal(errorCalled, false);
});

test("parseJsonArray handles empty array [dispatcher-edge-cases]", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles array with empty strings [dispatcher-edge-cases]", () => {
  const result = parseJsonArray('["a", "", "b"]');
  assert.deepStrictEqual(result, ["a", "", "b"]);
});

// ---------------------------------------------------------------------------
// resolveDispatchTarget
// ---------------------------------------------------------------------------

test("resolveDispatchTarget returns local_only for local_only [dispatcher-edge-cases]", () => {
  assert.equal(resolveDispatchTarget("local_only"), "local_only");
});

test("resolveDispatchTarget returns prefer_remote for prefer_remote [dispatcher-edge-cases]", () => {
  assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
});

test("resolveDispatchTarget returns require_remote for require_remote [dispatcher-edge-cases]", () => {
  assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
});

test("resolveDispatchTarget returns any for undefined [dispatcher-edge-cases]", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
});

test("resolveDispatchTarget returns any for null [dispatcher-edge-cases]", () => {
  assert.equal(resolveDispatchTarget(null), "any");
});

test("resolveDispatchTarget returns any for invalid value [dispatcher-edge-cases]", () => {
  assert.equal(resolveDispatchTarget("invalid" as any), "any");
});

// ---------------------------------------------------------------------------
// resolveRequiredIsolationLevel
// ---------------------------------------------------------------------------

test("resolveRequiredIsolationLevel returns hardened for hardened [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
});

test("resolveRequiredIsolationLevel returns strict for strict [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
});

test("resolveRequiredIsolationLevel returns standard for undefined [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel returns standard for null [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
});

test("resolveRequiredIsolationLevel returns standard for invalid value [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredIsolationLevel("invalid" as any), "standard");
});

// ---------------------------------------------------------------------------
// resolveRequiredRepoVersion
// ---------------------------------------------------------------------------

test("resolveRequiredRepoVersion returns trimmed non-empty string [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.0.0  "), "v1.0.0");
});

test("resolveRequiredRepoVersion returns null for undefined [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

test("resolveRequiredRepoVersion returns null for null [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
});

test("resolveRequiredRepoVersion returns null for empty string [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
});

test("resolveRequiredRepoVersion returns null for whitespace only [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for non-string [dispatcher-edge-cases]", () => {
  assert.equal(resolveRequiredRepoVersion(123 as any), null);
});

// ---------------------------------------------------------------------------
// meetsIsolationRequirement
// ---------------------------------------------------------------------------

test("meetsIsolationRequirement standard worker meets standard requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened worker meets standard requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict worker meets standard requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement hardened worker meets hardened requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

test("meetsIsolationRequirement strict worker meets hardened requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement standard worker does not meet hardened requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement standard worker does not meet strict requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("standard", "strict"), false);
});

test("meetsIsolationRequirement hardened worker does not meet strict requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

test("meetsIsolationRequirement strict worker meets strict requirement [dispatcher-edge-cases]", () => {
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

// ---------------------------------------------------------------------------
// isElevatedPriority
// ---------------------------------------------------------------------------

test("isElevatedPriority returns true for high [dispatcher-edge-cases]", () => {
  assert.equal(isElevatedPriority("high"), true);
});

test("isElevatedPriority returns true for urgent [dispatcher-edge-cases]", () => {
  assert.equal(isElevatedPriority("urgent"), true);
});

test("isElevatedPriority returns false for normal [dispatcher-edge-cases]", () => {
  assert.equal(isElevatedPriority("normal"), false);
});

test("isElevatedPriority returns false for low [dispatcher-edge-cases]", () => {
  assert.equal(isElevatedPriority("low"), false);
});

// ---------------------------------------------------------------------------
// isRemoteSessionReadyForDispatch - local placement always ready
// ---------------------------------------------------------------------------

test("isRemoteSessionReadyForDispatch local placement returns true [dispatcher-edge-cases]", () => {
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

test("isRemoteSessionReadyForDispatch remote without connected status returns false [dispatcher-edge-cases]", () => {
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

test("isRemoteSessionReadyForDispatch remote with null session status returns false [dispatcher-edge-cases]", () => {
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
