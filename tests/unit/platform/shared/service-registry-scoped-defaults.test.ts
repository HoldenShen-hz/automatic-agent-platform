import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  registerFivePlaneRuntimeCatalog,
} from "../../../../src/platform/five-plane-runtime-bootstrap.js";
import {
  FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  FivePlaneRuntimeOrchestrator,
} from "../../../../src/platform/five-plane-runtime-orchestrator.js";
import { buildPlatformRootSummary } from "../../../../src/index.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

const REPO_ROOT = process.cwd();

const TOP_LEVEL_SCOPE_FILES = [
  "src/platform/five-plane-runtime-bootstrap.ts",
  "src/platform/five-plane-runtime-orchestrator.ts",
  "src/platform/ai-operations-runtime-catalog.ts",
  "src/platform/ai-operations-startup-plan.ts",
  "src/platform/ai-operations-runtime-orchestrator.ts",
  "src/domains-runtime-catalog.ts",
  "src/domains-startup-plan.ts",
  "src/domains-runtime-orchestrator.ts",
  "src/interaction-governance-runtime-catalog.ts",
  "src/interaction-governance-startup-plan.ts",
  "src/interaction-governance-runtime-orchestrator.ts",
  "src/scale-ops-runtime-catalog.ts",
  "src/scale-ops-startup-plan.ts",
  "src/scale-ops-runtime-orchestrator.ts",
  "src/platform-architecture-bootstrap.ts",
  "src/platform-application-kernel.ts",
  "src/index.ts",
] as const;

test("registerFivePlaneRuntimeCatalog uses a scoped registry by default", async () => {
  const globalRegistry = ServiceRegistry.getInstance();
  await globalRegistry.reset();

  const catalog = registerFivePlaneRuntimeCatalog();
  assert.ok(catalog.interfacePlane.length > 0);

  const freshGlobalRegistry = ServiceRegistry.getInstance();
  try {
    assert.equal(freshGlobalRegistry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), false);
  } finally {
    await freshGlobalRegistry.reset();
  }
});

test("FivePlaneRuntimeOrchestrator default constructor isolates startup from the global registry", async () => {
  const globalRegistry = ServiceRegistry.getInstance();
  await globalRegistry.reset();

  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const result = orchestrator.startup();
  assert.equal(result.ready, true);

  const freshGlobalRegistry = ServiceRegistry.getInstance();
  try {
    assert.equal(freshGlobalRegistry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID), false);
    assert.equal(freshGlobalRegistry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), false);
  } finally {
    await freshGlobalRegistry.reset();
  }
});

test("buildPlatformRootSummary defaults to a scoped registry", async () => {
  const globalRegistry = ServiceRegistry.getInstance();
  await globalRegistry.reset();

  const summary = buildPlatformRootSummary();
  assert.ok(summary.planes.capabilityCounts.interface >= 0);

  const freshGlobalRegistry = ServiceRegistry.getInstance();
  try {
    assert.equal(freshGlobalRegistry.isInitialized("architecture.application-kernel"), false);
    assert.equal(freshGlobalRegistry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), false);
  } finally {
    await freshGlobalRegistry.reset();
  }
});

test("top-level runtime assembly entrypoints default to ServiceRegistry.createScoped", () => {
  for (const relativePath of TOP_LEVEL_SCOPE_FILES) {
    const source = readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
    assert.equal(
      source.includes("ServiceRegistry = ServiceRegistry.getInstance()"),
      false,
      `${relativePath} should not default runtime assembly to ServiceRegistry.getInstance()`,
    );
    assert.equal(
      source.includes("ServiceRegistry = ServiceRegistry.createScoped()"),
      true,
      `${relativePath} should default runtime assembly to ServiceRegistry.createScoped()`,
    );
  }
});
