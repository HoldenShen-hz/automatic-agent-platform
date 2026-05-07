import { describe, expect, it } from "vitest";
import { ConflictResolver } from "../../packages/shared/sync/src/conflict-resolver";

describe("conflict resolver regressions", () => {
  it("merges nested objects using vector-clock aware field resolution instead of shallow spread", () => {
    const resolver = new ConflictResolver();

    const merged = resolver.resolve(
      {
        id: "task-1",
        status: { phase: "running", owner: "server-owner" },
        metadata: { retries: 1 },
      },
      {
        id: "task-1",
        status: { phase: "blocked", owner: "local-owner" },
        metadata: { retries: 2, note: "needs review" },
      },
      "merge",
      {
        lamportTimestamp: 1,
        vectorClock: {
          phase: { actorId: "server", timestamp: 1 },
          owner: { actorId: "server", timestamp: 1 },
          retries: { actorId: "server", timestamp: 1 },
        },
      },
      {
        lamportTimestamp: 2,
        vectorClock: {
          phase: { actorId: "local", timestamp: 2 },
          owner: { actorId: "local", timestamp: 2 },
          retries: { actorId: "local", timestamp: 2 },
          note: { actorId: "local", timestamp: 2 },
        },
      },
    );

    expect(merged).toEqual({
      id: "task-1",
      status: { phase: "blocked", owner: "local-owner" },
      metadata: { retries: 2, note: "needs review" },
    });
  });
});
