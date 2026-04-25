import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_MAINLINE_CAPABILITIES,
  listPlatformMainlineCapabilities,
  resolvePlatformMainlineCapability,
  type PlatformMainlineCapabilityId,
  type PlatformMainlineCapability,
} from "../../src/platform/platform-mainline-bootstrap.js";

const VALID_CAPABILITY_IDS: PlatformMainlineCapabilityId[] = [
  "interface",
  "control-plane",
  "orchestration",
  "execution",
  "state-evidence",
  "model-gateway",
  "prompt-engine",
  "compliance",
];

test("PLATFORM_MAINLINE_CAPABILITIES is a frozen array", () => {
  assert.ok(Array.isArray(PLATFORM_MAINLINE_CAPABILITIES));
  assert.ok(Object.isFrozen(PLATFORM_MAINLINE_CAPABILITIES));
});

test("PLATFORM_MAINLINE_CAPABILITIES contains all expected capability IDs", () => {
  const capabilityIds = PLATFORM_MAINLINE_CAPABILITIES.map((c) => c.capabilityId);
  for (const id of VALID_CAPABILITY_IDS) {
    assert.ok(capabilityIds.includes(id), `Expected capability ID "${id}" to be present`);
  }
  assert.equal(PLATFORM_MAINLINE_CAPABILITIES.length, VALID_CAPABILITY_IDS.length);
});

test("each PlatformMainlineCapability has required fields", () => {
  for (const capability of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(capability.capabilityId, "capabilityId must be present");
    assert.ok(capability.entryModule, "entryModule must be present");
    assert.ok(Array.isArray(capability.architectureSections), "architectureSections must be an array");
    assert.ok(Array.isArray(capability.criticalSubmodules), "criticalSubmodules must be an array");
  }
});

test("each PlatformMainlineCapability has unique capabilityId", () => {
  const ids = PLATFORM_MAINLINE_CAPABILITIES.map((c) => c.capabilityId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "capabilityId values must be unique");
});

test("listPlatformMainlineCapabilities returns the frozen catalog", () => {
  const result = listPlatformMainlineCapabilities();
  assert.ok(Array.isArray(result));
  assert.ok(Object.isFrozen(result));
  assert.equal(result, PLATFORM_MAINLINE_CAPABILITIES);
});

test("resolvePlatformMainlineCapability resolves all valid capability IDs", () => {
  for (const capabilityId of VALID_CAPABILITY_IDS) {
    const capability = resolvePlatformMainlineCapability(capabilityId);
    assert.equal(capability.capabilityId, capabilityId);
    assert.ok(capability.entryModule);
    assert.ok(Array.isArray(capability.architectureSections));
    assert.ok(Array.isArray(capability.criticalSubmodules));
  }
});

test("resolvePlatformMainlineCapability throws for unknown capabilityId", () => {
  assert.throws(
    () => resolvePlatformMainlineCapability("unknown-capability" as PlatformMainlineCapabilityId),
    (error: any) => error.message.includes("platform_mainline.not_found")
  );
});

test("resolvePlatformMainlineCapability error message includes the unknown ID", () => {
  const unknownId = "nonexistent-capability";
  assert.throws(
    () => resolvePlatformMainlineCapability(unknownId as PlatformMainlineCapabilityId),
    (error: any) => error.message.includes(unknownId)
  );
});

test("resolvePlatformMainlineCapability returns capability with correct structure", () => {
  const capability = resolvePlatformMainlineCapability("execution");
  assert.equal(capability.capabilityId, "execution");
  assert.equal(capability.entryModule, "src/platform/execution/index.ts");
  assert.ok(capability.architectureSections.includes("§14"));
  assert.ok(capability.criticalSubmodules.includes("dispatcher"));
  assert.ok(capability.criticalSubmodules.includes("execution-engine"));
});

test("PlatformMainlineCapabilityId type accepts all valid IDs", () => {
  const ids: PlatformMainlineCapabilityId[] = VALID_CAPABILITY_IDS;
  assert.equal(ids.length, VALID_CAPABILITY_IDS.length);
});

test("specific capabilities have expected properties", () => {
  const interfaceCap = resolvePlatformMainlineCapability("interface");
  assert.equal(interfaceCap.entryModule, "src/platform/interface/index.ts");
  assert.ok(interfaceCap.architectureSections.includes("§4"));
  assert.ok(interfaceCap.criticalSubmodules.includes("api"));
  assert.ok(interfaceCap.criticalSubmodules.includes("webhook"));

  const controlPlane = resolvePlatformMainlineCapability("control-plane");
  assert.equal(controlPlane.entryModule, "src/platform/control-plane/index.ts");
  assert.ok(controlPlane.criticalSubmodules.includes("approval-center"));
  assert.ok(controlPlane.criticalSubmodules.includes("config-center"));

  const stateEvidence = resolvePlatformMainlineCapability("state-evidence");
  assert.equal(stateEvidence.entryModule, "src/platform/state-evidence/index.ts");
  assert.ok(stateEvidence.criticalSubmodules.includes("truth"));
  assert.ok(stateEvidence.criticalSubmodules.includes("events"));

  const modelGateway = resolvePlatformMainlineCapability("model-gateway");
  assert.ok(modelGateway.criticalSubmodules.includes("provider-registry"));
  assert.ok(modelGateway.criticalSubmodules.includes("router"));

  const promptEngine = resolvePlatformMainlineCapability("prompt-engine");
  assert.ok(promptEngine.criticalSubmodules.includes("registry"));
  assert.ok(promptEngine.criticalSubmodules.includes("renderer"));
  assert.ok(promptEngine.criticalSubmodules.includes("eval"));
});

test("criticalSubmodules arrays are non-empty for all capabilities", () => {
  for (const capability of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(capability.criticalSubmodules.length > 0, `${capability.capabilityId} should have criticalSubmodules`);
  }
});

test("architectureSections arrays are non-empty for all capabilities", () => {
  for (const capability of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(capability.architectureSections.length > 0, `${capability.capabilityId} should have architectureSections`);
  }
});
