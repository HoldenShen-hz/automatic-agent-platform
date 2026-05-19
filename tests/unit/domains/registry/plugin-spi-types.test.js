import assert from "node:assert/strict";
import test from "node:test";
import { PluginSpiTypeSchema, PluginLifecycleStateSchema, PluginRuntimeIsolationSchema, PluginSandboxPolicySchema, PluginManifestSchema, } from "../../../../src/domains/registry/plugin-spi.js";
test("PluginSpiTypeSchema accepts valid types", () => {
    const types = ["retriever", "validator", "planner", "presenter", "adapter"];
    for (const type of types) {
        const result = PluginSpiTypeSchema.parse(type);
        assert.equal(result, type);
    }
});
test("PluginSpiTypeSchema rejects invalid type", () => {
    assert.throws(() => PluginSpiTypeSchema.parse("invalid"));
});
test("PluginLifecycleStateSchema accepts valid states", () => {
    const states = ["registered", "loaded", "active", "inactive", "unloaded", "degraded", "disabled"];
    for (const state of states) {
        const result = PluginLifecycleStateSchema.parse(state);
        assert.equal(result, state);
    }
});
test("PluginLifecycleStateSchema rejects invalid state", () => {
    assert.throws(() => PluginLifecycleStateSchema.parse("invalid"));
});
test("PluginRuntimeIsolationSchema accepts valid isolation modes", () => {
    const modes = [
        "shared_process",
        "serialized_in_process",
        "forked_process",
        "sandboxed_process",
        "containerized_process",
    ];
    for (const mode of modes) {
        const result = PluginRuntimeIsolationSchema.parse(mode);
        assert.equal(result, mode);
    }
});
test("PluginSandboxPolicySchema parses valid policy", () => {
    const policy = {
        timeoutMs: 10000,
        allowFilesystemWrite: true,
        allowNetworkEgress: true,
        allowedKnowledgeNamespaces: ["ns1", "ns2"],
        maxConcurrentInvocations: 5,
        maxQueuedInvocations: 10,
        runtimeIsolation: "forked_process",
        cooldownMs: 1000,
    };
    const result = PluginSandboxPolicySchema.parse(policy);
    assert.equal(result.timeoutMs, 10000);
    assert.equal(result.allowFilesystemWrite, true);
    assert.equal(result.allowNetworkEgress, true);
});
test("PluginSandboxPolicySchema applies defaults", () => {
    const result = PluginSandboxPolicySchema.parse({});
    assert.equal(result.timeoutMs, 5000);
    assert.equal(result.allowFilesystemWrite, false);
    assert.equal(result.allowNetworkEgress, false);
    assert.deepEqual(result.allowedKnowledgeNamespaces, []);
    assert.equal(result.maxConcurrentInvocations, 1);
    assert.equal(result.maxQueuedInvocations, 8);
    assert.equal(result.runtimeIsolation, "serialized_in_process");
    assert.equal(result.cooldownMs, 0);
});
test("PluginSandboxPolicySchema rejects negative timeoutMs", () => {
    assert.throws(() => PluginSandboxPolicySchema.parse({ timeoutMs: -1 }));
});
test("PluginSandboxPolicySchema rejects zero maxConcurrentInvocations", () => {
    assert.throws(() => PluginSandboxPolicySchema.parse({ maxConcurrentInvocations: 0 }));
});
test("PluginManifestSchema parses valid manifest", () => {
    const manifest = {
        pluginId: "plugin_123",
        name: "Test Plugin",
        version: "1.0.0",
        owner: "test-owner",
        domainIds: ["domain1"],
        capabilityIds: ["cap1"],
        spiTypes: ["retriever"],
        publicSdkSurface: "1.0.0",
    };
    const result = PluginManifestSchema.parse(manifest);
    assert.equal(result.pluginId, "plugin_123");
    assert.equal(result.name, "Test Plugin");
    assert.equal(result.version, "1.0.0");
});
test("PluginManifestSchema applies defaults", () => {
    const minimal = {
        pluginId: "plugin_123",
        name: "Test Plugin",
        version: "1.0.0",
        owner: "test-owner",
        spiTypes: ["retriever"],
        publicSdkSurface: "1.0.0",
    };
    const result = PluginManifestSchema.parse(minimal);
    assert.deepEqual(result.domainIds, []);
    assert.deepEqual(result.capabilityIds, []);
    assert.equal(result.extensionKind, "domain_plugin");
    assert.equal(result.trustLevel, "trusted");
    assert.deepEqual(result.settingsSchema, {});
});
test("PluginManifestSchema requires at least one spiType", () => {
    assert.throws(() => PluginManifestSchema.parse({
        pluginId: "plugin_123",
        name: "Test Plugin",
        version: "1.0.0",
        owner: "test-owner",
        spiTypes: [],
        publicSdkSurface: "1.0.0",
    }));
});
test("PluginManifestSchema rejects empty pluginId", () => {
    assert.throws(() => PluginManifestSchema.parse({
        pluginId: "",
        name: "Test Plugin",
        version: "1.0.0",
        owner: "test-owner",
        spiTypes: ["retriever"],
        publicSdkSurface: "1.0.0",
    }));
});
//# sourceMappingURL=plugin-spi-types.test.js.map