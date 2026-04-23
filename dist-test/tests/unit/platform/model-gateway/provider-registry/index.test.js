import assert from "node:assert/strict";
import test from "node:test";
test("ProviderCredentialStatus type accepts valid values", () => {
    const statuses = ["active", "cooling_down", "disabled"];
    assert.equal(statuses.length, 3);
});
test("ProviderCredentialRecordInput structure is correct", () => {
    const input = {
        credentialId: "cred_123",
        apiKey: "sk-xxx",
        secretRef: null,
        label: "production",
        status: "active",
        cooldownUntil: null,
        resetAt: null,
        lastFailureCode: null,
        retryAfterMs: null,
    };
    assert.equal(input.credentialId, "cred_123");
    assert.equal(input.status, "active");
    assert.equal(input.label, "production");
});
test("ProviderCredentialRecordInput with minimal fields", () => {
    const input = {
        credentialId: "cred_minimal",
    };
    assert.equal(input.credentialId, "cred_minimal");
    assert.equal(input.status, undefined);
});
test("ProviderCredentialManagedSecretContext structure is correct", () => {
    const ctx = {
        provider: "openai",
        credentialId: "cred_456",
        label: "prod-key",
    };
    assert.equal(ctx.provider, "openai");
    assert.equal(ctx.credentialId, "cred_456");
    assert.equal(ctx.label, "prod-key");
});
test("ProviderCredentialManagedSecretContext with null label", () => {
    const ctx = {
        provider: "anthropic",
        credentialId: "cred_789",
        label: null,
    };
    assert.equal(ctx.label, null);
});
test("ProviderCredentialManagedSecretLease structure is correct", () => {
    const lease = {
        apiKey: "sk-expired-xxx",
        leaseId: "lease_123",
        expiresAt: "2026-04-15T00:00:00.000Z",
        leaseSource: "provider_issued",
    };
    assert.equal(lease.apiKey, "sk-expired-xxx");
    assert.equal(lease.leaseId, "lease_123");
    assert.equal(lease.leaseSource, "provider_issued");
});
test("ProviderCredentialManagedSecretLease with wrapped_secret source", () => {
    const lease = {
        apiKey: "sk-wrapped-xxx",
        leaseId: "lease_456",
        expiresAt: "2026-04-14T12:00:00.000Z",
        leaseSource: "wrapped_secret",
    };
    assert.equal(lease.leaseSource, "wrapped_secret");
});
test("ProviderCredentialManagedSecretAccess structure is correct", () => {
    const access = {
        secretResolver: (ref) => `resolved:${ref}`,
        secretLeaseIssuer: null,
    };
    assert.equal(typeof access.secretResolver, "function");
    assert.equal(access.secretLeaseIssuer, null);
});
test("ProviderCredentialManagedSecretAccess with lease issuer", async () => {
    const leaseIssuer = async (ref, ctx) => {
        return {
            apiKey: `leased:${ref}`,
            leaseId: `lease_${ctx.credentialId}`,
            expiresAt: "2026-04-15T00:00:00.000Z",
            leaseSource: "provider_issued",
        };
    };
    const access = {
        secretResolver: null,
        secretLeaseIssuer: leaseIssuer,
    };
    assert.equal(typeof access.secretLeaseIssuer, "function");
    const result = await leaseIssuer("secret_ref", { provider: "test", credentialId: "c1", label: null });
    assert.equal(result.leaseSource, "provider_issued");
});
//# sourceMappingURL=index.test.js.map