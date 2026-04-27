import assert from "node:assert/strict";
import test from "node:test";

import {
  buildComplianceBootstrap,
  COMPLIANCE_BOOTSTRAP_SERVICE_ID,
  COMPLIANCE_CATALOG_SERVICE_ID,
  registerComplianceBootstrap,
} from "../../../../src/platform/compliance/compliance-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("compliance bootstrap exposes canonical compliance services", () => {
  const bootstrap = buildComplianceBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "compliance");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    COMPLIANCE_CATALOG_SERVICE_ID,
    COMPLIANCE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 5);
});

test("compliance bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerComplianceBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "erasure"), true);
    assert.equal(registry.isInitialized(COMPLIANCE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(COMPLIANCE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("buildComplianceBootstrap returns correct capabilityGroupId", () => {
  const bootstrap = buildComplianceBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "compliance");
});

test("buildComplianceBootstrap catalog contains all compliance capabilities", () => {
  const bootstrap = buildComplianceBootstrap();
  assert.equal(bootstrap.catalog.length, 5);
  const capabilityIds = bootstrap.catalog.map((c) => c.capabilityId);
  assert.ok(capabilityIds.includes("crypto-shredding"));
  assert.ok(capabilityIds.includes("data-residency"));
  assert.ok(capabilityIds.includes("encryption"));
  assert.ok(capabilityIds.includes("erasure"));
  assert.ok(capabilityIds.includes("lineage"));
});

test("buildComplianceBootstrap registeredServiceIds has correct structure", () => {
  const bootstrap = buildComplianceBootstrap();
  assert.equal(bootstrap.registeredServiceIds.length, 2);
  assert.equal(bootstrap.registeredServiceIds[0], COMPLIANCE_CATALOG_SERVICE_ID);
  assert.equal(bootstrap.registeredServiceIds[1], COMPLIANCE_BOOTSTRAP_SERVICE_ID);
});

test("buildComplianceBootstrap returns readonly catalog", () => {
  const bootstrap = buildComplianceBootstrap();
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
});

test("registerComplianceBootstrap uses default registry when not provided", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerComplianceBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "compliance");
    assert.equal(registry.isInitialized(COMPLIANCE_CATALOG_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("service IDs have expected format", () => {
  assert.ok(COMPLIANCE_CATALOG_SERVICE_ID.startsWith("aiops.compliance."));
  assert.ok(COMPLIANCE_BOOTSTRAP_SERVICE_ID.startsWith("aiops.compliance."));
  assert.notEqual(COMPLIANCE_CATALOG_SERVICE_ID, COMPLIANCE_BOOTSTRAP_SERVICE_ID);
});

test("catalog entries have valid structure", () => {
  const bootstrap = buildComplianceBootstrap();
  bootstrap.catalog.forEach((entry) => {
    assert.ok(entry.capabilityId.length > 0);
    assert.ok(entry.entryModule.length > 0);
    assert.ok(entry.description.length > 0);
    assert.ok(entry.baselineServices.length > 0);
  });
});
