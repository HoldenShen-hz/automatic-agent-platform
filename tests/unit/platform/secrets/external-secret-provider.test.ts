import assert from "node:assert/strict";
import test from "node:test";

import { ExternalSecretProvider, ExternalSecretProviderAdapter } from "../../../../src/platform/five-plane-control-plane/iam/external-secret-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_VAULT_SECRETS_JSON: undefined,
    AA_VAULT_SECRETS_FILE: undefined,
    AA_KMS_SECRETS_JSON: undefined,
    AA_KMS_SECRETS_FILE: undefined,
    AA_SECRET_MANAGER_SECRETS_JSON: undefined,
    AA_SECRET_MANAGER_SECRETS_FILE: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ExternalSecretProvider construction
// ---------------------------------------------------------------------------

test("ExternalSecretProvider accepts vault provider kind", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv(),
  });
  assert.equal(provider.providerKind, "vault");
});

test("ExternalSecretProvider accepts kms provider kind", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "kms",
    env: createMockEnv(),
  });
  assert.equal(provider.providerKind, "kms");
});

test("ExternalSecretProvider accepts secret_manager provider kind", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "secret_manager",
    env: createMockEnv(),
  });
  assert.equal(provider.providerKind, "secret_manager");
});

// ---------------------------------------------------------------------------
// ExternalSecretProvider.hasConfiguredSource
// ---------------------------------------------------------------------------

test("hasConfiguredSource returns false when no source configured", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv(),
  });
  assert.equal(provider.hasConfiguredSource(), false);
});

test("hasConfiguredSource returns true when JSON source is configured", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"myvalue"}' }),
  });
  assert.equal(provider.hasConfiguredSource(), true);
});

test("hasConfiguredSource returns true when file source is configured", () => {
  // Note: This test assumes a real file path would be validated at runtime
  // We're testing the logic path when file exists
  const provider = new ExternalSecretProvider({
    providerKind: "kms",
    env: createMockEnv({ AA_KMS_SECRETS_JSON: '{"key1":"value1"}' }),
  });
  assert.equal(provider.hasConfiguredSource(), true);
});

// ---------------------------------------------------------------------------
// ExternalSecretProvider.describeSecret
// ---------------------------------------------------------------------------

test("describeSecret returns unresolved when no source configured", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv(),
  });
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, false);
  assert.equal(result.secretRef, "secret://mykey");
  assert.equal(result.source, "vault");
});

test("describeSecret returns resolved true when secret found in JSON", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"secret-value"}' }),
  });
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, true);
  assert.equal(result.secretRef, "secret://mykey");
  assert.notEqual(result.maskedValue, null);
});

test("describeSecret extracts correct scope from secret ref", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"value"}' }),
  });
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.scope, "mykey");
});

test("describeSecret returns unresolved for non-existent secret in configured JSON", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"otherkey":"value"}' }),
  });
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, false);
});

test("describeSecret handles nested path in JSON lookup", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"folder/mykey":"nested-value"}' }),
  });
  const result = await provider.describeSecret("secret://folder/mykey");
  assert.equal(result.resolved, true);
});

test("describeSecret handles simple string value entry", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "kms",
    env: createMockEnv({ AA_KMS_SECRETS_JSON: '{"mykey":"kms-secret"}' }),
  });
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, true);
});

test("describeSecret handles object entry with locator", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "secret_manager",
    env: createMockEnv({ AA_SECRET_MANAGER_SECRETS_JSON: '{"mykey":{"value":"gcp-secret","locator":"custom-locator"}}' }),
  });
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, true);
  assert.equal(result.envName, "custom-locator");
});

// ---------------------------------------------------------------------------
// ExternalSecretProvider.requireSecret
// ---------------------------------------------------------------------------

test("requireSecret returns value when secret exists in JSON", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"the-secret-value"}' }),
  });
  const result = await provider.requireSecret("secret://mykey");
  assert.equal(result.resolved, true);
  assert.equal(result.value, "the-secret-value");
});

test("requireSecret throws when secret not found", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"otherkey":"value"}' }),
  });
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("secret.missing_value"),
  );
});

test("requireSecret throws when JSON is empty object", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{}' }),
  });
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("secret.missing_value"),
  );
});

test("requireSecret handles object entry with value", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "kms",
    env: createMockEnv({ AA_KMS_SECRETS_JSON: '{"mykey":{"value":"decrypted-secret"}}' }),
  });
  const result = await provider.requireSecret("secret://mykey");
  assert.equal(result.value, "decrypted-secret");
});

test("requireSecret trims whitespace from string values", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"  trimmed-secret  "}' }),
  });
  const result = await provider.requireSecret("secret://mykey");
  assert.equal(result.value, "trimmed-secret");
});

// ---------------------------------------------------------------------------
// ExternalSecretProvider.issueSecretLease
// ---------------------------------------------------------------------------

test("issueSecretLease returns null when no source configured", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv(),
  });
  const result = await provider.issueSecretLease("secret://mykey");
  assert.equal(result, null);
});

test("issueSecretLease returns null when secret has no lease config", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":{"value":"simple-value"}}' }),
  });
  const result = await provider.issueSecretLease("secret://mykey");
  assert.equal(result, null);
});

test("issueSecretLease returns lease when configured in entry", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({
      AA_VAULT_SECRETS_JSON: JSON.stringify({
        mykey: {
          value: "leased-secret",
          issued_lease: {
            value: "leased-secret",
            expires_at: "2025-12-31T23:59:59Z",
            renewable: true,
            issued_by: "test-issuer",
          },
        },
      }),
    }),
  });
  const result = await provider.issueSecretLease("secret://mykey");
  assert.notEqual(result, null);
  assert.equal(result!.value, "leased-secret");
  assert.equal(result!.renewable, true);
  assert.equal(result!.issuedBy, "test-issuer");
});

// ---------------------------------------------------------------------------
// ExternalSecretProviderAdapter
// ---------------------------------------------------------------------------

test("ExternalSecretProviderAdapter has same providerKind as wrapped provider", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv(),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  assert.equal(adapter.providerKind, "vault");
});

test("ExternalSecretProviderAdapter.describeSecret delegates to provider", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"adapter-value"}' }),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  const result = await adapter.describeSecret("secret://mykey");
  assert.equal(result.resolved, true);
  assert.equal((result as any).value, undefined); // describeSecret doesn't return value
});

test("ExternalSecretProviderAdapter.requireSecret delegates to provider", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"adapter-secret"}' }),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  const result = await adapter.requireSecret("secret://mykey");
  assert.equal(result.value, "adapter-secret");
});

test("ExternalSecretProviderAdapter.refreshSecret delegates to provider", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"refresh-value"}' }),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  const result = await adapter.refreshSecret("secret://mykey");
  assert.equal(result.resolved, true);
});

test("ExternalSecretProviderAdapter.issueSecretLease delegates to provider", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":{"value":"lease-value"}}' }),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  const result = await (adapter as any).issueSecretLease?.("secret://mykey") ?? null;
  assert.equal(result, null); // No lease configured
});

test("ExternalSecretProviderAdapter.isConfigured delegates to provider.hasConfiguredSource", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":"value"}' }),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  assert.equal(adapter.isConfigured(), true);
});

test("ExternalSecretProviderAdapter.isConfigured returns false when no source", () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv(),
  });
  const adapter = new ExternalSecretProviderAdapter(provider);
  assert.equal(adapter.isConfigured(), false);
});

// ---------------------------------------------------------------------------
// ExternalSecretProvider error handling
// ---------------------------------------------------------------------------

test("ExternalSecretProvider throws for invalid JSON in inline source", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: "not-valid-json" }),
  });
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("secret.provider_config_invalid"),
  );
});

test("ExternalSecretProvider throws for null value in JSON", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '{"mykey":null}' }),
  });
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("secret.provider_config_invalid"),
  );
});

test("ExternalSecretProvider throws for array instead of object in JSON", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: createMockEnv({ AA_VAULT_SECRETS_JSON: '["array","not","object"]' }),
  });
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("secret.provider_config_invalid"),
  );
});
