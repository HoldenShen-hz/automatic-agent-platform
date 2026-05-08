import assert from "node:assert/strict";
import test from "node:test";

import {
  PluginSpiTypeSchema,
  PluginLifecycleStateSchema,
  PluginRuntimeIsolationSchema,
  PluginSandboxPolicySchema,
  PluginManifestSchema,
} from "../../../../src/domains/registry/plugin-spi.js";

test("PluginSpiTypeSchema accepts valid spi types", () => {
  const validTypes = ["retriever", "validator", "planner", "presenter", "adapter"];
  for (const type of validTypes) {
    const result = PluginSpiTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("PluginSpiTypeSchema rejects invalid spi types", () => {
  const result = PluginSpiTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("PluginLifecycleStateSchema accepts valid states", () => {
  const validStates = ["registered", "loaded", "active", "inactive", "unloaded", "degraded", "disabled"];
  for (const state of validStates) {
    const result = PluginLifecycleStateSchema.safeParse(state);
    assert.equal(result.success, true, `Expected ${state} to be valid`);
  }
});

test("PluginLifecycleStateSchema rejects invalid states", () => {
  const result = PluginLifecycleStateSchema.safeParse("unknown_state");
  assert.equal(result.success, false);
});

test("PluginRuntimeIsolationSchema accepts valid isolation modes", () => {
  const validModes = [
    "shared_process",
    "serialized_in_process",
    "forked_process",
    "sandboxed_process",
    "containerized_process",
  ];
  for (const mode of validModes) {
    const result = PluginRuntimeIsolationSchema.safeParse(mode);
    assert.equal(result.success, true, `Expected ${mode} to be valid`);
  }
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

test("PluginSandboxPolicySchema accepts valid custom values", () => {
  const result = PluginSandboxPolicySchema.parse({
    timeoutMs: 30000,
    allowFilesystemWrite: true,
    allowNetworkEgress: true,
    allowedKnowledgeNamespaces: ["ns_1", "ns_2"],
    maxConcurrentInvocations: 4,
    maxQueuedInvocations: 16,
    runtimeIsolation: "sandboxed_process",
    cooldownMs: 5000,
  });
  assert.equal(result.timeoutMs, 30000);
  assert.equal(result.allowFilesystemWrite, true);
  assert.equal(result.allowNetworkEgress, true);
  assert.deepEqual(result.allowedKnowledgeNamespaces, ["ns_1", "ns_2"]);
  assert.equal(result.maxConcurrentInvocations, 4);
  assert.equal(result.maxQueuedInvocations, 16);
  assert.equal(result.runtimeIsolation, "sandboxed_process");
  assert.equal(result.cooldownMs, 5000);
});

test("PluginSandboxPolicySchema rejects negative timeoutMs", () => {
  const result = PluginSandboxPolicySchema.safeParse({ timeoutMs: -100 });
  assert.equal(result.success, false);
});

test("PluginSandboxPolicySchema rejects zero maxConcurrentInvocations", () => {
  const result = PluginSandboxPolicySchema.safeParse({ maxConcurrentInvocations: 0 });
  assert.equal(result.success, false);
});

test("PluginManifestSchema applies defaults and validates structure", () => {
  const manifest = PluginManifestSchema.parse({
    pluginId: "plugin_demo",
    name: "Demo Plugin",
    version: "1.0.0",
    owner: "team_demo",
    spiTypes: ["retriever"],
    publicSdkSurface: "v1",
  });

  assert.equal(manifest.pluginId, "plugin_demo");
  assert.equal(manifest.domainIds.length, 0);
  assert.equal(manifest.capabilityIds.length, 0);
  assert.equal(manifest.trustLevel, "trusted");
  assert.equal(manifest.extensionKind, "domain_plugin");
  assert.deepEqual(manifest.sandbox, PluginSandboxPolicySchema.parse({}));
});

test("PluginManifestSchema requires at least one spiType", () => {
  const result = PluginManifestSchema.safeParse({
    pluginId: "plugin_bad",
    name: "Bad Plugin",
    version: "1.0.0",
    owner: "team",
    spiTypes: [],
    publicSdkSurface: "v1",
  });
  assert.equal(result.success, false);
});

test("PluginManifestSchema rejects empty pluginId", () => {
  const result = PluginManifestSchema.safeParse({
    pluginId: "",
    name: "Plugin",
    version: "1.0.0",
    owner: "team",
    spiTypes: ["retriever"],
    publicSdkSurface: "v1",
  });
  assert.equal(result.success, false);
});

test("PluginManifestSchema accepts domain_plugin and external_adapter extension kinds", () => {
  const domainPlugin = PluginManifestSchema.parse({
    pluginId: "p1",
    name: "P1",
    version: "1.0.0",
    owner: "team",
    spiTypes: ["retriever"],
    publicSdkSurface: "v1",
    extensionKind: "domain_plugin",
  });
  assert.equal(domainPlugin.extensionKind, "domain_plugin");

  const externalAdapter = PluginManifestSchema.parse({
    pluginId: "p2",
    name: "P2",
    version: "1.0.0",
    owner: "team",
    spiTypes: ["adapter"],
    publicSdkSurface: "v1",
    extensionKind: "external_adapter",
  });
  assert.equal(externalAdapter.extensionKind, "external_adapter");
});

test("PluginManifestSchema accepts trust levels", () => {
  const trustLevels = ["internal", "trusted", "community", "unverified"] as const;
  for (const level of trustLevels) {
    const manifest = PluginManifestSchema.parse({
      pluginId: `plugin_${level}`,
      name: `Plugin ${level}`,
      version: "1.0.0",
      owner: "team",
      spiTypes: ["retriever"],
      publicSdkSurface: "v1",
      trustLevel: level,
    });
    assert.equal(manifest.trustLevel, level);
  }
});
