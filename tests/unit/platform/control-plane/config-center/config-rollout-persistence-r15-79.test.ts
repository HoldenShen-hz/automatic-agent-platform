import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  ConfigRolloutService,
  RolloutPhase,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteConfigRolloutStore } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/config-rollout-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("R15-79: active canary rollout survives service restart via durable store", () => {
  const workspace = createTempWorkspace("aa-config-rollout-r15-79-");
  const dbPath = join(workspace, "config-rollouts.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    const firstService = new ConfigRolloutService({
      store: new SqliteConfigRolloutStore(db.connection),
    });
    const rollout = firstService.startRollout("runtime.timeout", "platform", null, 100, {
      ticket: "R15-79",
    });

    assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);

    const restartedService = new ConfigRolloutService({
      store: new SqliteConfigRolloutStore(db.connection),
    });
    const recovered = restartedService.getActiveRollout("runtime.timeout", "platform", null);

    assert.ok(recovered);
    assert.equal(recovered?.rolloutId, rollout.rolloutId);
    assert.equal(recovered?.stage.phase, RolloutPhase.CANARY_5);
    assert.equal(recovered?.currentPercentage, 5);
    assert.deepEqual(recovered?.metadata, { ticket: "R15-79" });
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("R15-79: promoted rollout persists latest stage across service restart", () => {
  const workspace = createTempWorkspace("aa-config-rollout-r15-79-promote-");
  const dbPath = join(workspace, "config-rollouts.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    const service = new ConfigRolloutService({
      store: new SqliteConfigRolloutStore(db.connection),
    });
    const rollout = service.startRollout("routing.policy", "tenant", "tenant-1", 100);
    service.promoteRollout(rollout.rolloutId);

    const restartedService = new ConfigRolloutService({
      store: new SqliteConfigRolloutStore(db.connection),
    });
    const recovered = restartedService.getActiveRollout("routing.policy", "tenant", "tenant-1");

    assert.ok(recovered);
    assert.equal(recovered?.stage.phase, RolloutPhase.CANARY_25);
    assert.equal(recovered?.currentPercentage, 25);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
