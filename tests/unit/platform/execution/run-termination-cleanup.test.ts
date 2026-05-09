import assert from "node:assert/strict";
import test from "node:test";

import { RunTerminationCleanup, type CleanupCallback } from "../../../../src/platform/execution/run-termination-cleanup.js";

test("RunTerminationCleanup includes callback in cleanup order", async () => {
  // R4-22 fix: callback is now a valid CleanupResourceKind
  const cleanup = new RunTerminationCleanup();
  const cleanedIds: string[] = [];

  const leaseCb: CleanupCallback = async () => {
    cleanedIds.push("lease");
    return true;
  };
  const callbackCb: CleanupCallback = async () => {
    cleanedIds.push("callback");
    return true;
  };

  const result = await cleanup.execute(
    {
      runId: "run_123",
      tenantId: "tenant_123",
      terminalStatus: "completed",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [
        { resourceKind: "lease", resourceId: "lease_1", cleanupRequired: true },
        { resourceKind: "callback", resourceId: "cb_1", cleanupRequired: true },
      ],
    },
    {
      cleanup: {
        lease: leaseCb,
        callback: callbackCb,
        // Other kinds not needed for this test
        secret: async () => false,
        budget_reservation: async () => false,
        plugin_resource: async () => false,
        timer: async () => false,
        hitl_wait: async () => false,
        context_snapshot: async () => false,
      },
    },
  );

  // callback should be in the cleanupOrder now (R4-22 fix)
  assert.equal(result.cleanupOrder.includes("callback"), true);
  // Verify the callback handler was actually called
  assert.equal(cleanedIds.includes("callback"), true, "callback handler should have been called");
  assert.equal(result.cleanupStatus, "complete");
});

test("RunTerminationCleanup executes callback handler for pending callbacks cleanup", async () => {
  const cleanup = new RunTerminationCleanup();
  let callbackInvoked = false;

  const callbackCb: CleanupCallback = async () => {
    callbackInvoked = true;
    return true;
  };

  const result = await cleanup.execute(
    {
      runId: "run_456",
      tenantId: "tenant_456",
      terminalStatus: "cancelled",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [
        { resourceKind: "callback", resourceId: "cb_pending_1", cleanupRequired: true },
      ],
    },
    {
      cleanup: {
        lease: async () => false,
        callback: callbackCb,
        secret: async () => false,
        budget_reservation: async () => false,
        plugin_resource: async () => false,
        timer: async () => false,
        hitl_wait: async () => false,
        context_snapshot: async () => false,
      },
    },
  );

  // R4-22: callback cleanup kind should now work
  assert.equal(callbackInvoked, true, "callback handler should have been invoked");
  assert.equal(result.cleanedResourceIds.includes("cb_pending_1"), true);
});