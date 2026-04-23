import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { PackPluginCompatibilityService, validateBusinessPackManifest, } from "../../../../src/sdk/pack-sdk/index.js";
test("pack compatibility lists builtin plugins with normalized license and boundary metadata", () => {
    const service = new PackPluginCompatibilityService();
    const inventory = service.listAvailablePlugins();
    const githubAdapter = inventory.find((entry) => entry.pluginId === "plugin.shared.github_adapter");
    const planner = inventory.find((entry) => entry.pluginId === "plugin.core.basic-planner");
    assert.ok(githubAdapter);
    assert.equal(githubAdapter.minimumLicenseTier, "professional");
    assert.equal(githubAdapter.boundaryClass, "shared");
    assert.ok(githubAdapter.lifecycleHooks.includes("initialize"));
    assert.ok(githubAdapter.capabilityIds.includes("external.github"));
    assert.ok(planner);
    assert.equal(planner.minimumLicenseTier, "community");
    assert.equal(planner.boundaryClass, "core");
});
test("pack compatibility reports compatible when selected plugins cover manifest capabilities", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "ops-github-pack",
        version: "1.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
            { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
            { capabilityKey: "external.github.issue", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "professional",
        pluginIds: ["plugin.operations.retriever", "plugin.shared.github_adapter"],
    });
    assert.equal(report.verdict, "compatible");
    assert.equal(report.requiredLicenseTier, "professional");
    assert.deepEqual(report.missingPluginCapabilities, []);
    assert.deepEqual(report.blockedByLicense, []);
    assert.deepEqual(report.capabilityMatrix, { experimental: 0, beta: 1, ga: 1 });
    assert.deepEqual(report.requiredContracts, ["runtime_execution_contract", "tool_skill_plugin_contract"]);
    assert.deepEqual(report.capabilityCoverage.map((entry) => ({ capabilityKey: entry.capabilityKey, compatible: entry.compatible })), [
        { capabilityKey: "ops.runbook_search", compatible: true },
        { capabilityKey: "external.github.issue", compatible: true },
    ]);
});
test("pack compatibility suggests candidate plugins when selected set does not cover a capability", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "github-only-pack",
        version: "1.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
            { capabilityKey: "external.github.workflow", maturity: "ga", requiredContracts: ["tool_skill_plugin_contract"] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "professional",
        pluginIds: ["plugin.operations.retriever"],
    });
    assert.equal(report.verdict, "missing_plugins");
    assert.deepEqual(report.missingPluginCapabilities, ["external.github.workflow"]);
    assert.equal(report.capabilityCoverage[0]?.compatible, false);
    assert.ok(report.capabilityCoverage[0]?.candidatePluginIds.includes("plugin.shared.github_adapter"));
    assert.ok(report.capabilityCoverage[0]?.reasons.some((reason) => reason.startsWith("suggested_plugins:")));
});
test("pack compatibility blocks community tier when capability requires professional license", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "github-community-pack",
        version: "1.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
            { capabilityKey: "external.github", maturity: "ga", requiredContracts: ["tool_skill_plugin_contract"] },
        ],
    });
    const report = service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: ["plugin.shared.github_adapter"],
    });
    assert.equal(report.verdict, "license_blocked");
    assert.equal(report.requiredLicenseTier, "professional");
    assert.deepEqual(report.blockedByLicense, ["external.github"]);
    assert.ok(report.capabilityCoverage[0]?.reasons.includes("requires_license:professional"));
});
test("pack compatibility rejects an empty selected plugin set", () => {
    const service = new PackPluginCompatibilityService();
    const manifest = validateBusinessPackManifest({
        packId: "ops-pack",
        version: "1.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
            { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
    });
    assert.throws(() => service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: [],
    }), (error) => error instanceof ValidationError && error.code === "pack_plugin_compatibility.empty_plugin_set");
});
//# sourceMappingURL=pack-plugin-compatibility-service.test.js.map