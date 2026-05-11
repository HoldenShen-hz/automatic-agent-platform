import { describe, expect, it, vi } from "vitest";
import { ConflictResolver, SyncCoordinator, createMemoryOfflineMutationStore, OfflineQueue } from "@aa/shared-sync";
import type { OfflineMutation } from "@aa/shared-sync";
import type { SyncMutationDispatcher } from "../../../../../packages/shared/sync/src/sync-coordinator";

function createMutation(id: string): OfflineMutation {
  return {
    id,
    endpoint: `/api/v1/tasks/${id}`,
    method: "POST",
    body: { id },
    createdAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("SyncCoordinator", () => {
  it("flush dispatches queued mutations before draining the queue", async () => {
    const queue = new OfflineQueue(createMemoryOfflineMutationStore([
      createMutation("m1"),
      createMutation("m2"),
    ]));
    await queue.whenReady();
    const dispatch = vi.fn(async () => undefined);
    const coordinator = new SyncCoordinator(
      queue,
      new ConflictResolver(),
      { dispatch } satisfies SyncMutationDispatcher,
    );

    const result = await coordinator.flush("2026-05-01T12:00:00.000Z");

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "m1" }));
    expect(dispatch).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "m2" }));
    expect(result.mutations.map((mutation) => mutation.id)).toEqual(["m1", "m2"]);
    expect(result.flushedAt).toBe("2026-05-01T12:00:00.000Z");
    expect(coordinator.pendingCount()).toBe(0);
  });
});
