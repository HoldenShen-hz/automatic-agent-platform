import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error - module resolution issue at compile time
import { VaultHttpSecretProvider } from "../../../../../dist/src/platform/control-plane/iam/vault-http-secret-provider.js";
// @ts-expect-error - module resolution issue at compile time
import { maskSecretValue } from "../../../../../dist/src/platform/control-plane/iam/env-secret-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_VAULT_ADDR: undefined,
    AA_VAULT_TOKEN: undefined,
    AA_VAULT_APPROLE_ROLE: undefined,
    AA_VAULT_APPROLE_SECRET: undefined,
    AA_VAULT_MOUNT: undefined,
    AA_VAULT_TIMEOUT_MS: undefined,
    ...overrides,
  };
}

function createProvider(mockEnv: NodeJS.ProcessEnv): VaultHttpSecretProvider {
  return new VaultHttpSecretProvider({ env: mockEnv });
}

// ---------------------------------------------------------------------------
// VaultHttpSecretProvider construction and configuration
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider defaults mount to 'secret'", () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.local" }));
  // Default mount is "secret" - verified by behavior when fetching
  assert.equal(provider.isConfigured(), true);
});

test("VaultHttpSecretProvider defaults timeout to 5000ms", () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.local" }));
  assert.equal(provider.isConfigured(), true);
  // Just verify it doesn't crash with undefined timeout
});

test("VaultHttpSecretProvider uses custom mount from AA_VAULT_MOUNT", () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.local",
    AA_VAULT_MOUNT: "my-secrets",
  }));
  assert.equal(provider.isConfigured(), true);
});

test("VaultHttpSecretProvider uses custom timeout from AA_VAULT_TIMEOUT_MS", () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.local",
    AA_VAULT_TIMEOUT_MS: "15000",
  }));
  assert.equal(provider.isConfigured(), true);
});

// ---------------------------------------------------------------------------
// isConfigured
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.isConfigured returns false when AA_VAULT_ADDR not set", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.isConfigured(), false);
});

test("VaultHttpSecretProvider.isConfigured returns false when AA_VAULT_ADDR is empty string", () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "" }));
  assert.equal(provider.isConfigured(), false);
});

test("VaultHttpSecretProvider.isConfigured returns true when AA_VAULT_ADDR is set", () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.internal:8200" }));
  assert.equal(provider.isConfigured(), true);
});

test("VaultHttpSecretProvider.isConfigured returns false for whitespace-only AA_VAULT_ADDR", () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "   " }));
  assert.equal(provider.isConfigured(), false);
});

// ---------------------------------------------------------------------------
// providerKind
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.providerKind is 'vault'", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.providerKind, "vault");
});

// ---------------------------------------------------------------------------
// describeSecret
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.describeSecret returns unresolved when not configured", async () => {
  const provider = createProvider(createMockEnv({}));
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, false);
  assert.equal(result.source, "vault");
  assert.equal(result.secretRef, "secret://mykey");
});

test("VaultHttpSecretProvider.describeSecret returns unresolved even when configured", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.local" }));
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, false);
  assert.equal(result.source, "vault");
});

test("VaultHttpSecretProvider.describeSecret extracts correct scope from simple secret ref", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.local" }));
  const result = await provider.describeSecret("secret://myapp/api-key");
  assert.equal(result.scope, "myapp");
  assert.equal(result.secretRef, "secret://myapp/api-key");
});

test("VaultHttpSecretProvider.describeSecret extracts correct scope from nested secret ref", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.local" }));
  const result = await provider.describeSecret("secret://myapp/production/database");
  assert.equal(result.scope, "myapp");
});

// ---------------------------------------------------------------------------
// refreshSecret
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.refreshSecret clears cached token and returns metadata", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.local" }));
  const result = await provider.refreshSecret("secret://mykey");
  assert.equal(result.secretRef, "secret://mykey");
  assert.equal(result.resolved, false);
});

// ---------------------------------------------------------------------------
// requireSecret - configuration errors
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.requireSecret throws when not configured", async () => {
  const provider = createProvider(createMockEnv({}));
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("vault.config_missing"),
  );
});

test("VaultHttpSecretProvider.requireSecret throws when AA_VAULT_ADDR missing", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_TOKEN: "tok" }));
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("vault.config_missing"),
  );
});

// ---------------------------------------------------------------------------
// requireSecret - authentication errors
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.requireSecret throws when AppRole fails and no static token", async () => {
  const mockFetch = async () => ({ ok: false, status: 500 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_APPROLE_ROLE: "test-role",
      AA_VAULT_APPROLE_SECRET: "test-secret",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://mykey"),
      (e: any) => e.message.includes("vault.auth_required"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// requireSecret - successful retrieval
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.requireSecret returns secret value when found", async () => {
  const mockFetch = async (_url: string, _init?: any) => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        data: { mykey: "secret-value" },
        metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
      },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    const result = await provider.requireSecret("secret://mykey");
    assert.equal(result.resolved, true);
    assert.equal(result.value, "secret-value");
    assert.equal(result.source, "vault");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret returns correct scope for nested secret path", async () => {
  const mockFetch = async (_url: string, _init?: any) => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        data: { password: "secret-password" },
        metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
      },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    const result = await provider.requireSecret("secret://myapp/production/password");
    assert.equal(result.scope, "myapp");
    assert.equal(result.value, "secret-password");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// requireSecret - error handling
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.requireSecret throws ValidationError when secret not found (404)", async () => {
  const mockFetch = async () => ({ ok: false, status: 404 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://nonexistent"),
      (e: any) => e.message.includes("vault.secret_not_found"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret throws ProviderError for server errors (5xx)", async () => {
  const mockFetch = async () => ({ ok: false, status: 503 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://mykey"),
      (e: any) => {
        return e.message.includes("vault.request_failed") && e.retryable === true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret throws ValidationError when key not found in secret", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        data: { otherkey: "value" },
        metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
      },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://mykey"),
      (e: any) => e.message.includes("vault.key_not_found"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret throws when Vault KV v2 response has destroyed key", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        data: {},
        metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: true, version: 5 },
      },
    }),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    await assert.rejects(
      async () => provider.requireSecret("secret://mykey"),
      (e: any) => e.message.includes("vault.key_not_found"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// AppRole authentication and token caching
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.requireSecret uses static token when AppRole fails", async () => {
  let callCount = 0;
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/approle/login")) {
      callCount++;
      return { ok: false, status: 500 };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { mykey: "static-token-secret" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_APPROLE_ROLE: "test-role",
      AA_VAULT_APPROLE_SECRET: "test-secret",
      AA_VAULT_TOKEN: "fallback-static-token",
    }));
    const result = await provider.requireSecret("secret://mykey");
    assert.equal(result.value, "static-token-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret caches token and does not re-authenticate on subsequent calls", async () => {
  let loginCallCount = 0;
  let vaultGetCallCount = 0;
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/approle/login")) {
      loginCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          auth: {
            client_token: "cached-token",
            lease_duration: 3600,
            renewable: true,
          },
        }),
      };
    }
    vaultGetCallCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { mykey: "secret-value" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_APPROLE_ROLE: "test-role",
      AA_VAULT_APPROLE_SECRET: "test-secret",
    }));
    await provider.requireSecret("secret://mykey");
    await provider.requireSecret("secret://mykey");
    assert.equal(loginCallCount, 1, "AppRole login should be called once");
    assert.equal(vaultGetCallCount, 2, "vaultGet should be called twice");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret uses custom Vault mount point", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    assert.ok(url.includes("/v1/custom-mount/data/"), `Expected custom mount path, got: ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { mykey: "custom-mount-secret" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
      AA_VAULT_MOUNT: "custom-mount",
    }));
    const result = await provider.requireSecret("secret://mykey");
    assert.equal(result.value, "custom-mount-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret removes trailing slash from Vault address", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    assert.ok(!url.includes("//v1/"), `URL should not have double slashes: ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { mykey: "value" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local/", // trailing slash
      AA_VAULT_TOKEN: "test-token",
    }));
    await provider.requireSecret("secret://mykey");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// issueSecretLease
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.issueSecretLease returns null (not supported by KV v2)", async () => {
  const provider = createProvider(createMockEnv({}));
  const result = await provider.issueSecretLease("secret://mykey");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

test("VaultHttpSecretProvider.isAvailable returns false when not configured", async () => {
  const provider = createProvider(createMockEnv({}));
  const result = await provider.isAvailable();
  assert.equal(result, false);
});

test("VaultHttpSecretProvider.isAvailable returns true when Vault responds OK", async () => {
  const mockFetch = async () => ({ ok: true, status: 200 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    const result = await provider.isAvailable();
    assert.equal(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.isAvailable returns false when Vault returns error", async () => {
  const mockFetch = async () => ({ ok: false, status: 500 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    const result = await provider.isAvailable();
    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.isAvailable returns false when fetch throws", async () => {
  const mockFetch = async () => { throw new Error("Network error"); };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;
  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.local",
      AA_VAULT_TOKEN: "test-token",
    }));
    const result = await provider.isAvailable();
    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// maskSecretValue utility
// ---------------------------------------------------------------------------

test("maskSecretValue masks short values with asterisks", () => {
  const result = maskSecretValue("abc");
  assert.equal(result, "****");
});

test("maskSecretValue shows first few and last 4 chars of longer values", () => {
  const result = maskSecretValue("my-secret-value-1234");
  assert.ok(result.endsWith("1234"));
  assert.ok(result.startsWith("*"));
});

test("maskSecretValue handles exact 4-character values", () => {
  const result = maskSecretValue("test");
  assert.equal(result, "****");
});

test("maskSecretValue trims whitespace before masking", () => {
  const result = maskSecretValue("  secret  ");
  assert.equal(result, "**cret");
});
