import { describe, expect, it } from "vitest";
import { OfflineQueue, createMemoryOfflineMutationStore, createPersistentOfflineQueue, } from "@aa/shared-sync";
function createMutation(id) {
    return {
        id,
        endpoint: "/api/v1/tasks",
        method: "POST",
        body: { title: `Task ${id}` },
        createdAt: new Date().toISOString(),
        idempotencyKey: `idem-${id}`,
        retryCount: 0,
        status: "pending",
        tenantId: "tenant-1",
        traceId: `trace-${id}`,
        principal: {
            principalId: "user-1",
            tenantId: "tenant-1",
            roles: ["operator"],
        },
    };
}
describe("OfflineQueue", () => {
    describe("core operations", () => {
        it("enqueue adds mutation to queue after the async persist barrier completes", async () => {
            const store = createMemoryOfflineMutationStore([]);
            const queue = new OfflineQueue(store);
            const mutation = createMutation("m1");
            await queue.enqueue(mutation);
            expect(queue.size()).toBe(1);
            expect(queue.peek()[0]).toEqual(mutation);
        });
        it("drain removes all mutations and returns them", async () => {
            const store = createMemoryOfflineMutationStore([]);
            const queue = new OfflineQueue(store);
            await queue.enqueue(createMutation("m1"));
            await queue.enqueue(createMutation("m2"));
            await queue.enqueue(createMutation("m3"));
            const drained = queue.drain();
            expect(drained.length).toBe(3);
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
        });
        it("evicts oldest when at capacity", async () => {
            const store = createMemoryOfflineMutationStore([]);
            const queue = new OfflineQueue(store, 2);
            await queue.enqueue(createMutation("oldest"));
            await queue.enqueue(createMutation("middle"));
            await queue.enqueue(createMutation("newest"));
            expect(queue.size()).toBe(2);
            const remaining = queue.peek().map((m) => m.id);
            expect(remaining).not.toContain("oldest");
            expect(remaining).toContain("middle");
            expect(remaining).toContain("newest");
        });
        it("persist writes mutations after whenReady", async () => {
            const mutations = [];
            const store = createMemoryOfflineMutationStore([]);
            const originalWriteAll = store.writeAll.bind(store);
            store.writeAll = async (ms) => {
                mutations.push(...ms);
                return originalWriteAll(ms);
            };
            const queue = createPersistentOfflineQueue(store);
            await queue.whenReady();
            await queue.enqueue(createMutation("m1"));
            await queue.enqueue(createMutation("m2"));
            await new Promise((resolve) => setImmediate(resolve));
            expect(mutations.length).toBeGreaterThan(0);
        });
    });
    describe("IndexedDB Before Load (Issue #2073)", () => {
        it("waits for the initial load before making the mutation visible", async () => {
            const store = createMemoryOfflineMutationStore([]);
            const persistCalls = [];
            const originalWriteAll = store.writeAll.bind(store);
            store.writeAll = async (ms) => {
                persistCalls.push(`write:${ms.map((m) => m.id).join(",")}`);
                return originalWriteAll(ms);
            };
            const queue = new OfflineQueue(store);
            const enqueuePromise = queue.enqueue(createMutation("m1"));
            expect(queue.size()).toBe(0);
            await enqueuePromise;
            expect(queue.size()).toBe(1);
            await queue.enqueue(createMutation("m2"));
            await new Promise((resolve) => setImmediate(resolve));
            expect(persistCalls.some((c) => c.includes("m2"))).toBe(true);
        });
        it("operations work correctly when called before and after whenReady", async () => {
            const store = createMemoryOfflineMutationStore([]);
            const queue = new OfflineQueue(store);
            const firstEnqueue = queue.enqueue(createMutation("before-ready"));
            expect(queue.size()).toBe(0);
            await firstEnqueue;
            expect(queue.size()).toBe(1);
            await queue.whenReady();
            await queue.enqueue(createMutation("after-ready"));
            expect(queue.size()).toBe(2);
            const drained = queue.drain();
            expect(drained.length).toBe(2);
            expect(queue.isEmpty()).toBe(true);
        });
        it("correctly loads pre-existing mutations from store on whenReady", async () => {
            const preExisting = [
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
            await queue.enqueue(createMutation("m1"));
            const peeked = queue.peek();
            expect(peeked.length).toBe(1);
            peeked.push(createMutation("m2"));
            expect(queue.size()).toBe(1);
        });
        it("tracks retry count through eviction", async () => {
            const store = createMemoryOfflineMutationStore([]);
            const queue = new OfflineQueue(store, 3);
            await queue.enqueue({ ...createMutation("m1"), retryCount: 5 });
            await queue.enqueue(createMutation("m2"));
            await queue.enqueue(createMutation("m3"));
            await queue.enqueue(createMutation("m4"));
            const remaining = queue.peek();
            expect(remaining.some((m) => m.id === "m1")).toBe(false);
        });
        it("emits a caller-visible signal when capacity eviction drops queued mutations", async () => {
            const evicted = [];
            const store = createMemoryOfflineMutationStore([]);
            const queue = new OfflineQueue(store, {
                maxCapacity: 2,
                onEvict(mutation) {
                    evicted.push(mutation.id);
                },
            });
            await queue.enqueue(createMutation("m1"));
            await queue.enqueue(createMutation("m2"));
            await queue.enqueue(createMutation("m3"));
            expect(evicted).toEqual(["m1"]);
        });
    });
});
