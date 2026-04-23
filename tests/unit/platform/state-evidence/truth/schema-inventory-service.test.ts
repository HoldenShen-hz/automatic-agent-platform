import assert from "node:assert/strict";
import test from "node:test";

import { SchemaInventoryService } from "../../../../../src/platform/state-evidence/truth/schema-inventory-service.js";

test("SchemaInventoryService exposes authoritative logical table inventory", () => {
  const service = new SchemaInventoryService();
  const tables = service.listTables();
  const summary = service.buildSummary();

  assert.equal(summary.totalTables, 86);
  assert.equal(tables.length, 86);
  assert.ok(tables.some((table) => table.tableName === "tasks" && table.category === "core_truth"));
  assert.ok(tables.some((table) => table.tableName === "outbox" && table.category === "reliability_extension"));
  assert.ok(tables.some((table) => table.tableName === "eval_runs" && table.category === "governance_extension"));
  assert.ok(tables.some((table) => table.tableName === "deployment_bindings" && table.category === "runtime_extension"));
});
