import assert from "node:assert/strict";
import test from "node:test";

import { ProjectionInventoryService } from "../../../../../src/platform/state-evidence/events/projection-inventory-service.js";

test("ProjectionInventoryService exposes projection inventory and contract gaps", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();
  const summary = service.buildSummary();

  assert.equal(records.length, 9);
  assert.equal(records.some((record) => record.consumerId === "approval_projection"), true);
  assert.equal(records.every((record) => record.rebuildRequired), true);
  assert.equal(summary.total, records.length);
  assert.ok(summary.contractGaps.includes("gateway_summary"));
});
