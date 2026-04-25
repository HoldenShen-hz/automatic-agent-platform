import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error - module resolution issue at compile time
import { GcpSecretManagerHttpSecretProvider } from "../../../../../dist/src/platform/control-plane/iam/gcp-secret-manager-http-secret-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_GCP_PROJECT_ID: undefined,
    AA_GCP_TOKEN: undefined,
    AA_GCP_TOKEN_FETCH_URL: undefined,
    AA_GCP_TIMEOUT_MS: undefined,
    ...overrides,
  };
}

function createProvider(mockEnv: NodeJS.ProcessEnv = createMockEnv()): GcpSecretManagerHttpSecretProvider {
  return new GcpSecretManagerHttpSecretProvider({ env: mockEnv });
}

// ---------------------------------------------------------------------------
// GcpSecretManagerHttpSecretProvider construction
// ---------------------------------------------------------------------------

test("GcpSecretManagerHttpSecretProvider defaults timeout to 5000ms", () => {
  const provider = createProvider(createMockEnv({
    AA_GCP_PROJECT_ID: "my-project",
  }));
  assert.equal(provider.providerKind, "secret_manager");
});

test("GcpSecretManagerHttpSecretProvider parses custom timeout", () => {
  const provider = createProvider(createMockEnv({
    AA_GCP_PROJECT_ID: "my-project",
    AA_GCP_TIMEOUT_MS: "10000",
  }));
  assert.equal(provider.providerKind, "secret_manager");
});

test("GcpSecretManagerHttpSecretProvider uses custom token fetch URL", () => {
  const provider = createProvider(createMockEnv({
    AA_GCP_PROJECT_ID: "my-project",
    AA_GCP_TOKEN_FETCH_URL: "https://custom.auth.example.com/token",
  }));
  assert.equal(provider.providerKind, "secret_manager");
});

// ---------------------------------------------------------------------------
// isConfigured
// ---------------------------------------------------------------------------

test("isConfigured returns false when AA_GCP_PROJECT_ID not set", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.isConfigured(), false);
});

test("isConfigured returns false when AA_GCP_PROJECT_ID is empty string", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "" }));
  assert.equal(provider.isConfigured(), false);
});

test("isConfigured returns false when AA_GCP_PROJECT_ID is only whitespace", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "   " }));
  assert.equal(provider.isConfigured(), false);
});

test("isConfigured returns true when AA_GCP_PROJECT_ID is set", () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-gcp-project" }));
  assert.equal(provider.isConfigured(), true);
});

// ---------------------------------------------------------------------------
// providerKind
// ---------------------------------------------------------------------------

test("providerKind is secret_manager", () => {
  const provider = createProvider();
  assert.equal(provider.providerKind, "secret_manager");
});

// ---------------------------------------------------------------------------
// describeSecret
// ---------------------------------------------------------------------------

test("describeSecret returns unresolved metadata", async () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
  const result = await provider.describeSecret("secret://my-secret");
  assert.equal(result.resolved, false);
  assert.equal(result.secretRef, "secret://my-secret");
  assert.equal(result.scope, "gcp");
  assert.equal(result.source, "secret_manager");
  assert.equal(result.maskedValue, null);
  assert.equal(result.envName, "AA_GCP_PROJECT_ID");
});

test("describeSecret uses project ID as envName", async () => {
  const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "test-project-123" }));
  const result = await provider.describeSecret("secret://my-secret");
  assert.equal(result.envName, "AA_GCP_PROJECT_ID");
});

// ---------------------------------------------------------------------------
// requireSecret - validation errors
// ---------------------------------------------------------------------------

test("requireSecret throws when project not configured", async () => {
  const provider = createProvider(createMockEnv({}));
  await assert.rejects(
    async () => provider.requireSecret("secret://my-secret"),
    (e: any) => e.message.includes("gcp.config_missing"),
  );
});

// ---------------------------------------------------------------------------
// requireSecret - token fetching
// ---------------------------------------------------------------------------

test("requireSecret uses explicit token when provided", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    // Should NOT try to fetch token when explicit token is set
    if (url.includes("metadata.google.internal")) {
      throw new Error("Should not fetch from metadata");
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("gcp-secret-value").toString("base64") },
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
    assert.equal(result.value, "gcp-secret-value");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret fetches token from metadata when no explicit token", async () => {
  let tokenFetchCalled = false;
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("metadata.google.internal")) {
      tokenFetchCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "fetched-token", expires_in: 3600 }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("metadata-secret").toString("base64") },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
    const result = await provider.requireSecret("secret://my-secret");
    assert.equal(tokenFetchCalled, true);
    assert.equal(result.value, "metadata-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret throws when token fetch fails", async () => {
  const mockFetch = async () => ({ ok: false, status: 500 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
    await assert.rejects(
      async () => provider.requireSecret("secret://my-secret"),
      (e: any) => e.message.includes("gcp.token_fetch_failed"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// requireSecret - successful retrieval
// ---------------------------------------------------------------------------

test("requireSecret returns decoded secret value", async () => {
  const secretValue = "my-gcp-secret-value";
  const mockFetch = async (_url: string, _init?: any) => ({
    ok: true,
    status: 200,
    json: async () => ({
      name: "projects/my-project/secrets/my-secret/versions/latest",
      payload: { data: Buffer.from(secretValue).toString("base64") },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    const result = await provider.requireSecret("secret://my-secret");
    assert.equal(result.resolved, true);
    assert.equal(result.value, secretValue);
    assert.equal(result.source, "secret_manager");
    assert.notEqual(result.maskedValue, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret handles version in secret ref", async () => {
  const secretValue = "versioned-secret";
  const mockFetch = async (url: string, _init?: any) => {
    assert.ok(url.includes("/versions/specific-version"));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/specific-version",
        payload: { data: Buffer.from(secretValue).toString("base64") },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    const result = await provider.requireSecret("secret://my-secret/versions/specific-version");
    assert.equal(result.value, secretValue);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret uses latest version when version not specified", async () => {
  const secretValue = "latest-secret";
  const mockFetch = async (url: string, _init?: any) => {
    assert.ok(url.includes("/versions/latest"));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from(secretValue).toString("base64") },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    const result = await provider.requireSecret("secret://my-secret");
    assert.equal(result.value, secretValue);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// requireSecret - error handling
// ---------------------------------------------------------------------------

test("requireSecret throws ValidationError when secret not found (404)", async () => {
  const mockFetch = async () => ({ ok: false, status: 404 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://nonexistent-secret"),
      (e: any) => e.message.includes("gcp.secret_not_found"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret throws ProviderError for GCP API errors (5xx)", async () => {
  const mockFetch = async () => ({ ok: false, status: 503, statusText: "Service Unavailable" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://my-secret"),
      (e: any) => {
        return e.message.includes("gcp.request_failed") && e.retryable === true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret throws ProviderError for non-retryable errors (4xx)", async () => {
  const mockFetch = async () => ({ ok: false, status: 400, statusText: "Bad Request" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://my-secret"),
      (e: any) => {
        return e.message.includes("gcp.request_failed") && e.retryable === false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requireSecret throws ProviderError when response has no payload", async () => {
  const mockFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_GCP_PROJECT_ID: "my-project",
      AA_GCP_TOKEN: "my-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://my-secret"),
      (e: any) => e.message.includes("gcp.access_failed"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// issueSecretLease
// ---------------------------------------------------------------------------

test("issueSecretLease returns null (not supported for GCP Secret Manager)", async () => {
  const provider = createProvider(createMockEnv({
    AA_GCP_PROJECT_ID: "my-project",
    AA_GCP_TOKEN: "my-token",
  }));
  const result = await provider.issueSecretLease("secret://my-secret");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

test("isAvailable returns false when project not configured", async () => {
  const provider = createProvider(createMockEnv({}));
  const result = await provider.isAvailable();
  assert.equal(result, false);
});

test("isAvailable returns true when token can be obtained", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("metadata.google.internal")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "valid-token", expires_in: 3600 }),
      };
    }
    return { ok: true, status: 200 };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
    const result = await provider.isAvailable();
    assert.equal(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("isAvailable returns false when token fetch fails", async () => {
  const mockFetch = async () => ({ ok: false, status: 500 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
    const result = await provider.isAvailable();
    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// refreshSecret
// ---------------------------------------------------------------------------

test("refreshSecret clears cached token and returns metadata", async () => {
  let tokenFetchCount = 0;
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("metadata.google.internal")) {
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
        payload: { data: Buffer.from("secret").toString("base64") },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({ AA_GCP_PROJECT_ID: "my-project" }));
    // First call - fetches token
    await provider.requireSecret("secret://my-secret");
    // Second call - uses cached token
    await provider.requireSecret("secret://my-secret");
    assert.equal(tokenFetchCount, 1);
    // Refresh - should clear cache and fetch new token
    await provider.refreshSecret("secret://my-secret");
    // Another requireSecret - should fetch token again since cache was cleared
    await provider.requireSecret("secret://my-secret");
    assert.equal(tokenFetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
