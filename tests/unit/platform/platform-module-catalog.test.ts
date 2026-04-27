import assert from "node:assert/strict";
import test from "node:test";

import {
  listArchitectureReadinessRings,
  listPlatformSurfaceManifests,
  registerPlatformSurfaceCatalog,
  resolveArchitectureReadinessRing,
  resolvePlatformSurfaceManifest,
} from "../../../src/platform/platform-module-catalog.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("platform module catalog exposes canonical platform surfaces", () => {
  const manifests = listPlatformSurfaceManifests();
  assert.deepEqual(
    manifests.map((manifest) => manifest.surfaceId),
    [
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
    ],
  );
  assert.equal(resolvePlatformSurfaceManifest("execution").entryModule, "src/platform/execution/index.ts");
  assert.ok(resolvePlatformSurfaceManifest("orchestration").canonicalSubdomains.includes("harness"));
});

test("platform module catalog registers itself in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const manifests = registerPlatformSurfaceCatalog(registry);
    assert.equal(manifests.length, 10);
    assert.equal(registry.isInitialized("platform.surface-catalog"), true);
  } finally {
    await registry.reset();
  }
});

test("architecture readiness rings are complete and have evidence", () => {
  const rings = listArchitectureReadinessRings();

  assert.deepEqual(
    rings.map((ring) => ring.ringId),
    ["contract-freeze", "hardening", "usability", "expansion"],
  );
  for (const ring of rings) {
    assert.equal(ring.status, "complete");
    assert.equal(ring.evidenceModules.length > 0, true);
    assert.equal(ring.verificationTests.length > 0, true);
  }
  assert.ok(resolveArchitectureReadinessRing("hardening").evidenceModules.includes("src/platform/state-evidence/events/dlq-service.ts"));
  assert.ok(resolveArchitectureReadinessRing("expansion").evidenceModules.includes("src/scale-ecosystem/marketplace/index.ts"));
});
