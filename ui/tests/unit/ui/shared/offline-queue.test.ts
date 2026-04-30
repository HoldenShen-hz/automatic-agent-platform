import { describe, expect, it } from "vitest";
import {
  OfflineQueue,
  createMemoryOfflineMutationStore,
  createPersistentOfflineQueue,
} from "@aa/shared-sync";
import type { OfflineMutation } from "@aa/shared-sync";

function createMutation(id: string): OfflineMutation {
  return {
    id,
    endpoint: "/api/v1/tasks",
    method: "POST",
    body: { title: `Task ${id}` },
    createdAt: new Date().toISOString(),
    idempotencyKey: `idem-${id}`,
    retryCount: 0,
    status: "pending",
  };
}

describe("OfflineQueue", () => {
  describe("core operations", () => {
    it("enqueue adds mutation to queue", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store);
      const mutation = createMutation("m1");

      queue.enqueue(mutation);

      expect(queue.size()).toBe(1);
      expect(queue.peek()[0]).toEqual(mutation);
    });

    it("drain removes all mutations and returns them", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store);

      queue.enqueue(createMutation("m1"));
      queue.enqueue(createMutation("m2"));
      queue.enqueue(createMutation("m3"));

      const drained = queue.drain();

      expect(drained.length).toBe(3);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it("evicts oldest when at capacity", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store, 2);

      queue.enqueue(createMutation("oldest"));
      queue.enqueue(createMutation("middle"));
      queue.enqueue(createMutation("newest"));

      expect(queue.size()).toBe(2);
      const remaining = queue.peek().map((m) => m.id);
      expect(remaining).not.toContain("oldest");
      expect(remaining).toContain("middle");
      expect(remaining).toContain("newest");
    });

    it("persist writes mutations after whenReady", async () => {
      const mutations: OfflineMutation[] = [];
      const store = createMemoryOfflineMutationStore([]);

      const originalWriteAll = store.writeAll.bind(store);
      store.writeAll = async (ms) => {
        mutations.push(...ms);
        return originalWriteAll(ms);
      };

      const queue = createPersistentOfflineQueue(store);
      await queue.whenReady();

      queue.enqueue(createMutation("m1"));
      queue.enqueue(createMutation("m2"));

      await new Promise((resolve) => setImmediate(resolve));

      expect(mutations.length).toBeGreaterThan(0);
    });
  });

  describe("IndexedDB Before Load (Issue #2073)", () => {
    it("persist is called but does not block when before whenReady", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const persistCalls: string[] = [];

      const originalWriteAll = store.writeAll.bind(store);
      store.writeAll = async (ms) => {
        persistCalls.push(`write:${ms.map((m) => m.id).join(",")}`);
        return originalWriteAll(ms);
      };

      const queue = new OfflineQueue(store);

      queue.enqueue(createMutation("m1"));

      expect(queue.size()).toBe(1);

      await queue.whenReady();

      queue.enqueue(createMutation("m2"));

      await new Promise((resolve) => setImmediate(resolve));

      expect(persistCalls.some((c) => c.includes("m2"))).toBe(true);
    });

    it("operations work correctly when called before and after whenReady", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store);

      queue.enqueue(createMutation("before-ready"));
      expect(queue.size()).toBe(1);

      await queue.whenReady();

      queue.enqueue(createMutation("after-ready"));
      expect(queue.size()).toBe(2);

      const drained = queue.drain();
      expect(drained.length).toBe(2);
      expect(queue.isEmpty()).toBe(true);
    });

    it("correctly loads pre-existing mutations from store on whenReady", async () => {
      const preExisting: OfflineMutation[] = [
        createMutation("pre-1"),
        createMutation("pre-2"),
      ];
      const store = createMemoryOfflineMutationStore(preExisting);
      const queue = new OfflineQueue(store);

      expect(queue.size()).toBe(0);

      await queue.whenReady();

      expect(queue.size()).toBe(2);
    });

    it("capacity returns configured max capacity", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store, 500);

      expect(queue.capacity()).toBe(500);
      expect(queue.isFull()).toBe(false);
    });

    it("peek returns readonly copy", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store);

      queue.enqueue(createMutation("m1"));
      const peeked = queue.peek();

      expect(peeked.length).toBe(1);

      (peeked as OfflineMutation[]).push(createMutation("m2"));
      expect(queue.size()).toBe(1);
    });

    it("tracks retry count through eviction", async () => {
      const store = createMemoryOfflineMutationStore([]);
      const queue = new OfflineQueue(store, 3);

      queue.enqueue({ ...createMutation("m1"), retryCount: 5 });
      queue.enqueue(createMutation("m2"));

      queue.enqueue(createMutation("m3"));
      queue.enqueue(createMutation("m4"));

      const remaining = queue.peek();
      expect(remaining.some((m) => m.id === "m1")).toBe(false);
    });
  });
});