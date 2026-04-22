/**
 * Unit tests for MultiRegion barrel exports
 *
 * @see src/scale-ecosystem/multi-region/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as multiRegion from "../../../src/scale-ecosystem/multi-region/index.js";

test("multi-region barrel exports cross-region-routing-service", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("crossregionrouting") || k.toLowerCase().includes("routing")),
    "should export cross-region-routing-service"
  );
});

test("multi-region barrel exports data-replicator", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("replicator") || k.toLowerCase().includes("replication")),
    "should export data-replicator"
  );
});

test("multi-region barrel exports failover-controller", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("failover")),
    "should export failover-controller"
  );
});

test("multi-region barrel exports region routing functions", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("routing") || k.toLowerCase().includes("select")),
    "should export region routing functions"
  );
});

test("multi-region barrel exports cdc-replication-service", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("cdcreplication") || k.toLowerCase().includes("cdc")),
    "should export cdc-replication-service"
  );
});

test("multi-region barrel exports region-health-check-service", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("regionhealth") || k.toLowerCase().includes("health")),
    "should export region-health-check-service"
  );
});

test("multi-region barrel has multiple exports", () => {
  const keys = Object.keys(multiRegion);
  assert.ok(keys.length >= 4, "should have multiple exports (routing, replication, failover, router)");
});
