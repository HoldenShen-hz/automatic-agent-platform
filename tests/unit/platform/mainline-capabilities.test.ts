import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlatformMainlineCapabilities,
  resolvePlatformMainlineCapability,
  PLATFORM_MAINLINE_CAPABILITIES,
  type PlatformMainlineCapabilityId,
} from "../../../src/platform/platform-mainline-bootstrap.js";

test("PLATFORM_MAINLINE_CAPABILITIES is frozen and has exactly 8 capabilities", () => {
  assert.ok(Object.isFrozen(PLATFORM_MAINLINE_CAPABILITIES), "PLATFORM_MAINLINE_CAPABILITIES should be frozen");
  assert.equal(PLATFORM_MAINLINE_CAPABILITIES.length, 8);
});

test("listPlatformMainlineCapabilities returns frozen array of 8 capabilities", () => {
  const capabilities = listPlatformMainlineCapabilities();
  assert.ok(Object.isFrozen(capabilities), "returned array should be frozen");
  assert.equal(capabilities.length, 8);
});

test("all capability IDs are valid PlatformMainlineCapabilityId types", () => {
  const capabilityIds: PlatformMainlineCapabilityId[] = [
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
    "model-gateway",
    "prompt-engine",
    "compliance",
  ];

  const capabilities = listPlatformMainlineCapabilities();
  const capabilityIdsFromList = capabilities.map((c) => c.capabilityId);

  assert.deepEqual(capabilityIdsFromList, capabilityIds);
});

test("each capability has required fields", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    assert.ok(typeof capability.capabilityId === "string", `${capability.capabilityId}: capabilityId should be string`);
    assert.ok(typeof capability.entryModule === "string", `${capability.capabilityId}: entryModule should be string`);
    assert.ok(Array.isArray(capability.architectureSections), `${capability.capabilityId}: architectureSections should be array`);
    assert.ok(Array.isArray(capability.criticalSubmodules), `${capability.capabilityId}: criticalSubmodules should be array`);
    assert.ok(capability.architectureSections.length > 0, `${capability.capabilityId}: should have at least one architecture section`);
    assert.ok(capability.criticalSubmodules.length > 0, `${capability.capabilityId}: should have at least one critical submodule`);
  }
});

test("each capability entryModule starts with 'src/platform/'", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    assert.ok(
      capability.entryModule.startsWith("src/platform/"),
      `${capability.capabilityId}: entryModule should start with 'src/platform/', got ${capability.entryModule}`,
    );
  }
});

test("all architecture sections follow section reference format (§X or §X.Y)", () => {
  const capabilities = listPlatformMainlineCapabilities();
  const sectionPattern = /^§\d+(?:\.\d+)*$/;

  for (const capability of capabilities) {
    for (const section of capability.architectureSections) {
      assert.ok(
        sectionPattern.test(section),
        `${capability.capabilityId}: architecture section '${section}' should match section reference format`,
      );
    }
  }
});

test("resolvePlatformMainlineCapability returns correct capability for each capabilityId", () => {
  const capabilities = listPlatformMainlineCapabilities();

  for (const capability of capabilities) {
    const resolved = resolvePlatformMainlineCapability(capability.capabilityId);
    assert.strictEqual(resolved.capabilityId, capability.capabilityId);
    assert.strictEqual(resolved.entryModule, capability.entryModule);
    assert.deepEqual(resolved.architectureSections, capability.architectureSections);
  }
});

test("resolvePlatformMainlineCapability throws Error for unknown capabilityId", () => {
  assert.throws(
    () => resolvePlatformMainlineCapability("non-existent" as PlatformMainlineCapabilityId),
    { message: /platform_mainline.not_found:non-existent/ },
  );
});

test("interface capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("interface");

  assert.strictEqual(capability.entryModule, "src/platform/interface/index.ts");
  assert.ok(capability.architectureSections.includes("§4"));
  assert.ok(capability.architectureSections.includes("§6"));
  assert.ok(capability.architectureSections.includes("§7"));
  assert.ok(capability.criticalSubmodules.includes("api"));
  assert.ok(capability.criticalSubmodules.includes("webhook"));
  assert.ok(capability.criticalSubmodules.includes("scheduler"));
});

test("control-plane capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("control-plane");

  assert.strictEqual(capability.entryModule, "src/platform/control-plane/index.ts");
  assert.ok(capability.architectureSections.includes("§10"));
  assert.ok(capability.criticalSubmodules.includes("approval-center"));
  assert.ok(capability.criticalSubmodules.includes("config-center"));
  assert.ok(capability.criticalSubmodules.includes("iam"));
});

test("orchestration capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("orchestration");

  assert.strictEqual(capability.entryModule, "src/platform/orchestration/index.ts");
  assert.ok(capability.architectureSections.includes("§13"));
  assert.ok(capability.criticalSubmodules.includes("oapeflir"));
  assert.ok(capability.criticalSubmodules.includes("planner"));
  assert.ok(capability.criticalSubmodules.includes("hitl"));
});

test("execution capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("execution");

  assert.strictEqual(capability.entryModule, "src/platform/execution/index.ts");
  assert.ok(capability.architectureSections.includes("§14"));
  assert.ok(capability.criticalSubmodules.includes("dispatcher"));
  assert.ok(capability.criticalSubmodules.includes("execution-engine"));
  assert.ok(capability.criticalSubmodules.includes("worker-pool"));
});

test("state-evidence capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("state-evidence");

  assert.strictEqual(capability.entryModule, "src/platform/state-evidence/index.ts");
  assert.ok(capability.architectureSections.includes("§25"));
  assert.ok(capability.criticalSubmodules.includes("truth"));
  assert.ok(capability.criticalSubmodules.includes("events"));
  assert.ok(capability.criticalSubmodules.includes("projections"));
});

test("model-gateway capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("model-gateway");

  assert.strictEqual(capability.entryModule, "src/platform/model-gateway/index.ts");
  assert.ok(capability.architectureSections.includes("§15"));
  assert.ok(capability.criticalSubmodules.includes("provider-registry"));
  assert.ok(capability.criticalSubmodules.includes("router"));
  assert.ok(capability.criticalSubmodules.includes("fallback"));
});

test("prompt-engine capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("prompt-engine");

  assert.strictEqual(capability.entryModule, "src/platform/prompt-engine/index.ts");
  assert.ok(capability.architectureSections.includes("§16"));
  assert.ok(capability.criticalSubmodules.includes("registry"));
  assert.ok(capability.criticalSubmodules.includes("renderer"));
  assert.ok(capability.criticalSubmodules.includes("eval"));
});

test("compliance capability has correct properties", () => {
  const capability = resolvePlatformMainlineCapability("compliance");

  assert.strictEqual(capability.entryModule, "src/platform/compliance/index.ts");
  assert.ok(capability.architectureSections.includes("§23"));
  assert.ok(capability.criticalSubmodules.includes("crypto-shredding"));
  assert.ok(capability.criticalSubmodules.includes("erasure"));
  assert.ok(capability.criticalSubmodules.includes("lineage"));
});

test("no duplicate capabilityIds across capabilities", () => {
  const capabilities = listPlatformMainlineCapabilities();
  const ids = capabilities.map((c) => c.capabilityId);
  const uniqueIds = new Set(ids);

  assert.equal(uniqueIds.size, ids.length, "capabilityIds should be unique");
});

test("listPlatformMainlineCapabilities returns same frozen array reference", () => {
  const capabilities1 = listPlatformMainlineCapabilities();
  const capabilities2 = listPlatformMainlineCapabilities();

  assert.strictEqual(capabilities1, capabilities2);
});
