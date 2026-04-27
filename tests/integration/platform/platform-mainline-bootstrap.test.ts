import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlatformMainlineCapabilities,
  resolvePlatformMainlineCapability,
  PLATFORM_MAINLINE_CAPABILITIES,
  type PlatformMainlineCapabilityId,
} from "../../../src/platform/platform-mainline-bootstrap.js";

test("integration: listPlatformMainlineCapabilities returns all eight capabilities", () => {
  const capabilities = listPlatformMainlineCapabilities();

  assert.equal(capabilities.length, 8);

  const expectedIds: PlatformMainlineCapabilityId[] = [
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
    "model-gateway",
    "prompt-engine",
    "compliance",
  ];

  const actualIds = capabilities.map((c) => c.capabilityId);
  for (const expectedId of expectedIds) {
    assert.ok(actualIds.includes(expectedId), `Should include ${expectedId}`);
  }
});

test("integration: resolvePlatformMainlineCapability returns correct capability", () => {
  const capability = resolvePlatformMainlineCapability("interface");
  assert.equal(capability.capabilityId, "interface");
  assert.ok(capability.entryModule.includes("interface"));
  assert.ok(Array.isArray(capability.architectureSections));
  assert.ok(Array.isArray(capability.criticalSubmodules));
});

test("integration: each capability has required properties", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    assert.ok(typeof capability.capabilityId === "string");
    assert.ok(typeof capability.entryModule === "string");
    assert.ok(Array.isArray(capability.architectureSections));
    assert.ok(Array.isArray(capability.criticalSubmodules));
    assert.ok(capability.entryModule.startsWith("src/platform/"));
    assert.ok(capability.architectureSections.length > 0);
    assert.ok(capability.criticalSubmodules.length > 0);
  }
});

test("integration: PLATFORM_MAINLINE_CAPABILITIES outer array is frozen", () => {
  assert.ok(Object.isFrozen(PLATFORM_MAINLINE_CAPABILITIES));
});

test("integration: resolvePlatformMainlineCapability throws for unknown capability", () => {
  assert.throws(
    () => resolvePlatformMainlineCapability("unknown-capability" as PlatformMainlineCapabilityId),
    /platform_mainline.not_found/,
  );
});

test("integration: all capability entryModules resolve to existing paths", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    assert.ok(capability.entryModule.endsWith("/index.ts") || capability.entryModule.endsWith(".ts"));
  }
});

test("integration: each plane capability references correct architecture sections", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    // Each capability should reference valid architecture sections (starting with §)
    for (const section of capability.architectureSections) {
      assert.ok(section.startsWith("§"), `${capability.capabilityId} section ${section} should start with §`);
    }
  }
});

test("integration: critical submodules are non-empty strings", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    for (const submodule of capability.criticalSubmodules) {
      assert.ok(typeof submodule === "string");
      assert.ok(submodule.length > 0);
    }
  }
});

test("integration: model-gateway capability has correct structure", () => {
  const capability = resolvePlatformMainlineCapability("model-gateway");
  assert.equal(capability.capabilityId, "model-gateway");
  assert.ok(capability.entryModule.includes("model-gateway"));
  assert.ok(capability.criticalSubmodules.includes("router"));
  assert.ok(capability.criticalSubmodules.includes("provider-registry"));
});

test("integration: prompt-engine capability has correct structure", () => {
  const capability = resolvePlatformMainlineCapability("prompt-engine");
  assert.equal(capability.capabilityId, "prompt-engine");
  assert.ok(capability.entryModule.includes("prompt-engine"));
  assert.ok(capability.criticalSubmodules.includes("registry"));
  assert.ok(capability.criticalSubmodules.includes("renderer"));
});

test("integration: compliance capability has correct structure", () => {
  const capability = resolvePlatformMainlineCapability("compliance");
  assert.equal(capability.capabilityId, "compliance");
  assert.ok(capability.entryModule.includes("compliance"));
  assert.ok(capability.criticalSubmodules.includes("encryption"));
  assert.ok(capability.criticalSubmodules.includes("erasure"));
});
