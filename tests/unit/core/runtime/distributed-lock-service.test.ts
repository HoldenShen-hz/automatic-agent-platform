import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The distributed-lock-service.ts file is a re-export barrel that exports
// everything from the distributed-lock module. This test file verifies
// that the exports are properly structured and accessible.

const DISTRIBUTED_LOCK_SERVICE_PATH = join(__dirname, "..", "..", "..", "..", "src", "core", "runtime", "distributed-lock-service.js");

test("barrel module exports are accessible", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  const keys = Object.keys(mod);
  assert.ok(keys.length > 0, "Expected exports from the barrel");
});

test("barrel re-exports distributed-lock-types", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  // distributed-lock-types exports LockDataSchema, transitionLock, etc.
  assert.ok("LockDataSchema" in mod || "transitionLock" in mod, "should re-export from distributed-lock-types");
});

test("barrel re-exports locking-support", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  // locking-support exports lockLogger, defaultPostgresFactory, inferPgSslFromDsn
  assert.ok("lockLogger" in mod || "defaultPostgresFactory" in mod, "should re-export from locking-support");
});

test("barrel re-exports sqlite-lock-adapter", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  assert.ok("SqliteLockAdapter" in mod, "should re-export SqliteLockAdapter");
});

test("barrel re-exports pg-advisory-lock-adapter", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  assert.ok("PgAdvisoryLockAdapter" in mod, "should re-export PgAdvisoryLockAdapter");
});

test("barrel re-exports redis-lock-adapter", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  assert.ok("RedisLockAdapter" in mod, "should re-export RedisLockAdapter");
});

test("barrel re-exports distributed-lock-factory", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  assert.ok("createLockAdapter" in mod, "should re-export createLockAdapter");
});

test("module exports include createLockAdapter function", async () => {
  const mod = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod !== undefined);
  assert.equal(typeof mod.createLockAdapter, "function", "should export createLockAdapter function");
});

test("multiple imports return same module reference", async () => {
  const mod1 = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  const mod2 = await import("file://" + DISTRIBUTED_LOCK_SERVICE_PATH);
  assert.ok(mod1 === mod2);
});