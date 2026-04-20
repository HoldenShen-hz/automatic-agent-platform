import assert from "node:assert/strict";
import test from "node:test";

import { ProviderCredentialPool } from "../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js";
import type { ProviderCredentialRecord } from "../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool-support.js";

test("ProviderCredentialPool full lifecycle: select, use, markSuccess", async () => {
  const pool = new ProviderCredentialPool({
    provider: "test",
    credentials: [
      { credentialId: "primary", apiKey: "primary-key", status: "active" },
      { credentialId: "secondary", apiKey: "secondary-key", status: "active" },
    ],
  });

  // Select credential
  const selection1 = await pool.selectCredential();
  assert.ok(selection1 !== null);
  assert.equal(selection1.credentialId, "primary");

  // Mark success
  pool.markSuccess("primary");

  // Select again - should get primary since it was marked successful
  const selection2 = await pool.selectCredential();
  assert.ok(selection2 !== null);
  assert.equal(selection2.credentialId, "primary");
});

test("ProviderCredentialPool failover on 5xx error", async () => {
  const pool = new ProviderCredentialPool({
    provider: "test",
    credentials: [
      { credentialId: "primary", apiKey: "primary-key", status: "active" },
      { credentialId: "secondary", apiKey: "secondary-key", status: "active" },
    ],
  });

  // Fail primary
  pool.markFailure({
    credentialId: "primary",
    statusCode: 503,
    retryAfterMs: 5000,
  });

  // Should failover to secondary
  const selection = await pool.selectCredential();
  assert.ok(selection !== null);
  assert.equal(selection.credentialId, "secondary");
});

test("ProviderCredentialPool permanent failure with 402", async () => {
  const pool = new ProviderCredentialPool({
    provider: "test",
    credentials: [
      { credentialId: "primary", apiKey: "primary-key", status: "active" },
    ],
  });

  pool.markFailure({
    credentialId: "primary",
    statusCode: 402,
  });

  // Cannot failover - only one credential and it's disabled
  const selection = await pool.selectCredential({ excludeCredentialIds: ["primary"] });
  assert.equal(selection, null);
});

test("ProviderCredentialPool recovery after cooldown", async () => {
  const pool = new ProviderCredentialPool({
    provider: "test",
    defaultCooldownMs: 50,
    credentials: [
      { credentialId: "cred-1", apiKey: "key-1", status: "active" },
    ],
  });

  // Fail credential
  pool.markFailure({
    credentialId: "cred-1",
    statusCode: 429,
    retryAfterMs: 20,
  });

  // Should be cooling down
  const state1 = pool.getStates()[0];
  assert.equal(state1?.effectiveStatus, "cooling_down");

  // Wait for cooldown
  await new Promise(resolve => setTimeout(resolve, 60));

  // Should be active again
  const selection = await pool.selectCredential();
  assert.ok(selection !== null);
  assert.equal(selection.credentialId, "cred-1");
});

test("ProviderCredentialPool multiple failures trigger circuit breaker behavior", async () => {
  const pool = new ProviderCredentialPool({
    provider: "test",
    credentials: [
      { credentialId: "cred-1", apiKey: "key-1", status: "active" },
      { credentialId: "cred-2", apiKey: "key-2", status: "active" },
    ],
  });

  // Fail both credentials
  pool.markFailure({ credentialId: "cred-1", statusCode: 500 });
  pool.markFailure({ credentialId: "cred-2", statusCode: 500 });

  const exhaustion = pool.getExhaustion();
  assert.equal(exhaustion.reasonCode, "provider.credentials_cooling_down");
});

test("ProviderCredentialPool fromEnvironment loads multiple key formats", () => {
  const pool = ProviderCredentialPool.fromEnvironment(
    "openai",
    {
      OPENAI_API_KEY: "sk-test-1",
      OPENAI_API_KEYS_JSON: JSON.stringify([
        { apiKey: "sk-test-2", label: "secondary" },
      ]),
    },
  );

  const states = pool.getStates();
  assert.equal(states.length, 2);
  const ids = states.map(s => s.credentialId);
  assert.ok(ids.includes("openai-default"));
  assert.ok(ids.includes("openai-1"));
});

test("ProviderCredentialPool releaseCredential with active lease", () => {
  const pool = new ProviderCredentialPool({
    provider: "test",
    credentials: [
      {
        credentialId: "cred-1",
        secretRef: "secret/test",
        status: "active",
      },
    ] as ProviderCredentialRecord[],
    managedSecretAccess: {
      secretLeaseRevoker: (leaseId: string, _context: Record<string, unknown>) => {
        assert.equal(leaseId, "lease-123");
      },
    },
  } as any);

  const released = pool.releaseCredential({
    credentialId: "cred-1",
    leaseId: "lease-123",
  }, "provider.request_completed");

  assert.ok(released !== null);
  assert.equal(released?.credentialId, "cred-1");
});
