/**
 * Unit Tests: Builtin Plugin Registry (Extended)
 *
 * Tests for builtin plugin registry functionality including:
 * - Plugin creation
 * - Manifest retrieval
 * - Plugin revocation
 * - Data taint propagation
 * - Marketplace registry
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BundleRevocationSeverity,
  createBuiltinPlugin,
  getBuiltinPluginManifest,
  getDataTaintLabels,
  hasBuiltinPlugin,
  hasDataTaintLabel,
  isPluginRevoked,
  listBuiltinPluginIds,
  propagateDataTaint,
  removePluginRevocation,
  revokePluginBundle,
  getPluginRevocationStatus,
  listRevokedPlugins,
  PluginMarketplaceRegistry,
} from "../../../src/plugins/builtin-plugin-registry.js";

// =============================================================================
// Basic plugin registry tests
// =============================================================================

test("builtin plugin registry exposes builtin factories and presence checks", () => {
  const pluginIds = listBuiltinPluginIds();
  assert.ok(pluginIds.includes("plugin.coding.retriever"));
  assert.ok(pluginIds.includes("plugin.coding.presenter"));
  assert.ok(pluginIds.includes("plugin.core.basic-evaluator"));
  assert.ok(pluginIds.includes("plugin.core.basic-planner"));
  assert.ok(pluginIds.includes("plugin.shared.github_adapter"));

  assert.equal(hasBuiltinPlugin("plugin.coding.presenter"), true);
  assert.equal(hasBuiltinPlugin("plugin.missing"), false);

  const presenter = createBuiltinPlugin("plugin.coding.presenter");
  assert.ok(presenter);
  assert.equal(presenter?.spiType, "presenter");
  assert.equal(createBuiltinPlugin("plugin.core.basic-evaluator")?.spiType, "validator");
  assert.equal(createBuiltinPlugin("plugin.core.basic-planner")?.spiType, "planner");
  assert.equal(createBuiltinPlugin("plugin.missing"), null);
});

test("builtin plugin registry returns null for unknown plugin id", () => {
  const plugin = createBuiltinPlugin("plugin.does.not.exist");
  assert.equal(plugin, null);
});

test("builtin plugin registry has multiple plugin categories", () => {
  const pluginIds = listBuiltinPluginIds();
  // Should have plugins from different categories
  assert.ok(pluginIds.some((id) => id.startsWith("plugin.coding.")));
  assert.ok(pluginIds.some((id) => id.startsWith("plugin.shared.")));
  assert.ok(pluginIds.some((id) => id.startsWith("plugin.core.")));
});

test("builtin validator and planner plugins provide useful default behavior", async () => {
  const validator = createBuiltinPlugin("plugin.core.basic-evaluator");
  const planner = createBuiltinPlugin("plugin.core.basic-planner");
  assert.equal(validator?.spiType, "validator");
  assert.equal(planner?.spiType, "planner");

  if (validator?.spiType === "validator") {
    const validation = await validator.validate({
      stepId: "step_validate",
      machineOutput: {
        stepId: "step_validate",
        outputRef: null,
        payload: { summary: "ok", passed: true },
      },
      contract: {
        requiredFields: ["summary", "passed"],
        fieldTypes: {
          summary: "string",
          passed: "boolean",
        },
      },
    });
    assert.equal(validation.valid, true);
  }

  if (planner?.spiType === "planner") {
    const suggestion = await planner.suggestWorkflow({
      taskId: "task_plan",
      intent: "review output",
      assessment: {
        taskId: "task_plan",
        timestamp: Date.now(),
        situationRef: "task_situation:task_plan:1",
        phase: "pre-execution",
        complexity: "moderate",
        risk: "medium",
        riskAssessment: { level: "medium", factors: [] },
        routingDecision: { division: "coding", workflow: "multi-step", rationale: "moderate" },
        resourceAllocation: { modelClass: "medium", maxTokens: 3000, timeoutMs: 30000 },
        approvalPolicy: { required: false, level: "none" },
        executionMode: "auto",
        suggestedActions: [],
      },
    });
    assert.ok(suggestion);
    assert.equal(suggestion?.overrides.length, 3);
  }
});

// =============================================================================
// Manifest retrieval tests
// =============================================================================

test("getBuiltinPluginManifest returns correct manifest for known plugins", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.retriever");
  assert.ok(manifest);
  assert.equal(manifest.pluginId, "plugin.coding.retriever");
  assert.equal(manifest.name, "Coding Retriever");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.owner, "platform-team");
  assert.deepEqual(manifest.domainIds, ["coding"]);
  assert.deepEqual(manifest.capabilityIds, ["retriever.coding"]);
  assert.deepEqual(manifest.spiTypes, ["retriever"]);
  assert.equal(manifest.trustLevel, "internal");
});

test("getBuiltinPluginManifest returns null for unknown plugin id", () => {
  const manifest = getBuiltinPluginManifest("plugin.does.not.exist");
  assert.equal(manifest, null);
});

test("getBuiltinPluginManifest returns correct manifest for presenter plugin", () => {
  const manifest = getBuiltinPluginManifest("plugin.coding.presenter");
  assert.ok(manifest);
  assert.equal(manifest.pluginId, "plugin.coding.presenter");
  assert.equal(manifest.name, "Coding Presenter");
  assert.equal(manifest.trustLevel, "internal");
});

test("getBuiltinPluginManifest returns correct manifest for github adapter", () => {
  const manifest = getBuiltinPluginManifest("plugin.shared.github_adapter");
  assert.ok(manifest);
  assert.equal(manifest.pluginId, "plugin.shared.github_adapter");
  assert.equal(manifest.trustLevel, "trusted");
  assert.ok(manifest.capabilityIds.includes("external.github"));
});

test("plugin capability enumeration via manifest capabilityIds", () => {
  const codingRetriever = getBuiltinPluginManifest("plugin.coding.retriever");
  assert.ok(codingRetriever);
  assert.ok(codingRetriever.capabilityIds.includes("retriever.coding"));

  const githubAdapter = getBuiltinPluginManifest("plugin.shared.github_adapter");
  assert.ok(githubAdapter);
  assert.ok(githubAdapter.capabilityIds.includes("external.github"));
  assert.ok(githubAdapter.capabilityIds.includes("external.github.issue"));
  assert.ok(githubAdapter.capabilityIds.includes("external.github.workflow"));
});

// =============================================================================
// Plugin revocation tests
// =============================================================================

test("revokePluginBundle marks plugin as revoked with severity", () => {
  const pluginId = "plugin.test.revocation";

  assert.equal(isPluginRevoked(pluginId), false);

  const record = revokePluginBundle(
    pluginId,
    BundleRevocationSeverity.WARNING,
    "Test revocation",
    ["1.0.0"],
  );

  assert.equal(record.pluginId, pluginId);
  assert.equal(record.severity, BundleRevocationSeverity.WARNING);
  assert.equal(record.reason, "Test revocation");
  assert.deepEqual(record.affectedVersions, ["1.0.0"]);
  assert.ok(record.revokedAt);

  assert.equal(isPluginRevoked(pluginId), true);
});

test("getPluginRevocationStatus returns revocation record when revoked", () => {
  const pluginId = "plugin.test.status";

  revokePluginBundle(pluginId, BundleRevocationSeverity.MODERATE, "Security vulnerability", ["1.0.0"]);

  const status = getPluginRevocationStatus(pluginId);
  assert.ok(status);
  assert.equal(status.pluginId, pluginId);
  assert.equal(status.severity, BundleRevocationSeverity.MODERATE);
  assert.equal(status.reason, "Security vulnerability");
});

test("getPluginRevocationStatus returns null when not revoked", () => {
  const status = getPluginRevocationStatus("plugin.coding.presenter");
  assert.equal(status, null);
});

test("listRevokedPlugins returns all revoked plugins", () => {
  const plugin1 = "plugin.test.list1";
  const plugin2 = "plugin.test.list2";

  revokePluginBundle(plugin1, BundleRevocationSeverity.SEVERE, "Critical bug", ["1.0.0"]);
  revokePluginBundle(plugin2, BundleRevocationSeverity.INFO, "Deprecation notice", ["*"]);

  const revoked = listRevokedPlugins();
  assert.ok(revoked.some((r) => r.pluginId === plugin1));
  assert.ok(revoked.some((r) => r.pluginId === plugin2));
});

test("removePluginRevocation clears revocation status", () => {
  const pluginId = "plugin.test.remove";

  revokePluginBundle(pluginId, BundleRevocationSeverity.WARNING, "Temporary issue");
  assert.equal(isPluginRevoked(pluginId), true);

  const removed = removePluginRevocation(pluginId);
  assert.equal(removed, true);
  assert.equal(isPluginRevoked(pluginId), false);
});

test("removePluginRevocation returns false for non-revoked plugin", () => {
  const removed = removePluginRevocation("plugin.coding.presenter");
  assert.equal(removed, false);
});

test("revokePluginBundle defaults affectedVersions to wildcard", () => {
  const pluginId = "plugin.test.default";

  const record = revokePluginBundle(
    pluginId,
    BundleRevocationSeverity.CRITICAL,
    "Emergency revocation",
  );

  assert.deepEqual(record.affectedVersions, ["*"]);
});

test("all BundleRevocationSeverity levels are correctly assigned", () => {
  const pluginIds = [
    "plugin.test.severity1",
    "plugin.test.severity2",
    "plugin.test.severity3",
    "plugin.test.severity4",
    "plugin.test.severity5",
  ];
  const severities = [
    BundleRevocationSeverity.INFO,
    BundleRevocationSeverity.WARNING,
    BundleRevocationSeverity.MODERATE,
    BundleRevocationSeverity.SEVERE,
    BundleRevocationSeverity.CRITICAL,
  ];

  for (let i = 0; i < pluginIds.length; i++) {
    revokePluginBundle(pluginIds[i], severities[i], `Test severity ${i}`);
    const status = getPluginRevocationStatus(pluginIds[i]);
    assert.equal(status?.severity, severities[i]);
  }
});

// =============================================================================
// Data taint propagation tests
// =============================================================================

test("propagateDataTaint tracks cross-plugin data contamination", () => {
  const dataId = "data-123";
  const targetPluginId = "plugin.coding.retriever";
  const labels = ["sensitive", "pii"];

  const propagation = propagateDataTaint(dataId, targetPluginId, labels);

  assert.equal(propagation.originPluginId, targetPluginId);
  assert.equal(propagation.originatingDataId, dataId);
  assert.equal(propagation.labels.length, 2);
  assert.equal(propagation.labels[0].label, "sensitive");
  assert.equal(propagation.labels[0].sourcePluginId, targetPluginId);
  assert.equal(propagation.labels[1].label, "pii");
});

test("getDataTaintLabels retrieves all taint labels for a data ID", () => {
  const dataId = "data-456";

  propagateDataTaint(dataId, "plugin.coding.presenter", ["label-a"]);
  propagateDataTaint(dataId, "plugin.shared.github_adapter", ["label-b"]);

  const labels = getDataTaintLabels(dataId);
  assert.equal(labels.length, 2);
  assert.ok(labels.some((l) => l.label === "label-a"));
  assert.ok(labels.some((l) => l.label === "label-b"));
});

test("getDataTaintLabels returns empty array for unknown data ID", () => {
  const labels = getDataTaintLabels("data-does-not-exist");
  assert.equal(labels.length, 0);
});

test("hasDataTaintLabel checks for specific taint label existence", () => {
  const dataId = "data-789";

  propagateDataTaint(dataId, "plugin.coding.retriever", ["confidential"]);

  assert.equal(hasDataTaintLabel(dataId, "confidential"), true);
  assert.equal(hasDataTaintLabel(dataId, "nonexistent"), false);
});

test("propagateDataTaint creates taint labels with correct metadata", () => {
  const dataId = "data-meta";
  const pluginId = "plugin.test.meta";

  const propagation = propagateDataTaint(dataId, pluginId, ["test-label"]);

  const label = propagation.labels[0];
  assert.equal(label.sourcePluginId, pluginId);
  assert.equal(label.label, "test-label");
  assert.ok(label.propagatedAt);
  assert.ok(label.severity);
});

// =============================================================================
// Plugin marketplace registry tests
// =============================================================================

test("PluginMarketplaceRegistry can be instantiated", () => {
  const registry = new PluginMarketplaceRegistry();
  assert.ok(registry);
});

test("PluginMarketplaceRegistry.registerLoader and loadPlugin flow", async () => {
  const registry = new PluginMarketplaceRegistry();

  // Register a mock loader
  let loadCalled = false;
  registry.registerLoader("mock", {
    loadFromSource: async (source: string) => {
      loadCalled = true;
      assert.equal(source, "mock://test-plugin");
      return null;
    },
    supportsSource: (source: string) => source.startsWith("mock://"),
  });

  registry.registerMarketplaceEntry({
    pluginId: "plugin.mock.test",
    name: "Mock Test Plugin",
    version: "1.0.0",
    owner: "test",
    trustLevel: "trusted",
    source: "mock://test-plugin",
  });

  // Should fail because not authenticated
  await assert.rejects(
    async () => registry.loadPlugin("plugin.mock.test", "mock://test-plugin", "invalid-token"),
    /Plugin marketplace\.auth\.required/,
  );

  // Authenticate and try again
  const sessionToken = await registry.authenticate("mock://marketplace", {
    apiKey: "test-key",
    apiSecret: "test-secret",
  });

  assert.equal(registry.isAuthenticated(sessionToken), true);
});

test("PluginMarketplaceRegistry.authenticate generates session token", async () => {
  const registry = new PluginMarketplaceRegistry();

  const token = await registry.authenticate("mock://marketplace", {
    apiKey: "key",
    apiSecret: "secret",
  });

  assert.ok(typeof token === "string");
  assert.ok(token.startsWith("session_"));
  assert.equal(registry.isAuthenticated(token), true);
});

test("PluginMarketplaceRegistry.isAuthenticated returns false for invalid token", () => {
  const registry = new PluginMarketplaceRegistry();

  assert.equal(registry.isAuthenticated("invalid-token"), false);
});

test("PluginMarketplaceRegistry.registerMarketplaceEntry adds entry", () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "plugin.marketplace.test",
    name: "Marketplace Test Plugin",
    version: "1.0.0",
    owner: "test",
    trustLevel: "verified",
    source: "marketplace://plugins/test",
  });

  assert.equal(registry.hasMarketplacePlugin("plugin.marketplace.test"), true);
  const entry = registry.getMarketplaceEntry("plugin.marketplace.test");
  assert.ok(entry);
  assert.equal(entry?.version, "1.0.0");
  assert.equal(entry?.trustLevel, "verified");
});

test("PluginMarketplaceRegistry.hasMarketplacePlugin returns false for unknown plugin", () => {
  const registry = new PluginMarketplaceRegistry();

  assert.equal(registry.hasMarketplacePlugin("plugin.unknown"), false);
});

test("PluginMarketplaceRegistry.listMarketplacePlugins returns all entries", () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "plugin.list.test1",
    name: "List Test 1",
    version: "1.0.0",
    owner: "test",
    trustLevel: "trusted",
    source: "marketplace://plugins/test1",
  });
  registry.registerMarketplaceEntry({
    pluginId: "plugin.list.test2",
    name: "List Test 2",
    version: "1.0.0",
    owner: "test",
    trustLevel: "certified",
    source: "marketplace://plugins/test2",
  });

  const plugins = registry.listMarketplacePlugins();
  assert.ok(plugins.length >= 2);
  assert.ok(plugins.some((p) => p.pluginId === "plugin.list.test1"));
  assert.ok(plugins.some((p) => p.pluginId === "plugin.list.test2"));
});

test("PluginMarketplaceRegistry.loadPlugin returns null for unknown plugin", async () => {
  const registry = new PluginMarketplaceRegistry();

  const plugin = await registry.loadPlugin("plugin.unknown", "source://unknown");
  assert.equal(plugin, null);
});

test("PluginMarketplaceRegistry.loadPlugin throws for unknown source", async () => {
  const registry = new PluginMarketplaceRegistry();

  registry.registerMarketplaceEntry({
    pluginId: "plugin.no.loader",
    name: "No Loader Plugin",
    version: "1.0.0",
    owner: "test",
    trustLevel: "trusted",
    source: "unknown://source",
  });

  await assert.rejects(
    async () => registry.loadPlugin("plugin.no.loader", "unknown://source"),
    /Plugin marketplace\.loader\.not_found/,
  );
});

// =============================================================================
// Additional builtin plugin tests
// =============================================================================

test("builtin growth plugins exist and are retrievable", () => {
  assert.ok(hasBuiltinPlugin("plugin.growth.retriever"));
  assert.ok(hasBuiltinPlugin("plugin.growth.presenter"));
  assert.ok(hasBuiltinPlugin("plugin.growth.crm_adapter"));
});

test("builtin game dev plugins exist and are retrievable", () => {
  assert.ok(hasBuiltinPlugin("plugin.gamedev.retriever"));
  assert.ok(hasBuiltinPlugin("plugin.gamedev.unity_adapter"));
});

test("builtin operations plugins exist and are retrievable", () => {
  assert.ok(hasBuiltinPlugin("plugin.operations.retriever"));
  assert.ok(hasBuiltinPlugin("plugin.operations.presenter"));
});

test("builtin asset production plugins exist and are retrievable", () => {
  assert.ok(hasBuiltinPlugin("plugin.assetproduction.retriever"));
  assert.ok(hasBuiltinPlugin("plugin.assetproduction.figma_adapter"));
});

test("builtin livestream plugins exist and are retrievable", () => {
  assert.ok(hasBuiltinPlugin("plugin.livestream.retriever"));
  assert.ok(hasBuiltinPlugin("plugin.livestream.obs_adapter"));
});

test("all builtin plugins have valid manifests", () => {
  const pluginIds = listBuiltinPluginIds();
  for (const pluginId of pluginIds) {
    const manifest = getBuiltinPluginManifest(pluginId);
    assert.ok(manifest, `Plugin ${pluginId} should have manifest`);
    assert.ok(manifest.pluginId, `Plugin ${pluginId} manifest should have pluginId`);
    assert.ok(manifest.name, `Plugin ${pluginId} manifest should have name`);
    assert.ok(manifest.version, `Plugin ${pluginId} manifest should have version`);
    assert.ok(manifest.owner, `Plugin ${pluginId} manifest should have owner`);
  }
});

test("all builtin adapters have adapterType set correctly", () => {
  const adapters = [
    { pluginId: "plugin.growth.crm_adapter", expectedType: "crm_analytics" },
    { pluginId: "plugin.shared.github_adapter", expectedType: "github" },
  ];

  for (const { pluginId, expectedType } of adapters) {
    const plugin = createBuiltinPlugin(pluginId);
    assert.ok(plugin, `Plugin ${pluginId} should exist`);
    if ("adapterType" in plugin) {
      assert.equal((plugin as any).adapterType, expectedType, `${pluginId} should have adapterType ${expectedType}`);
    }
  }
});