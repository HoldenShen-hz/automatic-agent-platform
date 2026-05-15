import assert from "node:assert/strict";
import test from "node:test";

import {
  loadDispatchReconcileCliEnv,
  loadLeaseHandoverCliEnv,
  loadEventOpsCliEnv,
  loadOrphanCleanupCliEnv,
  loadReplayRecoveryCliEnv,
  loadProfileHomeCliEnv,
  loadAuthoritativeStorageAdminCliEnv,
} from "../../../../../src/platform/five-plane-control-plane/config-center/ops-cli-env.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("loadDispatchReconcileCliEnv defaults to scan action", () => {
  const result = loadDispatchReconcileCliEnv({});
  assert.equal(result.action, "scan");
  assert.equal(result.occurredAt, null);
});

test("loadDispatchReconcileCliEnv accepts scan action", () => {
  const result = loadDispatchReconcileCliEnv({ AA_DISPATCH_RECONCILE_ACTION: "scan" });
  assert.equal(result.action, "scan");
});

test("loadDispatchReconcileCliEnv accepts repair action", () => {
  const result = loadDispatchReconcileCliEnv({ AA_DISPATCH_RECONCILE_ACTION: "repair" });
  assert.equal(result.action, "repair");
});

test("loadDispatchReconcileCliEnv throws on invalid action", () => {
  assert.throws(
    () => loadDispatchReconcileCliEnv({ AA_DISPATCH_RECONCILE_ACTION: "invalid" }),
    (err: unknown) => err instanceof ValidationError && err.code === "dispatch_reconcile.invalid_action"
  );
});

test("loadDispatchReconcileCliEnv parses occurredAt", () => {
  const result = loadDispatchReconcileCliEnv({ AA_OCCURRED_AT: "2024-01-01T00:00:00.000Z" });
  assert.equal(result.occurredAt, "2024-01-01T00:00:00.000Z");
});

test("loadLeaseHandoverCliEnv throws on missing required env vars", () => {
  assert.throws(
    () => loadLeaseHandoverCliEnv({}),
    (err: unknown) => err instanceof ValidationError && err.code === "missing_env:AA_LEASE_ID"
  );
});

test("loadLeaseHandoverCliEnv parses required fields", () => {
  const result = loadLeaseHandoverCliEnv({
    AA_LEASE_ID: "lease_123",
    AA_WORKER_ID: "worker_456",
    AA_NEW_WORKER_ID: "worker_789",
  });
  assert.equal(result.leaseId, "lease_123");
  assert.equal(result.workerId, "worker_456");
  assert.equal(result.newWorkerId, "worker_789");
  assert.equal(result.ttlMs, 30000); // default
});

test("loadLeaseHandoverCliEnv parses ttlMs", () => {
  const result = loadLeaseHandoverCliEnv({
    AA_LEASE_ID: "lease_123",
    AA_WORKER_ID: "worker_456",
    AA_NEW_WORKER_ID: "worker_789",
    AA_LEASE_TTL_MS: "60000",
  });
  assert.equal(result.ttlMs, 60000);
});

test("loadLeaseHandoverCliEnv throws on invalid ttlMs", () => {
  assert.throws(
    () => loadLeaseHandoverCliEnv({
      AA_LEASE_ID: "lease_123",
      AA_WORKER_ID: "worker_456",
      AA_NEW_WORKER_ID: "worker_789",
      AA_LEASE_TTL_MS: "invalid",
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "invalid_integer_env:AA_LEASE_TTL_MS"
  );
});

test("loadLeaseHandoverCliEnv throws on negative ttlMs", () => {
  assert.throws(
    () => loadLeaseHandoverCliEnv({
      AA_LEASE_ID: "lease_123",
      AA_WORKER_ID: "worker_456",
      AA_NEW_WORKER_ID: "worker_789",
      AA_LEASE_TTL_MS: "-1",
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "invalid_integer_env:AA_LEASE_TTL_MS"
  );
});

test("loadLeaseHandoverCliEnv parses optional fields", () => {
  const result = loadLeaseHandoverCliEnv({
    AA_LEASE_ID: "lease_123",
    AA_WORKER_ID: "worker_456",
    AA_NEW_WORKER_ID: "worker_789",
    AA_REASON_CODE: "worker_unavailable",
    AA_OCCURRED_AT: "2024-01-01T00:00:00.000Z",
  });
  assert.equal(result.reasonCode, "worker_unavailable");
  assert.equal(result.occurredAt, "2024-01-01T00:00:00.000Z");
});

test("loadEventOpsCliEnv resolves dbPath", () => {
  const result = loadEventOpsCliEnv({});
  assert.ok(result.dbPath.includes("sqlite"));
});

test("loadEventOpsCliEnv uses AA_DB_PATH when set", () => {
  const result = loadEventOpsCliEnv({ AA_DB_PATH: "/custom/path/test.db" });
  assert.equal(result.dbPath, "/custom/path/test.db");
});

test("loadEventOpsCliEnv parses consumerId", () => {
  const result = loadEventOpsCliEnv({ AA_EVENT_CONSUMER_ID: "consumer_123" });
  assert.equal(result.consumerId, "consumer_123");
});

test("loadOrphanCleanupCliEnv defaults to scan action", () => {
  const result = loadOrphanCleanupCliEnv({});
  assert.equal(result.action, "scan");
});

test("loadOrphanCleanupCliEnv accepts repair action", () => {
  const result = loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "repair" });
  assert.equal(result.action, "repair");
});

test("loadOrphanCleanupCliEnv throws on invalid action", () => {
  assert.throws(
    () => loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "invalid" }),
    (err: unknown) => err instanceof ValidationError && err.code === "orphan_cleanup.invalid_action"
  );
});

test("loadReplayRecoveryCliEnv throws on missing kind", () => {
  assert.throws(
    () => loadReplayRecoveryCliEnv({}),
    (err: unknown) => err instanceof ValidationError && err.code === "missing_env:AA_RECOVERY_REPLAY_KIND"
  );
});

test("loadReplayRecoveryCliEnv accepts task kind", () => {
  const result = loadReplayRecoveryCliEnv({
    AA_RECOVERY_REPLAY_KIND: "task",
  });
  assert.equal(result.kind, "task");
});

test("loadReplayRecoveryCliEnv accepts execution kind", () => {
  const result = loadReplayRecoveryCliEnv({
    AA_RECOVERY_REPLAY_KIND: "execution",
  });
  assert.equal(result.kind, "execution");
});

test("loadReplayRecoveryCliEnv throws on invalid kind", () => {
  assert.throws(
    () => loadReplayRecoveryCliEnv({ AA_RECOVERY_REPLAY_KIND: "invalid" }),
    (err: unknown) => err instanceof ValidationError && err.code === "replay_recovery.invalid_kind"
  );
});

test("loadReplayRecoveryCliEnv parses optional ids", () => {
  const result = loadReplayRecoveryCliEnv({
    AA_RECOVERY_REPLAY_KIND: "task",
    AA_TASK_ID: "task_123",
    AA_EXECUTION_ID: "exec_456",
  });
  assert.equal(result.taskId, "task_123");
  assert.equal(result.executionId, "exec_456");
});

test("loadProfileHomeCliEnv defaults create to false", () => {
  const result = loadProfileHomeCliEnv({});
  assert.equal(result.create, false);
});

test("loadProfileHomeCliEnv parses create flag", () => {
  const result = loadProfileHomeCliEnv({ AA_PROFILE_HOME_CREATE: "1" });
  assert.equal(result.create, true);
});

test("loadAuthoritativeStorageAdminCliEnv defaults to summary action", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({});
  assert.equal(result.action, "summary");
});

test("loadAuthoritativeStorageAdminCliEnv accepts migrate action", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "migrate" });
  assert.equal(result.action, "migrate");
});

test("loadAuthoritativeStorageAdminCliEnv accepts plan action", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "plan" });
  assert.equal(result.action, "plan");
});

test("loadAuthoritativeStorageAdminCliEnv accepts status action", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "status" });
  assert.equal(result.action, "status");
});

test("loadAuthoritativeStorageAdminCliEnv accepts up action", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "up" });
  assert.equal(result.action, "up");
});

test("loadAuthoritativeStorageAdminCliEnv accepts down action", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "down" });
  assert.equal(result.action, "down");
});

test("loadAuthoritativeStorageAdminCliEnv throws on invalid action", () => {
  assert.throws(
    () => loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "invalid" }),
    (err: unknown) => err instanceof ValidationError && err.code.includes("unknown_authoritative_storage_action")
  );
});

test("loadAuthoritativeStorageAdminCliEnv uses AA_DB_PATH when set", () => {
  const result = loadAuthoritativeStorageAdminCliEnv({ AA_DB_PATH: "/custom/path/test.db" });
  assert.equal(result.dbPath, "/custom/path/test.db");
});
