import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlatformApplicationKernel,
  registerPlatformApplicationKernel,
} from "../../src/platform-application-kernel.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("platform application kernel builds startup plans for app targets", () => {
  const kernel = getPlatformApplicationKernel();
  const apiPlan = kernel.buildStartupPlan("api");
  assert.equal(apiPlan.target.targetKind, "api");
  assert.equal(apiPlan.selectedApp?.startupCommand, "npm run api");
  assert.ok(apiPlan.requiredLayerManifests.some((layer) => layer.layerId === "platform"));
  assert.ok(apiPlan.requiredLayerManifests.some((layer) => layer.layerId === "apps"));
  assert.deepEqual(apiPlan.domainsStartupPlan?.startupOrder, ["9a", "9b", "9c", "9d", "9e", "9f"]);
  assert.deepEqual(
    {
      phase9a: apiPlan.domainsRuntimeCatalog?.phase9a.length,
      phase9b: apiPlan.domainsRuntimeCatalog?.phase9b.length,
      phase9c: apiPlan.domainsRuntimeCatalog?.phase9c.length,
      phase9d: apiPlan.domainsRuntimeCatalog?.phase9d.length,
      phase9e: apiPlan.domainsRuntimeCatalog?.phase9e.length,
      phase9f: apiPlan.domainsRuntimeCatalog?.phase9f.length,
    },
    {
      phase9a: 4,
      phase9b: 4,
      phase9c: 4,
      phase9d: 4,
      phase9e: 4,
      phase9f: 4,
    },
  );
  assert.deepEqual(apiPlan.planeStartupPlan?.startupOrder, [
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ]);
  assert.deepEqual(apiPlan.aiOperationsStartupPlan?.startupOrder, [
    "model-gateway",
    "prompt-engine",
    "compliance",
    "harness",
  ]);
  assert.deepEqual(
    {
      modelGateway: apiPlan.aiOperationsRuntimeCatalog?.modelGateway.length,
      promptEngine: apiPlan.aiOperationsRuntimeCatalog?.promptEngine.length,
      compliance: apiPlan.aiOperationsRuntimeCatalog?.compliance.length,
      harness: apiPlan.aiOperationsRuntimeCatalog?.harness.length,
    },
    {
      modelGateway: 6,
      promptEngine: 5,
      compliance: 5,
      harness: 4,
    },
  );
  assert.deepEqual(apiPlan.interactionGovernanceStartupPlan?.startupOrder, ["interaction", "org-governance"]);
  assert.deepEqual(
    {
      interaction: apiPlan.interactionGovernanceRuntimeCatalog?.interaction.length,
      governance: apiPlan.interactionGovernanceRuntimeCatalog?.governance.length,
    },
    {
      interaction: 6,
      governance: 6,
    },
  );
  assert.deepEqual(apiPlan.scaleOpsStartupPlan?.startupOrder, ["scale-ecosystem", "ops-maturity"]);
  assert.deepEqual(
    {
      scaleEcosystem: apiPlan.scaleOpsRuntimeCatalog?.scaleEcosystem.length,
      opsMaturity: apiPlan.scaleOpsRuntimeCatalog?.opsMaturity.length,
    },
    {
      scaleEcosystem: 6,
      opsMaturity: 12,
    },
  );
});

test("platform application kernel exposes summary and demo startup targets", () => {
  const kernel = getPlatformApplicationKernel();
  const targets = kernel.listStartupTargets();
  assert.deepEqual(targets.map((target) => target.targetKind), ["summary", "demo", "api", "console", "worker"]);
});

test("platform application kernel registers itself in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const kernel = registerPlatformApplicationKernel(registry);
    const snapshot = kernel.buildSnapshot();
    assert.equal(snapshot.appCount, 3);
    assert.equal(snapshot.startupTargetCount, 5);
    assert.equal(registry.isInitialized("architecture.application-kernel"), true);
  } finally {
    await registry.reset();
  }
});
