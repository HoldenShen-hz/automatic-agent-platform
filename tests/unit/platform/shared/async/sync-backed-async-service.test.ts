import assert from "node:assert/strict";
import test from "node:test";

import { SyncBackedAsyncService } from "../../../../../src/platform/shared/async/sync-backed-async-service.js";

class TestSyncService {
  public value = 0;

  public increment(): number {
    return ++this.value;
  }

  public getValue(): number {
    return this.value;
  }

  public compute(x: number, y: number): number {
    return x + y;
  }
}

class TestAsyncService extends SyncBackedAsyncService<TestSyncService> {
  public constructor() {
    super(() => new TestSyncService());
  }

  public async incrementAsync(): Promise<number> {
    return this.asPromise((sync) => sync.increment());
  }

  public async getValueAsync(): Promise<number> {
    return this.asPromise((sync) => sync.getValue());
  }

  public async computeAsync(x: number, y: number): Promise<number> {
    return this.asPromise((sync) => sync.compute(x, y));
  }

  public getSyncServiceDirectly(): TestSyncService {
    return this.getSyncService();
  }
}

test("SyncBackedAsyncService provides sync service via constructor factory", () => {
  const asyncService = new TestAsyncService();
  const sync = asyncService.getSyncServiceDirectly();
  assert.ok(sync instanceof TestSyncService);
});

test("asPromise wraps sync operation in resolved promise", async () => {
  const asyncService = new TestAsyncService();
  const result = await asyncService.incrementAsync();
  assert.equal(result, 1);
});

test("asPromise preserves return value of sync operation", async () => {
  const asyncService = new TestAsyncService();
  const result = await asyncService.computeAsync(3, 5);
  assert.equal(result, 8);
});

test("asPromise does not mutate sync state incorrectly", async () => {
  const asyncService = new TestAsyncService();
  await asyncService.incrementAsync();
  await asyncService.incrementAsync();
  const value = await asyncService.getValueAsync();
  assert.equal(value, 2);
});

test("getSyncService returns the underlying sync service", () => {
  const asyncService = new TestAsyncService();
  const sync = asyncService.getSyncService();
  assert.equal(sync.value, 0);
  sync.increment();
  assert.equal(sync.value, 1);
  assert.equal(asyncService.getSyncService().value, 1);
});

test("asPromise handles null return values", async () => {
  class NullSyncService {
    public getNull(): null {
      return null;
    }
  }
  class NullAsyncService extends SyncBackedAsyncService<NullSyncService> {
    public constructor() {
      super(() => new NullSyncService());
    }

    public async getNullAsync(): Promise<null> {
      return this.asPromise((sync) => sync.getNull());
    }
  }
  const asyncService = new NullAsyncService();
  const result = await asyncService.getNullAsync();
  assert.equal(result, null);
});

test("asPromise handles undefined return values", async () => {
  class UndefinedSyncService {
    public getUndefined(): undefined {
      return undefined;
    }
  }
  class UndefinedAsyncService extends SyncBackedAsyncService<UndefinedSyncService> {
    public constructor() {
      super(() => new UndefinedSyncService());
    }

    public async getUndefinedAsync(): Promise<undefined> {
      return this.asPromise((sync) => sync.getUndefined());
    }
  }
  const asyncService = new UndefinedAsyncService();
  const result = await asyncService.getUndefinedAsync();
  assert.equal(result, undefined);
});

test("asPromise handles object return values", async () => {
  class ObjectSyncService {
    public getObject(): { key: string; value: number } {
      return { key: "test", value: 42 };
    }
  }
  class ObjectAsyncService extends SyncBackedAsyncService<ObjectSyncService> {
    public constructor() {
      super(() => new ObjectSyncService());
    }

    public async getObjectAsync(): Promise<{ key: string; value: number }> {
      return this.asPromise((sync) => sync.getObject());
    }
  }
  const asyncService = new ObjectAsyncService();
  const result = await asyncService.getObjectAsync();
  assert.deepEqual(result, { key: "test", value: 42 });
});

test("asPromise handles array return values", async () => {
  class ArraySyncService {
    public getArray(): number[] {
      return [1, 2, 3];
    }
  }
  class ArrayAsyncService extends SyncBackedAsyncService<ArraySyncService> {
    public constructor() {
      super(() => new ArraySyncService());
    }

    public async getArrayAsync(): Promise<number[]> {
      return this.asPromise((sync) => sync.getArray());
    }
  }
  const asyncService = new ArrayAsyncService();
  const result = await asyncService.getArrayAsync();
  assert.deepEqual(result, [1, 2, 3]);
});

test("multiple concurrent asPromise calls are independent", async () => {
  const asyncService = new TestAsyncService();
  const [result1, result2, result3] = await Promise.all([
    asyncService.computeAsync(1, 2),
    asyncService.computeAsync(3, 4),
    asyncService.computeAsync(5, 6),
  ]);
  assert.equal(result1, 3);
  assert.equal(result2, 7);
  assert.equal(result3, 11);
});

test("asPromise handles boolean return values", async () => {
  class BooleanSyncService {
    public isReady(): boolean {
      return true;
    }
    public hasData(): boolean {
      return false;
    }
  }
  class BooleanAsyncService extends SyncBackedAsyncService<BooleanSyncService> {
    public constructor() {
      super(() => new BooleanSyncService());
    }

    public async isReadyAsync(): Promise<boolean> {
      return this.asPromise((sync) => sync.isReady());
    }
    public async hasDataAsync(): Promise<boolean> {
      return this.asPromise((sync) => sync.hasData());
    }
  }
  const asyncService = new BooleanAsyncService();
  const ready = await asyncService.isReadyAsync();
  const hasData = await asyncService.hasDataAsync();
  assert.equal(ready, true);
  assert.equal(hasData, false);
});
