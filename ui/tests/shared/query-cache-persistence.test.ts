import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  createMemoryQueryCachePersister,
  persistQueryClientSnapshot,
  restorePersistedQueryClient,
  startPersistingQueryClient,
} from "@aa/shared-state";

describe("query cache persistence", () => {
  it("hydrates a fresh query client from persisted state", async () => {
    const persister = createMemoryQueryCachePersister();
    const sourceClient = new QueryClient();
    sourceClient.setQueryData(["tasks"], [{ id: "task-1", title: "Persisted task" }]);
    sourceClient.setQueryData(["approvals"], [{ approvalId: "approval-1", taskId: "task-1" }]);

    await persistQueryClientSnapshot(sourceClient, persister);

    const restoredClient = new QueryClient();
    const restored = await restorePersistedQueryClient(restoredClient, persister);

    expect(restored).toBe(true);
    expect(restoredClient.getQueryData(["tasks"])).toEqual([{ id: "task-1", title: "Persisted task" }]);
    expect(restoredClient.getQueryData(["approvals"])).toEqual([{ approvalId: "approval-1", taskId: "task-1" }]);
  });

  it("subscribes to cache changes and persists later updates", async () => {
    const persister = createMemoryQueryCachePersister();
    const client = new QueryClient();
    const stopPersisting = startPersistingQueryClient(client, {
      persister,
      debounceMs: 0,
    });

    client.setQueryData(["dashboard"], { ok: true, source: "live" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    stopPersisting();

    const restoredClient = new QueryClient();
    await restorePersistedQueryClient(restoredClient, persister);
    expect(restoredClient.getQueryData(["dashboard"])).toEqual({ ok: true, source: "live" });
  });
});
