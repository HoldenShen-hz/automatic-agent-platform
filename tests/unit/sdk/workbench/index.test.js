/**
 * @fileoverview Tests for SDK Workbench Service
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SdkWorkbenchService } from "../../../../src/sdk/workbench/index.js";
const testClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    tenantId: "test-tenant",
    bearerToken: "test-token",
};
function createTestPlugin(overrides = {}) {
    return {
        pluginId: "test-plugin-1",
        name: "Test Plugin",
        version: "1.0.0",
        type: "tool",
        capabilityIds: ["test.capability"],
        lifecycleHooks: [],
        ...overrides,
    };
}
function createTestPack(overrides = {}) {
    return {
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
            { capabilityKey: "test.cap", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
        ...overrides,
    };
}
test("SdkWorkbenchService.buildSnapshot returns correct structure", () => {
    const service = new SdkWorkbenchService();
    const plugins = [createTestPlugin()];
    const packs = [createTestPack()];
    const contracts = ["runtime_execution_contract", "other_contract"];
    const snapshot = service.buildSnapshot({
        client: testClientConfig,
        plugins,
        packs,
        availableContracts: contracts,
    });
    assert.equal(snapshot.apiBaseUrl, "https://api.example.com");
    assert.equal(snapshot.apiVersion, "v1");
    assert.equal(snapshot.tenantId, "test-tenant");
    assert.deepEqual(snapshot.pluginIds, ["test-plugin-1"]);
    assert.deepEqual(snapshot.packIds, ["test-pack"]);
    assert.ok(Array.isArray(snapshot.capabilityCatalog));
    assert.ok(Array.isArray(snapshot.requiredContracts));
    assert.ok(Array.isArray(snapshot.missingContracts));
    assert.ok(Array.isArray(snapshot.installPlans));
    assert.ok(Array.isArray(snapshot.workbenchShortcuts));
});
test("SdkWorkbenchService.buildSnapshot handles null tenantId", () => {
    const service = new SdkWorkbenchService();
    const configWithoutTenant = {
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
    };
    const snapshot = service.buildSnapshot({
        client: configWithoutTenant,
        plugins: [],
        packs: [],
        availableContracts: [],
    });
    assert.equal(snapshot.tenantId, null);
});
test("SdkWorkbenchService.buildSnapshot deduplicates required contracts", () => {
    const service = new SdkWorkbenchService();
    const packs = [
        createTestPack({
            packId: "pack-a",
            capabilities: [
                { capabilityKey: "cap-a", maturity: "ga", requiredContracts: ["contract-1", "contract-2"] },
                { capabilityKey: "cap-b", maturity: "ga", requiredContracts: ["contract-1", "contract-3"] },
            ],
        }),
    ];
    const snapshot = service.buildSnapshot({
        client: testClientConfig,
        plugins: [],
        packs,
        availableContracts: ["contract-1", "contract-2", "contract-3"],
    });
    // contract-1 should only appear once
    const contract1Count = snapshot.requiredContracts.filter((c) => c === "contract-1").length;
    assert.equal(contract1Count, 1);
});
test("SdkWorkbenchService.buildSnapshot identifies missing contracts", () => {
    const service = new SdkWorkbenchService();
    const packs = [
        createTestPack({
            capabilities: [
                { capabilityKey: "cap-a", maturity: "ga", requiredContracts: ["missing-contract"] },
            ],
        }),
    ];
    const snapshot = service.buildSnapshot({
        client: testClientConfig,
        plugins: [],
        packs,
        availableContracts: ["runtime_execution_contract"],
    });
    assert.ok(snapshot.missingContracts.includes("missing-contract"));
});
test("SdkWorkbenchService.createInstallPlan creates plan with resolved capabilities", () => {
    const service = new SdkWorkbenchService();
    const plugins = [createTestPlugin({ pluginId: "my-plugin", capabilityIds: ["test.cap"] })];
    const pack = createTestPack();
    const plan = service.createInstallPlan({ pack, plugins });
    assert.equal(plan.packId, "test-pack");
    assert.equal(plan.ready, true);
    assert.deepEqual(plan.unresolvedCapabilities, []);
    assert.equal(plan.pluginAssignments.length, 1);
    assert.equal(plan.pluginAssignments[0].pluginId, "my-plugin");
    assert.equal(plan.pluginAssignments[0].capabilityKey, "test.cap");
});
test("SdkWorkbenchService.createInstallPlan marks unresolved when no plugin matches", () => {
    const service = new SdkWorkbenchService();
    const plugins = [];
    const pack = createTestPack();
    const plan = service.createInstallPlan({ pack, plugins });
    assert.equal(plan.ready, false);
    assert.deepEqual(plan.unresolvedCapabilities, ["test.cap"]);
    assert.deepEqual(plan.pluginAssignments, []);
});
test("SdkWorkbenchService.createInstallPlan with multiple plugins finds first match", () => {
    const service = new SdkWorkbenchService();
    const plugins = [
        createTestPlugin({ pluginId: "plugin-a", capabilityIds: ["other.cap"] }),
        createTestPlugin({ pluginId: "plugin-b", capabilityIds: ["test.cap"] }),
    ];
    const pack = createTestPack();
    const plan = service.createInstallPlan({ pack, plugins });
    assert.equal(plan.pluginAssignments.length, 1);
    assert.equal(plan.pluginAssignments[0].pluginId, "plugin-b");
});
test("SdkWorkbenchService.buildPublishReadiness throws on empty workspace", () => {
    const service = new SdkWorkbenchService();
    assert.throws(() => service.buildPublishReadiness({
        client: testClientConfig,
        plugins: [],
        packs: [],
        availableContracts: [],
    }), (error) => error instanceof Error &&
        error.message.includes("SDK workbench requires at least one plugin or pack"));
});
test("SdkWorkbenchService.buildPublishReadiness returns ready true when all resolved", () => {
    const service = new SdkWorkbenchService();
    const plugins = [createTestPlugin({ pluginId: "my-plugin", capabilityIds: ["test.cap"] })];
    const packs = [createTestPack()];
    const report = service.buildPublishReadiness({
        client: testClientConfig,
        plugins,
        packs,
        availableContracts: ["runtime_execution_contract"],
    });
    assert.equal(report.ready, true);
    assert.deepEqual(report.findings, []);
    assert.ok(Array.isArray(report.previewUrls));
    assert.ok(Array.isArray(report.coveredContracts));
    assert.ok(Array.isArray(report.missingContracts));
});
test("SdkWorkbenchService.buildPublishReadiness reports unresolved capabilities", () => {
    const service = new SdkWorkbenchService();
    const plugins = [];
    const packs = [createTestPack()];
    const report = service.buildPublishReadiness({
        client: testClientConfig,
        plugins,
        packs,
        availableContracts: ["runtime_execution_contract"],
    });
    assert.equal(report.ready, false);
    assert.ok(report.findings.some((f) => f.includes("unresolved capabilities")));
});
test("SdkWorkbenchService.buildPublishReadiness reports missing contracts", () => {
    const service = new SdkWorkbenchService();
    const plugins = [];
    const packs = [
        createTestPack({
            capabilities: [
                { capabilityKey: "cap-a", maturity: "ga", requiredContracts: ["missing-contract"] },
            ],
        }),
    ];
    const report = service.buildPublishReadiness({
        client: testClientConfig,
        plugins,
        packs,
        availableContracts: [],
    });
    assert.equal(report.ready, false);
    assert.ok(report.findings.some((f) => f.includes("missing contracts")));
});
test("SdkWorkbenchService.listWorkbenchShortcuts returns expected shortcuts", () => {
    const service = new SdkWorkbenchService();
    const shortcuts = service.listWorkbenchShortcuts(testClientConfig);
    assert.ok(shortcuts.length >= 4);
    assert.ok(shortcuts.some((s) => s.shortcutId === "sdk.tasks.list"));
    assert.ok(shortcuts.some((s) => s.shortcutId === "sdk.packs.list"));
    assert.ok(shortcuts.some((s) => s.shortcutId === "sdk.pack.test"));
    assert.ok(shortcuts.some((s) => s.shortcutId === "sdk.readme.contracts"));
});
test("SdkWorkbenchService.listWorkbenchShortcuts returns correct URLs", () => {
    const service = new SdkWorkbenchService();
    const shortcuts = service.listWorkbenchShortcuts(testClientConfig);
    const tasksShortcut = shortcuts.find((s) => s.shortcutId === "sdk.tasks.list");
    assert.ok(tasksShortcut);
    assert.ok(tasksShortcut.previewUrl?.includes("/v1/harness-runs"));
    const approvalsShortcut = shortcuts.find((s) => s.shortcutId === "sdk.packs.list");
    assert.ok(approvalsShortcut);
    assert.ok(approvalsShortcut.previewUrl?.includes("/v1/packs"));
    assert.ok(approvalsShortcut.previewUrl?.includes("limit=10"));
});
test("SdkWorkbenchService.listWorkbenchShortcuts shortcut kinds", () => {
    const service = new SdkWorkbenchService();
    const shortcuts = service.listWorkbenchShortcuts(testClientConfig);
    const apiShortcut = shortcuts.find((s) => s.kind === "api");
    const cliShortcut = shortcuts.find((s) => s.kind === "cli");
    const docsShortcut = shortcuts.find((s) => s.kind === "docs");
    assert.ok(apiShortcut);
    assert.ok(cliShortcut);
    assert.ok(docsShortcut);
});
test("SdkWorkbenchService multiple packs create multiple install plans", () => {
    const service = new SdkWorkbenchService();
    const plugins = [createTestPlugin({ pluginId: "my-plugin", capabilityIds: ["cap-a", "cap-b"] })];
    const packs = [
        createTestPack({ packId: "pack-a", capabilities: [{ capabilityKey: "cap-a", maturity: "ga", requiredContracts: [] }] }),
        createTestPack({ packId: "pack-b", capabilities: [{ capabilityKey: "cap-b", maturity: "ga", requiredContracts: [] }] }),
    ];
    const snapshot = service.buildSnapshot({
        client: testClientConfig,
        plugins,
        packs,
        availableContracts: [],
    });
    assert.equal(snapshot.installPlans.length, 2);
    assert.equal(snapshot.installPlans[0].packId, "pack-a");
    assert.equal(snapshot.installPlans[1].packId, "pack-b");
});
//# sourceMappingURL=index.test.js.map