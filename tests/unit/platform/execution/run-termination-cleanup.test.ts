import assert from "node:assert/strict";
import test from "node:test";

import { RunTerminationCleanup, type CleanupVerification } from "../../../../src/platform/execution/run-termination-cleanup.js";

test("RunTerminationCleanup emits cleanup_completed and includes callback in cleanup order", async () => {
  const cleanup = new RunTerminationCleanup({
    cleanupHandlers: {
      lease: async (): Promise<CleanupVerification> => ({ verified: true }),
      callback: async (): Promise<CleanupVerification> => ({ verified: true }),
    },
  });
  const completed: unknown[] = [];
  const failed: unknown[] = [];

  const result = cleanup.execute({
    runId: "run_123",
    tenantId: "tenant_123",
    terminalStatus: "completed",
    requestedAt: "2026-04-29T00:00:00.000Z",
    resources: [
      { resourceKind: "callback", resourceId: "cb_1", cleanupRequired: true },
      { resourceKind: "lease", resourceId: "lease_1", cleanupRequired: true },
    ],
  }, {
    emitCleanupCompleted(payload) {
      completed.push(payload);
    },
    emitCleanupFailed(payload) {
      failed.push(payload);
    },
  });

  assert.equal(result.complete, true);
  assert.deepEqual(result.cleanedResourceIds, ["lease_1", "cb_1"]);
  assert.equal(result.cleanupOrder.includes("callback"), true);
  assert.equal(completed.length, 1);
  assert.equal(failed.length, 0);
});

test("RunTerminationCleanup emits cleanup_failed when a handler is missing", async () => {
  const cleanup = new RunTerminationCleanup({
    cleanupHandlers: {
      lease: async (): Promise<CleanupVerification> => ({ verified: true }),
    },
  });
  const completed: unknown[] = [];
  const failed: Array<{ result: unknown; error: string }> = [];

  const result = cleanup.execute({
    runId: "run_456",
    tenantId: "tenant_456",
    terminalStatus: "failed",
    requestedAt: "2026-04-29T00:00:00.000Z",
    resources: [
      { resourceKind: "lease", resourceId: "lease_2", cleanupRequired: true },
      { resourceKind: "callback", resourceId: "cb_2", cleanupRequired: true },
    ],
  }, {
    emitCleanupCompleted(payload) {
      completed.push(payload);
    },
    emitCleanupFailed(payload, error) {
      failed.push({ result: payload, error });
    },
  });

  assert.equal(result.complete, false);
  assert.deepEqual(result.cleanedResourceIds, ["lease_2"]);
  assert.deepEqual(result.failedResourceIds, ["cb_2"]);
  assert.equal(completed.length, 0);
  assert.equal(failed.length, 1);
  assert.match(failed[0]!.error, /failed to clean up/i);
});
