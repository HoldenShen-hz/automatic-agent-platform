import assert from "node:assert/strict";
import test from "node:test";

import { PackPluginCompatibilityService, validateBusinessPackManifest } from "../../../src/sdk/index.js";

test("integration: pack compatibility evaluates builtin plugin coverage and license tier across sdk barrels", () => {
  const service = new PackPluginCompatibilityService();
  const manifest = validateBusinessPackManifest({
    packId: "operations-market-pack",
    version: "2.7.0",
    domainId: "operations",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
      { capabilityKey: "marketplace.revenue.ops", maturity: "experimental", requiredContracts: ["marketplace_catalog_and_revenue_contract"] },
    ],
  });

  const report = service.evaluateManifest({
    manifest,
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever", "plugin.shared.github_adapter"],
  });

  assert.equal(report.selectedPlugins.length, 2);
  assert.equal(report.requiredLicenseTier, "professional");
  assert.equal(report.verdict, "missing_plugins");
  assert.deepEqual(report.missingPluginCapabilities, ["marketplace.revenue.ops"]);
  assert.ok(report.availablePlugins.some((entry) => entry.pluginId === "plugin.shared.github_adapter"));
  assert.ok(report.capabilityCoverage.some((entry) => entry.capabilityKey === "external.github.workflow" && entry.compatible));
  assert.ok(report.capabilityCoverage.some((entry) => entry.capabilityKey === "marketplace.revenue.ops" && !entry.compatible));
  assert.deepEqual(report.capabilityMatrix, { experimental: 1, beta: 1, ga: 1 });
});
