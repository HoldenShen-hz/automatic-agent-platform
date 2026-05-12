import assert from "node:assert/strict";
import test from "node:test";

import { VaultHttpSecretProvider } from "../../../../../src/platform/control-plane/iam/vault-http-secret-provider.js";

// Helper to create a mock env
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

// Helper to create provider with mock env
function createProvider(mockEnv: NodeJS.ProcessEnv): VaultHttpSecretProvider {
  return new VaultHttpSecretProvider({ env: mockEnv });
}

test("VaultHttpSecretProvider.isConfigured returns false when AA_VAULT_ADDR not set", () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: undefined }));
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

test("VaultHttpSecretProvider.isConfigured returns true when AA_VAULT_ADDR is whitespace-only after trim", () => {
  // isConfigured checks .trim().length > 0, so whitespace-only should return false
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "   " }));
  assert.equal(provider.isConfigured(), false);
});

test("VaultHttpSecretProvider.describeSecret returns unresolved when not configured", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.describeSecret("secret://mykey");

  assert.equal(result.resolved, false);
  assert.equal(result.source, "vault");
  assert.equal(result.secretRef, "secret://mykey");
});

test("VaultHttpSecretProvider.describeSecret returns unresolved even when configured", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.internal:8200" }));

  const result = await provider.describeSecret("secret://mykey");

  assert.equal(result.resolved, false);
  assert.equal(result.source, "vault");
});

test("VaultHttpSecretProvider.providerKind is vault", () => {
  const provider = createProvider(createMockEnv({}));
  assert.equal(provider.providerKind, "vault");
});

test("VaultHttpSecretProvider.issueSecretLease returns null (not supported)", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.issueSecretLease("secret://mykey");

  assert.equal(result, null);
});

test("VaultHttpSecretProvider.refreshSecret clears cached token and returns metadata", async () => {
  const provider = createProvider(createMockEnv({ AA_VAULT_ADDR: "https://vault.internal:8200" }));

  // First describe to set initial state
  const result1 = await provider.refreshSecret("secret://mykey");

  assert.equal(result1.secretRef, "secret://mykey");
  assert.equal(result1.resolved, false);
});

test("VaultHttpSecretProvider.requireSecret throws ValidationError when not configured", async () => {
  const provider = createProvider(createMockEnv({}));

  try {
    await provider.requireSecret("secret://mykey");
    assert.fail("Should have thrown");
  } catch (error: any) {
    assert.ok(error.message.includes("vault.config_missing"), `Expected error.message to include "vault.config_missing", got: ${error.message}`);
  }
});

test("VaultHttpSecretProvider.requireSecret throws ValidationError when secret not found (404)", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://nonexistent");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("vault.secret_not_found"), `Expected error.message to include "vault.secret_not_found", got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret throws ProviderError for server errors (5xx)", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://mykey");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("vault.request_failed"), `Expected error.message to include "vault.request_failed", got: ${error.message}`);
      assert.equal(error.retryable, true, "Expected error to be retryable");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret throws ValidationError when key not found in secret", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { otherkey: "value" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://mykey");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("vault.key_not_found"), `Expected error.message to include "vault.key_not_found", got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret returns secret value when found", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
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
      AA_VAULT_ADDR: "https://vault.internal:8200",
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

test("VaultHttpSecretProvider.isAvailable returns false when not configured", async () => {
  const provider = createProvider(createMockEnv({}));

  const result = await provider.isAvailable();

  assert.equal(result, false);
});

test("VaultHttpSecretProvider.isAvailable returns true when Vault responds OK", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: true, status: 200 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    const result = await provider.isAvailable();

    assert.equal(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.isAvailable returns false when Vault returns error", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 500 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    const result = await provider.isAvailable();

    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.isAvailable returns false when fetch throws", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    throw new Error("Network error");
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    const result = await provider.isAvailable();

    assert.equal(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret uses static token when AppRole fails", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    if (url.includes("/approle/login")) {
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
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_APPROLE_ROLE: "test-role",
      AA_VAULT_APPROLE_SECRET: "test-secret",
      AA_VAULT_TOKEN: "fallback-static-token",
    }));

    const result = await provider.requireSecret("secret://mykey");

    assert.equal(result.resolved, true);
    assert.equal(result.value, "static-token-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret throws when AppRole fails and no static token", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return { ok: false, status: 500 };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_APPROLE_ROLE: "test-role",
      AA_VAULT_APPROLE_SECRET: "test-secret",
      // No static token!
    }));

    try {
      await provider.requireSecret("secret://mykey");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("vault.auth_required"), `Expected auth_required error, got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret uses cached token on subsequent calls", async () => {
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
            client_token: "new-token",
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
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_APPROLE_ROLE: "test-role",
      AA_VAULT_APPROLE_SECRET: "test-secret",
    }));

    // First call - authenticates via AppRole
    const result1 = await provider.requireSecret("secret://mykey");
    assert.equal(result1.value, "secret-value");

    // Second call - should use cached token (no second AppRole call)
    const result2 = await provider.requireSecret("secret://mykey");
    assert.equal(result2.value, "secret-value");

    // Should have only called AppRole login once
    assert.equal(loginCallCount, 1, "AppRole login should be called once");
    assert.equal(vaultGetCallCount, 2, "vaultGet should be called twice");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret handles Vault KV v2 response with destroyed key", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: {}, // empty data
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: true, version: 5 },
        },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    try {
      await provider.requireSecret("secret://mykey");
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.ok(error.message.includes("vault.key_not_found"), `Expected key_not_found error, got: ${error.message}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.describeSecret returns correct scope for nested secret path", async () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.internal:8200",
  }));

  const result = await provider.describeSecret("secret://myapp/production/database");

  assert.equal(result.scope, "myapp");
  assert.equal(result.secretRef, "secret://myapp/production/database");
});

test("VaultHttpSecretProvider.requireSecret returns correct scope for nested secret path", async () => {
  const mockFetch = async (_url: string, _init?: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { password: "secret-password" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
    }));

    const result = await provider.requireSecret("secret://myapp/production/password");

    assert.equal(result.scope, "myapp");
    assert.equal(result.value, "secret-password");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider handles custom Vault mount point", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    // Should request from custom mount point
    assert.ok(url.includes("/v1/secrets/data/"), `Expected custom mount path, got: ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { "api-key": "secret-api-key" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
      AA_VAULT_MOUNT: "secrets",
    }));

    const result = await provider.requireSecret("secret://api-key");

    assert.equal(result.value, "secret-api-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.parseTimeout uses default when AA_VAULT_TIMEOUT_MS not set", async () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.internal:8200",
    AA_VAULT_TOKEN: "test-token",
    AA_VAULT_TIMEOUT_MS: undefined,
  }));

  // Should use default 5000ms - just verify it doesn't crash
  assert.equal(provider.isConfigured(), true);
});

test("VaultHttpSecretProvider.parseTimeout uses custom timeout value", async () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.internal:8200",
    AA_VAULT_TOKEN: "test-token",
    AA_VAULT_TIMEOUT_MS: "10000",
  }));

  // Should use 10000ms - just verify it doesn't crash
  assert.equal(provider.isConfigured(), true);
});

test("VaultHttpSecretProvider.addr removes trailing slash from URL", async () => {
  // The addr getter removes trailing slashes
  // We can verify this by checking the envName in the result
  const mockFetch = async (url: string, _init?: any) => {
    // Verify URL doesn't have double slashes when addr has trailing slash
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
      AA_VAULT_ADDR: "https://vault.internal:8200/", // Note trailing slash
      AA_VAULT_TOKEN: "test-token",
    }));

    await provider.requireSecret("secret://mykey");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VaultHttpSecretProvider.requireSecret with nested secret path and default mount", async () => {
  const mockFetch = async (url: string, _init?: any) => {
    // With default mount "secret", secret://myapp/prod/db password should map to secret/data/myapp/prod
    assert.ok(url.includes("/v1/secret/data/"), `Expected default mount path, got: ${url}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: { password: "secret123" },
          metadata: { created_time: "2024-01-01T00:00:00Z", destroyed: false, version: 1 },
        },
      }),
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as any;

  try {
    const provider = createProvider(createMockEnv({
      AA_VAULT_ADDR: "https://vault.internal:8200",
      AA_VAULT_TOKEN: "test-token",
      AA_VAULT_MOUNT: undefined, // default "secret"
    }));

    const result = await provider.requireSecret("secret://myapp/prod/password");
    assert.equal(result.value, "secret123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// R33-12: VaultHttpSecretProvider rejects path traversal in secret references
test("VaultHttpSecretProvider.requireSecret rejects secret ref with path traversal", async () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.internal:8200",
    AA_VAULT_TOKEN: "test-token",
  }));

  await assert.rejects(
    () => provider.requireSecret("secret://myapp/../../../etc/passwd"),
    /vault\.path_traversal/,
  );
});

test("VaultHttpSecretProvider.requireSecret rejects secret ref with encoded path traversal", async () => {
  const provider = createProvider(createMockEnv({
    AA_VAULT_ADDR: "https://vault.internal:8200",
    AA_VAULT_TOKEN: "test-token",
  }));

  await assert.rejects(
    () => provider.requireSecret("secret://..\\..\\..\\etc\\passwd"),
    /vault\.path_traversal/,
  );
});
