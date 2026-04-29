import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_MAINLINE_CAPABILITIES,
  listPlatformMainlineCapabilities,
  resolvePlatformMainlineCapability,
  type PlatformMainlineCapabilityId,
  type PlatformMainlineCapability,
} from "../../src/platform/platform-mainline-bootstrap.js";

test("listPlatformMainlineCapabilities returns frozen top-level array", () => {
  const capabilities = listPlatformMainlineCapabilities();
  assert.ok(Object.isFrozen(capabilities));
});

test("mainline capabilities cover all five platform planes", () => {
  const capabilities = listPlatformMainlineCapabilities();
  const ids = capabilities.map((c) => c.capabilityId);

  const platformPlanes: PlatformMainlineCapabilityId[] = [
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ];

  for (const plane of platformPlanes) {
    assert.ok(
      ids.includes(plane),
      `Required platform plane ${plane} not found in mainline capabilities`,
    );
  }
});

test("resolvePlatformMainlineCapability integrates with listPlatformMainlineCapabilities", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const cap of capabilities) {
    const resolved = resolvePlatformMainlineCapability(cap.capabilityId);
    assert.strictEqual(resolved.capabilityId, cap.capabilityId);
    assert.strictEqual(resolved.entryModule, cap.entryModule);
    assert.deepStrictEqual(resolved.architectureSections, cap.architectureSections);
    assert.deepStrictEqual(resolved.criticalSubmodules, cap.criticalSubmodules);
  }
});

test("all architecture sections follow §N format", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const cap of capabilities) {
    for (const section of cap.architectureSections) {
      assert.ok(
        /^§\d+(?:\.\d+)*$/.test(section),
        `Capability ${cap.capabilityId} has invalid section format: ${section}`,
      );
    }
  }
});

test("model-gateway and prompt-engine are separate concerns", () => {
  const modelGateway = resolvePlatformMainlineCapability("model-gateway");
  const promptEngine = resolvePlatformMainlineCapability("prompt-engine");

  assert.notStrictEqual(modelGateway.capabilityId, promptEngine.capabilityId);

  const modelSubsets = new Set(modelGateway.criticalSubmodules);
  const promptSubsets = new Set(promptEngine.criticalSubmodules);

  const overlap = [...modelSubsets].filter((x) => promptSubsets.has(x));
  assert.equal(
    overlap.length,
    0,
    `model-gateway and prompt-engine should have no overlap, but found: ${overlap.join(", ")}`,
  );
});

test("execution and state-evidence capabilities are distinct", () => {
  const execution = resolvePlatformMainlineCapability("execution");
  const stateEvidence = resolvePlatformMainlineCapability("state-evidence");

  assert.notStrictEqual(execution.capabilityId, stateEvidence.capabilityId);

  const executionSet = new Set(execution.criticalSubmodules);
  const evidenceSet = new Set(stateEvidence.criticalSubmodules);

  const overlap = [...executionSet].filter((x) => evidenceSet.has(x));
  assert.equal(
    overlap.length,
    0,
    `execution and state-evidence should have no overlap, but found: ${overlap.join(", ")}`,
  );
});

test("mainline bootstrap is consistent with module catalog interface", async () => {
  const { listPlatformSurfaceManifests, resolvePlatformSurfaceManifest } =
    await import("../../src/platform/platform-module-catalog.js");

  const surfaceManifests = listPlatformSurfaceManifests();
  const mainlineCapabilities = listPlatformMainlineCapabilities();

  const surfaceIds = surfaceManifests.map((s) => s.surfaceId);
  const mainlineIds = mainlineCapabilities.map((c) => c.capabilityId);

  for (const id of mainlineIds) {
    if (id === "x1-fabric" || id === "shared" || id === "contracts") {
      continue;
    }
    assert.ok(
      surfaceIds.includes(id as any),
      `Mainline capability ${id} should exist in surface manifest catalog`,
    );
  }
});

test("resolvePlatformMainlineCapability error is distinguishable", () => {
  const invalidId = "definitely-not-a-valid-capability";
  try {
    resolvePlatformMainlineCapability(invalidId as PlatformMainlineCapabilityId);
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("platform_mainline.not_found"));
    assert.ok(err.message.includes(invalidId));
  }
});

test("full roundtrip: list all and resolve all", () => {
  const capabilities = listPlatformMainlineCapabilities();
  assert.equal(capabilities.length, 8);

  for (const capability of capabilities) {
    const resolved = resolvePlatformMainlineCapability(capability.capabilityId);
    assert.strictEqual(resolved, capability);
  }
});

test("compliance capability is last in the list and covers data governance", () => {
  const compliance = PLATFORM_MAINLINE_CAPABILITIES[PLATFORM_MAINLINE_CAPABILITIES.length - 1];
  assert.equal(compliance.capabilityId, "compliance");

  assert.ok(compliance.criticalSubmodules.includes("crypto-shredding"));
  assert.ok(compliance.criticalSubmodules.includes("data-residency"));
  assert.ok(compliance.criticalSubmodules.includes("erasure"));
  assert.ok(compliance.criticalSubmodules.includes("lineage"));

  assert.ok(compliance.architectureSections.includes("§23"));
});

test("interface capability entry module maps to interface plane", () => {
  const interfaceCap = resolvePlatformMainlineCapability("interface");
  assert.equal(interfaceCap.entryModule, "src/platform/interface/index.ts");
});

test("critical submodules are meaningful names, not file paths", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const cap of capabilities) {
    for (const submodule of cap.criticalSubmodules) {
      assert.ok(
        !submodule.includes("/"),
        `Capability ${cap.capabilityId} submodule "${submodule}" should not be a file path`,
      );
      assert.ok(
        submodule === submodule.toLowerCase(),
        `Capability ${cap.capabilityId} submodule "${submodule}" should be lowercase`,
      );
    }
  }
});