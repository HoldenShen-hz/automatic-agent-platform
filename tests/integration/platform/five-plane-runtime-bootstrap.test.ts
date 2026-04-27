import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFivePlaneRuntimeCatalog,
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  registerFivePlaneRuntimeCatalog,
} from "../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("integration: registerFivePlaneRuntimeCatalog initializes all five plane catalogs", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerFivePlaneRuntimeCatalog(registry);

    // Verify all plane catalogs are initialized
    assert.ok(registry.isInitialized("plane.interface.catalog"));
    assert.ok(registry.isInitialized("plane.control.catalog"));
    assert.ok(registry.isInitialized("plane.orchestration.catalog"));
    assert.ok(registry.isInitialized("plane.execution.catalog"));
    assert.ok(registry.isInitialized("plane.state-evidence.catalog"));

    // Verify all plane bootstraps are initialized
    assert.ok(registry.isInitialized("plane.interface.bootstrap"));
    assert.ok(registry.isInitialized("plane.control.bootstrap"));
    assert.ok(registry.isInitialized("plane.orchestration.bootstrap"));
    assert.ok(registry.isInitialized("plane.execution.bootstrap"));
    assert.ok(registry.isInitialized("plane.state-evidence.bootstrap"));

    // Verify main catalog service is initialized
    assert.ok(registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID));

    // Verify catalog contains all planes
    assert.ok(catalog.interfacePlane.length > 0);
    assert.ok(catalog.controlPlane.length > 0);
    assert.ok(catalog.orchestrationPlane.length > 0);
    assert.ok(catalog.executionPlane.length > 0);
    assert.ok(catalog.stateEvidencePlane.length > 0);
  } finally {
    await registry.reset();
  }
});

test("integration: buildFivePlaneRuntimeCatalog returns frozen catalog", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  // Verify all planes exist
  assert.ok(catalog.interfacePlane);
  assert.ok(catalog.controlPlane);
  assert.ok(catalog.orchestrationPlane);
  assert.ok(catalog.executionPlane);
  assert.ok(catalog.stateEvidencePlane);

  // Verify arrays are frozen
  assert.ok(Object.isFrozen(catalog.interfacePlane));
  assert.ok(Object.isFrozen(catalog.controlPlane));
  assert.ok(Object.isFrozen(catalog.orchestrationPlane));
  assert.ok(Object.isFrozen(catalog.executionPlane));
  assert.ok(Object.isFrozen(catalog.stateEvidencePlane));
});

test("integration: catalog capabilities have expected structure", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  // Check interface plane capabilities
  for (const capability of catalog.interfacePlane) {
    assert.ok(typeof capability.capabilityId === "string");
    assert.ok(typeof capability.entryModule === "string");
    assert.ok(typeof capability.description === "string");
    assert.ok(Array.isArray(capability.baselineServices));
  }

  // Check control plane capabilities
  for (const capability of catalog.controlPlane) {
    assert.ok(typeof capability.capabilityId === "string");
    assert.ok(typeof capability.entryModule === "string");
    assert.ok(typeof capability.description === "string");
    assert.ok(Array.isArray(capability.baselineServices));
  }
});

test("integration: each plane catalog has unique capability IDs", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  const checkUniqueness = (planeCapabilities: readonly { capabilityId: string }[], planeName: string) => {
    const ids = planeCapabilities.map((c) => c.capabilityId);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, `${planeName} should have unique capability IDs`);
  };

  checkUniqueness(catalog.interfacePlane, "interfacePlane");
  checkUniqueness(catalog.controlPlane, "controlPlane");
  checkUniqueness(catalog.orchestrationPlane, "orchestrationPlane");
  checkUniqueness(catalog.executionPlane, "executionPlane");
  checkUniqueness(catalog.stateEvidencePlane, "stateEvidencePlane");
});

test("integration: plane catalogs contain expected capability categories", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  // Interface plane should have API-related capabilities
  const interfaceIds = catalog.interfacePlane.map((c) => c.capabilityId);
  assert.ok(interfaceIds.some((id) => id.includes("api") || id.includes("ingress") || id.includes("scheduler")));

  // Control plane should have IAM/config capabilities
  const controlIds = catalog.controlPlane.map((c) => c.capabilityId);
  assert.ok(controlIds.some((id) => id.includes("iam") || id.includes("config") || id.includes("approval")));

  // Orchestration plane should have routing/planning capabilities
  const orchestrationIds = catalog.orchestrationPlane.map((c) => c.capabilityId);
  assert.ok(orchestrationIds.some((id) => id.includes("routing") || id.includes("planner") || id.includes("oapeflir")));

  // Execution plane should have dispatcher/worker capabilities
  const executionIds = catalog.executionPlane.map((c) => c.capabilityId);
  assert.ok(executionIds.some((id) => id.includes("dispatcher") || id.includes("worker") || id.includes("execution")));

  // State-evidence plane should have truth/events capabilities
  const stateEvidenceIds = catalog.stateEvidencePlane.map((c) => c.capabilityId);
  assert.ok(stateEvidenceIds.some((id) => id.includes("truth") || id.includes("event") || id.includes("artifact")));
});

test("integration: total capability count across all planes", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  const total =
    catalog.interfacePlane.length +
    catalog.controlPlane.length +
    catalog.orchestrationPlane.length +
    catalog.executionPlane.length +
    catalog.stateEvidencePlane.length;

  assert.ok(total > 0, "Should have at least one capability per plane");
  assert.equal(catalog.interfacePlane.length, 6, "interface plane should have 6 capabilities");
  assert.equal(catalog.controlPlane.length, 12, "control plane should have 12 capabilities");
});
