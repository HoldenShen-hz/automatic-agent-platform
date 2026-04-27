import assert from "node:assert/strict";
import test from "node:test";

import { SdkWorkbenchService } from "../../../../src/sdk/workbench/index.js";
import type { ApiClientConfig } from "../../../../src/sdk/client-sdk/index.js";
import type { BusinessPackManifest } from "../../../../src/sdk/pack-sdk/index.js";
import type { PluginManifest } from "../../../../src/domains/registry/plugin-spi.js";

const mockClient: ApiClientConfig = {
  baseUrl: "https://api.example.com",
  apiVersion: "v1",
  bearerToken: "test-token",
};

const mockPlugin: PluginManifest = {
  pluginId: "plugin.test.query",
  name: "Query Plugin",
  version: "1.0.0",
  spiType: "tool",
  capabilityIds: ["query.execute", "search.execute"],
};

const mockPack: BusinessPackManifest = {
  packId: "test-pack",
  version: "1.0.0",
  domain: "testing",
  owner: "test@example.com",
  capabilities: [
    { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    { capabilityKey: "data.transform", maturity: "beta", requiredContracts: ["transform_contract"] },
  ],
};

test("SdkWorkbenchService.createInstallPlan matches plugin capabilities to pack capabilities", () => {
  const service = new SdkWorkbenchService();

  const plan = service.createInstallPlan({
    pack: mockPack,
    plugins: [mockPlugin],
  });

  assert.equal(plan.packId, "test-pack");
  assert.equal(plan.ready, false); // data.transform is unresolved
  assert.equal(plan.unresolvedCapabilities.length, 1);
  assert.ok(plan.unresolvedCapabilities.includes("data.transform"));
  assert.equal(plan.pluginAssignments.length, 1);
  assert.equal(plan.pluginAssignments[0]?.pluginId, "plugin.test.query");
  assert.equal(plan.pluginAssignments[0]?.capabilityKey, "query.execute");
});

test("SdkWorkbenchService.createInstallPlan resolves all capabilities when plugin matches", () => {
  const service = new SdkWorkbenchService();

  const packWithMatchingCap: BusinessPackManifest = {
    ...mockPack,
    capabilities: [
      { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  };

  const plan = service.createInstallPlan({
    pack: packWithMatchingCap,
    plugins: [mockPlugin],
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.unresolvedCapabilities.length, 0);
  assert.equal(plan.pluginAssignments.length, 1);
});

test("SdkWorkbenchService.createInstallPlan handles multiple plugins", () => {
  const service = new SdkWorkbenchService();

  const plugin2: PluginManifest = {
    pluginId: "plugin.test.transform",
    name: "Transform Plugin",
    version: "1.0.0",
    spiType: "adapter",
    capabilityIds: ["data.transform"],
  };

  const plan = service.createInstallPlan({
    pack: mockPack,
    plugins: [mockPlugin, plugin2],
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.unresolvedCapabilities.length, 0);
  assert.equal(plan.pluginAssignments.length, 2);
});

test("SdkWorkbenchService.createInstallPlan handles empty plugins array", () => {
  const service = new SdkWorkbenchService();

  const plan = service.createInstallPlan({
    pack: mockPack,
    plugins: [],
  });

  assert.equal(plan.ready, false);
  assert.equal(plan.unresolvedCapabilities.length, 2);
  assert.equal(plan.pluginAssignments.length, 0);
});

test("SdkWorkbenchService.buildSnapshot aggregates data from plugins and packs", () => {
  const service = new SdkWorkbenchService();

  const snapshot = service.buildSnapshot({
    client: mockClient,
    plugins: [mockPlugin],
    packs: [mockPack],
    availableContracts: ["runtime_execution_contract", "transform_contract"],
  });

  assert.equal(snapshot.apiBaseUrl, "https://api.example.com");
  assert.equal(snapshot.apiVersion, "v1");
  assert.deepEqual(snapshot.pluginIds, ["plugin.test.query"]);
  assert.deepEqual(snapshot.packIds, ["test-pack"]);
  assert.ok(snapshot.capabilityCatalog.includes("query.execute"));
  assert.ok(snapshot.capabilityCatalog.includes("search.execute"));
});

test("SdkWorkbenchService.buildSnapshot identifies missing contracts", () => {
  const service = new SdkWorkbenchService();

  const snapshot = service.buildSnapshot({
    client: mockClient,
    plugins: [mockPlugin],
    packs: [mockPack],
    availableContracts: ["runtime_execution_contract"], // missing transform_contract
  });

  assert.ok(snapshot.missingContracts.includes("transform_contract"));
  assert.equal(snapshot.requiredContracts.length, 2);
});

test("SdkWorkbenchService.buildSnapshot generates workbench shortcuts", () => {
  const service = new SdkWorkbenchService();

  const snapshot = service.buildSnapshot({
    client: mockClient,
    plugins: [],
    packs: [],
    availableContracts: [],
  });

  assert.ok(snapshot.workbenchShortcuts.length > 0);
  const taskShortcut = snapshot.workbenchShortcuts.find((s) => s.shortcutId === "sdk.tasks.list");
  assert.ok(taskShortcut != null);
  assert.ok(taskShortcut?.previewUrl?.includes("/tasks"));
});

test("SdkWorkbenchService.buildPublishReadiness reports findings for unresolved capabilities", () => {
  const service = new SdkWorkbenchService();

  const report = service.buildPublishReadiness({
    client: mockClient,
    plugins: [mockPlugin],
    packs: [mockPack],
    availableContracts: ["runtime_execution_contract", "transform_contract"],
  });

  assert.equal(report.ready, false);
  assert.ok(report.findings.some((f) => f.includes("unresolved capabilities")));
});

test("SdkWorkbenchService.buildPublishReadiness reports findings for missing contracts", () => {
  const service = new SdkWorkbenchService();

  const report = service.buildPublishReadiness({
    client: mockClient,
    plugins: [mockPlugin],
    packs: [mockPack],
    availableContracts: ["runtime_execution_contract"], // missing transform_contract
  });

  assert.equal(report.ready, false);
  assert.ok(report.findings.some((f) => f.includes("missing contracts")));
});

test("SdkWorkbenchService.buildPublishReadiness returns ready=true when all resolved", () => {
  const service = new SdkWorkbenchService();

  const packSingleCap: BusinessPackManifest = {
    ...mockPack,
    capabilities: [
      { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  };

  const report = service.buildPublishReadiness({
    client: mockClient,
    plugins: [mockPlugin],
    packs: [packSingleCap],
    availableContracts: ["runtime_execution_contract"],
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.findings, []);
  assert.ok(report.previewUrls.length > 0);
});

test("SdkWorkbenchService.buildPublishReadiness throws for empty workspace", () => {
  const service = new SdkWorkbenchService();

  assert.throws(
    () =>
      service.buildPublishReadiness({
        client: mockClient,
        plugins: [],
        packs: [],
        availableContracts: [],
      }),
    /SDK workbench requires at least one plugin or pack/i,
  );
});

test("SdkWorkbenchService.listWorkbenchShortcuts returns shortcuts with correct structure", () => {
  const service = new SdkWorkbenchService();

  const shortcuts = service.listWorkbenchShortcuts(mockClient);

  assert.ok(shortcuts.length >= 4);
  for (const shortcut of shortcuts) {
    assert.ok(shortcut.shortcutId.length > 0);
    assert.ok(shortcut.label.length > 0);
    assert.ok(["api", "cli", "docs"].includes(shortcut.kind));
    assert.ok(shortcut.command.length > 0);
  }
});

test("SdkWorkbenchService.listWorkbenchShortcuts builds correct preview URLs", () => {
  const service = new SdkWorkbenchService();

  const shortcuts = service.listWorkbenchShortcuts(mockClient);

  const tasksShortcut = shortcuts.find((s) => s.shortcutId === "sdk.tasks.list");
  assert.ok(tasksShortcut?.previewUrl?.includes("https://api.example.com/v1/tasks"));
});
