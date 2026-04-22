import assert from "node:assert/strict";
import test from "node:test";

import { BenchmarkInventoryService } from "../../../../../src/platform/shared/stability/benchmark-inventory-service.js";

test("BenchmarkInventoryService exposes benchmark inventory and target-scale summary", () => {
  const service = new BenchmarkInventoryService();
  const records = service.listBenchmarks();
  const summary = service.buildSummary();

  assert.equal(records.length, 6);
  assert.equal(records.some((record) => record.architectureSection === "§31"), true);
  assert.equal(summary.total, 6);
  assert.equal(summary.byTargetScale.S4_contract_only, 1);
  assert.equal(summary.bySection["§27"], 2);
});
