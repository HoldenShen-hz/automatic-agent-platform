import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_SURFACE_MANIFESTS,
  ARCHITECTURE_READINESS_RINGS,
  listPlatformSurfaceManifests,
  resolvePlatformSurfaceManifest,
  registerPlatformSurfaceCatalog,
  listArchitectureReadinessRings,
  resolveArchitectureReadinessRing,
  type PlatformSurfaceId,
  type PlatformSurfaceManifest,
  type ArchitectureReadinessRing,
} from "../../src/platform/platform-module-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("registerPlatformSurfaceCatalog integrates with ServiceRegistry lifecycle", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerPlatformSurfaceCatalog(registry);

    assert.ok(registry.isInitialized("platform.surface-catalog"));
    const retrieved = registry.get<readonly PlatformSurfaceManifest[]>("platform.surface-catalog");
    assert.strictEqual(retrieved, catalog);
    assert.equal(retrieved.length, 11);
  } finally {
    await registry.reset();
  }
});

test("listPlatformSurfaceManifests works after registry registration", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerPlatformSurfaceCatalog(registry);
    const manifests = listPlatformSurfaceManifests();
    assert.equal(manifests.length, 11);
    assert.strictEqual(manifests, PLATFORM_SURFACE_MANIFESTS);
  } finally {
    await registry.reset();
  }
});

test("resolvePlatformSurfaceManifest works after registry registration", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerPlatformSurfaceCatalog(registry);
    const manifest = resolvePlatformSurfaceManifest("orchestration");
    assert.equal(manifest.surfaceId, "orchestration");
    assert.ok(manifest.canonicalSubdomains.includes("planner"));
    assert.ok(manifest.canonicalSubdomains.includes("routing"));
  } finally {
    await registry.reset();
  }
});

test("catalog covers all major platform planes", async () => {
  const manifests = listPlatformSurfaceManifests();
  const planeIds = manifests.map((m) => m.surfaceId);

  const requiredPlanes: PlatformSurfaceId[] = [
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ];

  for (const plane of requiredPlanes) {
    assert.ok(
      planeIds.includes(plane),
      `Required platform plane ${plane} not found in catalog`,
    );
  }
});

test("architecture rings have consistent structure across all rings", async () => {
  const rings = listArchitectureReadinessRings();

  for (const ring of rings) {
    assert.ok(ring.evidenceModules.length > 0, `Ring ${ring.ringId} has no evidence modules`);
    assert.ok(ring.verificationTests.length > 0, `Ring ${ring.ringId} has no verification tests`);
  }
});

test("service registry isolation between catalog registrations", async () => {
  const registry1 = ServiceRegistry.getInstance();
  const registry2 = ServiceRegistry.getInstance();

  try {
    registerPlatformSurfaceCatalog(registry1);
    const catalog1 = registry1.get<readonly PlatformSurfaceManifest[]>("platform.surface-catalog");

    registerPlatformSurfaceCatalog(registry2);
    const catalog2 = registry2.get<readonly PlatformSurfaceManifest[]>("platform.surface-catalog");

    assert.ok(catalog1 != null);
    assert.ok(catalog2 != null);
    assert.strictEqual(catalog1, catalog2);
  } finally {
    await registry1.reset();
    await registry2.reset();
  }
});

test("platform module catalog is consistent with platform architecture sections", async () => {
  const manifests = listPlatformSurfaceManifests();

  for (const manifest of manifests) {
    assert.ok(
      manifest.architectureSections.length > 0,
      `Surface ${manifest.surfaceId} has no architecture sections`,
    );

    for (const section of manifest.architectureSections) {
      assert.ok(
        section.startsWith("§"),
        `Invalid architecture section format: ${section}`,
      );
    }
  }
});

test("readiness ring expansion references other catalog entries", async () => {
  const ring = resolveArchitectureReadinessRing("expansion");

  const expectedReferences = [
    "src/org-governance/index.ts",
    "src/scale-ecosystem/index.ts",
    "src/ops-maturity/index.ts",
  ];

  for (const ref of expectedReferences) {
    assert.ok(
      ring.evidenceModules.some((m) => m.includes(ref.replace("src/", ""))),
      `Expansion ring should reference ${ref}`,
    );
  }
});

test("resolvePlatformSurfaceManifest error message includes invalid surfaceId", async () => {
  const invalidId = "nonexistent-surface";
  try {
    resolvePlatformSurfaceManifest(invalidId as PlatformSurfaceId);
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes(invalidId));
  }
});

test("resolveArchitectureReadinessRing error message includes invalid ringId", async () => {
  const invalidId = "nonexistent-ring";
  try {
    resolveArchitectureReadinessRing(invalidId as any);
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes(invalidId));
  }
});

test("full roundtrip: register, retrieve, and verify catalog entries", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const registered = registerPlatformSurfaceCatalog(registry);
    assert.equal(registered.length, 11);

    const retrieved = registry.get<readonly PlatformSurfaceManifest[]>("platform.surface-catalog");
    assert.strictEqual(registered, retrieved);

    for (const manifest of retrieved) {
      const resolved = resolvePlatformSurfaceManifest(manifest.surfaceId);
      assert.strictEqual(resolved.surfaceId, manifest.surfaceId);
      assert.strictEqual(resolved.entryModule, manifest.entryModule);
    }
  } finally {
    await registry.reset();
  }
});

test("full roundtrip: list and verify all rings", async () => {
  const rings = listArchitectureReadinessRings();
  assert.equal(rings.length, 4);

  const ringIds = ["contract-freeze", "hardening", "usability", "expansion"];
  for (const id of ringIds) {
    const ring = resolveArchitectureReadinessRing(id as any);
    assert.ok(ring != null);
    assert.equal(ring.ringId, id);
  }
});