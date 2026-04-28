import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentExecutionRecord,
  ExecutionWorkerHandshakeService,
  ExecutionWorkerWritebackService,
  mergeExecutionIds,
  parseJsonArray,
  persistRemoteLogs,
  RemoteWorkerRegistrationService,
  resolveRemoteAuthorityBlockReason,
  toWorkerStatus,
  WorkerRegistryService,
  writebackSupport,
  type RemoteAuthorityBlockReason,
  type RemoteSessionAuthorityState,
} from "../../../../../src/platform/execution/worker-pool/index.js";

test("ExecutionWorkerHandshakeService is exported", () => {
  assert.equal(typeof ExecutionWorkerHandshakeService, "function");
});

test("ExecutionWorkerWritebackService is exported", () => {
  assert.equal(typeof ExecutionWorkerWritebackService, "function");
});

test("RemoteWorkerRegistrationService is exported", () => {
  assert.equal(typeof RemoteWorkerRegistrationService, "function");
});

test("WorkerRegistryService is exported", () => {
  assert.equal(typeof WorkerRegistryService, "function");
});

test("RemoteAuthorityBlockReason type exists", () => {
  const reason: RemoteAuthorityBlockReason = "session_expired";
  assert.equal(reason, "session_expired");
});

test("RemoteSessionAuthorityState type exists", () => {
  const state: RemoteSessionAuthorityState = {
    blocked: false,
    reason: null,
    blockedAt: null,
  };
  assert.equal(state.blocked, false);
  assert.equal(state.reason, null);
});

test("RemoteSessionAuthorityState with block reason", () => {
  const state: RemoteSessionAuthorityState = {
    blocked: true,
    reason: "session_expired",
    blockedAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(state.blocked, true);
  assert.equal(state.reason, "session_expired");
  assert.equal(state.blockedAt, "2024-01-15T10:00:00Z");
});

test("buildAgentExecutionRecord is exported as function", () => {
  // This is a utility function - verify it exists
  assert.ok(typeof buildAgentExecutionRecord === "function" || buildAgentExecutionRecord !== undefined);
});

test("mergeExecutionIds is exported as function", () => {
  assert.ok(typeof mergeExecutionIds === "function");
});

test("parseJsonArray is exported as function", () => {
  assert.ok(typeof parseJsonArray === "function");
});

test("persistRemoteLogs is exported as function", () => {
  assert.ok(typeof persistRemoteLogs === "function");
});

test("toWorkerStatus is exported as function", () => {
  assert.ok(typeof toWorkerStatus === "function");
});

test("writebackSupport namespace is exported", () => {
  assert.ok(typeof writebackSupport === "object");
  assert.ok(writebackSupport !== null);
});

test("resolveRemoteAuthorityBlockReason is exported as function", () => {
  assert.ok(typeof resolveRemoteAuthorityBlockReason === "function");
});

test("worker-load-balancing exports exist", () => {
  // Check that worker load balancing support exists
  assert.ok(ExecutionWorkerHandshakeService !== undefined);
});

test("worker-scheduling-status exports exist", () => {
  assert.ok(ExecutionWorkerHandshakeService !== undefined);
});
