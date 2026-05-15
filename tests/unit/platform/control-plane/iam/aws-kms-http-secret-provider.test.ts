import assert from "node:assert/strict";
import test from "node:test";

import { AwsKmsHttpSecretProvider } from "../../../../../src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.js";

// Helper to create a mock env
function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_AWS_ACCESS_KEY_ID: undefined,
    AA_AWS_SECRET_ACCESS_KEY: undefined,
    AA_AWS_SESSION_TOKEN: undefined,
    AA_AWS_REGION: undefined,
    AA_AWS_KMS_KEY_ARN: undefined,
    AA_AWS_KMS_ENDPOINT: undefined,
    AA_AWS_TIMEOUT_MS: undefined,
    ...overrides,
  };
}

// Helper to create provider with mock env
function createProvider(mockEnv: NodeJS.ProcessEnv): AwsKmsHttpSecretProvider {
  return new AwsKmsHttpSecretProvider({ env: mockEnv });
}

test("AwsKmsHttpSecretProvider.providerKind is kms", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.providerKind, "kms");
});

test("AwsKmsHttpSecretProvider.isConfigured returns false when AA_AWS_ACCESS_KEY_ID not set", () => {
  const provider = createProvider(createMockEnv({ AA_AWS_ACCESS_KEY_ID: undefined }));
  assert.equal(provider.isConfigured(), false);
});

test("AwsKmsHttpSecretProvider.isConfigured returns false when AA_AWS_ACCESS_KEY_ID is empty string", () => {
  const provider = createProvider(createMockEnv({ AA_AWS_ACCESS_KEY_ID: "" }));
  assert.equal(provider.isConfigured(), false);
});

test("AwsKmsHttpSecretProvider.isConfigured returns false when AA_AWS_ACCESS_KEY_ID is whitespace only", () => {
  const provider = createProvider(createMockEnv({ AA_AWS_ACCESS_KEY_ID: "   " }));
  assert.equal(provider.isConfigured(), false);
});

test("AwsKmsHttpSecretProvider.isConfigured returns false when AA_AWS_SECRET_ACCESS_KEY not set", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: undefined,
  }));
  assert.equal(provider.isConfigured(), false);
});

test("AwsKmsHttpSecretProvider.isConfigured returns false when AA_AWS_SECRET_ACCESS_KEY is empty string", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "",
  }));
  assert.equal(provider.isConfigured(), false);
});

test("AwsKmsHttpSecretProvider.isConfigured returns true when credentials are set", () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));
  assert.equal(provider.isConfigured(), true);
});

test("AwsKmsHttpSecretProvider.describeSecret returns unresolved metadata", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/xxx",
  }));

  const result = await provider.describeSecret("secret://kms/mykey");

  assert.equal(result.resolved, false);
  assert.equal(result.source, "kms");
  assert.equal(result.scope, "kms");
  assert.equal(result.secretRef, "secret://kms/mykey");
  assert.equal(result.maskedValue, null);
});

test("AwsKmsHttpSecretProvider.issueSecretLease returns null (not supported)", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));

  const result = await provider.issueSecretLease("secret://kms/mykey");

  assert.equal(result, null);
});

test("AwsKmsHttpSecretProvider.requireSecret throws ValidationError when key required but not found", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));

  try {
    await provider.requireSecret("secret://other/mykey");
    assert.fail("Should have thrown");
  } catch (error: any) {
    assert.ok(error.message.includes("kms.key_required"), `Expected kms.key_required error, got: ${error.message}`);
  }
});

test("AwsKmsHttpSecretProvider.isAvailable returns false when access key not set", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.isAvailable();

  assert.equal(result, false);
});

test("AwsKmsHttpSecretProvider.isAvailable returns true when KMS responds", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ Keys: [] }),
    };
  };

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

test("AwsKmsHttpSecretProvider.isAvailable returns false when KMS returns error", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 500 };
  };

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

test("AwsKmsHttpSecretProvider.describeSecret uses default envName when AA_AWS_KMS_KEY_ARN not set", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
  }));

  const result = await provider.describeSecret("secret://kms/mykey");

  assert.equal(result.envName, "AA_AWS_KMS_KEY_ARN");
});

test("AwsKmsHttpSecretProvider.requireSecret throws ValidationError when ciphertext env not set", async () => {
  const provider = createProvider(createMockEnv({
    AA_AWS_ACCESS_KEY_ID: "test-key",
    AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/test-key-id",
  }));

  try {
    await provider.requireSecret("secret://kms/test-key-id");
    assert.fail("Should have thrown");
  } catch (error: any) {
    assert.ok(error.message.includes("kms.ciphertext_not_configured"), `Expected kms.ciphertext_not_configured error, got: ${error.message}`);
  }
});

test("AwsKmsHttpSecretProvider.requireSecret returns secret value when ciphertext is configured", async () => {
  const ciphertext = Buffer.from("decrypted-secret-value").toString("base64");

  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        Plaintext: { B: Array.from(Buffer.from("decrypted-secret-value")) },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_AWS_REGION: "us-east-1",
      AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/test-key-id",
      AA_KMS_CIPHERTEXT_TEST_KEY_ID: ciphertext,
    }));

    const result = await provider.requireSecret("secret://kms/test-key-id");

    assert.equal(result.resolved, true);
    assert.equal(result.value, "decrypted-secret-value");
    assert.equal(result.source, "kms");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AwsKmsHttpSecretProvider.requireSecret throws ProviderError when KMS returns error", async () => {
  const ciphertext = Buffer.from("test").toString("base64");

  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "KMS service error",
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/xxx",
      AA_KMS_CIPHERTEXT_XXX: ciphertext,
    }));

    try {
      await provider.requireSecret("secret://kms/xxx");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("kms.request_failed"), `Expected kms.request_failed error, got: ${error.message}`);
      assert.equal(error.retryable, true, "Expected 5xx error to be retryable");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AwsKmsHttpSecretProvider.requireSecret throws ProviderError when Plaintext is missing from response", async () => {
  const ciphertext = Buffer.from("test").toString("base64");

  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/xxx",
      AA_KMS_CIPHERTEXT_XXX: ciphertext,
    }));

    try {
      await provider.requireSecret("secret://kms/xxx");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("kms.decrypt_failed"), `Expected kms.decrypt_failed error, got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AwsKmsHttpSecretProvider uses default region when AA_AWS_REGION not set", async () => {
  let capturedHost: string | null = null;
  const mockFetch = async (url: string, _init?: any) => {
    capturedHost = new URL(url).host;
    return { ok: true, status: 200 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
    }));

    await provider.isAvailable();

    assert.equal(capturedHost, "kms.us-east-1.amazonaws.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AwsKmsHttpSecretProvider uses configured region", async () => {
  let capturedHost: string | null = null;
  const mockFetch = async (url: string, _init?: any) => {
    capturedHost = new URL(url).host;
    return { ok: true, status: 200 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_AWS_ACCESS_KEY_ID: "test-key",
      AA_AWS_SECRET_ACCESS_KEY: "test-secret",
      AA_AWS_REGION: "eu-west-2",
    }));

    await provider.isAvailable();

    assert.equal(capturedHost, "kms.eu-west-2.amazonaws.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
