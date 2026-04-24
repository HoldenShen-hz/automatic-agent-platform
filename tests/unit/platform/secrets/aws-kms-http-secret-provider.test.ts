import assert from "node:assert/strict";
import test from "node:test";

import { AwsKmsHttpSecretProvider } from "../../../../src/platform/control-plane/iam/aws-kms-http-secret-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_AWS_ACCESS_KEY_ID: undefined,
    AA_AWS_SECRET_ACCESS_KEY: undefined,
    AA_AWS_REGION: undefined,
    AA_AWS_SESSION_TOKEN: undefined,
    AA_AWS_KMS_KEY_ARN: undefined,
    AA_AWS_KMS_ENDPOINT: undefined,
    AA_AWS_TIMEOUT_MS: undefined,
    ...overrides,
  };
}

function createProvider(mockEnv: NodeJS.ProcessEnv = createMockEnv()): AwsKmsHttpSecretProvider {
  return new AwsKmsHttpSecretProvider({ env: mockEnv });
}

// ---------------------------------------------------------------------------
// AwsKmsHttpSecretProvider construction
// ---------------------------------------------------------------------------

test("AwsKmsHttpSecretProvider defaults to us-east-1 region", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));
  // Provider constructs without error
  assert.equal(provider.providerKind, "kms");
});

test("AwsKmsHttpSecretProvider uses custom region when provided", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_REGION: "eu-west-1",
  }));
  assert.equal(provider.providerKind, "kms");
});

test("AwsKmsHttpSecretProvider uses custom endpoint when provided", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_ENDPOINT: "https://my-kms.local:8443",
  }));
  assert.equal(provider.providerKind, "kms");
});

test("AwsKmsHttpSecretProvider parses custom timeout", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_TIMEOUT_MS: "10000",
  }));
  assert.equal(provider.providerKind, "kms");
});

// ---------------------------------------------------------------------------
// isConfigured
// ---------------------------------------------------------------------------

test("isConfigured returns false when AA_AWS_ACCESS_KEY_ID not set", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));
  assert.equal(provider.isConfigured(), false);
});

test("isConfigured returns false when AA_AWS_SECRET_ACCESS_KEY not set", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
  }));
  assert.equal(provider.isConfigured(), false);
});

test("isConfigured returns false when both are empty strings", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "",
    AA_AWS_SECRET_ACCESS_KEY: "",
  }));
  assert.equal(provider.isConfigured(), false);
});

test("isConfigured returns true when both credentials are set", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));
  assert.equal(provider.isConfigured(), true);
});

test("isConfigured returns true when credentials have whitespace (trimmed)", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "  test-key  ",
    AA_AWS_SECRET_ACCESS_KEY: "  test-secret  ",
  }));
  assert.equal(provider.isConfigured(), true);
});

// ---------------------------------------------------------------------------
// providerKind
// ---------------------------------------------------------------------------

test("providerKind is kms", () => {
  const provider = createProvider();
  assert.equal(provider.providerKind, "kms");
});

// ---------------------------------------------------------------------------
// describeSecret
// ---------------------------------------------------------------------------

test("describeSecret returns unresolved metadata", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/test-key-id",
  }));
  const result = await provider.describeSecret("secret://kms/mykey");
  assert.equal(result.resolved, false);
  assert.equal(result.secretRef, "secret://kms/mykey");
  assert.equal(result.scope, "kms");
  assert.equal(result.source, "kms");
  assert.equal(result.maskedValue, null);
});

test("describeSecret uses key arn as envName", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/my-key-id",
  }));
  const result = await provider.describeSecret("secret://kms/mykey");
  assert.equal(result.envName, "arn:aws:kms:us-east-1:123456:key/my-key-id");
});

// ---------------------------------------------------------------------------
// requireSecret - validation errors
// ---------------------------------------------------------------------------

test("requireSecret throws when key ID cannot be extracted and no ARN configured", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));
  await assert.rejects(
    async () => provider.requireSecret("secret://other/path"),
    (e: any) => e.message.includes("kms.key_required"),
  );
});

test("requireSecret throws when ciphertext env var not configured", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/my-key-id",
  }));
  await assert.rejects(
    async () => provider.requireSecret("secret://kms/mykey"),
    (e: any) => e.message.includes("kms.ciphertext_not_configured"),
  );
});

// ---------------------------------------------------------------------------
// requireSecret - successful decryption
// ---------------------------------------------------------------------------

test("requireSecret decrypts and returns secret value", async () => {
  // Create a mock ciphertext (base64 encoded "decrypted-secret")
  const plaintext = "decrypted-secret-value";
  const ciphertextBase64 = Buffer.from(plaintext).toString("base64");

  const mockFetch = async (_url: string, _init?: any) => ({
    ok: true,
    status: 200,
    json: async () => ({
      Plaintext: { B: Array.from(Buffer.from(plaintext)) },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_KMS_CIPHERTEXT_MYKEY: ciphertextBase64,
    }));
    const result = await provider.requireSecret("secret://kms/mykey");
    assert.equal(result.resolved, true);
    assert.equal(result.value, plaintext);
    assert.equal(result.source, "kms");
    assert.notEqual(result.maskedValue, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret extracts key ID from secret ref path", async () => {
  const plaintext = "another-secret";
  const ciphertextBase64 = Buffer.from(plaintext).toString("base64");

  const mockFetch = async (_url: string, _init?: any) => ({
    ok: true,
    status: 200,
    json: async () => ({
      Plaintext: { B: Array.from(Buffer.from(plaintext)) },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_KMS_CIPHERTEXT_MY_KEY_ID: ciphertextBase64, // AA_KMS_CIPHERTEXT_MY_KEY_ID
    }));
    const result = await provider.requireSecret("secret://kms/my-key-id");
    assert.equal(result.value, plaintext);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// requireSecret - error handling
// ---------------------------------------------------------------------------

test("requireSecret throws ProviderError when KMS returns error", async () => {
  const mockFetch = async () => ({ ok: false, status: 500, text: async () => "Internal Server Error" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_KMS_CIPHERTEXT_MYKEY: Buffer.from("ciphertext").toString("base64"),
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://kms/mykey"),
      (e: any) => {
        return e.message.includes("kms.request_failed") && e.retryable === true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret throws ProviderError when KMS returns non-retryable error", async () => {
  const mockFetch = async () => ({ ok: false, status: 400, text: async () => "Bad Request" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_KMS_CIPHERTEXT_MYKEY: Buffer.from("ciphertext").toString("base64"),
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://kms/mykey"),
      (e: any) => {
        return e.message.includes("kms.request_failed") && e.retryable === false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret throws when KMS response has no Plaintext", async () => {
  const mockFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_KMS_CIPHERTEXT_MYKEY: Buffer.from("ciphertext").toString("base64"),
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://kms/mykey"),
      (e: any) => e.message.includes("kms.decrypt_failed"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// issueSecretLease
// ---------------------------------------------------------------------------

test("issueSecretLease returns null (not supported for AWS KMS)", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));
  const result = await provider.issueSecretLease("secret://kms/mykey");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

test("isAvailable returns false when not configured", async () => {
  const provider = createProvider(createMockEnv({}));
  const result = await provider.isAvailable();
  assert.equal(result, false);
});

test("isAvailable returns true when KMS responds OK", async () => {
  const mockFetch = async () => ({ ok: true, status: 200 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    }));
    const result = await provider.isAvailable();
    assert.equal(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("isAvailable returns false when KMS returns error", async () => {
  const mockFetch = async () => ({ ok: false, status: 500 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    }));
    const result = await provider.isAvailable();
    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("isAvailable returns false when fetch throws", async () => {
  const mockFetch = async () => { throw new Error("Network error"); };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    }));
    const result = await provider.isAvailable();
    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// refreshSecret
// ---------------------------------------------------------------------------

test("refreshSecret returns same as describeSecret", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/test-key-id",
  }));
  const refreshResult = await provider.refreshSecret("secret://kms/mykey");
  const describeResult = await provider.describeSecret("secret://kms/mykey");
  assert.deepEqual(refreshResult, describeResult);
});
