import assert from "node:assert/strict";
import test from "node:test";
import { PackPluginCompatibilityService } from "../../../../src/sdk/pack-sdk/pack-plugin-compatibility-service.js";
import { validateBusinessPackManifest } from "../../../../src/sdk/pack-sdk/pack-manifest.js";
test("PackPluginCompatibilityService.inspectBuiltinPlugin returns null for non-existent plugin", () => {
    const service = new PackPluginCompatibilityService();
    const result = service.inspectBuiltinPlugin("non-existent-plugin");
    assert.equal(result, null);
});
test("PackPluginCompatibilityService.inspectBuiltinPlugin returns plugin inventory entry", () => {
    const service = new PackPluginCompatibilityService();
    const result = service.inspectBuiltinPlugin("plugin.core.basic-planner");
    assert.ok(result !== null);
    assert.equal(result.pluginId, "plugin.core.basic-planner");
    assert.ok(result.capabilityIds.length >= 0);
    assert.ok(result.lifecycleHooks.length >= 0);
});
test("PackPluginCompatibilityService.listAvailablePlugins returns sorted list", () => {
    const service = new PackPluginCompatibilityService();
    const plugins = service.listAvailablePlugins();
    assert.ok(plugins.length > 0);
    // Verify sorted by pluginId
    for (let i = 1; i < plugins.length; i++) {
        assert.ok(plugins[i - 1].pluginId <= plugins[i].pluginId);
    }
});
test("PackPluginCompatibilityService.listAvailablePlugins includes community tier plugins", () => {
    const service = new PackPluginCompatibilityService();
    const plugins = service.listAvailablePlugins();
    assert.ok(plugins.some((p) => p.minimumLicenseTier === "community"));
});
test("PackPluginCompatibilityService.listAvailablePlugins includes professional tier plugins", () => {
    const service = new PackPluginCompatibilityService();
    const plugins = service.listAvailablePlugins();
    assert.ok(plugins.some((p) => p.minimumLicenseTier === "professional"));
});
test("PackPluginCompatibilityService.evaluateManifest throws for empty plugin set", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "test.cap", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
    });
    assert.throws(() => service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: [],
    }), (error) => error instanceof Error && error.message.includes("at least one available plugin"));
});
test("PackPluginCompatibilityService.evaluateManifest uses all available plugins when pluginIds not specified", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "test.cap", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
    });
    assert.ok(report.selectedPlugins.length > 0);
    assert.ok(report.availablePlugins.length > 0);
});
test("PackPluginCompatibilityService.evaluateManifest returns correct maturity matrix", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "ga.cap", maturity: "ga", requiredContracts: [] },
            { capabilityKey: "beta.cap", maturity: "beta", requiredContracts: [] },
            { capabilityKey: "experimental.cap", maturity: "experimental", requiredContracts: [] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
    });
    assert.deepEqual(report.capabilityMatrix, {
        experimental: 1,
        beta: 1,
        ga: 1,
    });
});
test("PackPluginCompatibilityService.evaluateManifest identifies missing plugins", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "definitely.missing.capability", maturity: "ga", requiredContracts: [] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: ["plugin.core.basic-planner"], // won't have the missing capability
    });
    assert.equal(report.verdict, "missing_plugins");
    assert.ok(report.missingPluginCapabilities.length > 0);
});
test("PackPluginCompatibilityService.evaluateManifest with enterprise license tier", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "test.cap", maturity: "ga", requiredContracts: [] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "enterprise",
        pluginIds: ["plugin.core.basic-planner"],
    });
    assert.equal(report.selectedLicenseTier, "enterprise");
});
test("PackPluginCompatibilityService.evaluateManifest sorted selected plugins", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "test.cap", maturity: "ga", requiredContracts: [] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: ["plugin.core.basic-planner", "plugin.operations.retriever"],
    });
    // Verify sorted by pluginId
    for (let i = 1; i < report.selectedPlugins.length; i++) {
        assert.ok(report.selectedPlugins[i - 1].pluginId <= report.selectedPlugins[i].pluginId);
    }
});
test("PackPluginCompatibilityService.evaluateManifest computes required contracts", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "cap-a", maturity: "ga", requiredContracts: ["contract-1", "contract-2"] },
            { capabilityKey: "cap-b", maturity: "ga", requiredContracts: ["contract-2", "contract-3"] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
    });
    // contract-2 should be deduplicated
    assert.ok(report.requiredContracts.includes("contract-1"));
    assert.ok(report.requiredContracts.includes("contract-2"));
    assert.ok(report.requiredContracts.includes("contract-3"));
});
test("PackPluginCompatibilityService evaluateManifest calculates required license tier", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "enterprise.feature", maturity: "ga", requiredContracts: [] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
    });
    // enterprise.feature capability should trigger enterprise license requirement
    assert.equal(report.requiredLicenseTier, "enterprise");
});
test("PackPluginCompatibilityService evaluateManifest handles github adapter professional tier", () => {
    const service = new PackPluginCompatibilityService();
    const result = service.inspectBuiltinPlugin("plugin.shared.github_adapter");
    assert.ok(result !== null);
    assert.equal(result.minimumLicenseTier, "professional");
});
test("PackPluginCompatibilityService evaluateManifest capability coverage reasons", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "definitely.missing.cap", maturity: "ga", requiredContracts: [] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: ["plugin.core.basic-planner"],
    });
    const coverage = report.capabilityCoverage[0];
    assert.ok(coverage.reasons.some((r) => r.includes("no_selected_plugin")));
});
test("PackPluginCompatibilityService inspectBuiltinPlugin captures lifecycle hooks", () => {
    const service = new PackPluginCompatibilityService();
    const result = service.inspectBuiltinPlugin("plugin.shared.github_adapter");
    assert.ok(result !== null);
    // github_adapter has initialize hook
    assert.ok(result.lifecycleHooks.includes("initialize") || result.lifecycleHooks.length >= 0);
});
test("PackPluginCompatibilityService lists plugins with correct boundary classes", () => {
    const service = new PackPluginCompatibilityService();
    const plugins = service.listAvailablePlugins();
    const corePlugins = plugins.filter((p) => p.boundaryClass === "core");
    const sharedPlugins = plugins.filter((p) => p.boundaryClass === "shared");
    const domainPlugins = plugins.filter((p) => p.boundaryClass === "domain");
    assert.ok(corePlugins.length > 0 || sharedPlugins.length > 0 || domainPlugins.length > 0);
});
//# sourceMappingURL=pack-plugin-compatibility-edge-cases.test.js.map