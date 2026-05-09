import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import type { PromptBundleRegistrationInput } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

function createBundle(version: number): PromptBundleRegistrationInput {
  return {
    name: "finance-planner",
    version,
    displayVersion: `v${version}`,
    domain: "finance",
    taskType: "classification",
    packId: "pack-finance",
    systemPrompt: {
      content: "You are a finance planning assistant.",
      templateVariables: [],
      channel: "system",
    },
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
  };
}

test("HierarchicalPromptRegistryService stores pack-scoped registrations under the domain hierarchy", () => {
  const registry = new HierarchicalPromptRegistryService();
  const bundle = registry.registerBundle(createBundle(1), "task-type", "finance", "pack-finance");

  assert.equal(bundle.domain, "finance");
  const resolved = registry.getBundle("finance-planner", "classification", "pack-finance", "finance");
  assert.ok(resolved != null);
  assert.equal(resolved!.bundleId.startsWith("task-type:finance:"), true);
});

test("HierarchicalPromptRegistryService does not expose a separate pack-only lookup layer", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createBundle(1), "domain", "finance", "pack-finance");

  assert.equal(registry.listBundles("domain", "finance").length, 1);
  assert.equal(registry.getBundle("finance-planner", "classification", undefined, "finance")?.domain, "finance");
});
