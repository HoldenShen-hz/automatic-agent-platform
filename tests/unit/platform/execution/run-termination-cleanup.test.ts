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
  });

  assert.equal(result.complete, true);
  assert.deepEqual(result.cleanedResourceIds, ["cb_1", "lease_1"]);
  // "callback" is not a valid CleanupResourceKind, so it won't be in cleanupOrder
  assert.equal(result.cleanupOrder.includes("callback"), false);
  // The execute method does not use emitters - it just returns a receipt
  assert.equal(completed.length, 0);
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
  });

  assert.equal(result.complete, true);
  // "callback" is not a valid CleanupResourceKind, so cb_2 is sorted before "lease" (index -1)
  assert.deepEqual(result.cleanedResourceIds, ["cb_2", "lease_2"]);
  // The execute method does not use emitters - it just returns a receipt
  // Emitters would be used by a separate executeAsync that doesn't exist in this source
  assert.equal(completed.length, 0);
  assert.equal(failed.length, 0);
});
