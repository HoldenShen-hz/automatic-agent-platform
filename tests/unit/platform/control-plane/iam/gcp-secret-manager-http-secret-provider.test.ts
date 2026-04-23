import assert from "node:assert/strict";
import test from "node:test";

import { GcpSecretManagerHttpSecretProvider } from "../../../../../src/platform/control-plane/iam/gcp-secret-manager-http-secret-provider.js";

function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_GCP_PROJECT_ID: undefined,
    AA_GCP_TOKEN: undefined,
    AA_GCP_TOKEN_FETCH_URL: undefined,
    AA_GCP_TIMEOUT_MS: undefined,
    ...overrides,
  };
}

function createProvider(mockEnv: NodeJS.ProcessEnv): GcpSecretManagerHttpSecretProvider {
  return new GcpSecretManagerHttpSecretProvider({ env: mockEnv });
}

test("GcpSecretManagerHttpSecretProvider.providerKind is secret_manager", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.providerKind, "secret_manager");
});

test("GcpSecretManagerHttpSecretProvider.isConfigured returns false when AA_GCP_PROJECT_ID not set", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: undefined }));
  assert.equal(provider.isConfigured(), false);
});

test("GcpSecretManagerHttpSecretProvider.isConfigured returns false when AA_GCP_PROJECT_ID is empty string", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "" }));
  assert.equal(provider.isConfigured(), false);
});

test("GcpSecretManagerHttpSecretProvider.isConfigured returns true when project ID is set", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));
  assert.equal(provider.isConfigured(), true);
});

test("GcpSecretManagerHttpSecretProvider.describeSecret returns unresolved metadata", async () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

  const result = await provider.describeSecret("secret://my-secret");

  assert.equal(result.resolved, false);
  assert.equal(result.source, "secret_manager");
  assert.equal(result.scope, "gcp");
  assert.equal(result.secretRef, "secret://my-secret");
  assert.equal(result.maskedValue, null);
});

test("GcpSecretManagerHttpSecretProvider.issueSecretLease returns null (not supported)", async () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

  const result = await provider.issueSecretLease("secret://my-secret");

  assert.equal(result, null);
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ValidationError when project not configured", async () => {
  const provider = createProvider(createMockEnv({}));

  try {
    await provider.requireSecret("secret://my-secret");
    assert.fail("Should have thrown");
  } catch (error: any) {
    assert.ok(error.message.includes("gcp.config_missing"), `Expected gcp.config_missing error, got: ${error.message}`);
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret retrieves secret with explicit token", async () => {
  const mockFetch = async (url: string, init?: any) => {
    if (url.includes("/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "explicit-token", expires_in: 3600 }),
      };
    }
    assert.equal(init?.headers?.Authorization, "Bearer explicit-token");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-gcp-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("secret-value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-gcp-project",
      AA_GCP_TOKEN: "explicit-token",
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.resolved, true);
    assert.equal(result.value, "secret-value");
    assert.equal(result.source, "secret_manager");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ValidationError when secret not found (404)", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      };
    }
    return { ok: false, status: 404 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    try {
      await provider.requireSecret("secret://nonexistent");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("gcp.secret_not_found"), `Expected gcp.secret_not_found error, got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ProviderError for server errors (5xx)", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      };
    }
    return { ok: false, status: 503 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    try {
      await provider.requireSecret("secret://my-secret");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("gcp.request_failed"), `Expected gcp.request_failed error, got: ${error.message}`);
      assert.equal(error.retryable, true, "Expected 5xx error to be retryable");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.isAvailable returns false when project not set", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.isAvailable();

  assert.equal(result, false);
});

test("GcpSecretManagerHttpSecretProvider.isAvailable returns true when token can be obtained", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      };
    }
    return { ok: true, status: 200 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    const result = await provider.isAvailable();

    assert.equal(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.getToken uses cached token when valid", async () => {
  let tokenFetchCount = 0;
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      tokenFetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: `token-${tokenFetchCount}`, expires_in: 3600 }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-gcp-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    await provider.requireSecret("secret://my-secret");
    await provider.requireSecret("secret://my-secret");

    assert.equal(tokenFetchCount, 1, "Token should be fetched only once");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider uses default metadata service URL", async () => {
  let capturedUrl: string | null = null;
  const defaultMetadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

  const mockFetch = async (url: string, _init?: any) => {
    if (url === defaultMetadataUrl) {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "default-metadata-token", expires_in: 3600 }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-gcp-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    await provider.requireSecret("secret://my-secret");

    assert.equal(capturedUrl, defaultMetadataUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider includes Metadata-Flavor header when fetching token", async () => {
  let capturedHeaders: Record<string, string> | null = null;
  const mockFetch = async (url: string, init?: any) => {
    if (url.includes("/token")) {
      capturedHeaders = init?.headers ?? {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-gcp-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    await provider.requireSecret("secret://my-secret");

    assert.equal(capturedHeaders?.["Metadata-Flavor"], "Google");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret extracts secret name from reference without version", async () => {
  let capturedUrl: string | null = null;
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      };
    }
    capturedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-gcp-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));

    await provider.requireSecret("secret://my-secret");

    assert.ok(capturedUrl !== null && capturedUrl.includes("/secrets/my-secret/versions/latest"), `Expected latest version, got: ${capturedUrl}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
