import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { createSqliteFencingTokenService } from "../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";

test("sqlite-backed fencing services share fence state across instances", () => {
  const db = new SqliteDatabase(`:memory:fence-shared-${Date.now()}`);
  db.migrate();

  const service1 = createSqliteFencingTokenService(db, "node-1");
  const service2 = createSqliteFencingTokenService(db, "node-2");

  const fence = service1.acquireFence("exec-shared", "exclusive");
  assert.ok(fence != null, "first node should acquire fence");
  assert.equal(service1.isFenceHeld("exec-shared"), true);
  assert.equal(service2.isFenceHeld("exec-shared"), true, "second service should observe the shared sqlite fence");
  assert.equal(service2.acquireFence("exec-shared", "exclusive"), null, "second node must be blocked by persisted fence state");

  assert.equal(service1.releaseFence("exec-shared"), true);
  const reacquired = service2.acquireFence("exec-shared", "exclusive");
  assert.ok(reacquired != null, "second node should acquire after persisted release");

  db.close();
});

test("sqlite-backed fencing services share active fence counts", () => {
  const db = new SqliteDatabase(`:memory:fence-count-${Date.now()}`);
  db.migrate();

  const service1 = createSqliteFencingTokenService(db, "node-1");
  const service2 = createSqliteFencingTokenService(db, "node-2");

  service1.acquireFence("exec-a", "exclusive");
  service2.acquireFence("exec-b", "shared");

  assert.equal(service1.getActiveFenceCount(), 2);
  assert.equal(service2.getActiveFenceCount(), 2);

  db.close();
});
