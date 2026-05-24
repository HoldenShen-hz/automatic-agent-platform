import assert from "node:assert/strict";
import test from "node:test";
import { loadRepoModule } from "../../../../helpers/repo-module.js";

type ConflictMetadata = {
  lamportTimestamp: number;
  vectorClock: Record<string, { actorId: string; timestamp: number }>;
};

async function loadSyncIndexModule() {
  return loadRepoModule<{
    ConflictResolver: new () => {
      resolve(
        serverValue: unknown,
        localValue: unknown,
        strategy: string,
        serverMetadata?: ConflictMetadata,
        localMetadata?: ConflictMetadata,
      ): unknown;
    };
  }>("ui", "packages", "shared", "sync", "src", "index.ts");
}

test("ConflictResolver.merge uses vector clocks instead of unconditional local overwrite", async () => {
  const { ConflictResolver } = await loadSyncIndexModule();
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

test("ConflictResolver.merge deduplicates arrays by id without replacing server entries wholesale", async () => {
  const { ConflictResolver } = await loadSyncIndexModule();
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
    { id: "existing", value: "local-should-not-overwrite" },
    { id: "server-only", value: "keep" },
    { id: "local-only", value: "append" },
  ]);
});

test("ConflictResolver.merge applies CRDT ordering to overlapping array entries by id", async () => {
  const { ConflictResolver } = await loadSyncIndexModule();
  const resolver = new ConflictResolver();
  const serverMetadata: ConflictMetadata = {
    lamportTimestamp: 8,
    vectorClock: {
      existing: { actorId: "server", timestamp: 4 },
    },
  };
  const localMetadata: ConflictMetadata = {
    lamportTimestamp: 9,
    vectorClock: {
      existing: { actorId: "local", timestamp: 7 },
    },
  };

  const result = resolver.resolve(
    [{ id: "existing", value: "server", retained: true }],
    [{ id: "existing", value: "local-newer", draftOnly: true }],
    "merge",
    serverMetadata,
    localMetadata,
  ) as Array<Record<string, unknown>>;

  assert.deepEqual(result, [{
    id: "existing",
    value: "local-newer",
    retained: true,
    draftOnly: true,
  }]);
});

test("ConflictResolver.server_wins compares Lamport timestamps for scalar values", async () => {
  const { ConflictResolver } = await loadSyncIndexModule();
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
