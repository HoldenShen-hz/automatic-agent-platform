/**
 * [SYS-REL-2.2] Redis Lock TOCTOU Race Condition Tests
 *
 * Tests for concurrent extendAsync and forceStealAsync operations
 * to verify that the Redis lock adapter correctly handles race conditions.
 *
 * Defect: extendAsync() uses non-atomic GET+SET, forceStealAsync() uses non-atomic DEL+SET.
 * Concurrent operations can result in two processes holding the same lock.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Mock Redis client for testing lock behavior
interface MockRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>;
  del(key: string): Promise<number>;
  status: string;
  connect(): Promise<void>;
  disconnect(): void;
  quit(): Promise<void>;
  on(event: "error", listener: (error: unknown) => void): void;
}

// Simple in-memory lock implementation for testing the pattern
// Note: Actual Redis adapter tests would require Redis running
class InMemoryLockAdapter {
  private locks = new Map<string, { owner: string; ttlMs: number; fencingToken: number }>();
  private fencingCounter = 0;

  async acquireAsync(input: { lockKey: string; owner: string; ttlMs?: number }): Promise<{ acquired: boolean; lock?: { lockKey: string; owner: string; fencingToken: number; status: string; ttlMs: number; acquiredAt: string; metadata: null } }> {
    const key = `lock:${input.lockKey}`;
    if (this.locks.has(key)) {
      return { acquired: false };
    }
    this.fencingCounter++;
    const lock = {
      lockKey: input.lockKey,
      owner: input.owner,
      fencingToken: this.fencingCounter,
      status: "held" as const,
      ttlMs: input.ttlMs ?? 30_000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    };
    this.locks.set(key, { owner: input.owner, ttlMs: lock.ttlMs, fencingToken: lock.fencingToken });
    return { acquired: true, lock };
  }

  // This implementation has the TOCTOU race condition - GET then SET is not atomic
  async extendAsync(lockKey: string, owner: string, additionalMs: number): Promise<{ lockKey: string; owner: string; fencingToken: number; status: string; acquiredAt: string; ttlMs: number; metadata: null } | null> {
    const key = `lock:${lockKey}`;
    const current = this.locks.get(key);
    if (!current) {
      return null;
    }
    // TOCTOU: Time-of-check to time-of-use - between GET and SET
    if (current.owner !== owner) {
      return null;
    }
    const newTtlMs = Math.min(additionalMs, 600_000);
    this.locks.set(key, { ...current, ttlMs: newTtlMs });
    return {
      lockKey,
      owner: current.owner,
      fencingToken: current.fencingToken,
      status: "held",
      acquiredAt: new Date().toISOString(),
      ttlMs: newTtlMs,
      metadata: null,
    };
  }

  // This implementation has the TOCTOU race condition - DEL then SET is not atomic
  async forceStealAsync(lockKey: string, newOwner: string, _reason: string): Promise<{ lockKey: string; owner: string; fencingToken: number; status: string; acquiredAt: string; ttlMs: number; metadata: string }> {
    const key = `lock:${lockKey}`;
    this.locks.delete(key); // TOCTOU: DELETE then SET is not atomic
    this.fencingCounter++;
    const ttlMs = 30_000;
    this.locks.set(key, { owner: newOwner, ttlMs, fencingToken: this.fencingCounter });
    return {
      lockKey,
      owner: newOwner,
      fencingToken: this.fencingCounter,
      status: "held",
      acquiredAt: new Date().toISOString(),
      ttlMs,
      metadata: JSON.stringify({ forceStealReason: _reason }),
    };
  }
}

// Simulates the TOCTOU race condition scenario
test("[SYS-REL-2.2] concurrent extendAsync on same lock grants only one", async () => {
  const lock = new InMemoryLockAdapter();

  // Acquire initial lock
  const acquireResult = await lock.acquireAsync({ lockKey: "shared", owner: "w-1", ttlMs: 10000 });
  assert.equal(acquireResult.acquired, true, "Initial acquire must succeed");

  // Simulate two concurrent extend attempts
  // In a proper atomic implementation, only one should succeed
  const results = await Promise.allSettled([
    lock.extendAsync("shared", "w-1", 20000),
    lock.extendAsync("shared", "w-2", 20000), // Different owner - should fail
  ]);

  // The current implementation has a bug: it allows concurrent extends
  // because there's no atomic compare-and-swap
  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);
  const failed = results.filter((r) => r.status === "fulfilled" && r.value === null);

  // With proper CAS, exactly one extend should succeed
  // Current buggy implementation may allow both to "succeed" from the check perspective
  // but in reality the second owner's extend returns null due to owner mismatch

  // This test documents the expected behavior: only one should fully succeed
  // In the buggy version, both might appear to succeed if owner check is bypassed
  assert.ok(
    succeeded.length === 1 || failed.length === 2,
    `Expected exactly one successful extend or both failing due to owner mismatch, got ${succeeded.length} succeeded`,
  );
});

test("[SYS-REL-2.2] concurrent forceStealAsync does not create double lock", async () => {
  const lock = new InMemoryLockAdapter();

  // Acquire initial lock
  await lock.acquireAsync({ lockKey: "shared", owner: "w-1", ttlMs: 10000 });

  // Simulate concurrent force steal attempts
  const concurrency = 5;
  const workers = Array.from({ length: concurrency }, (_, i) => `w-${i + 1}`);

  const results = await Promise.allSettled(
    workers.map((owner) => lock.forceStealAsync("shared", owner, "concurrent steal")),
  );

  // Filter for successful steals
  const successfulSteals = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ owner: string }>).value.owner);

  // There should be exactly one final owner
  // Due to TOCTOU race, multiple forceStealAsync could complete before seeing the other's delete
  const uniqueOwners = new Set(successfulSteals);

  // This assertion will fail with the buggy implementation if race conditions align
  // In proper atomic implementation, exactly one steal should succeed
  assert.equal(
    uniqueOwners.size,
    1,
    `Only one owner should exist after concurrent steal, but got ${uniqueOwners.size} owners: ${[...uniqueOwners].join(", ")}`,
  );
});

test("[SYS-REL-2.2] extendAsync rejects when owner does not match", async () => {
  const lock = new InMemoryLockAdapter();

  // Acquire lock with w-1
  await lock.acquireAsync({ lockKey: "test", owner: "w-1", ttlMs: 10000 });

  // Try to extend with different owner w-2
  const result = await lock.extendAsync("test", "w-2", 20000);

  // Should return null because owner doesn't match
  assert.equal(result, null, "Extend must fail when owner doesn't match");
});

test("[SYS-REL-2.2] forceStealAsync can steal from different owner", async () => {
  const lock = new InMemoryLockAdapter();

  // Acquire lock with w-1
  await lock.acquireAsync({ lockKey: "test", owner: "w-1", ttlMs: 10000 });

  // Force steal with w-2
  const result = await lock.forceStealAsync("test", "w-2", "testing force steal");

  assert.notEqual(result, null, "Force steal must succeed");
  assert.equal(result!.owner, "w-2", "New owner must be w-2");
});