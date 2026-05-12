import assert from "node:assert/strict";
import test from "node:test";

import type { CacheMeta } from "../../../../../src/platform/shared/cache/cache-types.js";
import { MemoryCacheStore } from "../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import { forceFullGc, formatMegabytes, heapUsedBytes } from "../../../../helpers/memory-leak.js";

function createCacheMeta(): CacheMeta {
  const now = Date.now();
  return {
    scope: "leak-guard",
    tags: ["leak-test"],
    version: "1",
    createdAt: now,
    lastAccessedAt: now,
    hitCount: 0,
    sizeBytes: 4096,
  };
}

async function populateAndClearNamespace(store: MemoryCacheStore, round: number): Promise<void> {
  for (let index = 0; index < 750; index += 1) {
    await store.set(
      "leak-guard",
      `round-${round}-entry-${index}`,
      {
        id: `${round}-${index}`,
        payload: `${round}:${index}:${"x".repeat(2048)}`,
      },
      createCacheMeta(),
    );
  }

  assert.equal(store.size, 750, "cache should retain the full namespace before invalidation");
  const removed = await store.invalidateNamespace("leak-guard");
  assert.equal(removed, 750, "namespace invalidation should release every inserted entry");
  assert.equal(store.size, 0, "cache should be empty after namespace invalidation");
}

test("leak guard: MemoryCacheStore does not retain heap after repeated invalidation cycles", async () => {
  const store = new MemoryCacheStore(2_000);

  for (let round = 0; round < 3; round += 1) {
    await populateAndClearNamespace(store, round);
  }

  await forceFullGc();
  const baselineHeap = heapUsedBytes();

  for (let round = 3; round < 21; round += 1) {
    await populateAndClearNamespace(store, round);
    await forceFullGc();
  }

  const finalHeap = heapUsedBytes();
  const retainedBytes = Math.max(0, finalHeap - baselineHeap);
  const retainedThresholdBytes = 8 * 1024 * 1024;

  assert.ok(
    retainedBytes < retainedThresholdBytes,
    `retained heap ${formatMegabytes(retainedBytes)} exceeded ${formatMegabytes(retainedThresholdBytes)} ` +
      `after repeated cache invalidation (baseline=${formatMegabytes(baselineHeap)}, final=${formatMegabytes(finalHeap)})`,
  );
});
