import assert from "node:assert/strict";
import test from "node:test";

import { RunTerminationCleanup, type CleanupCallback } from "../../../../src/platform/five-plane-execution/run-termination-cleanup.js";

test("RunTerminationCleanup includes callback in cleanup order [run-termination-cleanup]", async () => {
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

test("RunTerminationCleanup executes callback handler for pending callbacks cleanup [run-termination-cleanup]", async () => {
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

test("RunTerminationCleanup triggers compensation after resource cleanup [run-termination-cleanup]", async () => {
  const cleanup = new RunTerminationCleanup();
  const callOrder: string[] = [];

  const result = await cleanup.execute(
    {
      runId: "run_789",
      tenantId: "tenant_789",
      terminalStatus: "failed",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [
        { resourceKind: "lease", resourceId: "lease_1", cleanupRequired: true },
        { resourceKind: "secret", resourceId: "secret_1", cleanupRequired: true },
      ],
    },
    {
      cleanup: {
        lease: async () => {
          callOrder.push("cleanup:lease");
          return true;
        },
        secret: async () => {
          callOrder.push("cleanup:secret");
          return true;
        },
        budget_reservation: async () => true,
        plugin_resource: async () => true,
        timer: async () => true,
        hitl_wait: async () => true,
        context_snapshot: async () => true,
        callback: async () => true,
      },
      stateEvidenceFlush: async () => {
        callOrder.push("flush");
        return { flushed: true, artifactCount: 1 };
      },
      compensationTrigger: async () => {
        callOrder.push("compensation");
        return { triggered: true, compensationPlanId: "plan-1" };
      },
    },
  );

  assert.equal(result.cleanupStatus, "complete");
  assert.deepEqual(callOrder, ["cleanup:lease", "cleanup:secret", "flush", "compensation"]);
});

test("RunTerminationCleanup marks failed when state evidence flush throws and preserves error details [run-termination-cleanup]", async () => {
  const cleanup = new RunTerminationCleanup();

  const result = await cleanup.execute(
    {
      runId: "run_flush_fail",
      tenantId: "tenant_123",
      terminalStatus: "completed",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [],
    },
    {
      cleanup: {
        lease: async () => true,
        secret: async () => true,
        budget_reservation: async () => true,
        plugin_resource: async () => true,
        timer: async () => true,
        hitl_wait: async () => true,
        context_snapshot: async () => true,
        callback: async () => true,
      },
      stateEvidenceFlush: async () => {
        throw new Error("flush exploded");
      },
    },
  );

  assert.equal(result.cleanupStatus, "failed");
  assert.equal(result.stateEvidenceFlush?.flushed, false);
  assert.equal(result.stateEvidenceFlush?.error, "flush exploded");
});

test("RunTerminationCleanup records callback exceptions instead of silently swallowing them [run-termination-cleanup]", async () => {
  const cleanup = new RunTerminationCleanup();

  const result = await cleanup.execute(
    {
      runId: "run_err",
      tenantId: "tenant_err",
      terminalStatus: "failed",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [
        { resourceKind: "lease", resourceId: "lease_bad", cleanupRequired: true },
      ],
    },
    {
      cleanup: {
        lease: async () => {
          throw new Error("lease release boom");
        },
        secret: async () => true,
        budget_reservation: async () => true,
        plugin_resource: async () => true,
        timer: async () => true,
        hitl_wait: async () => true,
        context_snapshot: async () => true,
        callback: async () => true,
      },
    },
  );

  assert.equal(result.cleanupStatus, "failed");
  assert.deepEqual(result.failedResourceIds, ["lease_bad"]);
  assert.deepEqual(result.resourceErrors, [{
    resourceId: "lease_bad",
    resourceKind: "lease",
    error: "lease release boom",
  }]);
});

test("RunTerminationCleanup enforces per-callback timeout and bounded concurrency [run-termination-cleanup]", async () => {
  const cleanup = new RunTerminationCleanup();
  let inFlight = 0;
  let peak = 0;

  const result = await cleanup.execute(
    {
      runId: "run_concurrency",
      tenantId: "tenant_concurrency",
      terminalStatus: "completed",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [
        { resourceKind: "lease", resourceId: "lease_1", cleanupRequired: true },
        { resourceKind: "lease", resourceId: "lease_2", cleanupRequired: true },
        { resourceKind: "lease", resourceId: "lease_3", cleanupRequired: true },
        { resourceKind: "secret", resourceId: "secret_slow", cleanupRequired: true },
      ],
    },
    {
      cleanupTimeoutMs: 10,
      maxConcurrentCallbacks: 2,
      cleanup: {
        lease: async () => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 5));
          inFlight--;
          return true;
        },
        secret: async () => new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(true), 50);
        }),
        budget_reservation: async () => true,
        plugin_resource: async () => true,
        timer: async () => true,
        hitl_wait: async () => true,
        context_snapshot: async () => true,
        callback: async () => true,
      },
    },
  );

  assert.equal(peak, 2);
  assert.equal(result.cleanupStatus, "partial");
  assert.ok(result.failedResourceIds.includes("secret_slow"));
  assert.ok(result.resourceErrors?.some((entry) => entry.error.includes("run_cleanup.timeout:secret:secret_slow")));
});

test("RunTerminationCleanup publishes failed event for partial cleanup instead of completed event [run-termination-cleanup]", async () => {
  const cleanup = new RunTerminationCleanup();
  const published: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  const result = await cleanup.execute(
    {
      runId: "run_events",
      tenantId: "tenant_events",
      terminalStatus: "failed",
      requestedAt: "2026-04-29T00:00:00.000Z",
      resources: [
        { resourceKind: "lease", resourceId: "lease_ok", cleanupRequired: true },
        { resourceKind: "secret", resourceId: "secret_fail", cleanupRequired: true },
      ],
    },
    {
      cleanup: {
        lease: async () => true,
        secret: async () => false,
        budget_reservation: async () => true,
        plugin_resource: async () => true,
        timer: async () => true,
        hitl_wait: async () => true,
        context_snapshot: async () => true,
        callback: async () => true,
      },
      eventBus: {
        publish: (event: { eventType: string; payload: Record<string, unknown> }) => {
          published.push(event);
          return Promise.resolve();
        },
      } as never,
    },
  );

  assert.equal(result.cleanupStatus, "partial");
  assert.equal(published.length, 1);
  assert.equal(published[0]?.eventType, "run.cleanup_failed");
  assert.equal(published[0]?.payload.cleanupStatus, "partial");
});
