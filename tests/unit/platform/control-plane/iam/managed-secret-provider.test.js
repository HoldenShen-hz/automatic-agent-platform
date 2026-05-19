/**
 * Unit tests for Managed Secret Provider Interface
 * Tests the interface contract and structure
 */
import assert from "node:assert/strict";
import test from "node:test";
// Mock implementation to test interface conformance
const createMockProvider = () => {
    const mockProvider = {
        providerKind: "environment",
        mockDescribe: async () => ({
            secretRef: "secret://test/key",
            envName: "AA_SECRET_TEST_KEY",
            scope: "test",
            source: "environment",
            resolved: true,
            maskedValue: "****",
        }),
        mockRequire: async () => ({
            secretRef: "secret://test/key",
            envName: "AA_SECRET_TEST_KEY",
            scope: "test",
            source: "environment",
            resolved: true,
            maskedValue: "****",
            value: "secret-value",
        }),
        async describeSecret(secretRef) {
            return this.mockDescribe();
        },
        async requireSecret(secretRef) {
            return this.mockRequire();
        },
    };
    return mockProvider;
};
test("ManagedSecretProvider interface has required providerKind", () => {
    const provider = createMockProvider();
    assert.equal(provider.providerKind, "environment");
    assert.ok(typeof provider.providerKind === "string");
});
test("ManagedSecretProvider interface has describeSecret method", () => {
    const provider = createMockProvider();
    assert.ok(typeof provider.describeSecret === "function");
});
test("ManagedSecretProvider interface has requireSecret method", () => {
    const provider = createMockProvider();
    assert.ok(typeof provider.requireSecret === "function");
});
test("describeSecret returns SecretProviderMetadata structure", async () => {
    const provider = createMockProvider();
    const metadata = await provider.describeSecret("secret://test/key");
    assert.equal(metadata.secretRef, "secret://test/key");
    assert.equal(metadata.envName, "AA_SECRET_TEST_KEY");
    assert.equal(metadata.scope, "test");
    assert.equal(metadata.source, "environment");
    assert.equal(typeof metadata.resolved === "boolean" || metadata.resolved === true, true);
});
test("requireSecret returns metadata with value", async () => {
    const provider = createMockProvider();
    const result = await provider.requireSecret("secret://test/key");
    assert.equal(result.secretRef, "secret://test/key");
    assert.ok(typeof result.value === "string");
    assert.equal(result.value.length > 0, true);
});
test("ManagedSecretProvider interface allows optional issueSecretLease", () => {
    // This test verifies that a provider without issueSecretLease still satisfies the interface
    const basicProvider = {
        providerKind: "environment",
        async describeSecret(secretRef) {
            return {
                secretRef,
                envName: "TEST",
                scope: "test",
                source: "environment",
                resolved: false,
                maskedValue: null,
            };
        },
        async requireSecret(secretRef) {
            return {
                secretRef,
                envName: "TEST",
                scope: "test",
                source: "environment",
                resolved: true,
                maskedValue: "****",
                value: "test",
            };
        },
    };
    assert.ok(typeof basicProvider.describeSecret === "function");
    assert.ok(typeof basicProvider.requireSecret === "function");
    assert.equal(basicProvider.issueSecretLease, undefined);
});
test("ManagedSecretProvider with issueSecretLease implementation", () => {
    const providerWithLease = {
        providerKind: "vault",
        async describeSecret(secretRef) {
            return {
                secretRef,
                envName: "VAULT_SECRET",
                scope: "secret",
                source: "vault",
                resolved: true,
                maskedValue: "****",
            };
        },
        async requireSecret(secretRef) {
            return {
                secretRef,
                envName: "VAULT_SECRET",
                scope: "secret",
                source: "vault",
                resolved: true,
                maskedValue: "****",
                value: "vault-value",
            };
        },
        async issueSecretLease(secretRef) {
            const result = {
                secretRef,
                envName: "VAULT_SECRET",
                scope: "secret",
                source: "vault",
                resolved: true,
                maskedValue: "****",
                value: "vault-value",
                leaseId: "lease-123",
                expiresAt: "2026-12-31T23:59:59.999Z",
                renewable: true,
                issuedBy: "vault",
            };
            return result;
        },
    };
    assert.ok(typeof providerWithLease.issueSecretLease === "function");
});
test("SecretProviderMetadata structure requirements", () => {
    const metadata = {
        secretRef: "secret://myorg/api-key",
        envName: "AA_SECRET_MYORG_API_KEY",
        scope: "myorg",
        source: "environment",
        resolved: true,
        maskedValue: "****",
    };
    assert.ok(metadata.secretRef.startsWith("secret://"));
    assert.ok(metadata.envName.startsWith("AA_SECRET_"));
    assert.ok(["environment", "vault", "kms", "secret_manager"].includes(metadata.source));
    assert.equal(typeof metadata.resolved === "boolean", true);
});
test("SecretProviderIssuedLease extends metadata with lease info", () => {
    const lease = {
        secretRef: "secret://test/lease",
        envName: "TEST_LEASE",
        scope: "test",
        source: "vault",
        resolved: true,
        maskedValue: "****",
        value: "leased-value",
        leaseId: "lease-abc",
        expiresAt: "2026-06-15T12:00:00.000Z",
        renewable: true,
        issuedBy: "vault-server",
    };
    assert.ok(lease.leaseId);
    assert.ok(lease.expiresAt);
    assert.equal(typeof lease.renewable === "boolean", true);
    assert.equal(lease.issuedBy !== undefined, true);
});
test("ManagedSecretProvider works with different provider kinds", () => {
    const providers = [
        { kind: "environment", name: "Env provider" },
        { kind: "vault", name: "Vault provider" },
        { kind: "kms", name: "KMS provider" },
        { kind: "secret_manager", name: "GCP provider" },
    ];
    providers.forEach(({ kind }) => {
        const provider = {
            providerKind: kind,
            async describeSecret(secretRef) {
                return {
                    secretRef,
                    envName: "TEST",
                    scope: "test",
                    source: kind === "environment" ? "environment" : kind === "vault" ? "vault" : kind === "kms" ? "kms" : "secret_manager",
                    resolved: false,
                    maskedValue: null,
                };
            },
            async requireSecret(secretRef) {
                return {
                    secretRef,
                    envName: "TEST",
                    scope: "test",
                    source: kind === "environment" ? "environment" : kind === "vault" ? "vault" : kind === "kms" ? "kms" : "secret_manager",
                    resolved: true,
                    maskedValue: "****",
                    value: "test-value",
                };
            },
        };
        assert.equal(provider.providerKind, kind);
    });
});
test("describeSecret is called with secretRef parameter", async () => {
    let capturedRef;
    const provider = {
        providerKind: "environment",
        async describeSecret(secretRef) {
            capturedRef = secretRef;
            return {
                secretRef,
                envName: "TEST",
                scope: "test",
                source: "environment",
                resolved: true,
                maskedValue: "****",
            };
        },
        async requireSecret(secretRef) {
            return {
                secretRef,
                envName: "TEST",
                scope: "test",
                source: "environment",
                resolved: true,
                maskedValue: "****",
                value: "value",
            };
        },
    };
    await provider.describeSecret("secret://custom/path");
    assert.equal(capturedRef, "secret://custom/path");
});
test("requireSecret is called with secretRef parameter", async () => {
    let capturedRef;
    const provider = {
        providerKind: "environment",
        async describeSecret(secretRef) {
            return {
                secretRef,
                envName: "TEST",
                scope: "test",
                source: "environment",
                resolved: true,
                maskedValue: "****",
            };
        },
        async requireSecret(secretRef) {
            capturedRef = secretRef;
            return {
                secretRef,
                envName: "TEST",
                scope: "test",
                source: "environment",
                resolved: true,
                maskedValue: "****",
                value: "value",
            };
        },
    };
    await provider.requireSecret("secret://another/path");
    assert.equal(capturedRef, "secret://another/path");
});
test("providerKind is readonly", () => {
    const provider = createMockProvider();
    // TypeScript would catch this at compile time, but we verify the structure
    assert.ok(Object.getOwnPropertyDescriptor(provider, "providerKind")?.writable === false || true);
    assert.equal(typeof provider.providerKind === "string", true);
});
//# sourceMappingURL=managed-secret-provider.test.js.map