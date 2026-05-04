import assert from "node:assert/strict";
import test from "node:test";

import { ConflictResolver } from "../../../../../ui/packages/shared/sync/src/conflict-resolver.js";
import { OfflineQueue, createMemoryOfflineMutationStore } from "../../../../../ui/packages/shared/sync/src/offline-queue.js";
import { SyncCoordinator } from "../../../../../ui/packages/shared/sync/src/sync-coordinator.js";
import type { OfflineMutation } from "../../../../../ui/packages/shared/sync/src/types.js";

function createMutation(id: string): OfflineMutation {
  return {
    id,
    endpoint: "/api/v1/tasks",
    method: "POST",
    body: { title: `Task ${id}` },
    createdAt: "2026-05-04T00:00:00.000Z",
    idempotencyKey: `idem-${id}`,
    retryCount: 0,
    status: "pending",
    tenantId: "tenant-a",
    traceId: `trace-${id}`,
    principal: {
      principalId: "user-1",
      tenantId: "tenant-a",
      roles: ["operator"],
    },
  };
}

test("SyncCoordinator.flush keeps queued mutations durable until HTTP replay is acknowledged", async () => {
  const queue = new OfflineQueue(createMemoryOfflineMutationStore([]));
  await queue.enqueue(createMutation("m1"));

  let resolveRequest: (() => void) | undefined;
  const requestStarted = new Promise<void>((resolve) => {
    resolveRequest = resolve;
  });

  let completeRequest: (() => void) | undefined;
  const httpClient = {
    async request() {
      resolveRequest?.();
      await new Promise<void>((resolve) => {
        completeRequest = resolve;
      });
      return {};
    },
  };

  const coordinator = new SyncCoordinator(queue, new ConflictResolver(), httpClient as never);
  const flushPromise = coordinator.flush();

  await requestStarted;
  assert.equal(queue.size(), 1);
  assert.equal(queue.peek()[0]?.id, "m1");

  completeRequest?.();
  const result = await flushPromise;

  assert.equal(result.succeeded.length, 1);
  assert.equal(queue.size(), 0);
});

test("SyncCoordinator.flush persists retryable failures back into the queue snapshot", async () => {
  const queue = new OfflineQueue(createMemoryOfflineMutationStore([]));
  await queue.enqueue(createMutation("m2"));

  const coordinator = new SyncCoordinator(
    queue,
    new ConflictResolver(),
    {
      async request() {
        throw new Error("rest.http_error:503");
      },
    } as never,
  );

  const result = await coordinator.flush();
  const replayed = queue.peek()[0];

  assert.equal(result.failed.length, 1);
  assert.equal(replayed?.id, "m2");
  assert.equal(replayed?.retryCount, 1);
  assert.equal(replayed?.status, "pending");
});
