import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncBackedAsyncService } from "../../../../src/platform/shared/async/sync-backed-async-service.js";

// Concrete implementation for testing
class TestSyncService {
  public value = 42;

  public getValue(): number {
    return this.value;
  }

  public multiply(factor: number): number {
    return this.value * factor;
  }
}

class TestAsyncService extends SyncBackedAsyncService<TestSyncService> {
  public async getValueAsync(): Promise<number> {
    return this.asPromise((sync) => sync.getValue());
  }

  public async multiplyAsync(factor: number): Promise<number> {
    return this.asPromise((sync) => sync.multiply(factor));
  }

  public getSync(): TestSyncService {
    return this.getSyncService();
  }
}

test("SyncBackedAsyncService - asPromise wraps sync operation", async () => {
  const service = new TestAsyncService(() => new TestSyncService());

  const result = await service.getValueAsync();
  assert.equal(result, 42);
});

test("SyncBackedAsyncService - getSyncService returns the sync instance", () => {
  const service = new TestAsyncService(() => new TestSyncService());
  const sync = service.getSyncService();

  assert.equal(sync.value, 42);
  assert.ok(sync instanceof TestSyncService);
});

test("SyncBackedAsyncService - asPromise with operation taking parameter", async () => {
  const service = new TestAsyncService(() => new TestSyncService());

  const result = await service.multiplyAsync(3);
  assert.equal(result, 126);
});

test("SyncBackedAsyncService - factory is called once on construction", () => {
  let factoryCalls = 0;
  const factory = () => {
    factoryCalls++;
    return new TestSyncService();
  };

  new TestAsyncService(factory);
  assert.equal(factoryCalls, 1);
});

test("SyncBackedAsyncService - sync instance is shared", () => {
  const service = new TestAsyncService(() => new TestSyncService());

  const sync1 = service.getSyncService();
  const sync2 = service.getSyncService();

  assert.ok(sync1 === sync2);
});

test("SyncBackedAsyncService - asPromise preserves this context", async () => {
  class MutableAsyncService extends SyncBackedAsyncService<TestSyncService> {
    public async mutateAndGet(): Promise<number> {
      return this.asPromise((sync) => {
        sync.value = 100;
        return sync.getValue();
      });
    }
  }

  const service = new MutableAsyncService(() => new TestSyncService());
  const result = await service.mutateAndGet();

  assert.equal(result, 100);
  assert.equal(service.getSyncService().value, 100);
});