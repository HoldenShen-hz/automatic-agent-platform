/**
 * Unit tests for scale-ecosystem/cost-attribution re-exports
 *
 * @see src/scale-ecosystem/cost-attribution/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as costAttribution from "../../../../src/scale-ecosystem/cost-attribution/index.js";

test("cost-attribution re-exports CostOptimizationService", () => {
  assert.ok(
    "CostOptimizationService" in costAttribution,
    "should export CostOptimizationService"
  );
  assert.strictEqual(
    typeof costAttribution.CostOptimizationService,
    "function",
    "CostOptimizationService should be a constructor"
  );
});

test("cost-attribution CostOptimizationService is instantiable", () => {
  const Service = costAttribution.CostOptimizationService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.recordCost, "function", "should have recordCost method");
  assert.strictEqual(typeof instance.aggregate, "function", "should have aggregate method");
  assert.strictEqual(typeof instance.buildRecommendations, "function", "should have buildRecommendations method");
  assert.strictEqual(typeof instance.simulate, "function", "should have simulate method");
  assert.strictEqual(typeof instance.buildDashboardSlice, "function", "should have buildDashboardSlice method");
  assert.strictEqual(typeof instance.listRecords, "function", "should have listRecords method");
});
