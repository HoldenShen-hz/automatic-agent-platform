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
  type ArchitectureReadinessRingId,
} from "../../src/platform/platform-module-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("PLATFORM_SURFACE_MANIFESTS is frozen and has 11 entries", () => {
  assert.ok(Object.isFrozen(PLATFORM_SURFACE_MANIFESTS));
  assert.equal(PLATFORM_SURFACE_MANIFESTS.length, 11);
});

test("PLATFORM_SURFACE_MANIFESTS entries contain required fields", () => {
  for (const manifest of PLATFORM_SURFACE_MANIFESTS) {
    assert.ok(typeof manifest.surfaceId === "string");
    assert.ok(typeof manifest.entryModule === "string");
    assert.ok(typeof manifest.description === "string");
    assert.ok(Array.isArray(manifest.architectureSections));
    assert.ok(Array.isArray(manifest.canonicalSubdomains));
  }
});

test("PLATFORM_SURFACE_MANIFESTS surfaceIds are unique", () => {
  const ids = PLATFORM_SURFACE_MANIFESTS.map((m) => m.surfaceId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
});

test("PLATFORM_SURFACE_MANIFESTS includes expected surface IDs", () => {
  const ids = PLATFORM_SURFACE_MANIFESTS.map((m) => m.surfaceId);
  const expectedIds: PlatformSurfaceId[] = [
    "contracts",
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
    "model-gateway",
    "prompt-engine",
    "shared",
    "compliance",
  ];
  for (const expected of expectedIds) {
    assert.ok(ids.includes(expected), `Expected surfaceId ${expected} not found`);
  }
});

test("listPlatformSurfaceManifests returns PLATFORM_SURFACE_MANIFESTS", () => {
  const result = listPlatformSurfaceManifests();
  assert.strictEqual(result, PLATFORM_SURFACE_MANIFESTS);
});

test("resolvePlatformSurfaceManifest returns manifest for valid surfaceId", () => {
  const manifest = resolvePlatformSurfaceManifest("execution");
  assert.equal(manifest.surfaceId, "execution");
  assert.equal(manifest.entryModule, "src/platform/execution/index.ts");
  assert.ok(manifest.canonicalSubdomains.includes("dispatcher"));
  assert.ok(manifest.canonicalSubdomains.includes("execution-engine"));
});

test("resolvePlatformSurfaceManifest throws for unknown surfaceId", () => {
  assert.throws(
    () => resolvePlatformSurfaceManifest("unknown-surface" as PlatformSurfaceId),
    /Unknown platform surface/,
  );
});

test("ARCHITECTURE_READINESS_RINGS is frozen and has 4 entries", () => {
  assert.ok(Object.isFrozen(ARCHITECTURE_READINESS_RINGS));
  assert.equal(ARCHITECTURE_READINESS_RINGS.length, 4);
});

test("ARCHITECTURE_READINESS_RINGS entries contain required fields", () => {
  for (const ring of ARCHITECTURE_READINESS_RINGS) {
    assert.ok(typeof ring.ringId === "string");
    assert.ok(typeof ring.status === "string");
    assert.ok(typeof ring.gateMeaning === "string");
    assert.ok(Array.isArray(ring.architectureSections));
    assert.ok(Array.isArray(ring.evidenceModules));
    assert.ok(Array.isArray(ring.verificationTests));
  }
});

test("ARCHITECTURE_READINESS_RINGS ringIds are unique", () => {
  const ids = ARCHITECTURE_READINESS_RINGS.map((r) => r.ringId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
});

test("ARCHITECTURE_READINESS_RINGS includes expected ring IDs", () => {
  const ids = ARCHITECTURE_READINESS_RINGS.map((r) => r.ringId);
  const expectedIds: ArchitectureReadinessRingId[] = [
    "contract-freeze",
    "hardening",
    "usability",
    "expansion",
  ];
  for (const expected of expectedIds) {
    assert.ok(ids.includes(expected), `Expected ringId ${expected} not found`);
  }
});

test("ARCHITECTURE_READINESS_RINGS first ring has production_verified status", () => {
  const firstRing = ARCHITECTURE_READINESS_RINGS[0];
  assert.equal(firstRing.ringId, "contract-freeze");
  assert.equal(firstRing.status, "production_verified");
});

test("listArchitectureReadinessRings returns ARCHITECTURE_READINESS_RINGS", () => {
  const result = listArchitectureReadinessRings();
  assert.strictEqual(result, ARCHITECTURE_READINESS_RINGS);
});

test("resolveArchitectureReadinessRing returns ring for valid ringId", () => {
  const ring = resolveArchitectureReadinessRing("hardening");
  assert.equal(ring.ringId, "hardening");
  assert.equal(ring.status, "evidence_registered");
  assert.ok(ring.architectureSections.includes("§9"));
});

test("resolveArchitectureReadinessRing throws for unknown ringId", () => {
  assert.throws(
    () => resolveArchitectureReadinessRing("unknown-ring" as ArchitectureReadinessRingId),
    /Unknown architecture readiness ring/,
  );
});

test("registerPlatformSurfaceCatalog registers and retrieves catalog", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const result = registerPlatformSurfaceCatalog(registry);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 11);
  } finally {
    await registry.reset();
  }
});

test("registerPlatformSurfaceCatalog returns same reference on subsequent calls", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const result1 = registerPlatformSurfaceCatalog(registry);
    const result2 = registerPlatformSurfaceCatalog(registry);
    assert.strictEqual(result1, result2);
  } finally {
    await registry.reset();
  }
});

test("registerPlatformSurfaceCatalog accepts default registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const result = registerPlatformSurfaceCatalog();
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 11);
  } finally {
    await registry.reset();
  }
});

test("resolvePlatformSurfaceManifest for all surfaceIds returns valid manifests", () => {
  const surfaceIds: PlatformSurfaceId[] = [
    "contracts",
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
    "model-gateway",
    "prompt-engine",
    "shared",
    "compliance",
  ];

  for (const id of surfaceIds) {
    const manifest = resolvePlatformSurfaceManifest(id);
    assert.equal(manifest.surfaceId, id);
    assert.ok(manifest.entryModule.startsWith("src/platform/"));
    assert.ok(manifest.architectureSections.length > 0);
    assert.ok(manifest.canonicalSubdomains.length > 0);
  }
});

test("resolveArchitectureReadinessRing for all ringIds returns valid rings", () => {
  const ringIds: ArchitectureReadinessRingId[] = [
    "contract-freeze",
    "hardening",
    "usability",
    "expansion",
  ];

  for (const id of ringIds) {
    const ring = resolveArchitectureReadinessRing(id);
    assert.equal(ring.ringId, id);
    assert.ok(ring.architectureSections.length > 0);
    assert.ok(ring.evidenceModules.length > 0);
    assert.ok(ring.verificationTests.length > 0);
  }
});

test("execution surface manifest has expected canonical subdomains", () => {
  const manifest = resolvePlatformSurfaceManifest("execution");
  assert.ok(manifest.canonicalSubdomains.includes("dispatcher"));
  assert.ok(manifest.canonicalSubdomains.includes("execution-engine"));
  assert.ok(manifest.canonicalSubdomains.includes("worker-pool"));
  assert.ok(manifest.canonicalSubdomains.includes("queue"));
  assert.ok(manifest.canonicalSubdomains.includes("recovery"));
});

test("state-evidence surface manifest has expected canonical subdomains", () => {
  const manifest = resolvePlatformSurfaceManifest("state-evidence");
  assert.ok(manifest.canonicalSubdomains.includes("truth"));
  assert.ok(manifest.canonicalSubdomains.includes("events"));
  assert.ok(manifest.canonicalSubdomains.includes("artifacts"));
  assert.ok(manifest.canonicalSubdomains.includes("knowledge"));
});

test("expansion ring verification tests include platform-module-catalog", () => {
  const ring = resolveArchitectureReadinessRing("expansion");
  assert.ok(ring.verificationTests.some((t) => t.includes("platform-module-catalog")));
});