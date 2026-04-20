import assert from "node:assert/strict";
import test from "node:test";

import { loadPostgresPoolEnv } from "../../../../../src/platform/control-plane/config-center/postgres-pool-env.js";

test("loadPostgresPoolEnv prefers lock-specific env and parses pool settings", () => {
  const config = loadPostgresPoolEnv({
    AA_LOCK_POSTGRES_DSN: "postgresql://agent:secret@locks.internal/agent_os?sslmode=require",
    AA_LOCK_POSTGRES_POOL_MIN: "2",
    AA_LOCK_POSTGRES_POOL_MAX: "6",
    AA_LOCK_POSTGRES_IDLE_TIMEOUT_SECONDS: "45",
    AA_LOCK_POSTGRES_CONNECT_TIMEOUT_SECONDS: "12",
  });

  assert.equal(config.dsn, "postgresql://agent:secret@locks.internal/agent_os?sslmode=require");
  assert.equal(config.poolMin, 2);
  assert.equal(config.poolMax, 6);
  assert.equal(config.idleTimeoutSeconds, 45);
  assert.equal(config.connectTimeoutSeconds, 12);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test("loadPostgresPoolEnv falls back to storage postgres env", () => {
  const config = loadPostgresPoolEnv({
    AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_os?sslmode=require",
    AA_STORAGE_POSTGRES_POOL_MIN: "1",
    AA_STORAGE_POSTGRES_POOL_MAX: "4",
  });

  assert.equal(config.dsn, "postgresql://agent:secret@postgres.internal/agent_os?sslmode=require");
  assert.equal(config.poolMin, 1);
  assert.equal(config.poolMax, 4);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test("loadPostgresPoolEnv rejects invalid pool bounds", () => {
  assert.throws(
    () =>
      loadPostgresPoolEnv({
        AA_LOCK_POSTGRES_POOL_MIN: "9",
        AA_LOCK_POSTGRES_POOL_MAX: "3",
      }),
    /lock\.postgres\.pool_min_exceeds_max/,
  );
});
