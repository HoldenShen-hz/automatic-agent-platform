import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OfflineQueue, createMemoryOfflineMutationStore } from "../../../../../ui/packages/shared/sync/src/index.js";
import type { OfflineMutation } from "../../../../../ui/packages/shared/sync/src/index.js";

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

test("OfflineQueue.enqueue propagates persist failures instead of silently keeping memory-only state", async () => {
  const store = createMemoryOfflineMutationStore([]);
  store.writeAll = async () => {
    throw new Error("disk full");
  };

  const queue = new OfflineQueue(store);

  await assert.rejects(queue.enqueue(createMutation("m1")), /disk full/);
  assert.equal(queue.size(), 1);
  assert.equal(queue.peek()[0]?.id, "m1");
});

test("OfflineMutation contract includes tenant, trace, and principal envelope fields", () => {
  const source = readFileSync(
    new URL("../../../../../ui/packages/shared/sync/src/types.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /readonly tenantId: string;/);
  assert.match(source, /readonly traceId: string;/);
  assert.match(source, /readonly principal: \{/);
  assert.match(source, /readonly principalId: string;/);
  assert.match(source, /readonly roles: readonly string\[\];/);
});
