import assert from "node:assert/strict";
import test from "node:test";
import { listPlatformMainlineCapabilities, resolvePlatformMainlineCapability, PLATFORM_MAINLINE_CAPABILITIES, } from "../../../src/platform/platform-mainline-bootstrap.js";
test("platform mainline bootstrap captures W1/W2 critical surfaces", () => {
    const capabilities = listPlatformMainlineCapabilities();
    assert.deepEqual(capabilities.map((item) => item.capabilityId), ["interface", "control-plane", "orchestration", "execution", "state-evidence", "model-gateway", "prompt-engine", "compliance"]);
    assert.ok(resolvePlatformMainlineCapability("orchestration").criticalSubmodules.includes("harness"));
    assert.ok(resolvePlatformMainlineCapability("prompt-engine").criticalSubmodules.includes("conversation-template"));
});
test("listPlatformMainlineCapabilities returns all eight capabilities", () => {
    const capabilities = listPlatformMainlineCapabilities();
    assert.equal(capabilities.length, 8);
});
test("listPlatformMainlineCapabilities returns frozen array", () => {
    const capabilities = listPlatformMainlineCapabilities();
    assert.ok(Object.isFrozen(capabilities));
});
test("resolvePlatformMainlineCapability returns capability by id", () => {
    const capability = resolvePlatformMainlineCapability("interface");
    assert.equal(capability.capabilityId, "interface");
});
test("resolvePlatformMainlineCapability works for all valid ids", () => {
    const validIds = [
        "interface",
        "control-plane",
        "orchestration",
        "execution",
        "state-evidence",
        "model-gateway",
        "prompt-engine",
        "compliance",
    ];
    for (const id of validIds) {
        const capability = resolvePlatformMainlineCapability(id);
        assert.equal(capability.capabilityId, id);
    }
});
test("resolvePlatformMainlineCapability throws for invalid id", () => {
    assert.throws(() => resolvePlatformMainlineCapability("invalid"), /platform_mainline.not_found/);
    assert.throws(() => resolvePlatformMainlineCapability(""), /platform_mainline.not_found/);
});
test("each capability has capabilityId matching its position in PLATFORM_MAINLINE_CAPABILITIES", () => {
    const capabilities = listPlatformMainlineCapabilities();
    for (let i = 0; i < capabilities.length; i++) {
        assert.equal(capabilities[i].capabilityId, PLATFORM_MAINLINE_CAPABILITIES[i].capabilityId);
    }
});
test("each capability has valid entryModule", () => {
    const capabilities = listPlatformMainlineCapabilities();
    for (const capability of capabilities) {
        assert.ok(capability.entryModule.startsWith("src/platform/"));
        assert.ok(capability.entryModule.endsWith("/index.ts") || capability.entryModule.endsWith(".ts"));
    }
});
test("each capability has architectureSections as non-empty array", () => {
    const capabilities = listPlatformMainlineCapabilities();
    for (const capability of capabilities) {
        assert.ok(Array.isArray(capability.architectureSections));
        assert.ok(capability.architectureSections.length > 0);
    }
});
test("each capability has criticalSubmodules as non-empty array", () => {
    const capabilities = listPlatformMainlineCapabilities();
    for (const capability of capabilities) {
        assert.ok(Array.isArray(capability.criticalSubmodules));
        assert.ok(capability.criticalSubmodules.length > 0);
    }
});
test("all architecture sections start with § symbol", () => {
    const capabilities = listPlatformMainlineCapabilities();
    for (const capability of capabilities) {
        for (const section of capability.architectureSections) {
            assert.ok(section.startsWith("§"), `${capability.capabilityId}: section ${section} should start with §`);
        }
    }
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
    assert.ok(capability.criticalSubmodules.includes("iam"));
    assert.ok(capability.criticalSubmodules.includes("approval-center"));
    assert.ok(capability.criticalSubmodules.includes("config-center"));
    assert.ok(capability.criticalSubmodules.includes("incident-control"));
    assert.ok(capability.criticalSubmodules.includes("policy-center"));
});
test("orchestration capability has expected critical submodules", () => {
    const capability = resolvePlatformMainlineCapability("orchestration");
    assert.ok(capability.criticalSubmodules.includes("agent-delegation"));
    assert.ok(capability.criticalSubmodules.includes("harness"));
    assert.ok(capability.criticalSubmodules.includes("hitl"));
    assert.ok(capability.criticalSubmodules.includes("oapeflir"));
    assert.ok(capability.criticalSubmodules.includes("planner"));
    assert.ok(capability.criticalSubmodules.includes("routing"));
});
test("execution capability has expected critical submodules", () => {
    const capability = resolvePlatformMainlineCapability("execution");
    assert.ok(capability.criticalSubmodules.includes("dispatcher"));
    assert.ok(capability.criticalSubmodules.includes("execution-engine"));
    assert.ok(capability.criticalSubmodules.includes("worker-pool"));
    assert.ok(capability.criticalSubmodules.includes("queue"));
    assert.ok(capability.criticalSubmodules.includes("distributed-lock"));
    assert.ok(capability.criticalSubmodules.includes("recovery"));
});
test("state-evidence capability has expected critical submodules", () => {
    const capability = resolvePlatformMainlineCapability("state-evidence");
    assert.ok(capability.criticalSubmodules.includes("truth"));
    assert.ok(capability.criticalSubmodules.includes("events"));
    assert.ok(capability.criticalSubmodules.includes("projections"));
    assert.ok(capability.criticalSubmodules.includes("artifacts"));
    assert.ok(capability.criticalSubmodules.includes("memory"));
    assert.ok(capability.criticalSubmodules.includes("knowledge"));
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
    assert.ok(capability.criticalSubmodules.includes("eval"));
    assert.ok(capability.criticalSubmodules.includes("registry"));
    assert.ok(capability.criticalSubmodules.includes("renderer"));
    assert.ok(capability.criticalSubmodules.includes("rollout"));
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
test("PLATFORM_MAINLINE_CAPABILITIES is frozen", () => {
    assert.ok(Object.isFrozen(PLATFORM_MAINLINE_CAPABILITIES));
});
test("PLATFORM_MAINLINE_CAPABILITIES outer array is frozen", () => {
    assert.ok(Object.isFrozen(PLATFORM_MAINLINE_CAPABILITIES));
});
test("PlatformMainlineCapabilityId type accepts all valid ids", () => {
    const allIds = [
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
    const capabilityIds = capabilities.map((c) => c.capabilityId);
    assert.deepEqual(capabilityIds, allIds);
});
test("capability entryModule matches capabilityId path", () => {
    const capability = resolvePlatformMainlineCapability("control-plane");
    assert.ok(capability.entryModule.includes("control-plane"));
    const capability2 = resolvePlatformMainlineCapability("state-evidence");
    assert.ok(capability2.entryModule.includes("state-evidence"));
});
test("resolvePlatformMainlineCapability returns same object as list", () => {
    const byList = listPlatformMainlineCapabilities().find((c) => c.capabilityId === "execution");
    const byResolve = resolvePlatformMainlineCapability("execution");
    assert.equal(byList, byResolve);
});
//# sourceMappingURL=platform-mainline-bootstrap.test.js.map