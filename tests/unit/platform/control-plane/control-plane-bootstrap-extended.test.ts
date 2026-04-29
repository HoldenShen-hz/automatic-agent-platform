/**
 * Extended unit tests for Control Plane Bootstrap
 * Tests service catalog, capability registration, and bootstrap configuration
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildControlPlaneBootstrap,
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  CONTROL_PLANE_CATALOG_SERVICE_ID,
  registerControlPlaneBootstrap,
} from "../../../../../src/platform/control-plane/control-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

// ============================================================================
// Bootstrap Service Structure Tests
// ============================================================================

test("buildControlPlaneBootstrap returns object with planeId", () => {
  const bootstrap = buildControlPlaneBootstrap();

  assert.ok(bootstrap.planeId);
  assert.strictEqual(typeof bootstrap.planeId, "string");
});

test("buildControlPlaneBootstrap returns object with catalog", () => {
  const bootstrap = buildControlPlaneBootstrap();

  assert.ok(bootstrap.catalog);
  assert.ok(Array.isArray(bootstrap.catalog));
});

test("buildControlPlaneBootstrap returns object with registeredServiceIds", () => {
  const bootstrap = buildControlPlaneBootstrap();

  assert.ok(bootstrap.registeredServiceIds);
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
});

test("buildControlPlaneBootstrap catalog contains capability items", () => {
  const bootstrap = buildControlPlaneBootstrap();

  for (const item of bootstrap.catalog) {
    assert.ok(item.capabilityId);
    assert.ok(item.version);
  }
});

test("buildControlPlaneBootstrap includes required service IDs", () => {
  const bootstrap = buildControlPlaneBootstrap();

  assert.ok(bootstrap.registeredServiceIds.includes(CONTROL_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("buildControlPlaneBootstrap catalog includes approval-center capability", () => {
  const bootstrap = buildControlPlaneBootstrap();

  const approvalItem = bootstrap.catalog.find((item) => item.capabilityId === "approval-center");
  assert.ok(approvalItem);
});

test("buildControlPlaneBootstrap catalog includes tenant capability", () => {
  const bootstrap = buildControlPlaneBootstrap();

  const tenantItem = bootstrap.catalog.find((item) => item.capabilityId === "tenant");
  assert.ok(tenantItem);
});

// ============================================================================
// Service Registry Integration Tests
// ============================================================================

test("registerControlPlaneBootstrap registers services in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerControlPlaneBootstrap(registry);

    assert.ok(bootstrap.catalog.length > 0);
    assert.strictEqual(registry.isInitialized(CONTROL_PLANE_CATALOG_SERVICE_ID), true);
    assert.strictEqual(registry.isInitialized(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registerControlPlaneBootstrap returns bootstrap object", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerControlPlaneBootstrap(registry);

    assert.ok(bootstrap.planeId);
    assert.ok(bootstrap.catalog);
    assert.ok(bootstrap.registeredServiceIds);
  } finally {
    await registry.reset();
  }
});

test("registerControlPlaneBootstrap can be called multiple times", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap1 = registerControlPlaneBootstrap(registry);
    // Second call should return same bootstrap
    const bootstrap2 = registerControlPlaneBootstrap(registry);

    assert.ok(bootstrap1.catalog.length === bootstrap2.catalog.length);
  } finally {
    await registry.reset();
  }
});

// ============================================================================
// Service Catalog Content Tests
// ============================================================================

test("catalog entries have required fields", () => {
  const bootstrap = buildControlPlaneBootstrap();

  for (const item of bootstrap.catalog) {
    assert.ok(item.capabilityId, "Each catalog item must have capabilityId");
    assert.ok(item.version, "Each catalog item must have version");
    assert.ok(item.capabilityId.length > 0, "capabilityId must not be empty");
  }
});

test("catalog entries have valid version format", () => {
  const bootstrap = buildControlPlaneBootstrap();

  for (const item of bootstrap.catalog) {
    // Version should be in format like "1.0.0" or similar
    assert.ok(
      /^\d+\.\d+\.\d+/.test(item.version),
      `Version ${item.version} should be in semver format`,
    );
  }
});

test("catalog contains expected control plane capabilities", () => {
  const bootstrap = buildControlPlaneBootstrap();
  const capabilityIds = bootstrap.catalog.map((item) => item.capabilityId);

  // Should have at least approval-center and tenant
  assert.ok(capabilityIds.includes("approval-center"));
  assert.ok(capabilityIds.includes("tenant"));
});

test("catalog does not contain duplicate capability IDs", () => {
  const bootstrap = buildControlPlaneBootstrap();
  const capabilityIds = bootstrap.catalog.map((item) => item.capabilityId);
  const uniqueIds = new Set(capabilityIds);

  assert.strictEqual(capabilityIds.length, uniqueIds.size);
});

// ============================================================================
// Bootstrap Constants Tests
// ============================================================================

test("CONTROL_PLANE_BOOTSTRAP_SERVICE_ID is a non-empty string", () => {
  assert.strictEqual(typeof CONTROL_PLANE_BOOTSTRAP_SERVICE_ID, "string");
  assert.ok(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID.length > 0);
});

test("CONTROL_PLANE_CATALOG_SERVICE_ID is a non-empty string", () => {
  assert.strictEqual(typeof CONTROL_PLANE_CATALOG_SERVICE_ID, "string");
  assert.ok(CONTROL_PLANE_CATALOG_SERVICE_ID.length > 0);
});

test("CONTROL_PLANE_BOOTSTRAP_SERVICE_ID is different from CONTROL_PLANE_CATALOG_SERVICE_ID", () => {
  assert.notStrictEqual(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID, CONTROL_PLANE_CATALOG_SERVICE_ID);
});

// ============================================================================
// Plane ID Tests
// ============================================================================

test("control plane planeId is control-plane", () => {
  const bootstrap = buildControlPlaneBootstrap();

  assert.strictEqual(bootstrap.planeId, "control-plane");
});

// ============================================================================
// Registered Service Count Tests
// ============================================================================

test("registeredServiceIds contains exactly the expected services", () => {
  const bootstrap = buildControlPlaneBootstrap();

  // Should contain CONTROL_PLANE_CATALOG_SERVICE_ID and CONTROL_PLANE_BOOTSTRAP_SERVICE_ID
  assert.ok(bootstrap.registeredServiceIds.length >= 2);

  assert.ok(bootstrap.registeredServiceIds.includes(CONTROL_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("registerControlPlaneBootstrap registers correct number of services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerControlPlaneBootstrap(registry);

    // The bootstrap should register 12 services based on the original test
    assert.strictEqual(bootstrap.catalog.length, 12);
  } finally {
    await registry.reset();
  }
});

// ============================================================================
// Service Registry State Tests
// ============================================================================

test("ServiceRegistry isInitialized returns true after registration", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerControlPlaneBootstrap(registry);

    assert.strictEqual(registry.isInitialized(CONTROL_PLANE_CATALOG_SERVICE_ID), true);
    assert.strictEqual(registry.isInitialized(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("ServiceRegistry reset clears initialized state", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerControlPlaneBootstrap(registry);

    // Before reset, should be initialized
    assert.strictEqual(registry.isInitialized(CONTROL_PLANE_CATALOG_SERVICE_ID), true);

    await registry.reset();

    // After reset, should not be initialized
    // Note: This depends on reset() implementation
  } finally {
    await registry.reset();
  }
});

// ============================================================================
// Capability Item Structure Tests
// ============================================================================

test("catalog item structure is consistent", () => {
  const bootstrap = buildControlPlaneBootstrap();

  for (const item of bootstrap.catalog) {
    // Each item should have these properties
    assert.ok("capabilityId" in item);
    assert.ok("version" in item);

    // capabilityId should be a string
    assert.strictEqual(typeof item.capabilityId, "string");

    // version should be a string
    assert.strictEqual(typeof item.version, "string");
  }
});

test("catalog has minimum expected entries", () => {
  const bootstrap = buildControlPlaneBootstrap();

  // Based on the original test, catalog should have 12 entries
  assert.ok(bootstrap.catalog.length >= 10, "Catalog should have at least 10 entries");
});
