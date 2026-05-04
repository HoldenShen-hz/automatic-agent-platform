import assert from "node:assert/strict";
import test from "node:test";

import { ConflictResolver, type ConflictMetadata } from "../../../../../ui/packages/shared/sync/src/index.js";

test("ConflictResolver.merge uses vector clocks instead of unconditional local overwrite", () => {
  const resolver = new ConflictResolver();
  const serverMetadata: ConflictMetadata = {
    lamportTimestamp: 10,
    vectorClock: {
      title: { actorId: "server", timestamp: 10 },
      description: { actorId: "server", timestamp: 4 },
    },
  };
  const localMetadata: ConflictMetadata = {
    lamportTimestamp: 9,
    vectorClock: {
      title: { actorId: "local", timestamp: 3 },
      description: { actorId: "local", timestamp: 8 },
      draftOnly: { actorId: "local", timestamp: 8 },
    },
  };

  const result = resolver.resolve(
    { title: "server-title", description: "server-description" },
    { title: "local-title", description: "local-description", draftOnly: true },
    "merge",
    serverMetadata,
    localMetadata,
  ) as Record<string, unknown>;

  assert.equal(result.title, "server-title");
  assert.equal(result.description, "local-description");
  assert.equal(result.draftOnly, true);
});

test("ConflictResolver.merge deduplicates arrays by id without replacing server entries wholesale", () => {
  const resolver = new ConflictResolver();

  const result = resolver.resolve(
    [
      { id: "existing", value: "server" },
      { id: "server-only", value: "keep" },
    ],
    [
      { id: "existing", value: "local-should-not-overwrite" },
      { id: "local-only", value: "append" },
    ],
    "merge",
  ) as Array<{ id: string; value: string }>;

  assert.deepEqual(result, [
    { id: "existing", value: "server" },
    { id: "server-only", value: "keep" },
    { id: "local-only", value: "append" },
  ]);
});

test("ConflictResolver.server_wins compares Lamport timestamps for scalar values", () => {
  const resolver = new ConflictResolver();

  const localWins = resolver.resolve(
    "server",
    "local",
    "server_wins",
    { lamportTimestamp: 1, vectorClock: {} },
    { lamportTimestamp: 2, vectorClock: {} },
  );

  assert.equal(localWins, "local");
});
