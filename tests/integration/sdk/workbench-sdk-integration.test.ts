import assert from "node:assert/strict";
import test from "node:test";

import { SdkWorkbenchService } from "../../../src/sdk/workbench/index.js";

test("integration: sdk workbench composes client, plugin, and pack manifests into a publish readiness report", () => {
  const service = new SdkWorkbenchService();
  const report = service.buildPublishReadiness({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      tenantId: "tenant-enterprise",
    },
    plugins: [
      {
        pluginId: "approve-plugin",
        version: "1.0.0",
        owner: "owner@example.com",
        spiTypes: ["retriever"],
        publicSdkSurface: "test-sdk",
        capabilityIds: ["approve", "triage"],
      },
    ] as any,
    packs: [
      {
        packId: "ops-pack",
        version: "1.0.0",
        domain: "ops",
        owner: "owner@example.com",
        capabilities: [
          { capabilityKey: "approve", maturity: "ga", requiredContracts: ["approval_and_hitl_contract"] },
          { capabilityKey: "triage", maturity: "beta", requiredContracts: ["runtime_execution_contract"] },
        ],
      },
    ],
    availableContracts: ["approval_and_hitl_contract", "runtime_execution_contract"],
  });

  assert.equal(report.ready, true);
  assert.ok(report.previewUrls.some((url) => url.includes("/v1/harness-runs")));
  assert.deepEqual(report.findings, []);
});
