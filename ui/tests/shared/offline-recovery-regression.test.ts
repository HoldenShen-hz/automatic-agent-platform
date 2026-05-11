import { describe, expect, it } from "vitest";
import { SyncCoordinator, createMemoryOfflineMutationStore, createPersistentOfflineQueue } from "@aa/shared-sync";

describe("offline recovery sync flow", () => {
  it("rehydrates queued mutations, flushes them after reconnect, and preserves conflict resolution inputs", async () => {
    const store = createMemoryOfflineMutationStore([
      {
        id: "queued-before-restart",
        endpoint: "/api/v1/tasks/task-1",
        method: "PATCH",
        body: { title: "offline edit" },
        conflictKey: "task-1",
        version: 1,
        createdAt: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const recoveredQueue = createPersistentOfflineQueue(store);
    await recoveredQueue.whenReady();

    const coordinator = new SyncCoordinator(recoveredQueue);
    coordinator.queueMutation({
      id: "queued-after-restart",
      endpoint: "/api/v1/tasks/task-1",
      method: "PATCH",
      body: { title: "retry after reconnect" },
      conflictKey: "task-1",
      version: 2,
      createdAt: "2026-05-01T00:01:00.000Z",
    });

    expect(coordinator.pendingCount()).toBe(2);
    expect(coordinator.resolveConflict(
      { version: 1, title: "server" },
      { version: 2, title: "local" },
      "merge",
    )).toEqual({ version: 2, title: "local" });

    const flushed = coordinator.flush("2026-05-01T00:05:00.000Z");
    expect(flushed.flushedAt).toBe("2026-05-01T00:05:00.000Z");
    expect(flushed.mutations.map((mutation) => mutation.id)).toEqual([
      "queued-before-restart",
      "queued-after-restart",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restartedQueue = createPersistentOfflineQueue(store);
    await restartedQueue.whenReady();
    expect(restartedQueue.size()).toBe(0);
  });
});
