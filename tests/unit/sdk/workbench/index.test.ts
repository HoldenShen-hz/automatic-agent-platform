import assert from "node:assert/strict";
import test from "node:test";

import { SdkWorkbenchService } from "../../../../src/sdk/workbench/index.js";

test("SdkWorkbenchService builds install plans and missing contract summaries", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      tenantId: "tenant-1",
    },
    plugins: [
      {
        pluginId: "deploy-plugin",
        version: "1.0.0",
        owner: "ops@example.com",
        runtime: "sandboxed",
        entrypoint: "dist/deploy.js",
        capabilities: [
          { name: "deploy", description: "Deploy changes", scopes: ["release"] },
        ],
      },
    ],
    packs: [
      {
        packId: "release-pack",
        version: "1.0.0",
        domain: "ops",
        owner: "ops@example.com",
        capabilities: [
          { capabilityKey: "deploy", maturity: "ga", requiredContracts: ["platform_promote_criteria_contract"] },
          { capabilityKey: "rollback", maturity: "beta", requiredContracts: ["platform_panic_and_resume_contract"] },
        ],
      },
    ],
    availableContracts: ["platform_promote_criteria_contract"],
  });

  assert.deepEqual(snapshot.pluginIds, ["deploy-plugin"]);
  assert.deepEqual(snapshot.missingContracts, ["platform_panic_and_resume_contract"]);
  assert.equal(snapshot.installPlans[0]?.ready, false);
});

test("SdkWorkbenchService builds publish readiness previews", () => {
  const service = new SdkWorkbenchService();
  const report = service.buildPublishReadiness({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      tenantId: "tenant-1",
    },
    plugins: [
      {
        pluginId: "triage-plugin",
        version: "1.0.0",
        owner: "ops@example.com",
        runtime: "local",
        entrypoint: "dist/triage.js",
        capabilities: [
          { name: "triage", description: "Triage incidents", scopes: ["read", "write"] },
        ],
      },
    ],
    packs: [
      {
        packId: "triage-pack",
        version: "1.0.0",
        domain: "ops",
        owner: "ops@example.com",
        capabilities: [
          { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
      },
    ],
    availableContracts: ["runtime_execution_contract"],
  });

  assert.equal(report.ready, true);
  assert.equal(report.previewUrls.length, 3);
  assert.deepEqual(report.missingContracts, []);
});
