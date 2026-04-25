import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_SURFACE_MANIFESTS,
  listPlatformSurfaceManifests,
  resolvePlatformSurfaceManifest,
  registerPlatformSurfaceCatalog,
  type PlatformSurfaceId,
  type PlatformSurfaceManifest,
} from "../../src/platform/platform-module-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

const VALID_SURFACE_IDS: PlatformSurfaceId[] = [
  "contracts",
  "interface",
  "control-plane",
  "orchestration",
  "execution",
  "state-evidence",
  "model-gateway",
  "prompt-engine",
  "shared",
  "compliance",
];

test("PLATFORM_SURFACE_MANIFESTS is a frozen array", () => {
  assert.ok(Array.isArray(PLATFORM_SURFACE_MANIFESTS));
  assert.ok(Object.isFrozen(PLATFORM_SURFACE_MANIFESTS));
});

test("PLATFORM_SURFACE_MANIFESTS contains all expected surface IDs", () => {
  const surfaceIds = PLATFORM_SURFACE_MANIFESTS.map((m) => m.surfaceId);
  for (const id of VALID_SURFACE_IDS) {
    assert.ok(surfaceIds.includes(id), `Expected surface ID "${id}" to be present`);
  }
  assert.equal(PLATFORM_SURFACE_MANIFESTS.length, VALID_SURFACE_IDS.length);
});

test("each PlatformSurfaceManifest has required fields", () => {
  for (const manifest of PLATFORM_SURFACE_MANIFESTS) {
    assert.ok(manifest.surfaceId, "surfaceId must be present");
    assert.ok(manifest.entryModule, "entryModule must be present");
    assert.ok(manifest.description, "description must be present");
    assert.ok(Array.isArray(manifest.architectureSections), "architectureSections must be an array");
    assert.ok(Array.isArray(manifest.canonicalSubdomains), "canonicalSubdomains must be an array");
  }
});

test("each PlatformSurfaceManifest has unique surfaceId", () => {
  const ids = PLATFORM_SURFACE_MANIFESTS.map((m) => m.surfaceId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "surfaceId values must be unique");
});

test("listPlatformSurfaceManifests returns the frozen catalog", () => {
  const result = listPlatformSurfaceManifests();
  assert.ok(Array.isArray(result));
  assert.ok(Object.isFrozen(result));
  assert.equal(result, PLATFORM_SURFACE_MANIFESTS);
});

test("resolvePlatformSurfaceManifest resolves all valid surface IDs", () => {
  for (const surfaceId of VALID_SURFACE_IDS) {
    const manifest = resolvePlatformSurfaceManifest(surfaceId);
    assert.equal(manifest.surfaceId, surfaceId);
    assert.ok(manifest.entryModule);
    assert.ok(manifest.description);
  }
});

test("resolvePlatformSurfaceManifest throws for unknown surfaceId", () => {
  assert.throws(
    () => resolvePlatformSurfaceManifest("unknown-surface" as PlatformSurfaceId),
    (error: any) => error.message.includes("Unknown platform surface")
  );
});

test("resolvePlatformSurfaceManifest returns manifest with correct structure", () => {
  const manifest = resolvePlatformSurfaceManifest("execution");
  assert.equal(manifest.surfaceId, "execution");
  assert.equal(manifest.entryModule, "src/platform/execution/index.ts");
  assert.ok(manifest.architectureSections.includes("§14"));
  assert.ok(manifest.canonicalSubdomains.includes("dispatcher"));
});

test("registerPlatformSurfaceCatalog registers catalog in ServiceRegistry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const result = registerPlatformSurfaceCatalog(registry);

  assert.ok(Array.isArray(result));
  assert.equal(result, PLATFORM_SURFACE_MANIFESTS);
});

test("registerPlatformSurfaceCatalog uses default registry when none provided", async () => {
  const result = registerPlatformSurfaceCatalog();

  assert.ok(Array.isArray(result));
  assert.equal(result, PLATFORM_SURFACE_MANIFESTS);
});

test("registerPlatformSurfaceCatalog can be retrieved after registration", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registerPlatformSurfaceCatalog(registry);
  const retrieved = registry.get<readonly PlatformSurfaceManifest[]>("platform.surface-catalog");

  assert.ok(Array.isArray(retrieved));
  assert.equal(retrieved, PLATFORM_SURFACE_MANIFESTS);
});

test("PlatformSurfaceId type accepts all valid IDs", () => {
  const ids: PlatformSurfaceId[] = VALID_SURFACE_IDS;
  assert.equal(ids.length, VALID_SURFACE_IDS.length);
});

test("specific surface manifests have expected properties", () => {
  const contracts = resolvePlatformSurfaceManifest("contracts");
  assert.equal(contracts.entryModule, "src/platform/contracts/index.ts");
  assert.ok(contracts.architectureSections.includes("§5"));
  assert.ok(contracts.canonicalSubdomains.includes("request-envelope"));

  const orchestration = resolvePlatformSurfaceManifest("orchestration");
  assert.equal(orchestration.entryModule, "src/platform/orchestration/index.ts");
  assert.ok(orchestration.canonicalSubdomains.includes("hitl"));
  assert.ok(orchestration.canonicalSubdomains.includes("planner"));

  const stateEvidence = resolvePlatformSurfaceManifest("state-evidence");
  assert.equal(stateEvidence.entryModule, "src/platform/state-evidence/index.ts");
  assert.ok(stateEvidence.canonicalSubdomains.includes("truth"));
  assert.ok(stateEvidence.canonicalSubdomains.includes("events"));
});
