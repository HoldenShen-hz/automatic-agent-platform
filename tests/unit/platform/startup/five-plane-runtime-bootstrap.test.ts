import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFivePlaneRuntimeCatalog,
  buildX1FabricBootstrap,
  registerFivePlaneRuntimeCatalog,
  registerX1FabricBootstrap,
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  X1_FABRIC_BOOTSTRAP_SERVICE_ID,
  type X1FabricBootstrap,
} from "../../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildX1FabricBootstrap returns valid bootstrap object", () => {
  const bootstrap = buildX1FabricBootstrap();

  assert.equal(bootstrap.capabilityGroupId, "x1-fabric", "capabilityGroupId should be x1-fabric");
  assert.ok(bootstrap.capabilityCount > 0, "capabilityCount should be positive");
  assert.ok(Array.isArray(bootstrap.registeredServiceIds), "registeredServiceIds should be an array");
  assert.equal(bootstrap.registeredServiceIds.length, 4, "should have 4 registered service IDs");
});

test("buildX1FabricBootstrap includes required service IDs", () => {
  const bootstrap = buildX1FabricBootstrap();

  // X1FabricBootstrap uses aiops.* service IDs because it calls the aiops bootstrap functions
  assert.ok(bootstrap.registeredServiceIds.includes("aiops.model-gateway.bootstrap"), "should include model-gateway");
  assert.ok(bootstrap.registeredServiceIds.includes("aiops.prompt-engine.bootstrap"), "should include prompt-engine");
  assert.ok(bootstrap.registeredServiceIds.includes("aiops.compliance.bootstrap"), "should include compliance");
  assert.ok(bootstrap.registeredServiceIds.includes("plane.x1-fabric.bootstrap"), "should include x1-fabric");
});

test("buildFivePlaneRuntimeCatalog returns valid catalog", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  assert.ok(Array.isArray(catalog.interfacePlane), "interfacePlane should be an array");
  assert.ok(Array.isArray(catalog.controlPlane), "controlPlane should be an array");
  assert.ok(Array.isArray(catalog.orchestrationPlane), "orchestrationPlane should be an array");
  assert.ok(Array.isArray(catalog.executionPlane), "executionPlane should be an array");
  assert.ok(Array.isArray(catalog.stateEvidencePlane), "stateEvidencePlane should be an array");
});

test("buildFivePlaneRuntimeCatalog each plane catalog has entries", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  assert.ok(catalog.interfacePlane.length > 0, "interfacePlane should have entries");
  assert.ok(catalog.controlPlane.length > 0, "controlPlane should have entries");
  assert.ok(catalog.orchestrationPlane.length > 0, "orchestrationPlane should have entries");
  assert.ok(catalog.executionPlane.length > 0, "executionPlane should have entries");
  assert.ok(catalog.stateEvidencePlane.length > 0, "stateEvidencePlane should have entries");
});

test("registerX1FabricBootstrap registers and initializes services in registry", async () => {
  const registry = new ServiceRegistry();

  // registerX1FabricBootstrap calls get() internally, so services are initialized after call
  const bootstrap = registerX1FabricBootstrap(registry);
  assert.equal(registry.isInitialized(X1_FABRIC_BOOTSTRAP_SERVICE_ID), true, "x1-fabric service should be initialized after register()");
  assert.ok(bootstrap != null, "bootstrap should be retrievable");

  await registry.reset();
});

test("registerFivePlaneRuntimeCatalog registers and initializes catalog in registry", async () => {
  const registry = new ServiceRegistry();

  // registerFivePlaneRuntimeCatalog calls get() internally, so service is initialized after call
  const catalog = registerFivePlaneRuntimeCatalog(registry);
  assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), true, "catalog service should be initialized after register()");
  assert.ok(catalog != null, "catalog should be retrievable");

  await registry.reset();
});

test("X1FabricBootstrap capabilityCount is positive", () => {
  const bootstrap = buildX1FabricBootstrap();

  // The actual capability count is checked indirectly - we verify it's positive
  assert.ok(bootstrap.capabilityCount > 0, "capabilityCount should be positive");
});

test("registerFivePlaneRuntimeCatalog handles dependency ordering", async () => {
  const registry = new ServiceRegistry();

  // After register, services are initialized (register calls get() internally)
  registerFivePlaneRuntimeCatalog(registry);

  // All plane bootstrap services should be initialized after register
  const planes = [
    "plane.interface.bootstrap",
    "plane.x1-fabric.bootstrap",
    "plane.control.bootstrap",
    "plane.orchestration.bootstrap",
    "plane.execution.bootstrap",
    "plane.state-evidence.bootstrap",
  ];

  for (const serviceId of planes) {
    assert.equal(registry.isInitialized(serviceId), true, `${serviceId} should be initialized after register`);
  }

  await registry.reset();
});