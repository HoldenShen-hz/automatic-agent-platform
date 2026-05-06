import assert from "node:assert/strict";
import test from "node:test";

import { validateBusinessPackManifest as rawValidateBusinessPackManifest } from "../../../../src/sdk/pack-sdk/pack-manifest.js";

const TEST_PACK_SIGNING = {
  keyId: "test-pack-key",
  signature: "test-pack-signature",
  algorithm: "ed25519",
} as const;

function validateBusinessPackManifest(
  manifest: Parameters<typeof rawValidateBusinessPackManifest>[0],
  options?: Parameters<typeof rawValidateBusinessPackManifest>[1],
) {
  return rawValidateBusinessPackManifest(
    {
      ...manifest,
      signing: manifest.signing === undefined ? TEST_PACK_SIGNING : manifest.signing,
    },
    options,
  );
}

test("pack-sdk manifest keeps rollbackStrategy when provided", () => {
  const manifest = validateBusinessPackManifest({
    packId: "pack.coding.example",
    version: "1.0.0",
    domainId: "coding",
    owner: "platform-team",
    capabilities: [{ capabilityKey: "coding.patch" }],
    rollbackStrategy: {
      enabled: true,
      strategy: "semi_auto",
      maxRollbackDurationMs: 300000,
      requireApproval: true,
    },
    signing: {
      keyId: "sig-key-1",
      signature: "deadbeef",
    },
  });

  assert.deepEqual(manifest.rollbackStrategy, {
    enabled: true,
    strategy: "semi_auto",
    maxRollbackDurationMs: 300000,
    requireApproval: true,
  });
});
