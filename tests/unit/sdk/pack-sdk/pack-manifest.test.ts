import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  validateBusinessPackManifest,
  summarizeCapabilityMatrix,
  type BusinessPackManifest,
  type BusinessPackCapability,
} from "../../../../src/sdk/pack-sdk/pack-manifest.js";

test("validateBusinessPackManifest trims packId, version, domain, owner", () => {
  const manifest = validateBusinessPackManifest({
    packId: "  ops-pack  ",
    version: "  1.0.0  ",
    domain: "  operations  ",
    owner: "  ops@example.com  ",
    capabilities: [
      { capabilityKey: " triage ", maturity: "ga", requiredContracts: [" runtime_execution_contract "] },
    ],
  });

  assert.equal(manifest.packId, "ops-pack");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.domain, "operations");
  assert.equal(manifest.owner, "ops@example.com");
  assert.equal(manifest.capabilities[0]!.capabilityKey, "triage");
  assert.equal(manifest.capabilities[0]!.requiredContracts[0], "runtime_execution_contract");
});

test("validateBusinessPackManifest deduplicates requiredContracts within a capability", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["contract_a", " contract_a ", "contract_b"] },
    ],
  });

  assert.deepEqual(manifest.capabilities[0]!.requiredContracts, ["contract_a", "contract_b"]);
});

test("validateBusinessPackManifest removes empty contracts", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime", "", "  ", "contract"] },
    ],
  });

  assert.deepEqual(manifest.capabilities[0]!.requiredContracts, ["runtime", "contract"]);
});

test("validateBusinessPackManifest rejects empty packId", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        packId: "   ",
        version: "1.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
          { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.invalid_pack_id",
  );
});

test("validateBusinessPackManifest rejects empty capabilities", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        packId: "ops-pack",
        version: "1.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.empty_capabilities",
  );
});

test("summarizeCapabilityMatrix counts all maturity levels correctly", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "capacity", maturity: "beta", requiredContracts: ["capacity_contract"] },
      { capabilityKey: "observe", maturity: "experimental", requiredContracts: ["observe_contract"] },
      { capabilityKey: "search", maturity: "ga", requiredContracts: ["search_contract"] },
      { capabilityKey: "transform", maturity: "beta", requiredContracts: ["transform_contract"] },
    ],
  });

  const summary = summarizeCapabilityMatrix(manifest);
  assert.deepEqual(summary, { experimental: 1, beta: 2, ga: 2 });
});
