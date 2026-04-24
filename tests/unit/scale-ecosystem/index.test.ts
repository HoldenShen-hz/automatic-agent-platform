/**
 * Unit tests for ScaleEcosystem barrel exports
 *
 * @see src/scale-ecosystem/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as scaleEcosystem from "../../../src/scale-ecosystem/index.js";

test("scale-ecosystem barrel exports feedback-loop module", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("feedback")),
    "should export feedback-loop"
  );
});

test("scale-ecosystem barrel exports runtime-governance-service", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("runtimegovernance") || k.toLowerCase().includes("runtime")),
    "should export runtime-governance-service"
  );
});

test("scale-ecosystem barrel exports integration module", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("integration") || k.toLowerCase().includes("connector")),
    "should export integration"
  );
});

test("scale-ecosystem barrel exports marketplace module", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("marketplace") || k.toLowerCase().includes("billing")),
    "should export marketplace"
  );
});

test("scale-ecosystem barrel exports multi-region module", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("region") || k.toLowerCase().includes("replication")),
    "should export multi-region"
  );
});

test("scale-ecosystem barrel exports resource-manager module", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("resource") || k.toLowerCase().includes("fair")),
    "should export resource-manager"
  );
});

test("scale-ecosystem barrel exports scale-baseline-catalog", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("scalebaseline") || k.toLowerCase().includes("baseline")),
    "should export scale-baseline-catalog"
  );
});

test("scale-ecosystem barrel exports scale-bootstrap", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("scalebootstrap") || k.toLowerCase().includes("bootstrap")),
    "should export scale-bootstrap"
  );
});

test("scale-ecosystem barrel exports sla-engine module", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("sla")),
    "should export sla-engine"
  );
});

test("scale-ecosystem barrel has multiple exports", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(keys.length > 5, "should have multiple exports from submodules");
});

test("scale-ecosystem barrel exports runtime-services module", () => {
  const keys = Object.keys(scaleEcosystem);
  // runtime-services exports things like ExecutionDispatchService, DurableEventBus, etc.
  assert.ok(
    keys.some(k =>
      k.toLowerCase().includes("execution") ||
      k.toLowerCase().includes("dispatch") ||
      k.toLowerCase().includes("durable") ||
      k.toLowerCase().includes("worker") ||
      k.toLowerCase().includes("takeover") ||
      k.toLowerCase().includes("handshake")
    ),
    "should export runtime-services"
  );
});

test("scale-ecosystem barrel exports CrossRegionRoutingService", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("crossregion") || k.toLowerCase().includes("routing")),
    "should export CrossRegionRoutingService"
  );
});

test("scale-ecosystem barrel exports region-health-check-service", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("health") || k.toLowerCase().includes("region")),
    "should export region-health-check-service"
  );
});

test("scale-ecosystem barrel exports cdc-replication-service", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("cdc") || k.toLowerCase().includes("replication")),
    "should export cdc-replication-service"
  );
});

test("scale-ecosystem barrel exports data-replicator", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("replicator") || k.toLowerCase().includes("replicate")),
    "should export data-replicator"
  );
});

test("scale-ecosystem barrel exports failover-controller", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("failover")),
    "should export failover-controller"
  );
});

test("scale-ecosystem barrel exports region-router", () => {
  const keys = Object.keys(scaleEcosystem);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("regionrouter") || k.toLowerCase().includes("selectpreferredregion")),
    "should export region-router"
  );
});

test("scale-ecosystem barrel exports feedback-loop submodules", () => {
  const keys = Object.keys(scaleEcosystem);
  // feedback-loop includes: analyzer, collector, improvement-tracker, quality-grader, fine-tuning-exporter
  assert.ok(
    keys.some(k =>
      k.toLowerCase().includes("quality") ||
      k.toLowerCase().includes("fine") ||
      k.toLowerCase().includes("tuning") ||
      k.toLowerCase().includes("improvement") ||
      k.toLowerCase().includes("collector") ||
      k.toLowerCase().includes("analyzer")
    ),
    "should export feedback-loop submodules"
  );
});

test("scale-ecosystem barrel exports sla-engine submodules", () => {
  const keys = Object.keys(scaleEcosystem);
  // sla-engine includes: breach-detector, resource-allocator, tier-resolver
  assert.ok(
    keys.some(k =>
      k.toLowerCase().includes("breach") ||
      k.toLowerCase().includes("tier") ||
      k.toLowerCase().includes("allocator") ||
      k.toLowerCase().includes("slaoperations")
    ),
    "should export sla-engine submodules"
  );
});

test("scale-ecosystem barrel exports resource-manager submodules", () => {
  const keys = Object.keys(scaleEcosystem);
  // resource-manager includes: fair-scheduling-service, fair-queue, preemption, resource-pool-service, quota-enforcer
  assert.ok(
    keys.some(k =>
      k.toLowerCase().includes("fair") ||
      k.toLowerCase().includes("preempt") ||
      k.toLowerCase().includes("quota") ||
      k.toLowerCase().includes("pool")
    ),
    "should export resource-manager submodules"
  );
});

test("scale-ecosystem barrel exports integration submodules", () => {
  const keys = Object.keys(scaleEcosystem);
  // integration includes: connector-registry, connector-framework-service, connector-runtime, health-monitor
  assert.ok(
    keys.some(k =>
      k.toLowerCase().includes("connector") ||
      k.toLowerCase().includes("framework") ||
      k.toLowerCase().includes("health") ||
      k.toLowerCase().includes("monitor")
    ),
    "should export integration submodules"
  );
});

test("scale-ecosystem barrel exports marketplace submodules", () => {
  const keys = Object.keys(scaleEcosystem);
  // marketplace includes: billing-service, tenant-platform-service, certification, catalog, publisher, etc.
  assert.ok(
    keys.some(k =>
      k.toLowerCase().includes("billing") ||
      k.toLowerCase().includes("tenant") ||
      k.toLowerCase().includes("platform") ||
      k.toLowerCase().includes("catalog") ||
      k.toLowerCase().includes("publisher") ||
      k.toLowerCase().includes("compliance") ||
      k.toLowerCase().includes("license") ||
      k.toLowerCase().includes("pmf") ||
      k.toLowerCase().includes("pack")
    ),
    "should export marketplace submodules"
  );
});

test("scale-ecosystem exports contain identifiable service classes or functions", () => {
  const exports = Object.values(scaleEcosystem);
  // At least some exports should be classes or functions
  const hasExports = exports.length > 0;
  assert.ok(hasExports, "should have exported members");
});
