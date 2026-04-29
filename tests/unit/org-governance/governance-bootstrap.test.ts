import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGovernanceBootstrap,
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  GOVERNANCE_CATALOG_SERVICE_ID,
  registerGovernanceBootstrap,
  type GovernanceBootstrap,
} from "../../../src/org-governance/governance-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("buildGovernanceBootstrap returns correct capabilityGroupId", () => {
  const bootstrap = buildGovernanceBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "org-governance");
});

test("buildGovernanceBootstrap returns catalog with all six capabilities", () => {
  const bootstrap = buildGovernanceBootstrap();
  const capabilityIds = bootstrap.catalog.map((c) => c.capabilityId);
  assert.ok(capabilityIds.includes("org-model"));
  assert.ok(capabilityIds.includes("approval-routing"));
  assert.ok(capabilityIds.includes("sso-scim"));
  assert.ok(capabilityIds.includes("compliance-engine"));
  assert.ok(capabilityIds.includes("knowledge-boundary"));
  assert.ok(capabilityIds.includes("delegated-governance"));
  assert.equal(bootstrap.catalog.length, 6);
});

test("buildGovernanceBootstrap returns correct registeredServiceIds", () => {
  const bootstrap = buildGovernanceBootstrap();
  assert.deepStrictEqual(bootstrap.registeredServiceIds, [
    GOVERNANCE_CATALOG_SERVICE_ID,
    GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  ]);
});

test("buildGovernanceBootstrap catalog entries have required fields", () => {
  const bootstrap = buildGovernanceBootstrap();
  for (const capability of bootstrap.catalog) {
    assert.ok(capability.capabilityId.length > 0);
    assert.ok(capability.entryModule.length > 0);
    assert.ok(capability.description.length > 0);
    assert.ok(Array.isArray(capability.architectureSections));
    assert.ok(capability.architectureSections.length > 0);
    assert.ok(Array.isArray(capability.baselineServices));
    assert.ok(capability.baselineServices.length > 0);
  }
});

test("buildGovernanceBootstrap catalog entries have valid architecture sections", () => {
  const bootstrap = buildGovernanceBootstrap();
  for (const capability of bootstrap.catalog) {
    for (const section of capability.architectureSections) {
      assert.ok(section.startsWith("§"), `expected section ${section} to start with §`);
    }
  }
});

test("GOVERNANCE_CATALOG_SERVICE_ID has correct value", () => {
  assert.equal(GOVERNANCE_CATALOG_SERVICE_ID, "w3.governance.catalog");
});

test("GOVERNANCE_BOOTSTRAP_SERVICE_ID has correct value", () => {
  assert.equal(GOVERNANCE_BOOTSTRAP_SERVICE_ID, "w3.governance.bootstrap");
});

test("registerGovernanceBootstrap registers catalog service before bootstrap service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerGovernanceBootstrap(registry);
    assert.equal(registry.isInitialized(GOVERNANCE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID), true);
    assert.ok(bootstrap != null);
    assert.equal(bootstrap.capabilityGroupId, "org-governance");
    assert.ok(bootstrap.catalog.length > 0);
  } finally {
    await registry.reset();
  }
});

test("registerGovernanceBootstrap bootstrap depends on catalog service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerGovernanceBootstrap(registry);
    const bootstrapService = registry.get<GovernanceBootstrap>(GOVERNANCE_BOOTSTRAP_SERVICE_ID);
    assert.equal(bootstrapService.capabilityGroupId, "org-governance");
    assert.ok(bootstrapService.catalog.length > 0);
  } finally {
    await registry.reset();
  }
});

test("registerGovernanceBootstrap returns valid bootstrap from registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerGovernanceBootstrap(registry);
    assert.equal(bootstrap.capabilityGroupId, "org-governance");
    assert.equal(bootstrap.catalog.length, 6);
    assert.deepStrictEqual(bootstrap.registeredServiceIds, [
      GOVERNANCE_CATALOG_SERVICE_ID,
      GOVERNANCE_BOOTSTRAP_SERVICE_ID,
    ]);
  } finally {
    await registry.reset();
  }
});

test("registerGovernanceBootstrap uses default registry when none provided", async () => {
  try {
    const bootstrap = registerGovernanceBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "org-governance");
  } finally {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
  }
});

test("catalog service returns governance capability baselines", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerGovernanceBootstrap(registry);
    const catalog = registry.get<readonly import("../../../src/org-governance/governance-baseline-catalog.js").GovernanceCapabilityBaseline[]>(GOVERNANCE_CATALOG_SERVICE_ID);
    assert.ok(catalog.length > 0);
    assert.ok(catalog.some((c) => c.capabilityId === "org-model"));
  } finally {
    await registry.reset();
  }
});

test("bootstrap service is returned after catalog service initialization", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerGovernanceBootstrap(registry);
    const bootstrap = registry.get<GovernanceBootstrap>(GOVERNANCE_BOOTSTRAP_SERVICE_ID);
    const catalog = registry.get<readonly import("../../../src/org-governance/governance-baseline-catalog.js").GovernanceCapabilityBaseline[]>(GOVERNANCE_CATALOG_SERVICE_ID);
    assert.equal(bootstrap.catalog.length, catalog.length);
    assert.deepStrictEqual(bootstrap.catalog, catalog);
  } finally {
    await registry.reset();
  }
});

test("each catalog capability has valid entry module path", () => {
  const bootstrap = buildGovernanceBootstrap();
  for (const capability of bootstrap.catalog) {
    assert.ok(capability.entryModule.startsWith("src/org-governance/"));
    assert.ok(capability.entryModule.endsWith("/index.ts"));
  }
});

test("each catalog capability has non-empty description", () => {
  const bootstrap = buildGovernanceBootstrap();
  for (const capability of bootstrap.catalog) {
    assert.ok(capability.description.length > 0);
  }
});

test("registerGovernanceBootstrap returns same bootstrap instance on subsequent gets", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerGovernanceBootstrap(registry);
    const bootstrap1 = registry.get<GovernanceBootstrap>(GOVERNANCE_BOOTSTRAP_SERVICE_ID);
    const bootstrap2 = registry.get<GovernanceBootstrap>(GOVERNANCE_BOOTSTRAP_SERVICE_ID);
    assert.strictEqual(bootstrap1, bootstrap2);
  } finally {
    await registry.reset();
  }
});
