import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SqliteLockAdapter,
  DISTRIBUTED_LOCKS_DDL,
} from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "locks.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(DISTRIBUTED_LOCKS_DDL);
  return { workspace, db };
}

test("SqliteLockAdapter integration: acquire and release basic lock", () => {
  const h = createHarness("aa-lock-basic-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    // Acquire lock
    const result = adapter.acquire({ lockKey: "resource-1", owner: "worker-1", ttlMs: 5000 });
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock!.lockKey, "resource-1");
    assert.equal(result.lock!.owner, "worker-1");
    assert.equal(result.lock!.status, "held");
    assert.ok(result.lock!.fencingToken > 0);

    // Release lock
    const released = adapter.release("resource-1", "worker-1");
    assert.equal(released, true);

    // Lock should be available again
    const result2 = adapter.acquire({ lockKey: "resource-1", owner: "worker-2" });
    assert.equal(result2.acquired, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteLockAdapter integration: lock acquisition fails when already held", () => {
  const h = createHarness("aa-lock-conflict-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    // First worker acquires
    const r1 = adapter.acquire({ lockKey: "exclusive", owner: "worker-1", ttlMs: 10000 });
    assert.equal(r1.acquired, true);

    // Second worker cannot acquire same lock
    const r2 = adapter.acquire({ lockKey: "exclusive", owner: "worker-2", ttlMs: 10000 });
    assert.equal(r2.acquired, false);
    assert.equal(r2.lock, undefined);

    // First worker releases
    adapter.release("exclusive", "worker-1");

    // Now second worker can acquire
    const r3 = adapter.acquire({ lockKey: "exclusive", owner: "worker-2" });
    assert.equal(r3.acquired, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteLockAdapter integration: extend lock ttl", () => {
  const h = createHarness("aa-lock-extend-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    const r1 = adapter.acquire({ lockKey: "extendable", owner: "worker-1", ttlMs: 1000 });
    assert.equal(r1.acquired, true);
    const originalToken = r1.lock!.fencingToken;

    // Extend the lock
    const extended = adapter.extend("extendable", "worker-1", 5000);
    assert.ok(extended !== null);
    assert.equal(extended!.fencingToken, originalToken + 1);

    // Inspect to verify ttl was updated
    const inspect = adapter.inspect("extendable");
    assert.ok(inspect !== null);
    assert.ok(inspect!.ttlMs >= 4000); // Should be extended
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteLockAdapter integration: force steal transfers lock", () => {
  const h = createHarness("aa-lock-steal-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    // Worker 1 acquires
    adapter.acquire({ lockKey: "preemptible", owner: "worker-1", ttlMs: 10000 });

    // Admin force-steals
    const stolen = adapter.forceSteal("preemptible", "admin-worker", "priority_override");
    assert.equal(stolen.owner, "admin-worker");
    assert.ok(stolen.fencingToken > 0);

    // Worker 1 can no longer release (wrong owner)
    const r = adapter.release("preemptible", "worker-1");
    assert.equal(r, false);

    // Admin can release
    const released = adapter.release("preemptible", "admin-worker");
    assert.equal(released, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteLockAdapter integration: inspect returns lock metadata", () => {
  const h = createHarness("aa-lock-inspect-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    adapter.acquire({
      lockKey: "metadata-test",
      owner: "worker-1",
      ttlMs: 5000,
    });

    const inspect = adapter.inspect("metadata-test");
    assert.ok(inspect !== null);
    assert.equal(inspect!.lockKey, "metadata-test");
    assert.equal(inspect!.owner, "worker-1");
    assert.equal(inspect!.status, "held");
    assert.ok(inspect!.fencingToken > 0);
    assert.ok(inspect!.ttlMs > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteLockAdapter integration: same owner can re-acquire after release", () => {
  const h = createHarness("aa-lock-reacquire-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    adapter.acquire({ lockKey: "reusable", owner: "worker-1" });
    adapter.release("reusable", "worker-1");

    // Same owner can acquire again
    const r = adapter.acquire({ lockKey: "reusable", owner: "worker-1" });
    assert.equal(r.acquired, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteLockAdapter integration: multiple independent locks can be held simultaneously", () => {
  const h = createHarness("aa-lock-multi-");
  try {
    const adapter = new SqliteLockAdapter(h.db.connection);

    const r1 = adapter.acquire({ lockKey: "resource-a", owner: "worker-1" });
    const r2 = adapter.acquire({ lockKey: "resource-b", owner: "worker-1" });
    const r3 = adapter.acquire({ lockKey: "resource-c", owner: "worker-1" });

    assert.equal(r1.acquired, true);
    assert.equal(r2.acquired, true);
    assert.equal(r3.acquired, true);

    // All can be released
    assert.equal(adapter.release("resource-a", "worker-1"), true);
    assert.equal(adapter.release("resource-b", "worker-1"), true);
    assert.equal(adapter.release("resource-c", "worker-1"), true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
