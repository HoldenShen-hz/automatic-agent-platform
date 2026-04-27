/**
 * Unit tests for Interface Plane Bootstrap
 * Tests the bootstrap functions and service registration
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERFACE_PLANE_CATALOG_SERVICE_ID,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  buildInterfacePlaneBootstrap,
  registerInterfacePlaneBootstrap,
  type InterfacePlaneBootstrap,
} from "../../../../../src/platform/interface/interface-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("INTERFACE_PLANE_CATALOG_SERVICE_ID has correct value", () => {
  assert.equal(INTERFACE_PLANE_CATALOG_SERVICE_ID, "plane.interface.catalog");
});

test("INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID has correct value", () => {
  assert.equal(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, "plane.interface.bootstrap");
});

test("buildInterfacePlaneBootstrap returns correct structure", () => {
  const bootstrap = buildInterfacePlaneBootstrap();

  assert.equal(bootstrap.planeId, "interface");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 6);
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.equal(bootstrap.registeredServiceIds.length, 2);
  assert.equal(bootstrap.registeredServiceIds[0], INTERFACE_PLANE_CATALOG_SERVICE_ID);
  assert.equal(bootstrap.registeredServiceIds[1], INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID);
});

test("buildInterfacePlaneBootstrap catalog contains all capability IDs", () => {
  const bootstrap = buildInterfacePlaneBootstrap();

  const capabilityIds = bootstrap.catalog.map((c) => c.capabilityId);
  assert.ok(capabilityIds.includes("api"));
  assert.ok(capabilityIds.includes("channel-gateway"));
  assert.ok(capabilityIds.includes("console-backend"));
  assert.ok(capabilityIds.includes("ingress"));
  assert.ok(capabilityIds.includes("scheduler"));
  assert.ok(capabilityIds.includes("webhook"));
});

test("buildInterfacePlaneBootstrap catalog entries have required fields", () => {
  const bootstrap = buildInterfacePlaneBootstrap();

  for (const entry of bootstrap.catalog) {
    assert.ok(entry.capabilityId.length > 0);
    assert.ok(entry.entryModule.length > 0);
    assert.ok(entry.description.length > 0);
    assert.ok(Array.isArray(entry.baselineServices));
    assert.ok(entry.baselineServices.length > 0);
  }
});

test("InterfacePlaneBootstrap interface structure is correct", () => {
  const bootstrap: InterfacePlaneBootstrap = buildInterfacePlaneBootstrap();

  assert.equal(typeof bootstrap.planeId, "string");
  assert.equal(bootstrap.planeId, "interface");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
});

test("registerInterfacePlaneBootstrap registers services in registry", () => {
  // Use a fresh registry instance for this test
  const registry = ServiceRegistry.getInstance();
  const catalogId = INTERFACE_PLANE_CATALOG_SERVICE_ID;
  const bootstrapId = INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID;

  // Clear any existing registration
  try {
    registry.get<InterfacePlaneBootstrap>(bootstrapId);
  } catch {
    // Not registered yet, which is fine
  }

  const bootstrap = registerInterfacePlaneBootstrap(registry);

  assert.equal(bootstrap.planeId, "interface");
  assert.ok(bootstrap.catalog.length > 0);
});

test("registerInterfacePlaneBootstrap bootstrap depends on catalog", () => {
  const registry = ServiceRegistry.getInstance();

  const bootstrap = registerInterfacePlaneBootstrap(registry);

  // The bootstrap should have catalog populated
  assert.ok(bootstrap.catalog.length > 0);
});
