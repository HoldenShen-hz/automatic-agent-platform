import assert from "node:assert/strict";
import test from "node:test";
import { ProviderCredentialPool } from "../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js";
function createCredential(overrides = {}) {
    return {
        credentialId: "cred_1",
        apiKey: "test-api-key",
        ...overrides,
    };
}
function createPool(credentials, options = {}) {
    return new ProviderCredentialPool({
        provider: options.provider ?? "test-provider",
        credentials,
        defaultCooldownMs: options.defaultCooldownMs ?? 60_000,
    });
}
test("ProviderCredentialPool constructor initializes with credentials", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
        createCredential({ credentialId: "cred_2", apiKey: "key-2" }),
    ]);
    const states = pool.getStates();
    assert.equal(states.length, 2);
    assert.equal(states[0].credentialId, "cred_1");
    assert.equal(states[1].credentialId, "cred_2");
});
test("ProviderCredentialPool constructor skips credentials with no apiKey or secretRef", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
        createCredential({ credentialId: "cred_2", apiKey: null, secretRef: null }),
        // cred_3 only has credentialId - apiKey defaults to "test-api-key", so it's NOT skipped
        createCredential({ credentialId: "cred_3", apiKey: null, secretRef: null }),
    ]);
    const states = pool.getStates();
    // cred_2 and cred_3 have both apiKey=null and secretRef=null, so they are skipped
    assert.equal(states.length, 1);
    assert.equal(states[0].credentialId, "cred_1");
});
test("ProviderCredentialPool.getProvider returns provider name", () => {
    const pool = createPool([], { provider: "openai" });
    assert.equal(pool.getProvider(), "openai");
});
test("ProviderCredentialPool.selectCredential returns first active credential", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
        createCredential({ credentialId: "cred_2", apiKey: "key-2" }),
    ]);
    const selection = await pool.selectCredential();
    assert.ok(selection);
    assert.equal(selection.credentialId, "cred_1");
    assert.equal(selection.apiKey, "key-1");
    assert.equal(selection.routeReason, "first_active_credential");
});
test("ProviderCredentialPool.selectCredential returns preferred credential when available", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
        createCredential({ credentialId: "cred_2", apiKey: "key-2" }),
    ]);
    const selection = await pool.selectCredential({ preferredCredentialId: "cred_2" });
    assert.ok(selection);
    assert.equal(selection.credentialId, "cred_2");
    assert.equal(selection.routeReason, "preferred_credential");
});
test("ProviderCredentialPool.selectCredential excludes specified credentials", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
        createCredential({ credentialId: "cred_2", apiKey: "key-2" }),
    ]);
    const selection = await pool.selectCredential({ excludeCredentialIds: ["cred_1"] });
    assert.ok(selection);
    assert.equal(selection.credentialId, "cred_2");
});
test("ProviderCredentialPool.selectCredential returns null when all excluded", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    const selection = await pool.selectCredential({ excludeCredentialIds: ["cred_1"] });
    assert.equal(selection, null);
});
test("ProviderCredentialPool.selectCredential returns null when no credentials", async () => {
    const pool = createPool([]);
    const selection = await pool.selectCredential();
    assert.equal(selection, null);
});
test("ProviderCredentialPool.markSuccess resets credential state", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    // Mark failure first (simulating a prior failure)
    pool.markFailure({
        credentialId: "cred_1",
        statusCode: 429,
        retryAfterMs: 5000,
    });
    // Verify it's in cooldown
    const statesBefore = pool.getStates();
    assert.equal(statesBefore[0].effectiveStatus, "cooling_down");
    // Mark success should reset
    const result = pool.markSuccess("cred_1");
    assert.ok(result);
    assert.equal(result.status, "active");
    assert.equal(result.cooldownUntil, null);
    assert.equal(result.lastFailureCode, null);
});
test("ProviderCredentialPool.markSuccess returns null for unknown credential", () => {
    const pool = createPool([]);
    const result = pool.markSuccess("unknown");
    assert.equal(result, null);
});
test("ProviderCredentialPool.markFailure with status 402 disables credential", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    const result = pool.markFailure({
        credentialId: "cred_1",
        statusCode: 402,
        errorCode: "payment_required",
    });
    assert.ok(result);
    assert.equal(result.status, "disabled");
    assert.equal(result.cooldownUntil, null);
});
test("ProviderCredentialPool.markFailure with status 429 enters cooldown", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    const result = pool.markFailure({
        credentialId: "cred_1",
        statusCode: 429,
        retryAfterMs: 10000,
    });
    assert.ok(result);
    assert.equal(result.status, "cooling_down");
    assert.ok(result.cooldownUntil != null);
});
test("ProviderCredentialPool.markFailure with 5xx enters cooldown", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    const result = pool.markFailure({
        credentialId: "cred_1",
        statusCode: 500,
    });
    assert.ok(result);
    assert.equal(result.status, "cooling_down");
});
test("ProviderCredentialPool.markFailure returns null for unknown credential", () => {
    const pool = createPool([]);
    const result = pool.markFailure({
        credentialId: "unknown",
        statusCode: 500,
    });
    assert.equal(result, null);
});
test("ProviderCredentialPool.getExhaustion returns credentials_missing when no credentials", () => {
    const pool = createPool([]);
    const exhaustion = pool.getExhaustion();
    assert.equal(exhaustion.reasonCode, "provider.credentials_missing");
});
test("ProviderCredentialPool.getExhaustion returns credentials_disabled when all disabled", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    pool.markFailure({ credentialId: "cred_1", statusCode: 402 });
    const exhaustion = pool.getExhaustion();
    assert.equal(exhaustion.reasonCode, "provider.credentials_disabled");
});
test("ProviderCredentialPool.getExhaustion returns credentials_cooling_down when all cooling", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    pool.markFailure({ credentialId: "cred_1", statusCode: 429, retryAfterMs: 60000 });
    const exhaustion = pool.getExhaustion();
    assert.equal(exhaustion.reasonCode, "provider.credentials_cooling_down");
});
test("ProviderCredentialPool.canFailoverAfter returns false for non-retryable status", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    // 400 (Bad Request) is not retryable
    const result = await pool.canFailoverAfter({ statusCode: 400 });
    assert.equal(result, false);
});
test("ProviderCredentialPool.canFailoverAfter returns true when another credential available", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
        createCredential({ credentialId: "cred_2", apiKey: "key-2" }),
    ]);
    // cred_1 has failed, check if we can failover to cred_2
    const result = await pool.canFailoverAfter({
        statusCode: 429,
        retryAfterMs: 5000,
        excludeCredentialIds: ["cred_1"],
    });
    assert.equal(result, true);
});
test("ProviderCredentialPool.dispose marks pool as disposed", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    pool.dispose();
    // After dispose, selectCredential should throw
    await assert.rejects(async () => pool.selectCredential(), (err) => err?.code === "provider.credential_pool.disposed");
});
test("ProviderCredentialPool.dispose is idempotent", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    pool.dispose();
    pool.dispose(); // Should not throw
    await assert.rejects(async () => pool.selectCredential(), (err) => err?.code === "provider.credential_pool.disposed");
});
test("ProviderCredentialPool.getStates returns effective status", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    // Initially active
    const states = pool.getStates();
    assert.equal(states[0].effectiveStatus, "active");
    assert.equal(states[0].available, true);
});
test("ProviderCredentialPool.fromEnvironment creates pool from env vars", () => {
    const pool = ProviderCredentialPool.fromEnvironment("test", {
        TEST_API_KEY: "env-key-1",
    });
    const states = pool.getStates();
    assert.equal(states.length, 1);
    assert.equal(states[0].credentialId, "test-default");
});
test("ProviderCredentialPool.selectCredential after cooldown returns credential", async () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ], { defaultCooldownMs: 100 });
    // Mark failure with short cooldown
    pool.markFailure({
        credentialId: "cred_1",
        statusCode: 429,
        retryAfterMs: 50,
    });
    // Should not be available yet
    const selection1 = await pool.selectCredential();
    assert.equal(selection1, null);
    // Wait for cooldown to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    // Now should work
    const selection2 = await pool.selectCredential({ now: new Date(Date.now() + 200).toISOString() });
    assert.ok(selection2);
    assert.equal(selection2.credentialId, "cred_1");
});
test("ProviderCredentialPool.releaseCredential returns record for unknown credential", () => {
    const pool = createPool([
        createCredential({ credentialId: "cred_1", apiKey: "key-1" }),
    ]);
    // releaseCredential with unknown credential returns null
    const result = pool.releaseCredential({ credentialId: "unknown", leaseId: "lease_123" });
    assert.equal(result, null);
});
//# sourceMappingURL=provider-credential-pool.test.js.map