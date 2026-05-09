/**
 * @fileoverview Extended unit tests for SdkWorkbenchService
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SdkWorkbenchService } from "../../../../src/sdk/workbench/index.js";
import type { ApiClientConfig } from "../../../../src/sdk/client-sdk/api-client.js";
import type { BusinessPackManifest } from "../../../../src/sdk/pack-sdk/pack-manifest.js";
import type { PluginManifest } from "../../../../src/domains/registry/plugin-spi.js";

function createTestClient(overrides: Partial<ApiClientConfig> = {}): ApiClientConfig {
  return {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    tenantId: "test-tenant",
    bearerToken: "test-token",
    ...overrides,
  };
}

function createTestPlugin(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    owner: "test@example.com",
    spiTypes: ["retriever"],
    publicSdkSurface: "test-sdk",
    capabilityIds: ["test.capability"],
    domainIds: [],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
    ...overrides,
  } as unknown as PluginManifest;
}

function createTestPack(overrides: Partial<BusinessPackManifest> = {}): BusinessPackManifest {
  return {
    packId: "test-pack",
    version: "1.0.0",
    domain: "test",
    owner: "test@example.com",
    capabilities: [
      {
        capabilityKey: "test.capability",
        maturity: "ga",
        requiredContracts: ["runtime_execution_contract"],
      },
    ],
    ...overrides,
  };
}

test("SdkWorkbenchService creates snapshot with multiple plugins and packs", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "plugin-a", capabilityIds: ["cap-a", "cap-b"] }),
    createTestPlugin({ pluginId: "plugin-b", capabilityIds: ["cap-c"] }),
  ];
  const packs = [
    createTestPack({ packId: "pack-a", capabilities: [{ capabilityKey: "cap-a", maturity: "ga", requiredContracts: ["contract-a"] }] }),
    createTestPack({ packId: "pack-b", capabilities: [{ capabilityKey: "cap-c", maturity: "beta", requiredContracts: ["contract-b"] }] }),
  ];

  const snapshot = service.buildSnapshot({
    client: createTestClient(),
    plugins,
    packs,
    availableContracts: ["contract-a", "contract-b"],
  });

  assert.equal(snapshot.pluginIds.length, 2);
  assert.equal(snapshot.packIds.length, 2);
  assert.ok(snapshot.installPlans.length, 2);
});

test("SdkWorkbenchService deduplicates capability catalog", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "plugin-a", capabilityIds: ["shared-cap"] }),
    createTestPlugin({ pluginId: "plugin-b", capabilityIds: ["shared-cap", "other-cap"] }),
  ];

  const snapshot = service.buildSnapshot({
    client: createTestClient(),
    plugins,
    packs: [],
    availableContracts: [],
  });

  const sharedCapCount = snapshot.capabilityCatalog.filter((c) => c === "shared-cap").length;
  assert.equal(sharedCapCount, 1, "shared-cap should appear only once in capability catalog");
});

test("SdkWorkbenchService handles empty plugin list", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: createTestClient(),
    plugins: [],
    packs: [createTestPack()],
    availableContracts: ["runtime_execution_contract"],
  });

  assert.deepEqual(snapshot.pluginIds, []);
  assert.ok(snapshot.installPlans.length, 1);
  assert.equal(snapshot.installPlans[0]?.ready, false);
});

test("SdkWorkbenchService handles empty pack list", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: createTestClient(),
    plugins: [createTestPlugin()],
    packs: [],
    availableContracts: [],
  });

  assert.ok(snapshot.pluginIds.length, 1);
  assert.deepEqual(snapshot.packIds, []);
  assert.deepEqual(snapshot.installPlans, []);
});

test("SdkWorkbenchService install plan finds first matching plugin for capability", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "first-plugin", capabilityIds: ["target-cap"] }),
    createTestPlugin({ pluginId: "second-plugin", capabilityIds: ["target-cap"] }),
  ];
  const pack = createTestPack({
    capabilities: [{ capabilityKey: "target-cap", maturity: "ga", requiredContracts: [] }],
  });

  const plan = service.createInstallPlan({ pack, plugins });

  assert.equal(plan.pluginAssignments.length, 1);
  assert.equal(plan.pluginAssignments[0]?.pluginId, "first-plugin");
});

test("SdkWorkbenchService install plan handles multiple capabilities", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "plugin-a", capabilityIds: ["cap-a", "cap-b"] }),
  ];
  const pack = createTestPack({
    capabilities: [
      { capabilityKey: "cap-a", maturity: "ga", requiredContracts: [] },
      { capabilityKey: "cap-b", maturity: "ga", requiredContracts: [] },
      { capabilityKey: "cap-c", maturity: "beta", requiredContracts: [] },
    ],
  });

  const plan = service.createInstallPlan({ pack, plugins });

  assert.equal(plan.pluginAssignments.length, 2);
  assert.ok(plan.unresolvedCapabilities.includes("cap-c"));
  assert.equal(plan.ready, false);
});

test("SdkWorkbenchService buildPublishReadiness covers contracts correctly", () => {
  const service = new SdkWorkbenchService();
  const plugins = [createTestPlugin({ pluginId: "test-plugin", capabilityIds: ["test.cap"] })];
  const packs = [
    createTestPack({
      capabilities: [
        { capabilityKey: "test.cap", maturity: "ga", requiredContracts: ["contract-a", "contract-b"] },
      ],
    }),
  ];

  const report = service.buildPublishReadiness({
    client: createTestClient(),
    plugins,
    packs,
    availableContracts: ["contract-a", "contract-b"],
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.coveredContracts, ["contract-a", "contract-b"]);
  assert.deepEqual(report.missingContracts, []);
});

test("SdkWorkbenchService buildPublishReadiness with no available contracts", () => {
  const service = new SdkWorkbenchService();
  const plugins = [createTestPlugin()];
  const packs = [createTestPack()];

  const report = service.buildPublishReadiness({
    client: createTestClient(),
    plugins,
    packs,
    availableContracts: [],
  });

  assert.equal(report.ready, false);
  assert.ok(report.findings.some((f) => f.includes("missing contracts")));
});

test("SdkWorkbenchService shortcuts use correct API version", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts({
    baseUrl: "https://api.example.com",
    apiVersion: "v3",
  });

  const taskShortcut = shortcuts.find((s) => s.shortcutId === "sdk.tasks.list");
  assert.ok(taskShortcut?.previewUrl?.includes("/v3/harness-runs"));
});

test("SdkWorkbenchService shortcuts include correct harness run endpoint", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts(createTestClient());

  const taskShortcut = shortcuts.find((s) => s.shortcutId === "sdk.tasks.list");
  assert.ok(taskShortcut);
  assert.ok(taskShortcut!.previewUrl!.includes("/v1/harness-runs"));
  assert.equal(taskShortcut!.kind, "api");
  assert.equal(taskShortcut!.command, "GET /v1/harness-runs");
});

test("SdkWorkbenchService shortcuts include pack listing endpoint", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts(createTestClient());

  const packShortcut = shortcuts.find((s) => s.shortcutId === "sdk.packs.list");
  assert.ok(packShortcut);
  assert.ok(packShortcut!.previewUrl!.includes("/v1/packs"));
  assert.ok(packShortcut!.previewUrl!.includes("limit=10"));
  assert.equal(packShortcut!.kind, "api");
  assert.equal(packShortcut!.command, "GET /v1/packs");
});

test("SdkWorkbenchService shortcuts include pack test CLI command", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts(createTestClient());

  const packTestShortcut = shortcuts.find((s) => s.shortcutId === "sdk.pack.test");
  assert.ok(packTestShortcut);
  assert.ok(packTestShortcut!.command.includes("npm run test:integration"));
  assert.equal(packTestShortcut!.kind, "cli");
  assert.equal(packTestShortcut!.previewUrl, null);
});

test("SdkWorkbenchService shortcuts include docs reference", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts(createTestClient());

  const docsShortcut = shortcuts.find((s) => s.shortcutId === "sdk.readme.contracts");
  assert.ok(docsShortcut);
  assert.ok(docsShortcut!.command.includes("open docs_zh/contracts/sdk_surface_contract.md"));
  assert.equal(docsShortcut!.kind, "docs");
  assert.equal(docsShortcut!.previewUrl, null);
});

test("SdkWorkbenchService createInstallPlan with plugins that have no matching capabilities", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "plugin-a", capabilityIds: ["cap-a"] }),
    createTestPlugin({ pluginId: "plugin-b", capabilityIds: ["cap-b"] }),
  ];
  const pack = createTestPack({
    capabilities: [
      { capabilityKey: "cap-c", maturity: "ga", requiredContracts: [] },
      { capabilityKey: "cap-d", maturity: "beta", requiredContracts: [] },
    ],
  });

  const plan = service.createInstallPlan({ pack, plugins });

  assert.deepEqual(plan.pluginAssignments, []);
  assert.deepEqual(plan.unresolvedCapabilities, ["cap-c", "cap-d"]);
  assert.equal(plan.ready, false);
});

test("SdkWorkbenchService buildSnapshot with all contracts available", () => {
  const service = new SdkWorkbenchService();
  const packs = [
    createTestPack({
      capabilities: [
        { capabilityKey: "cap-a", maturity: "ga", requiredContracts: ["contract-a"] },
        { capabilityKey: "cap-b", maturity: "ga", requiredContracts: ["contract-b"] },
      ],
    }),
  ];

  const snapshot = service.buildSnapshot({
    client: createTestClient(),
    plugins: [],
    packs,
    availableContracts: ["contract-a", "contract-b"],
  });

  assert.deepEqual(snapshot.missingContracts, []);
  assert.ok(snapshot.installPlans.every((p) => p.ready === false)); // Still unresolved because no plugins
});

test("SdkWorkbenchService createInstallPlan ready when all capabilities resolved", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "plugin-a", capabilityIds: ["cap-a", "cap-b"] }),
  ];
  const pack = createTestPack({
    capabilities: [
      { capabilityKey: "cap-a", maturity: "ga", requiredContracts: [] },
      { capabilityKey: "cap-b", maturity: "ga", requiredContracts: [] },
    ],
  });

  const plan = service.createInstallPlan({ pack, plugins });

  assert.equal(plan.ready, true);
  assert.deepEqual(plan.unresolvedCapabilities, []);
  assert.equal(plan.pluginAssignments.length, 2);
});

test("SdkWorkbenchService buildPublishReadiness throws with empty plugins and packs", () => {
  const service = new SdkWorkbenchService();

  assert.throws(
    () =>
      service.buildPublishReadiness({
        client: createTestClient(),
        plugins: [],
        packs: [],
        availableContracts: [],
      }),
    /SDK workbench requires at least one plugin or pack/,
  );
});

test("SdkWorkbenchService buildPublishReadiness works with only plugins", () => {
  const service = new SdkWorkbenchService();
  const plugins = [createTestPlugin()];

  const report = service.buildPublishReadiness({
    client: createTestClient(),
    plugins,
    packs: [],
    availableContracts: [],
  });

  // Should not throw, just have findings about missing contracts
  assert.ok(typeof report.ready === "boolean");
  assert.ok(Array.isArray(report.findings));
});

test("SdkWorkbenchService buildPublishReadiness works with only packs", () => {
  const service = new SdkWorkbenchService();
  const packs = [createTestPack()];

  const report = service.buildPublishReadiness({
    client: createTestClient(),
    plugins: [],
    packs,
    availableContracts: [],
  });

  assert.equal(report.ready, false);
  assert.ok(report.findings.length > 0);
});

test("SdkWorkbenchService createInstallPlan preserves plugin capability mapping", () => {
  const service = new SdkWorkbenchService();
  const plugins = [
    createTestPlugin({ pluginId: "my-plugin", capabilityIds: ["my-cap"] }),
  ];
  const pack = createTestPack({
    capabilities: [{ capabilityKey: "my-cap", maturity: "ga", requiredContracts: ["my-contract"] }],
  });

  const plan = service.createInstallPlan({ pack, plugins });

  const assignment = plan.pluginAssignments.find((a) => a.capabilityKey === "my-cap");
  assert.ok(assignment);
  assert.equal(assignment!.pluginId, "my-plugin");
  assert.equal(assignment!.pluginCapability, "my-cap");
});

test("SdkWorkbenchService snapshot captures tenant context", () => {
  const service = new SdkWorkbenchService();

  const snapshot = service.buildSnapshot({
    client: createTestClient({ tenantId: "special-tenant" }),
    plugins: [],
    packs: [],
    availableContracts: [],
  });

  assert.equal(snapshot.tenantId, "special-tenant");
});

test("SdkWorkbenchService snapshot handles client without tenantId", () => {
  const service = new SdkWorkbenchService();

  const snapshot = service.buildSnapshot({
    client: { baseUrl: "https://api.example.com", apiVersion: "v1" },
    plugins: [],
    packs: [],
    availableContracts: [],
  });

  assert.equal(snapshot.tenantId, null);
});

test("SdkWorkbenchService rejects invalid plugin manifests instead of pass-through", () => {
  const service = new SdkWorkbenchService();

  assert.throws(
    () => service.buildSnapshot({
      client: createTestClient(),
      plugins: [
        createTestPlugin({
          name: "",
        }),
      ],
      packs: [],
      availableContracts: [],
    }),
    (error: unknown) =>
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "sdk_workbench.invalid_plugin_manifest",
  );
});
