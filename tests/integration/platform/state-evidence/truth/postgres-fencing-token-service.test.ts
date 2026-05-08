import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresFencingTokenService } from "../../../../../src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.js";
import { createTestPgDatabase, resetPgTables, shouldRunPgIntegration } from "../../../../helpers/pg-test-helper.js";

const pgSupport = shouldRunPgIntegration();

test("postgres-backed fencing services share exclusive fence state across instances", async () => {
  if (!pgSupport.enabled) {
    assert.match(
      pgSupport.reason ?? "",
      /(postgres runtime dependency is not installed|PostgreSQL test connection is not configured)/,
    );
    return;
  }

  const db = await createTestPgDatabase();
  try {
    await resetPgTables(db, ["fence_records"]);
    const service1 = createPostgresFencingTokenService(db, "pg-node-1");
    const service2 = createPostgresFencingTokenService(db, "pg-node-2");

    const firstFence = await service1.acquireFence("exec-pg-exclusive", "exclusive");
    assert.ok(firstFence != null);
    assert.equal(await service1.isFenceHeld("exec-pg-exclusive"), true);
    assert.equal(await service2.isFenceHeld("exec-pg-exclusive"), true);
    assert.equal(await service2.acquireFence("exec-pg-exclusive", "exclusive"), null);

    assert.equal(await service1.releaseFence("exec-pg-exclusive"), true);
    const reacquired = await service2.acquireFence("exec-pg-exclusive", "exclusive");
    assert.ok(reacquired != null);
  } finally {
    await db.close();
  }
});

test("postgres-backed fencing services keep shared fence counts in sync", async () => {
  if (!pgSupport.enabled) {
    assert.match(
      pgSupport.reason ?? "",
      /(postgres runtime dependency is not installed|PostgreSQL test connection is not configured)/,
    );
    return;
  }

  const db = await createTestPgDatabase();
  try {
    await resetPgTables(db, ["fence_records"]);
    const service1 = createPostgresFencingTokenService(db, "pg-node-1");
    const service2 = createPostgresFencingTokenService(db, "pg-node-2");

    await service1.acquireFence("exec-pg-shared", "shared");
    await service2.acquireFence("exec-pg-shared", "shared");

    assert.equal(await service1.getActiveFenceCount(), 2);
    assert.equal(await service2.getActiveFenceCount(), 2);
  } finally {
    await db.close();
  }
});
