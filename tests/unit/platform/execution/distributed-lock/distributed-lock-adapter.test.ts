import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/execution/distributed-lock/sqlite-lock-adapter.js";
import { RedisLockAdapter } from "../../../../../src/platform/execution/distributed-lock/redis-lock-adapter.js";
import type { DistributedLockAdapter } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-types.js";
import type { LockRecord, AcquireLockInput, AcquireLockResult } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-types.js";

test("DistributedLockAdapter interface requires backendKind", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };
  assert.equal(adapter.backendKind, "test");
});

test("DistributedLockAdapter acquire returns AcquireLockResult shape", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: (input: AcquireLockInput) => {
      assert.equal(input.lockKey, "test-key");
      assert.equal(input.owner, "test-owner");
      assert.equal(input.ttlMs, 30000);
      return { acquired: false };
    },
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };

  const result = adapter.acquire({ lockKey: "test-key", owner: "test-owner", ttlMs: 30000 });
  assert.equal(result.acquired, false);
});

test("DistributedLockAdapter release returns boolean", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: (lockKey: string, owner: string) => {
      assert.equal(lockKey, "test-key");
      assert.equal(owner, "test-owner");
      return true;
    },
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };

  const released = adapter.release("test-key", "test-owner");
  assert.equal(released, true);
});

test("DistributedLockAdapter extend returns LockRecord shape or null", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: (lockKey: string, owner: string, additionalMs: number) => {
      assert.equal(lockKey, "test-key");
      assert.equal(owner, "test-owner");
      assert.equal(additionalMs, 10000);
      return {
        lockKey,
        owner,
        fencingToken: 1,
        status: "held",
      };
    },
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };

  const result = adapter.extend("test-key", "test-owner", 10000);
  assert.ok(result !== null);
  assert.equal(result!.fencingToken, 1);
});

test("DistributedLockAdapter extend returns null when lock not found", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };

  const result = adapter.extend("nonexistent", "owner", 10000);
  assert.equal(result, null);
});

test("DistributedLockAdapter forceSteal returns LockRecord shape", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: (lockKey: string, newOwner: string, reason: string) => {
      assert.equal(lockKey, "test-key");
      assert.equal(newOwner, "new-owner");
      assert.equal(reason, "stolen");
      return {
        lockKey,
        owner: newOwner,
        fencingToken: 2,
        status: "held",
      };
    },
    inspect: () => null,
  };

  const result = adapter.forceSteal("test-key", "new-owner", "stolen");
  assert.equal(result.owner, "new-owner");
  assert.equal(result.fencingToken, 2);
});

test("DistributedLockAdapter inspect returns LockRecord or null", () => {
  const adapter: DistributedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: (lockKey: string) => {
      if (lockKey === "nonexistent") return null;
      return {
        lockKey,
        owner: "owner",
        fencingToken: 1,
        status: "held",
        ttlMs: 30000,
        metadata: null,
      };
    },
  };

  const result = adapter.inspect("test-key");
  assert.ok(result !== null);
  assert.equal(result!.lockKey, "test-key");

  const notFound = adapter.inspect("nonexistent");
  assert.equal(notFound, null);
});

test("LockRecord type has all required fields", () => {
  const record: LockRecord = {
    lockKey: "test-key",
    owner: "test-owner",
    fencingToken: 1,
    status: "held",
    acquiredAt: new Date().toISOString(),
    ttlMs: 30000,
    metadata: null,
  };

  assert.equal(record.lockKey, "test-key");
  assert.equal(record.owner, "test-owner");
  assert.equal(record.fencingToken, 1);
  assert.equal(record.status, "held");
  assert.ok(record.acquiredAt !== undefined);
  assert.equal(record.ttlMs, 30000);
  assert.equal(record.metadata, null);
});

test("AcquireLockInput type is usable", () => {
  const input: AcquireLockInput = {
    lockKey: "test-key",
    owner: "test-owner",
    ttlMs: 60000,
  };

  assert.equal(input.lockKey, "test-key");
  assert.equal(input.owner, "test-owner");
  assert.equal(input.ttlMs, 60000);
});

test("AcquireLockResult with successful acquisition", () => {
  const result: AcquireLockResult = {
    acquired: true,
    lock: {
      lockKey: "test-key",
      owner: "test-owner",
      fencingToken: 1,
      status: "held",
      acquiredAt: new Date().toISOString(),
      ttlMs: 30000,
      metadata: null,
    },
  };

  assert.equal(result.acquired, true);
  assert.ok(result.lock !== undefined);
  assert.equal(result.lock!.fencingToken, 1);
});

test("AcquireLockResult with failed acquisition", () => {
  const result: AcquireLockResult = {
    acquired: false,
  };

  assert.equal(result.acquired, false);
  assert.equal(result.lock, undefined);
});

test("SqliteLockAdapter is a constructor function", () => {
  assert.ok(typeof SqliteLockAdapter === "function");
});

test("RedisLockAdapter is a constructor function", () => {
  assert.ok(typeof RedisLockAdapter === "function");
});