import assert from "node:assert/strict";
import test from "node:test";
import { loadRepoModule } from "../../../../helpers/repo-module.js";

type OfflineMutation = {
  id: string;
  endpoint: string;
  method: string;
  body: { title: string };
  createdAt: string;
  idempotencyKey: string;
  retryCount: number;
  status: "pending" | "conflict";
  tenantId: string;
  traceId: string;
  principal: {
    principalId: string;
    tenantId: string;
    roles: string[];
  };
};

async function loadSyncModules() {
  const [conflictModule, queueModule, coordinatorModule] = await Promise.all([
    loadRepoModule<{ ConflictResolver: new () => unknown }>("ui", "packages", "shared", "sync", "src", "conflict-resolver.ts"),
    loadRepoModule<{
      OfflineQueue: new (store: { writeAll(items: readonly OfflineMutation[]): Promise<void> }) => {
        enqueue(mutation: OfflineMutation): Promise<void>;
        size(): number;
        peek(): OfflineMutation[];
      };
      createMemoryOfflineMutationStore: (
        items: readonly OfflineMutation[],
      ) => { writeAll(items: readonly OfflineMutation[]): Promise<void> };
    }>("ui", "packages", "shared", "sync", "src", "offline-queue.ts"),
    loadRepoModule<{
      SyncCoordinator: new (
        queue: unknown,
        resolver: unknown,
        httpClient: { request(): Promise<unknown> },
      ) => {
        flush(): Promise<{
          succeeded: unknown[];
          failed: unknown[];
          conflicts: Array<{ serverValue?: unknown }>;
        }>;
      };
    }>("ui", "packages", "shared", "sync", "src", "sync-coordinator.ts"),
  ]);
  return {
    ConflictResolver: conflictModule.ConflictResolver,
    OfflineQueue: queueModule.OfflineQueue,
    createMemoryOfflineMutationStore: queueModule.createMemoryOfflineMutationStore,
    SyncCoordinator: coordinatorModule.SyncCoordinator,
  };
}

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
  const { ConflictResolver, OfflineQueue, SyncCoordinator, createMemoryOfflineMutationStore } = await loadSyncModules();
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
  const { ConflictResolver, OfflineQueue, SyncCoordinator, createMemoryOfflineMutationStore } = await loadSyncModules();
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

  assert.ok(result.failed.length <= 1);
  assert.equal(replayed?.id, "m2");
  assert.equal(replayed?.retryCount, 1);
  assert.equal(replayed?.status, "pending");
});

test("SyncCoordinator.flush marks HTTP conflicts and preserves server payload for resolution", async () => {
  const { ConflictResolver, OfflineQueue, SyncCoordinator, createMemoryOfflineMutationStore } = await loadSyncModules();
  const queue = new OfflineQueue(createMemoryOfflineMutationStore([]));
  await queue.enqueue(createMutation("m3"));

  const coordinator = new SyncCoordinator(
    queue,
    new ConflictResolver(),
    {
      async request() {
        return {
          conflict: true,
          serverValue: { id: "server-task", title: "Authoritative Title" },
        };
      },
    } as never,
  );

  const result = await coordinator.flush();
  const queued = queue.peek()[0];

  assert.equal(result.succeeded.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0]?.serverValue, { id: "server-task", title: "Authoritative Title" });
  assert.equal(queued?.status, "conflict");
});
