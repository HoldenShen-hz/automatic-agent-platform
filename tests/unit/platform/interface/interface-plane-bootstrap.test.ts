import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInterfacePlaneBootstrap,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  INTERFACE_PLANE_CATALOG_SERVICE_ID,
  registerInterfacePlaneBootstrap,
  type InterfacePlaneBootstrap,
} from "../../../../src/platform/interface/interface-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("interface plane bootstrap exposes canonical interface services", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    INTERFACE_PLANE_CATALOG_SERVICE_ID,
    INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "api"), true);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "webhook"), true);
});

test("interface plane bootstrap registers interface services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerInterfacePlaneBootstrap(registry);
    assert.equal(bootstrap.catalog.length, 6);
    assert.equal(registry.isInitialized(INTERFACE_PLANE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("buildInterfacePlaneBootstrap returns correct planeId", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
});

test("buildInterfacePlaneBootstrap catalog contains all interface capabilities", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.catalog.length, 6);
  const capabilityIds = bootstrap.catalog.map((c) => c.capabilityId);
  assert.ok(capabilityIds.includes("api"));
  assert.ok(capabilityIds.includes("channel-gateway"));
  assert.ok(capabilityIds.includes("console-backend"));
  assert.ok(capabilityIds.includes("ingress"));
  assert.ok(capabilityIds.includes("scheduler"));
  assert.ok(capabilityIds.includes("webhook"));
});

test("buildInterfacePlaneBootstrap registeredServiceIds has correct structure", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.registeredServiceIds.length, 2);
  assert.equal(bootstrap.registeredServiceIds[0], INTERFACE_PLANE_CATALOG_SERVICE_ID);
  assert.equal(bootstrap.registeredServiceIds[1], INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID);
});

test("buildInterfacePlaneBootstrap returns readonly catalog", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
});

test("registerInterfacePlaneBootstrap uses default registry when not provided", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerInterfacePlaneBootstrap();
    assert.equal(bootstrap.planeId, "interface");
    assert.equal(registry.isInitialized(INTERFACE_PLANE_CATALOG_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registerInterfacePlaneBootstrap returns InterfacePlaneBootstrap type", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerInterfacePlaneBootstrap(registry);
    assert.equal((bootstrap as InterfacePlaneBootstrap).planeId, "interface");
    assert.ok(Array.isArray((bootstrap as InterfacePlaneBootstrap).catalog));
  } finally {
    await registry.reset();
  }
});

test("service IDs have expected format", () => {
  assert.ok(INTERFACE_PLANE_CATALOG_SERVICE_ID.startsWith("plane.interface."));
  assert.ok(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID.startsWith("plane.interface."));
  assert.notEqual(INTERFACE_PLANE_CATALOG_SERVICE_ID, INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID);
});

test("catalog entries have valid structure", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  bootstrap.catalog.forEach((entry) => {
    assert.ok(entry.capabilityId.length > 0);
    assert.ok(entry.entryModule.length > 0);
    assert.ok(entry.description.length > 0);
    assert.ok(entry.baselineServices.length > 0);
  });
});
