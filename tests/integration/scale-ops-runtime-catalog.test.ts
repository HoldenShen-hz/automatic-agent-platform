import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaleOpsRuntimeCatalog,
  registerScaleOpsRuntimeCatalog,
  SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
  type ScaleOpsRuntimeCatalog,
} from "../../src/scale-ops-runtime-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  SCALE_BOOTSTRAP_SERVICE_ID,
  registerScaleBootstrap,
} from "../../src/scale-ecosystem/scale-bootstrap.js";
import {
  OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  registerOpsMaturityBootstrap,
} from "../../src/ops-maturity/ops-maturity-bootstrap.js";

test("buildScaleOpsRuntimeCatalog returns catalog with scale ecosystem and ops maturity capabilities", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  assert.ok(catalog.scaleEcosystem.length > 0);
  assert.ok(catalog.opsMaturity.length > 0);
  assert.ok(Array.isArray(catalog.scaleEcosystem));
  assert.ok(Array.isArray(catalog.opsMaturity));
});

test("buildScaleOpsRuntimeCatalog contains all expected scale ecosystem capability ids", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  const capabilityIds = catalog.scaleEcosystem.map((c) => c.capabilityId);
  assert.ok(capabilityIds.includes("multi-region"));
  assert.ok(capabilityIds.includes("resource-manager"));
  assert.ok(capabilityIds.includes("sla-engine"));
  assert.ok(capabilityIds.includes("marketplace"));
  assert.ok(capabilityIds.includes("billing"));
  assert.ok(capabilityIds.includes("tenant-platform"));
  assert.ok(capabilityIds.includes("intelligence"));
  assert.ok(capabilityIds.includes("enterprise"));
  assert.ok(capabilityIds.includes("operations"));
  assert.ok(capabilityIds.includes("feedback-loop"));
  assert.ok(capabilityIds.includes("integration"));
});

test("buildScaleOpsRuntimeCatalog contains all expected ops maturity capability ids", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  const capabilityIds = catalog.opsMaturity.map((c) => c.capabilityId);
  assert.ok(capabilityIds.includes("agent-lifecycle"));
  assert.ok(capabilityIds.includes("capacity-planner"));
  assert.ok(capabilityIds.includes("compliance-reporter"));
  assert.ok(capabilityIds.includes("cost-optimizer"));
  assert.ok(capabilityIds.includes("drift-detection"));
  assert.ok(capabilityIds.includes("edge-runtime"));
  assert.ok(capabilityIds.includes("emergency"));
  assert.ok(capabilityIds.includes("explainability"));
  assert.ok(capabilityIds.includes("monitoring"));
  assert.ok(capabilityIds.includes("multimodal"));
  assert.ok(capabilityIds.includes("platform-ops-agent"));
  assert.ok(capabilityIds.includes("workflow-debugger"));
});

test("buildScaleOpsRuntimeCatalog scale ecosystem capabilities have required fields", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  for (const capability of catalog.scaleEcosystem) {
    assert.ok(capability.capabilityId);
    assert.ok(capability.entryModule);
    assert.ok(capability.description);
    assert.ok(Array.isArray(capability.architectureSections));
    assert.ok(Array.isArray(capability.baselineServices));
  }
});

test("buildScaleOpsRuntimeCatalog ops maturity capabilities have required fields", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  for (const capability of catalog.opsMaturity) {
    assert.ok(capability.capabilityId);
    assert.ok(capability.entryModule);
    assert.ok(capability.description);
    assert.ok(Array.isArray(capability.architectureSections));
    assert.ok(Array.isArray(capability.baselineServices));
  }
});

test("registerScaleOpsRuntimeCatalog registers catalog service in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerScaleOpsRuntimeCatalog(registry);

    assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
    assert.ok(catalog.scaleEcosystem.length > 0);
    assert.ok(catalog.opsMaturity.length > 0);
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeCatalog returns same catalog as buildScaleOpsRuntimeCatalog", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerScaleOpsRuntimeCatalog(registry);
    const directCatalog = buildScaleOpsRuntimeCatalog();

    assert.equal(catalog.scaleEcosystem.length, directCatalog.scaleEcosystem.length);
    assert.equal(catalog.opsMaturity.length, directCatalog.opsMaturity.length);
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeCatalog registers with bootstrap service dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerScaleOpsRuntimeCatalog(registry);

    assert.ok(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID));
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeCatalog returns readonly arrays", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerScaleOpsRuntimeCatalog(registry);

    assert.ok(Object.isFrozen(catalog.scaleEcosystem));
    assert.ok(Object.isFrozen(catalog.opsMaturity));
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeCatalog with fresh registry returns initialized catalog", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerScaleOpsRuntimeCatalog(registry);

    assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID), true);
    assert.equal(catalog.scaleEcosystem.some((c) => c.capabilityId === "multi-region"), true);
    assert.equal(catalog.opsMaturity.some((c) => c.capabilityId === "agent-lifecycle"), true);
  } finally {
    await registry.reset();
  }
});
