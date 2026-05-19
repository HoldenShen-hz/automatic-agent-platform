import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ExternalSecretProvider } from "../../../../../src/platform/control-plane/iam/external-secret-provider.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";
test("external secret provider resolves provider-specific JSON mappings", async () => {
    const provider = new ExternalSecretProvider({
        providerKind: "vault",
        env: {
            AA_VAULT_SECRETS_JSON: JSON.stringify({
                "secret://system/registry/ghcr/prod": {
                    value: "vault-registry-token-123456",
                    locator: "vault://kv/release/prod/registry",
                },
            }),
        },
    });
    const metadata = await provider.describeSecret("secret://system/registry/ghcr/prod");
    assert.equal(metadata.source, "vault");
    assert.equal(metadata.resolved, true);
    assert.equal(metadata.envName, "vault://kv/release/prod/registry");
    assert.equal(metadata.maskedValue?.endsWith("3456"), true);
    const value = await provider.requireSecret("secret://system/registry/ghcr/prod");
    assert.equal(value.value, "vault-registry-token-123456");
});
test("external secret provider resolves provider-specific file mappings", async () => {
    const workspace = createTempWorkspace("aa-external-secret-provider-");
    const filePath = join(workspace, "kms-secrets.json");
    try {
        createFile(filePath, JSON.stringify({
            "secret://system/deploy/kubeconfig/prod": {
                value: "kms-deploy-token-abcdef",
                locator: "kms://projects/demo/locations/global/keyRings/main/cryptoKeys/deploy",
            },
        }));
        const provider = new ExternalSecretProvider({
            providerKind: "kms",
            env: {
                AA_KMS_SECRETS_FILE: filePath,
            },
        });
        const metadata = await provider.describeSecret("secret://system/deploy/kubeconfig/prod");
        assert.equal(metadata.source, "kms");
        assert.equal(metadata.resolved, true);
        assert.equal(metadata.envName, "kms://projects/demo/locations/global/keyRings/main/cryptoKeys/deploy");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("external secret provider fail-closes malformed provider config", async () => {
    const provider = new ExternalSecretProvider({
        providerKind: "secret_manager",
        env: {
            AA_SECRET_MANAGER_SECRETS_JSON: "{broken",
        },
    });
    await assert.rejects(() => provider.describeSecret("secret://system/registry/ghcr/prod"), /secret\.provider_config_invalid:secret_manager:AA_SECRET_MANAGER_SECRETS_JSON/);
});
test("external secret provider can issue provider-backed short-lived leases", async () => {
    const provider = new ExternalSecretProvider({
        providerKind: "vault",
        env: {
            AA_VAULT_SECRETS_JSON: JSON.stringify({
                "secret://system/registry/ghcr/prod": {
                    value: "vault-registry-token-123456",
                    locator: "vault://kv/release/prod/registry",
                    issued_lease: {
                        value: "vault-lease-token-654321",
                        locator: "vault://lease/release/prod/registry",
                        lease_id: "vault-lease-001",
                        expires_at: "2099-01-01T00:00:00.000Z",
                        renewable: true,
                        issued_by: "vault.dynamic.release",
                    },
                },
            }),
        },
    });
    const lease = await provider.issueSecretLease("secret://system/registry/ghcr/prod");
    assert.equal(lease?.value, "vault-lease-token-654321");
    assert.equal(lease?.leaseId, "vault-lease-001");
    assert.equal(lease?.expiresAt, "2099-01-01T00:00:00.000Z");
    assert.equal(lease?.renewable, true);
    assert.equal(lease?.issuedBy, "vault.dynamic.release");
    assert.equal(lease?.envName, "vault://lease/release/prod/registry");
});
//# sourceMappingURL=external-secret-provider.test.js.map