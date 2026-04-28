import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFivePlaneRuntimeCatalog,
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  X1_FABRIC_BOOTSTRAP_SERVICE_ID,
  registerFivePlaneRuntimeCatalog,
  type FivePlaneRuntimeCatalog,
} from "../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("five-plane runtime bootstrap builds the full five-plane catalog", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  assert.equal(catalog.interfacePlane.length, 6);
  assert.equal(catalog.controlPlane.length, 12);
  assert.equal(catalog.orchestrationPlane.length, 8);
  assert.equal(catalog.executionPlane.length, 14);
  assert.equal(catalog.stateEvidencePlane.length, 10);
});

test("five-plane runtime bootstrap registers plane catalogs in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerFivePlaneRuntimeCatalog(registry);
    assert.equal(catalog.orchestrationPlane.some((item) => item.capabilityId === "harness"), true);
    assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized("plane.interface.catalog"), true);
    assert.equal(registry.isInitialized("plane.interface.bootstrap"), true);
    assert.equal(registry.isInitialized(X1_FABRIC_BOOTSTRAP_SERVICE_ID), true);
    assert.equal(registry.isInitialized("plane.control.catalog"), true);
    assert.equal(registry.isInitialized("plane.control.bootstrap"), true);
    assert.equal(registry.isInitialized("plane.orchestration.catalog"), true);
    assert.equal(registry.isInitialized("plane.orchestration.bootstrap"), true);
    assert.equal(registry.isInitialized("plane.execution.catalog"), true);
    assert.equal(registry.isInitialized("plane.execution.bootstrap"), true);
    assert.equal(registry.isInitialized("plane.state-evidence.catalog"), true);
    assert.equal(registry.isInitialized("plane.state-evidence.bootstrap"), true);
  } finally {
    await registry.reset();
  }
});

test("buildFivePlaneRuntimeCatalog returns all five planes", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  assert.ok(catalog.interfacePlane, "interfacePlane should exist");
  assert.ok(catalog.controlPlane, "controlPlane should exist");
  assert.ok(catalog.orchestrationPlane, "orchestrationPlane should exist");
  assert.ok(catalog.executionPlane, "executionPlane should exist");
  assert.ok(catalog.stateEvidencePlane, "stateEvidencePlane should exist");
});

test("catalog capability baselines have expected structure", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  const firstInterfaceCapability = catalog.interfacePlane[0];
  assert.ok(firstInterfaceCapability, "interfacePlane should have at least one capability");
  assert.ok("capabilityId" in firstInterfaceCapability, "capability should have capabilityId");
  assert.ok("entryModule" in firstInterfaceCapability, "capability should have entryModule");
  assert.ok("description" in firstInterfaceCapability, "capability should have description");
  assert.ok("baselineServices" in firstInterfaceCapability, "capability should have baselineServices");
  assert.equal(typeof firstInterfaceCapability.capabilityId, "string");
});

test("registerFivePlaneRuntimeCatalog registers all plane bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    assert.equal(registry.isInitialized("plane.interface.bootstrap"), true);
    assert.equal(registry.isInitialized(X1_FABRIC_BOOTSTRAP_SERVICE_ID), true);
    assert.equal(registry.isInitialized("plane.control.bootstrap"), true);
    assert.equal(registry.isInitialized("plane.orchestration.bootstrap"), true);
    assert.equal(registry.isInitialized("plane.execution.bootstrap"), true);
    assert.equal(registry.isInitialized("plane.state-evidence.bootstrap"), true);
  } finally {
    await registry.reset();
  }
});

test("registerFivePlaneRuntimeCatalog returns catalog with correct plane counts", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerFivePlaneRuntimeCatalog(registry);
    assert.equal(catalog.interfacePlane.length, 6);
    assert.equal(catalog.controlPlane.length, 12);
    assert.equal(catalog.orchestrationPlane.length, 8);
    assert.equal(catalog.executionPlane.length, 14);
    assert.equal(catalog.stateEvidencePlane.length, 10);
  } finally {
    await registry.reset();
  }
});

test("catalog has all required capability baselines for each plane", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  const totalCapabilities = catalog.interfacePlane.length +
    catalog.controlPlane.length +
    catalog.orchestrationPlane.length +
    catalog.executionPlane.length +
    catalog.stateEvidencePlane.length;
  assert.equal(totalCapabilities, 50, "total capabilities should be 50");
});

test("capability baselines have capabilityId in each plane", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  for (const capability of catalog.interfacePlane) {
    assert.ok(capability.capabilityId, "interface capability should have capabilityId");
  }
  for (const capability of catalog.controlPlane) {
    assert.ok(capability.capabilityId, "control-plane capability should have capabilityId");
  }
  for (const capability of catalog.orchestrationPlane) {
    assert.ok(capability.capabilityId, "orchestration capability should have capabilityId");
  }
  for (const capability of catalog.executionPlane) {
    assert.ok(capability.capabilityId, "execution capability should have capabilityId");
  }
  for (const capability of catalog.stateEvidencePlane) {
    assert.ok(capability.capabilityId, "state-evidence capability should have capabilityId");
  }
});
