import { describe, expect, it, vi } from "vitest";
import { ConflictResolver, FetchSyncMutationDispatcher, SyncCoordinator, createMemoryOfflineMutationStore, OfflineQueue } from "@aa/shared-sync";
import type { OfflineMutation, SyncMutationDispatcher } from "@aa/shared-sync";

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

  it("replays stored auth and idempotency headers during flush", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const queue = new OfflineQueue(createMemoryOfflineMutationStore([{
      ...createMutation("m3"),
      headers: {
        authorization: "Bearer token-1",
        "x-csrf-token": "csrf-1",
        "idempotency-key": "idem-1",
        "x-tenant-id": "tenant-1",
      },
    }]));
    await queue.whenReady();
    const coordinator = new SyncCoordinator(
      queue,
      new ConflictResolver(),
      new FetchSyncMutationDispatcher(fetchImplementation as typeof fetch),
    );

    await coordinator.flush("2026-05-01T12:05:00.000Z");

    expect(fetchImplementation).toHaveBeenCalled();
    const requestInit = fetchImplementation.mock.calls[0]?.[1];
    if (requestInit == null) {
      throw new Error("Expected fetch request init to be captured.");
    }
    const headers = new Headers(requestInit.headers);
    expect(headers.get("authorization")).toBe("Bearer token-1");
    expect(headers.get("x-csrf-token")).toBe("csrf-1");
    expect(headers.get("idempotency-key")).toBe("idem-1");
    expect(headers.get("x-tenant-id")).toBe("tenant-1");
  });
});
