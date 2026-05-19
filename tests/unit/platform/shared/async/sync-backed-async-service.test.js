import assert from "node:assert/strict";
import test from "node:test";
import { SyncBackedAsyncService } from "../../../../../src/platform/shared/async/sync-backed-async-service.js";
// Concrete implementation for testing
class TestSyncService {
    counter = 0;
    increment() {
        return ++this.counter;
    }
}
class TestAsyncService extends SyncBackedAsyncService {
    constructor() {
        super(() => new TestSyncService());
    }
    doAsyncIncrement() {
        return this.asPromise((sync) => sync.increment());
    }
    getCounterSync() {
        return this.sync.counter;
    }
    callAsPromise(operation) {
        return this.asPromise(operation);
    }
}
test("SyncBackedAsyncService initializes sync object via factory", () => {
    const service = new TestAsyncService();
    assert.equal(service.getSyncService().counter, 0);
});
test("SyncBackedAsyncService.asPromise wraps sync operation in Promise", async () => {
    const service = new TestAsyncService();
    const result = await service.doAsyncIncrement();
    assert.equal(result, 1);
});
test("SyncBackedAsyncService.asPromise resolves immediately with sync result", async () => {
    const service = new TestAsyncService();
    const promise = service.callAsPromise((sync) => sync.counter * 10);
    const result = await promise;
    assert.equal(result, 0); // counter is 0 at this point
});
test("SyncBackedAsyncService.asPromise executes operation with correct sync context", async () => {
    const service = new TestAsyncService();
    await service.doAsyncIncrement();
    await service.doAsyncIncrement();
    await service.doAsyncIncrement();
    assert.equal(service.getCounterSync(), 3);
});
test("SyncBackedAsyncService.sync property is protected but accessible via getSyncService", () => {
    const service = new TestAsyncService();
    const sync = service.getSyncService();
    assert.ok(sync instanceof TestSyncService);
    assert.equal(sync.counter, 0);
});
test("SyncBackedAsyncService can chain multiple async operations", async () => {
    const service = new TestAsyncService();
    const results = [];
    results.push(await service.doAsyncIncrement());
    results.push(await service.doAsyncIncrement());
    results.push(await service.doAsyncIncrement());
    assert.deepEqual(results, [1, 2, 3]);
});
test("SyncBackedAsyncService.sync is shared across all operations", async () => {
    const service = new TestAsyncService();
    await service.doAsyncIncrement();
    await service.doAsyncIncrement();
    assert.equal(service.getCounterSync(), 2);
    await service.doAsyncIncrement();
    assert.equal(service.getCounterSync(), 3);
});
test("SyncBackedAsyncService preserves sync state between asPromise calls", async () => {
    const service = new TestAsyncService();
    await service.callAsPromise((sync) => {
        sync.increment();
        sync.increment();
    });
    assert.equal(service.getSyncService().counter, 2);
    await service.callAsPromise((sync) => {
        sync.increment();
    });
    assert.equal(service.getSyncService().counter, 3);
});
test("SyncBackedAsyncService handles sync operations that return objects", async () => {
    class StatefulService extends SyncBackedAsyncService {
        constructor() {
            super(() => ({ state: { value: 42 } }));
        }
        async getState() {
            return this.asPromise((sync) => sync.state);
        }
    }
    const service = new StatefulService();
    const state = await service.getState();
    assert.equal(state.value, 42);
});
test("SyncBackedAsyncService handles sync operations with complex return values", async () => {
    class ComplexSyncService {
        data = { nested: { deep: "value" }, array: [1, 2, 3] };
        getData() {
            return this.data;
        }
    }
    class ComplexAsyncService extends SyncBackedAsyncService {
        constructor() {
            super(() => new ComplexSyncService());
        }
        async fetchData() {
            return this.asPromise((sync) => sync.getData());
        }
    }
    const service = new ComplexAsyncService();
    const data = await service.fetchData();
    assert.equal(data.nested.deep, "value");
    assert.deepEqual(data.array, [1, 2, 3]);
});
test("SyncBackedAsyncService factory is called only once during construction", () => {
    let factoryCallCount = 0;
    class CountingService extends SyncBackedAsyncService {
        constructor() {
            super(() => {
                factoryCallCount++;
                return { count: 0 };
            });
        }
    }
    const service = new CountingService();
    assert.equal(factoryCallCount, 1);
    // Accessing sync does not call factory again
    service.getSyncService();
    assert.equal(factoryCallCount, 1);
});
test("SyncBackedAsyncService works with mutable sync state", async () => {
    class MutableSyncService {
        items = [];
        add(item) {
            this.items.push(item);
            return this.items.length;
        }
    }
    class MutableAsyncService extends SyncBackedAsyncService {
        constructor() {
            super(() => new MutableSyncService());
        }
        async addItem(item) {
            return this.asPromise((sync) => sync.add(item));
        }
        getItems() {
            return this.sync.items;
        }
    }
    const service = new MutableAsyncService();
    await service.addItem("first");
    await service.addItem("second");
    assert.deepEqual(service.getItems(), ["first", "second"]);
});
test("SyncBackedAsyncService.asPromise rejects when sync operation throws", async () => {
    class ThrowingSyncService {
        fail() {
            throw new Error("sync error");
        }
    }
    class ThrowingAsyncService extends SyncBackedAsyncService {
        constructor() {
            super(() => new ThrowingSyncService());
        }
        async doFailingOperation() {
            return this.asPromise((sync) => sync.fail());
        }
    }
    const service = new ThrowingAsyncService();
    await assert.rejects(async () => service.doFailingOperation(), (error) => error instanceof Error && error.message === "sync error");
});
test("SyncBackedAsyncService handles null and undefined returns from sync", async () => {
    class NullableSyncService {
        getNull() {
            return null;
        }
        getUndefined() {
            return undefined;
        }
    }
    class NullableAsyncService extends SyncBackedAsyncService {
        constructor() {
            super(() => new NullableSyncService());
        }
        async fetchNull() {
            return this.asPromise((sync) => sync.getNull());
        }
        async fetchUndefined() {
            return this.asPromise((sync) => sync.getUndefined());
        }
    }
    const service = new NullableAsyncService();
    assert.equal(await service.fetchNull(), null);
    assert.equal(await service.fetchUndefined(), undefined);
});
test("SyncBackedAsyncService works with numeric sync operations", async () => {
    class NumericSyncService {
        add(a, b) {
            return a + b;
        }
        multiply(a, b) {
            return a * b;
        }
    }
    class NumericAsyncService extends SyncBackedAsyncService {
        constructor() {
            super(() => new NumericSyncService());
        }
        async add(a, b) {
            return this.asPromise((sync) => sync.add(a, b));
        }
        async multiply(a, b) {
            return this.asPromise((sync) => sync.multiply(a, b));
        }
    }
    const service = new NumericAsyncService();
    assert.equal(await service.add(2, 3), 5);
    assert.equal(await service.multiply(4, 5), 20);
});
test("SyncBackedAsyncService asPromise returns a new Promise that resolves with operation result", async () => {
    class SimpleSyncService {
        value = 100;
    }
    class SimpleAsyncService extends SyncBackedAsyncService {
        constructor() {
            super(() => new SimpleSyncService());
        }
        getValueAsync() {
            return this.asPromise((sync) => sync.value);
        }
    }
    const service = new SimpleAsyncService();
    const promise = service.getValueAsync();
    assert.ok(promise instanceof Promise);
    const result = await promise;
    assert.equal(result, 100);
});
//# sourceMappingURL=sync-backed-async-service.test.js.map