import assert from "node:assert/strict";
import test from "node:test";

import {
  loadDispatchExecutionCliEnv,
  loadWorkerHandshakeCliEnv,
  loadWorkerWritebackCliEnv,
} from "../../../../../src/platform/control-plane/config-center/runtime-ops-env.js";

test("runtime ops env loader parses dispatch execution settings", () => {
  const config = loadDispatchExecutionCliEnv({
    AA_DB_PATH: "/tmp/runtime.db",
    AA_EXECUTION_ID: "exec-123",
    AA_PRIORITY: "urgent",
    AA_QUEUE_NAME: "priority",
    AA_DISPATCH_TARGET: "prefer_remote",
    AA_REQUIRED_ISOLATION_LEVEL: "strict",
    AA_REQUIRED_REPO_VERSION: "abc123",
    AA_REQUIRED_CAPABILITIES_JSON: "[\"bash\",\"edit\"]",
    AA_DISPATCH_AFTER: "2026-04-11T12:00:00.000Z",
    AA_DISPATCH_CREATE_ONLY: "1",
    AA_PREFERRED_WORKER_ID: "worker-1",
    AA_LEASE_TTL_MS: "45000",
    AA_INCLUDE_DEGRADED: "1",
  });

  assert.equal(config.dbPath, "/tmp/runtime.db");
  assert.equal(config.executionId, "exec-123");
  assert.equal(config.priority, "urgent");
  assert.equal(config.queueName, "priority");
  assert.equal(config.dispatchTarget, "prefer_remote");
  assert.equal(config.requiredIsolationLevel, "strict");
  assert.deepEqual(config.requiredCapabilities, ["bash", "edit"]);
  assert.equal(config.createOnly, true);
  assert.equal(config.leaseTtlMs, 45000);
  assert.equal(config.includeDegraded, true);
});

test("runtime ops env loader fails closed on malformed remote logs", () => {
  assert.throws(
    () =>
      loadWorkerHandshakeCliEnv({
        AA_WORKER_HANDSHAKE_ACTION: "claim",
        AA_WORKER_ID: "worker-1",
        AA_LEASE_ID: "lease-1",
        AA_FENCING_TOKEN: "3",
        AA_REMOTE_LOGS_JSON: "{\"level\":\"info\"}",
      }),
    /invalid_env:AA_REMOTE_LOGS_JSON/,
  );
});

test("runtime ops env loader validates writeback terminal status", () => {
  assert.throws(
    () =>
      loadWorkerWritebackCliEnv({
        AA_EXECUTION_ID: "exec-1",
        AA_WORKER_ID: "worker-1",
        AA_LEASE_ID: "lease-1",
        AA_FENCING_TOKEN: "4",
        AA_TERMINAL_STATUS: "partial",
      }),
    /invalid_env:AA_TERMINAL_STATUS/,
  );
});
