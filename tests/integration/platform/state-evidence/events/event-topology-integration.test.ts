import assert from "node:assert/strict";
import test from "node:test";

import { EventTopologyService } from "../../../../../src/platform/state-evidence/events/event-topology-service.js";
import { EventOpsService } from "../../../../../src/platform/state-evidence/events/event-ops-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { join } from "node:path";

test("integration: event topology summary covers default tier1 consumers exposed by event ops", () => {
  const workspace = createTempWorkspace("aa-event-topology-");
  try {
    const db = new SqliteDatabase(join(workspace, "event-topology.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const ops = new EventOpsService(db, store);
    const topology = new EventTopologyService();
    const summary = topology.buildSummary();

    for (const consumerId of ops.listDefaultConsumers()) {
      assert.ok(summary.consumers.includes(consumerId));
    }
    assert.ok(summary.tierCounts.tier_1 > 0);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
