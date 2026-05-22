import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../helpers/repo-root.js";

import { createAssetProductionAdapterPlugin } from "../../../../src/plugins/adapters/asset-production-adapter.js";
import { createCrmAdapterPlugin } from "../../../../src/plugins/adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";
import { createLivestreamAdapterPlugin } from "../../../../src/plugins/adapters/livestream-adapter.js";
import { NetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";
import { ChannelGatewayDeliveryService } from "../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { nextPromptRolloutStage } from "../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";
import { HierarchicalPromptRegistryService } from "../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { PromptVersionManager } from "../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";

function createPromptRegistrationInput(version: number) {
  return {
    name: "triage-assistant",
    version,
    displayVersion: `v1.${version}.0`,
    domain: "ops",
    taskType: "incident_triage",
    packId: undefined,
    systemPrompt: {
      content: "You are a triage assistant.",
      templateVariables: [],
      channel: "system" as const,
    },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: undefined,
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "ops",
      deprecated: false,
      lifecycleStatus: "active" as const,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight: version === 2 ? 100 : 0,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  };
}

test("R28-11 and R28-12 CRM adapter blocks unauthenticated use and rejects path traversal actions", async () => {
  const plugin = createCrmAdapterPlugin({ apiBaseUrl: "https://api.hubspot.com" });

  await assert.rejects(plugin.execute("contacts", {}), /crm_adapter\.not_authenticated/);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  try {
    await plugin.authenticate({ token: "crm-secret-token-12345678" });
    await assert.rejects(plugin.execute("../owners", {}), /crm_adapter\.invalid_action/);

    const result = await plugin.execute("contacts", { limit: 1 });
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R28-13 game-dev adapter requires authentication and retains egress checks in source", async () => {
  const plugin = createGameDevAdapterPlugin();

  await assert.rejects(plugin.execute("status", {}), /game_dev_adapter\.not_authenticated/);

  await plugin.authenticate({ token: "unity-build-token-1234" });
  const result = await plugin.execute("status", { projectSlug: "proj", buildTarget: "ios" });
  assert.equal(result.success, true);

  const source = readFileSync(
    resolveRepoPath("src/plugins/adapters/game-dev-adapter.ts"),
    "utf8",
  );
  assert.match(source, /gameDevPolicy\.evaluate\(/);
});

test("R28-14 asset-production adapter requires authentication and retains egress checks in source", async () => {
  const plugin = createAssetProductionAdapterPlugin();

  await assert.rejects(plugin.execute("files.get", {}), /asset_production_adapter\.not_authenticated/);

  await plugin.authenticate({ token: "figma-token-123456" });
  const result = await plugin.execute("files.get", { fileKey: "file-1" });
  assert.equal(result.success, true);

  const source = readFileSync(
    resolveRepoPath("src/plugins/adapters/asset-production-adapter.ts"),
    "utf8",
  );
  assert.match(source, /assetProductionPolicy\.evaluate\(/);
});

test("R28-15 and R28-20 livestream adapter persists auth state and enforces egress policy", async () => {
  const denyPolicy = new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["example.com"],
  });
  const blockedPlugin = createLivestreamAdapterPlugin({ policy: denyPolicy });

  await assert.rejects(blockedPlugin.execute("scene.list", {}), /livestream_adapter\.not_authenticated/);

  await blockedPlugin.authenticate({ obsToken: "ABCDEFGHIJKLMNOPQRSTUV==" });
  await assert.rejects(blockedPlugin.execute("scene.list", { streamId: "stream-1" }), /egress denied/);

  const allowedPlugin = createLivestreamAdapterPlugin();
  await allowedPlugin.authenticate({ obsToken: "ABCDEFGHIJKLMNOPQRSTUV==" });
  const result = await allowedPlugin.execute("scene.list", { streamId: "stream-2" });
  assert.equal(result.success, true);
});

test("R28-16 generateNonce preserves full entropy for requested byte length", () => {
  const service = Object.create(ChannelGatewayDeliveryService.prototype) as ChannelGatewayDeliveryService;
  const nonce = service.generateNonce(32);

  assert.equal(nonce.length, 64);
  assert.match(nonce, /^[0-9a-f]+$/);
});

test("R28-17 nextPromptRolloutStage returns null for terminal stages", () => {
  assert.equal(nextPromptRolloutStage("stable"), null);
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
  assert.equal(nextPromptRolloutStage("canary_20"), "stable");
});

test("R28-18 hierarchical registry honors requested version when mutating bundles", () => {
  const registry = new HierarchicalPromptRegistryService();

  const bundle1 = registry.registerBundle(createPromptRegistrationInput(1), "global");
  registry.registerBundle(createPromptRegistrationInput(2), "global");
  registry.deprecateBundle("triage-assistant", bundle1.displayVersion, "global");

  const versions = registry.listBundleVersions("triage-assistant");
  const version1 = versions.find((entry) => entry.version === 1);
  const version2 = versions.find((entry) => entry.version === 2);

  assert.equal(version1?.deprecated, true);
  assert.equal(version2?.deprecated, false);
});

test("R28-19 compareVersions returns normalized ordering signals", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v1.0.0", "v1.5.0"), -1);
  assert.equal(manager.compareVersions("v1.5.0", "v1.0.0"), 1);
  assert.equal(manager.compareVersions("v2.0", "v2.0.0"), 0);
  assert.equal(manager.compareVersions(2, 7), -1);
});
