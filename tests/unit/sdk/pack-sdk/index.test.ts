import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizeCapabilityMatrix,
  validateBusinessPackManifest,
} from "../../../../src/sdk/pack-sdk/index.js";

test("pack-sdk validates business pack manifests and summarizes maturity counts", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "2.0.0",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "capacity", maturity: "beta", requiredContracts: ["capacity_planning_contract"] },
    ],
  });

  assert.deepEqual(summarizeCapabilityMatrix(manifest), {
    experimental: 0,
    beta: 1,
    ga: 1,
  });
});
