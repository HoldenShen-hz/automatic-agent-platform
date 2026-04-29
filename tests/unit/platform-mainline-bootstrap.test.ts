import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_MAINLINE_CAPABILITIES,
  listPlatformMainlineCapabilities,
  resolvePlatformMainlineCapability,
  type PlatformMainlineCapabilityId,
} from "../../src/platform/platform-mainline-bootstrap.js";

test("PLATFORM_MAINLINE_CAPABILITIES is frozen and has 8 entries", () => {
  assert.ok(Object.isFrozen(PLATFORM_MAINLINE_CAPABILITIES));
  assert.equal(PLATFORM_MAINLINE_CAPABILITIES.length, 8);
});

test("PLATFORM_MAINLINE_CAPABILITIES entries contain required fields", () => {
  for (const cap of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(typeof cap.capabilityId === "string");
    assert.ok(typeof cap.entryModule === "string");
    assert.ok(Array.isArray(cap.architectureSections));
    assert.ok(Array.isArray(cap.criticalSubmodules));
  }
});

test("PLATFORM_MAINLINE_CAPABILITIES capabilityIds are unique", () => {
  const ids = PLATFORM_MAINLINE_CAPABILITIES.map((c) => c.capabilityId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
});

test("PLATFORM_MAINLINE_CAPABILITIES includes expected capability IDs", () => {
  const ids = PLATFORM_MAINLINE_CAPABILITIES.map((c) => c.capabilityId);
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
  for (const expected of expectedIds) {
    assert.ok(ids.includes(expected), `Expected capabilityId ${expected} not found`);
  }
});

test("listPlatformMainlineCapabilities returns PLATFORM_MAINLINE_CAPABILITIES", () => {
  const result = listPlatformMainlineCapabilities();
  assert.strictEqual(result, PLATFORM_MAINLINE_CAPABILITIES);
});

test("resolvePlatformMainlineCapability returns capability for valid capabilityId", () => {
  const capability = resolvePlatformMainlineCapability("execution");
  assert.equal(capability.capabilityId, "execution");
  assert.equal(capability.entryModule, "src/platform/execution/index.ts");
  assert.ok(capability.criticalSubmodules.includes("dispatcher"));
  assert.ok(capability.criticalSubmodules.includes("execution-engine"));
});

test("resolvePlatformMainlineCapability throws for unknown capabilityId", () => {
  assert.throws(
    () => resolvePlatformMainlineCapability("unknown-capability" as PlatformMainlineCapabilityId),
    /platform_mainline.not_found/,
  );
});

test("interface capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("interface");
  assert.ok(capability.criticalSubmodules.includes("api"));
  assert.ok(capability.criticalSubmodules.includes("webhook"));
  assert.ok(capability.criticalSubmodules.includes("scheduler"));
  assert.ok(capability.criticalSubmodules.includes("console-backend"));
  assert.ok(capability.criticalSubmodules.includes("ingress"));
});

test("control-plane capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("control-plane");
  assert.ok(capability.criticalSubmodules.includes("approval-center"));
  assert.ok(capability.criticalSubmodules.includes("config-center"));
  assert.ok(capability.criticalSubmodules.includes("iam"));
  assert.ok(capability.criticalSubmodules.includes("incident-control"));
});

test("orchestration capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("orchestration");
  assert.ok(capability.criticalSubmodules.includes("planner"));
  assert.ok(capability.criticalSubmodules.includes("routing"));
  assert.ok(capability.criticalSubmodules.includes("harness"));
  assert.ok(capability.criticalSubmodules.includes("hitl"));
});

test("state-evidence capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("state-evidence");
  assert.ok(capability.criticalSubmodules.includes("truth"));
  assert.ok(capability.criticalSubmodules.includes("events"));
  assert.ok(capability.criticalSubmodules.includes("artifacts"));
  assert.ok(capability.criticalSubmodules.includes("memory"));
});

test("model-gateway capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("model-gateway");
  assert.ok(capability.criticalSubmodules.includes("provider-registry"));
  assert.ok(capability.criticalSubmodules.includes("router"));
  assert.ok(capability.criticalSubmodules.includes("fallback"));
  assert.ok(capability.criticalSubmodules.includes("degradation"));
  assert.ok(capability.criticalSubmodules.includes("cost-tracker"));
});

test("prompt-engine capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("prompt-engine");
  assert.ok(capability.criticalSubmodules.includes("registry"));
  assert.ok(capability.criticalSubmodules.includes("renderer"));
  assert.ok(capability.criticalSubmodules.includes("rollout"));
  assert.ok(capability.criticalSubmodules.includes("eval"));
  assert.ok(capability.criticalSubmodules.includes("conversation-template"));
});

test("compliance capability has expected critical submodules", () => {
  const capability = resolvePlatformMainlineCapability("compliance");
  assert.ok(capability.criticalSubmodules.includes("crypto-shredding"));
  assert.ok(capability.criticalSubmodules.includes("data-residency"));
  assert.ok(capability.criticalSubmodules.includes("encryption"));
  assert.ok(capability.criticalSubmodules.includes("erasure"));
  assert.ok(capability.criticalSubmodules.includes("lineage"));
});

test("all capabilities have valid entry modules pointing to platform", () => {
  for (const capability of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(
      capability.entryModule.startsWith("src/platform/"),
      `Capability ${capability.capabilityId} has invalid entry module: ${capability.entryModule}`,
    );
    assert.ok(
      capability.entryModule.endsWith("/index.ts"),
      `Capability ${capability.capabilityId} entry module should end with /index.ts`,
    );
  }
});

test("all capabilities have at least one architecture section", () => {
  for (const capability of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(
      capability.architectureSections.length > 0,
      `Capability ${capability.capabilityId} has no architecture sections`,
    );
    for (const section of capability.architectureSections) {
      assert.ok(
        section.startsWith("§"),
        `Invalid architecture section format: ${section}`,
      );
    }
  }
});

test("all capabilities have at least one critical submodule", () => {
  for (const capability of PLATFORM_MAINLINE_CAPABILITIES) {
    assert.ok(
      capability.criticalSubmodules.length > 0,
      `Capability ${capability.capabilityId} has no critical submodules`,
    );
  }
});

test("resolvePlatformMainlineCapability for all capabilityIds returns valid capabilities", () => {
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

  for (const id of capabilityIds) {
    const capability = resolvePlatformMainlineCapability(id);
    assert.equal(capability.capabilityId, id);
    assert.ok(capability.entryModule.length > 0);
    assert.ok(capability.architectureSections.length > 0);
    assert.ok(capability.criticalSubmodules.length > 0);
  }
});

test("execution capability has expected execution-related subdomains", () => {
  const capability = resolvePlatformMainlineCapability("execution");
  const subdomains = capability.criticalSubmodules;

  assert.ok(subdomains.includes("dispatcher"));
  assert.ok(subdomains.includes("execution-engine"));
  assert.ok(subdomains.includes("worker-pool"));
  assert.ok(subdomains.includes("queue"));
  assert.ok(subdomains.includes("recovery"));
  assert.ok(subdomains.includes("distributed-lock"));
  assert.ok(subdomains.includes("tool-executor"));
});

test("orchestration capability has expected coordination subdomains", () => {
  const capability = resolvePlatformMainlineCapability("orchestration");
  const subdomains = capability.criticalSubmodules;

  assert.ok(subdomains.includes("planner"));
  assert.ok(subdomains.includes("routing"));
  assert.ok(subdomains.includes("harness"));
  assert.ok(subdomains.includes("hitl"));
  assert.ok(subdomains.includes("agent-delegation"));
  assert.ok(subdomains.includes("oapeflir"));
});

test("error message includes the invalid capabilityId", () => {
  const invalidId = "totally-invalid-capability";
  try {
    resolvePlatformMainlineCapability(invalidId as PlatformMainlineCapabilityId);
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes(invalidId));
  }
});