/**
 * Unit tests for GCP Secret Manager HTTP Secret Provider
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GcpSecretManagerHttpSecretProvider } from "../../../../../src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.js";

// Helper to create a mock env
function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_GCP_PROJECT_ID: undefined,
    AA_GCP_TOKEN: undefined,
    AA_GCP_TOKEN_FETCH_URL: undefined,
    AA_GCP_TIMEOUT_MS: undefined,
    ...overrides,
  };
}

// Helper to create provider with mock env
function createProvider(mockEnv: NodeJS.ProcessEnv): GcpSecretManagerHttpSecretProvider {
  return new GcpSecretManagerHttpSecretProvider({ env: mockEnv });
}

test("GcpSecretManagerHttpSecretProvider.isConfigured returns false when AA_GCP_PROJECT_ID not set", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: undefined }));
  assert.equal(provider.isConfigured(), false);
});

test("GcpSecretManagerHttpSecretProvider.isConfigured returns false when AA_GCP_PROJECT_ID is empty string", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "" }));
  assert.equal(provider.isConfigured(), false);
});

test("GcpSecretManagerHttpSecretProvider.isConfigured returns true when AA_GCP_PROJECT_ID is set", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
  assert.equal(provider.isConfigured(), true);
});

test("GcpSecretManagerHttpSecretProvider.isConfigured returns false when AA_GCP_PROJECT_ID is whitespace only", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "   " }));
  assert.equal(provider.isConfigured(), false);
});

test("GcpSecretManagerHttpSecretProvider.providerKind is secret_manager", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.providerKind, "secret_manager");
});

test("GcpSecretManagerHttpSecretProvider rejects unsafe token fetch URL", () => {
  assert.throws(
    () => createProvider(createMockEnv({
      AA_GCP_TOKEN_FETCH_URL: "ftp://attacker.example.com/token",
    })),
    /gcp_secret_manager\.invalid_token_fetch_url/,
  );
});

test("GcpSecretManagerHttpSecretProvider.describeSecret returns unresolved metadata", async () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));

  const result = await provider.describeSecret("secret://my-secret");

  assert.equal(result.resolved, false);
  assert.equal(result.source, "secret_manager");
  assert.equal(result.scope, "gcp");
  assert.equal(result.secretRef, "secret://my-secret");
  assert.equal(result.envName, "AA_GCP_PROJECT_ID");
});

test("GcpSecretManagerHttpSecretProvider.describeSecret works without project configured", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.describeSecret("secret://any-secret");

  assert.equal(result.resolved, false);
});

test("GcpSecretManagerHttpSecretProvider.refreshSecret clears token cache and returns metadata", async () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));

  const result = await provider.refreshSecret("secret://my-secret");

  assert.equal(result.secretRef, "secret://my-secret");
  assert.equal(result.resolved, false);
});

test("GcpSecretManagerHttpSecretProvider.issueSecretLease returns null (not supported)", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.issueSecretLease("secret://my-secret");

  assert.equal(result, null);
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ValidationError when project not configured", async () => {
  const provider = createProvider(createMockEnv({}));

  try {
    await provider.requireSecret("secret://my-secret");
    assert.fail("Should have thrown");
  } catch (error: any) {
    assert.ok(error.message.includes("gcp.config_missing"), `Expected config_missing error, got: ${error.message}`);
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret returns secret value when found", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("secret-value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.resolved, true);
    assert.equal(result.value, "secret-value");
    assert.equal(result.source, "secret_manager");
    assert.equal(result.scope, "gcp");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ValidationError when secret not found (404)", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 404 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://nonexistent");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("gcp.secret_not_found"), `Expected secret_not_found error, got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ProviderError for server errors (5xx)", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 503 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://my-secret");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("gcp.request_failed"), `Expected request_failed error, got: ${error.message}`);
      assert.equal(error.retryable, true, "Expected error to be retryable for 5xx");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ProviderError when payload is missing", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: {}, // missing data
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://my-secret");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("gcp.access_failed"), `Expected access_failed error, got: ${error.message}`);
      assert.equal(error.retryable, false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.isAvailable returns false when project not configured", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.isAvailable();

  assert.equal(result, false);
});

test("GcpSecretManagerHttpSecretProvider.isAvailable returns true when configured and token succeeds", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "test-token",
        expires_in: 3600,
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    const result = await provider.isAvailable();

    assert.equal(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.isAvailable returns false when token fetch fails", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 500 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
    }));

    const result = await provider.isAvailable();

    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret uses cached token on subsequent calls", async () => {
  let tokenCallCount = 0;
  let secretCallCount = 0;

  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      tokenCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "cached-token",
          expires_in: 3600,
        }),
      };
    }
    secretCallCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("secret-value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      // No explicit token - will use metadata service
    }));

    const result1 = await provider.requireSecret("secret://my-secret");
    assert.equal(result1.value, "secret-value");

    const result2 = await provider.requireSecret("secret://my-secret");
    assert.equal(result2.value, "secret-value");

    // Token should be fetched only once due to caching
    assert.equal(tokenCallCount, 1, "Token fetch should be called once due to caching");
    assert.equal(secretCallCount, 2, "Secret fetch should be called twice");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret uses explicit token when provided", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/token")) {
      throw new Error("Should not fetch token when explicit token is set");
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("explicit-token-secret").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-explicit-token",
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.value, "explicit-token-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret parses secret version from ref", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    // Should use version from URL
    assert.ok(url.includes("/versions/specific-version"), `Expected specific-version in URL, got: ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/specific-version",
        payload: { data: Buffer.from("versioned-secret").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    const result = await provider.requireSecret("secret://my-secret/versions/specific-version");

    assert.equal(result.value, "versioned-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret uses default latest version", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    // Should default to latest when no version specified
    assert.ok(url.includes("/versions/latest"), `Expected latest version in URL, got: ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("latest-secret").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.value, "latest-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.isAvailable returns false when fetch throws", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    throw new Error("Network error");
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
    }));

    const result = await provider.isAvailable();

    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider.requireSecret throws ProviderError for client errors (4xx except 404)", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 403 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://my-secret");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("gcp.request_failed"), `Expected request_failed error, got: ${error.message}`);
      assert.equal(error.retryable, false, "4xx should not be retryable");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider uses custom timeout when AA_GCP_TIMEOUT_MS is set", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("timeout-test").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
      AA_GCP_TIMEOUT_MS: "10000",
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.value, "timeout-test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider uses custom token fetch URL when configured", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("custom-token-url")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "custom-token",
          expires_in: 3600,
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("custom-url-secret").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN_FETCH_URL: "https://custom-token-url.example.com/token",
      // No AA_GCP_TOKEN, so it will try to fetch from custom URL
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.value, "custom-url-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GcpSecretManagerHttpSecretProvider requireSecret masks the returned value", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("super-secret-value").toString("base64") },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "test-token",
    }));

    const result = await provider.requireSecret("secret://my-secret");

    assert.equal(result.resolved, true);
    assert.equal(result.value, "super-secret-value");
    assert.ok(result.maskedValue !== result.value, "maskedValue should be different from actual value");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
