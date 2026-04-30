/**
 * Unit tests for state-evidence-plane-bootstrap
 *
 * Tests the state evidence plane bootstrap functionality including:
 * - Bootstrap structure creation
 * - Service ID constants
 * - Catalog integration
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildStateEvidencePlaneBootstrap,
  STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID,
  STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
} from "../../../../src/platform/five-plane-state-evidence/state-evidence-plane-bootstrap.js";

import {
  listStateEvidenceCapabilityBaselines,
} from "../../../../src/platform/five-plane-state-evidence/state-evidence-plane-baseline.js";

test("STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID is a valid string", () => {
  assert.equal(typeof STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, "string");
  assert.equal(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, "plane.state-evidence.catalog");
});

test("STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID is a valid string", () => {
  assert.equal(typeof STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, "string");
  assert.equal(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, "plane.state-evidence.bootstrap");
});

test("buildStateEvidencePlaneBootstrap returns correct planeId", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.equal(bootstrap.planeId, "state-evidence");
});

test("buildStateEvidencePlaneBootstrap returns catalog with 10 capabilities", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 10);
});

test("buildStateEvidencePlaneBootstrap catalog matches listStateEvidenceCapabilityBaselines", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const baselines = listStateEvidenceCapabilityBaselines();
  assert.deepEqual(bootstrap.catalog, baselines);
});

test("buildStateEvidencePlaneBootstrap returns correct registeredServiceIds", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.equal(bootstrap.registeredServiceIds.length, 2);
  assert.ok(bootstrap.registeredServiceIds.includes(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("buildStateEvidencePlaneBootstrap returns frozen object", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.equal(Object.isFrozen(bootstrap), true);
});

test("buildStateEvidencePlaneBootstrap returns immutable catalog", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.equal(Object.isFrozen(bootstrap.catalog), true);
});

test("buildStateEvidencePlaneBootstrap catalog contains truth capability", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const truth = bootstrap.catalog.find((c) => c.capabilityId === "truth");
  assert.ok(truth, "truth capability should be in catalog");
  assert.equal(truth.entryModule, "src/platform/state-evidence/truth/index.ts");
});

test("buildStateEvidencePlaneBootstrap catalog contains events capability", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const events = bootstrap.catalog.find((c) => c.capabilityId === "events");
  assert.ok(events, "events capability should be in catalog");
  assert.ok(events.baselineServices.includes("TypedEventPublisher"));
});

test("buildStateEvidencePlaneBootstrap catalog contains memory capability", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const memory = bootstrap.catalog.find((c) => c.capabilityId === "memory");
  assert.ok(memory, "memory capability should be in catalog");
  assert.ok(memory.baselineServices.includes("MemoryStoreService"));
});

test("buildStateEvidencePlaneBootstrap catalog contains checkpoints capability", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const checkpoints = bootstrap.catalog.find((c) => c.capabilityId === "checkpoints");
  assert.ok(checkpoints, "checkpoints capability should be in catalog");
  assert.ok(checkpoints.baselineServices.includes("CheckpointStoreService"));
});

test("bootstrap registeredServiceIds contains catalog service id first", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.equal(bootstrap.registeredServiceIds[0], STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID);
});

test("bootstrap registeredServiceIds contains bootstrap service id second", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  assert.equal(bootstrap.registeredServiceIds[1], STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID);
});

test("Service IDs are distinct", () => {
  assert.notEqual(
    STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID,
    STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
    "catalog and bootstrap service IDs should be distinct",
  );
});

test("Service IDs follow naming convention", () => {
  assert.ok(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID.startsWith("plane."));
  assert.ok(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID.startsWith("plane."));
  assert.ok(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID.includes("state-evidence"));
  assert.ok(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID.includes("state-evidence"));
});

test("catalog capabilities are all unique", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const ids = bootstrap.catalog.map((c) => c.capabilityId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "all capability IDs should be unique");
});

test("catalog capabilities cover all expected types", () => {
  const bootstrap = buildStateEvidencePlaneBootstrap();
  const expectedIds = [
    "artifacts",
    "audit",
    "checkpoints",
    "dlq",
    "events",
    "incident",
    "knowledge",
    "memory",
    "projections",
    "truth",
  ];

  for (const expectedId of expectedIds) {
    const found = bootstrap.catalog.some((c) => c.capabilityId === expectedId);
    assert.ok(found, `catalog should contain ${expectedId}`);
  }
});
