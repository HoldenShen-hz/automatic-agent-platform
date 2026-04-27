import assert from "node:assert/strict";
import test from "node:test";

import { SyncBackedAsyncService } from "../../../../../src/platform/shared/async/sync-backed-async-service.js";

test("SyncBackedAsyncService initializes sync object via factory", () => {
  class SimpleSync {
    public value = 42;
  }
  class SimpleAsync extends SyncBackedAsyncService<SimpleSync> {
    public constructor() {
      super(() => new SimpleSync());
    }
  }
  const service = new SimpleAsync();
  assert.equal(service.getSyncService().value, 42);
});

test("SyncBackedAsyncService.asPromise wraps sync result in Promise", async () => {
  class AdderSync {
    public add(a: number, b: number): number {
      return a + b;
    }
  }
  class AdderAsync extends SyncBackedAsyncService<AdderSync> {
    public constructor() {
      super(() => new AdderSync());
    }
    public async add(a: number, b: number): Promise<number> {
      return this.asPromise((sync) => sync.add(a, b));
    }
  }
  const service = new AdderAsync();
  const result = await service.add(3, 4);
  assert.equal(result, 7);
});

test("SyncBackedAsyncService.asPromise executes immediately", async () => {
  class CounterSync {
    public count = 0;
    public increment(): number {
      return ++this.count;
    }
  }
  class CounterAsync extends SyncBackedAsyncService<CounterSync> {
    public constructor() {
      super(() => new CounterSync());
    }
    public async increment(): Promise<number> {
      return this.asPromise((sync) => sync.increment());
    }
  }
  const service = new CounterAsync();
  const result = await service.increment();
  assert.equal(result, 1);
});

test("SyncBackedAsyncService.sync is shared across operations", async () => {
  class SharedSync {
    public items: string[] = [];
    public push(item: string): number {
      this.items.push(item);
      return this.items.length;
    }
  }
  class SharedAsync extends SyncBackedAsyncService<SharedSync> {
    public constructor() {
      super(() => new SharedSync());
    }
    public async push(item: string): Promise<number> {
      return this.asPromise((sync) => sync.push(item));
    }
  }
  const service = new SharedAsync();
  await service.push("first");
  await service.push("second");
  assert.deepEqual(service.getSyncService().items, ["first", "second"]);
});

test("SyncBackedAsyncService.asPromise rejects on sync error", async () => {
  class FailingSync {
    public fail(): never {
      throw new Error("operation failed");
    }
  }
  class FailingAsync extends SyncBackedAsyncService<FailingSync> {
    public constructor() {
      super(() => new FailingSync());
    }
    public async doFail(): Promise<void> {
      return this.asPromise((sync) => sync.fail());
    }
  }
  const service = new FailingAsync();
  await assert.rejects(
    async () => service.doFail(),
    (err: unknown) => err instanceof Error && err.message === "operation failed",
  );
});

test("SyncBackedAsyncService handles null return value", async () => {
  class NullableSync {
    public getNull(): null {
      return null;
    }
  }
  class NullableAsync extends SyncBackedAsyncService<NullableSync> {
    public constructor() {
      super(() => new NullableSync());
    }
    public async fetchNull(): Promise<null> {
      return this.asPromise((sync) => sync.getNull());
    }
  }
  const service = new NullableAsync();
  const result = await service.fetchNull();
  assert.equal(result, null);
});

test("SyncBackedAsyncService handles undefined return value", async () => {
  class UndefinedSync {
    public getUndefined(): undefined {
      return undefined;
    }
  }
  class UndefinedAsync extends SyncBackedAsyncService<UndefinedSync> {
    public constructor() {
      super(() => new UndefinedSync());
    }
    public async fetchUndefined(): Promise<undefined> {
      return this.asPromise((sync) => sync.getUndefined());
    }
  }
  const service = new UndefinedAsync();
  const result = await service.fetchUndefined();
  assert.equal(result, undefined);
});

test("SyncBackedAsyncService preserves sync state between multiple calls", async () => {
  class StateSync {
    public total = 0;
    public add(n: number): number {
      this.total += n;
      return this.total;
    }
  }
  class StateAsync extends SyncBackedAsyncService<StateSync> {
    public constructor() {
      super(() => new StateSync());
    }
    public async add(n: number): Promise<number> {
      return this.asPromise((sync) => sync.add(n));
    }
  }
  const service = new StateAsync();
  await service.add(5);
  await service.add(3);
  const finalTotal = await service.add(2);
  assert.equal(finalTotal, 10);
  assert.equal(service.getSyncService().total, 10);
});

test("SyncBackedAsyncService factory called exactly once", () => {
  let factoryCalls = 0;
  class CountingService extends SyncBackedAsyncService<{ n: number }> {
    public constructor() {
      super(() => {
        factoryCalls++;
        return { n: 0 };
      });
    }
  }
  const service = new CountingService();
  assert.equal(factoryCalls, 1);
  service.getSyncService();
  assert.equal(factoryCalls, 1);
  service.getSyncService();
  assert.equal(factoryCalls, 1);
});

test("SyncBackedAsyncService works with complex nested objects", async () => {
  class ComplexSync {
    public data = { nested: { value: 123 }, arr: [1, 2, 3] };
    public getData() {
      return this.data;
    }
  }
  class ComplexAsync extends SyncBackedAsyncService<ComplexSync> {
    public constructor() {
      super(() => new ComplexSync());
    }
    public async getData() {
      return this.asPromise((sync) => sync.getData());
    }
  }
  const service = new ComplexAsync();
  const data = await service.getData();
  assert.equal(data.nested.value, 123);
  assert.deepEqual(data.arr, [1, 2, 3]);
});

test("SyncBackedAsyncService.sync property has correct type", () => {
  class MySync {
    public x = 10;
  }
  class MyAsync extends SyncBackedAsyncService<MySync> {
    public constructor() {
      super(() => new MySync());
    }
  }
  const service = new MyAsync();
  const sync = service.getSyncService();
  assert.ok(sync instanceof MySync);
  assert.equal(sync.x, 10);
});

test("SyncBackedAsyncService handles 0 and false return values", async () => {
  class ZeroFalseSync {
    public zero(): number {
      return 0;
    }
    public false(): boolean {
      return false;
    }
  }
  class ZeroFalseAsync extends SyncBackedAsyncService<ZeroFalseSync> {
    public constructor() {
      super(() => new ZeroFalseSync());
    }
    public async zero(): Promise<number> {
      return this.asPromise((sync) => sync.zero());
    }
    public async false(): Promise<boolean> {
      return this.asPromise((sync) => sync.false());
    }
  }
  const service = new ZeroFalseAsync();
  assert.equal(await service.zero(), 0);
  assert.equal(await service.false(), false);
});

test("SyncBackedAsyncService can wrap operations that return arrays", async () => {
  class ArraySync {
    public items = [1, 2, 3];
    public getItems(): number[] {
      return this.items;
    }
  }
  class ArrayAsync extends SyncBackedAsyncService<ArraySync> {
    public constructor() {
      super(() => new ArraySync());
    }
    public async getItems(): Promise<number[]> {
      return this.asPromise((sync) => sync.getItems());
    }
  }
  const service = new ArrayAsync();
  const items = await service.getItems();
  assert.deepEqual(items, [1, 2, 3]);
});

test("SyncBackedAsyncService asPromise returns a new Promise each time", async () => {
  class IncrementSync {
    public n = 0;
    public inc(): number {
      return ++this.n;
    }
  }
  class IncrementAsync extends SyncBackedAsyncService<IncrementSync> {
    public constructor() {
      super(() => new IncrementSync());
    }
    public async inc(): Promise<number> {
      return this.asPromise((sync) => sync.inc());
    }
  }
  const service = new IncrementAsync();
  const p1 = service.asPromise((sync) => sync.n);
  const p2 = service.asPromise((sync) => sync.n);
  // Both should resolve to 0 (not yet incremented)
  assert.equal(await p1, 0);
  assert.equal(await p2, 0);
  // Now increment
  await service.inc();
  const p3 = service.asPromise((sync) => sync.n);
  assert.equal(await p3, 1);
});

test("SyncBackedAsyncService sync access does not mutate", () => {
  class ReadOnlySync {
    public readonly items = ["a", "b", "c"];
    public getItems(): readonly string[] {
      return this.items;
    }
  }
  class ReadOnlyAsync extends SyncBackedAsyncService<ReadOnlySync> {
    public constructor() {
      super(() => new ReadOnlySync());
    }
  }
  const service = new ReadOnlyAsync();
  const items = service.getSyncService().getItems();
  assert.deepEqual(items, ["a", "b", "c"]);
});

test("SyncBackedAsyncService works with map and set operations", async () => {
  class MapSetSync {
    private map = new Map<string, number>();
    private set = new Set<number>();
    public setItem(key: string, value: number): void {
      this.map.set(key, value);
    }
    public getItem(key: string): number | undefined {
      return this.map.get(key);
    }
    public addToSet(value: number): void {
      this.set.add(value);
    }
    public hasInSet(value: number): boolean {
      return this.set.has(value);
    }
  }
  class MapSetAsync extends SyncBackedAsyncService<MapSetSync> {
    public constructor() {
      super(() => new MapSetSync());
    }
    public async setItem(key: string, value: number): Promise<void> {
      return this.asPromise((sync) => sync.setItem(key, value));
    }
    public async getItem(key: string): Promise<number | undefined> {
      return this.asPromise((sync) => sync.getItem(key));
    }
    public async addToSet(value: number): Promise<void> {
      return this.asPromise((sync) => sync.addToSet(value));
    }
    public async hasInSet(value: number): Promise<boolean> {
      return this.asPromise((sync) => sync.hasInSet(value));
    }
  }
  const service = new MapSetAsync();
  await service.setItem("key1", 100);
  const val = await service.getItem("key1");
  assert.equal(val, 100);
  await service.addToSet(42);
  const has = await service.hasInSet(42);
  assert.equal(has, true);
});

test("SyncBackedAsyncService works with boolean logic operations", async () => {
  class BoolSync {
    public flag = true;
    public invert(): boolean {
      this.flag = !this.flag;
      return this.flag;
    }
  }
  class BoolAsync extends SyncBackedAsyncService<BoolSync> {
    public constructor() {
      super(() => new BoolSync());
    }
    public async invert(): Promise<boolean> {
      return this.asPromise((sync) => sync.invert());
    }
  }
  const service = new BoolAsync();
  assert.equal(service.getSyncService().flag, true);
  const result1 = await service.invert();
  assert.equal(result1, false);
  const result2 = await service.invert();
  assert.equal(result2, true);
});