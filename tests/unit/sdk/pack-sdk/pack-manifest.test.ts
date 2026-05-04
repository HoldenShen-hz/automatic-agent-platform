import assert from "node:assert/strict";
import test from "node:test";

import { validateBusinessPackManifest } from "../../../../src/sdk/pack-sdk/pack-manifest.js";

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
