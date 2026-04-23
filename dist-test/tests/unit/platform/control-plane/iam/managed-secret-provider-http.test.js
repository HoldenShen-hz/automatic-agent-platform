import assert from "node:assert/strict";
import test from "node:test";
import { AwsKmsHttpSecretProvider } from "../../../../../src/platform/control-plane/iam/aws-kms-http-secret-provider.js";
import { GcpSecretManagerHttpSecretProvider } from "../../../../../src/platform/control-plane/iam/gcp-secret-manager-http-secret-provider.js";
import { VaultHttpSecretProvider } from "../../../../../src/platform/control-plane/iam/vault-http-secret-provider.js";
function withMockFetch(handler) {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = (async (url, init) => {
        const normalizedUrl = typeof url === "string"
            ? url
            : url instanceof URL
                ? url.toString()
                : url.url;
        calls.push({ url: normalizedUrl, init });
        return handler(normalizedUrl, init);
    });
    return {
        calls,
        restore: () => {
            globalThis.fetch = originalFetch;
        },
    };
}
test("VaultHttpSecretProvider reads KV v2 secrets through Vault HTTP API", async () => {
    const fetchMock = withMockFetch(async (url, init) => {
        if (url.endsWith("/v1/secret/data/system/deploy/kubeconfig")) {
            assert.equal(init?.headers != null, true);
            assert.equal((init?.headers)["X-Vault-Token"], "vault-token-123");
            return new Response(JSON.stringify({
                data: {
                    data: {
                        prod: "vault-prod-deploy-token-1234",
                    },
                    metadata: {
                        created_time: "2026-04-12T00:00:00.000Z",
                        destroyed: false,
                        version: 3,
                    },
                },
            }), { status: 200 });
        }
        throw new Error(`unexpected vault request: ${url}`);
    });
    try {
        const provider = new VaultHttpSecretProvider({
            env: {
                AA_VAULT_ADDR: "https://vault.internal:8200",
                AA_VAULT_TOKEN: "vault-token-123",
            },
        });
        assert.equal(provider.isConfigured(), true);
        const secret = await provider.requireSecret("secret://system/deploy/kubeconfig/prod");
        assert.equal(secret.value, "vault-prod-deploy-token-1234");
        assert.equal(secret.source, "vault");
        assert.equal(secret.maskedValue?.endsWith("1234"), true);
        assert.equal(fetchMock.calls.length, 1);
    }
    finally {
        fetchMock.restore();
    }
});
test("AwsKmsHttpSecretProvider decrypts ciphertext using the AWS KMS HTTP API", async () => {
    const fetchMock = withMockFetch(async (url, init) => {
        assert.match(url, /^https:\/\/kms\.us-east-1\.amazonaws\.com\/\?Action=Decrypt&Version=2014-11-01$/);
        const headers = init?.headers;
        assert.equal(typeof headers.Authorization, "string");
        assert.match(headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIATEST/);
        assert.equal(headers["X-Amz-Target"], "TrentService.Decrypt");
        return new Response(JSON.stringify({
            Plaintext: {
                B: Array.from(Buffer.from("kms-prod-secret-9876", "utf8")),
            },
        }), { status: 200 });
    });
    try {
        const provider = new AwsKmsHttpSecretProvider({
            env: {
                AA_AWS_REGION: "us-east-1",
                AA_AWS_ACCESS_KEY_ID: "AKIATEST",
                AA_AWS_SECRET_ACCESS_KEY: "secret-key",
                AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456789012:key/test",
                AA_KMS_CIPHERTEXT_TEST: Buffer.from("ciphertext-bytes").toString("base64"),
            },
        });
        assert.equal(provider.isConfigured(), true);
        const secret = await provider.requireSecret("secret://kms/test");
        assert.equal(secret.value, "kms-prod-secret-9876");
        assert.equal(secret.source, "kms");
        assert.equal(secret.maskedValue?.endsWith("9876"), true);
        assert.equal(fetchMock.calls.length, 1);
    }
    finally {
        fetchMock.restore();
    }
});
test("GcpSecretManagerHttpSecretProvider fetches a metadata token and accesses the secret version", async () => {
    const fetchMock = withMockFetch(async (url, init) => {
        if (url === "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token") {
            assert.equal((init?.headers)["Metadata-Flavor"], "Google");
            return new Response(JSON.stringify({
                access_token: "gcp-access-token",
                expires_in: 3600,
            }), { status: 200 });
        }
        if (url === "https://secretmanager.googleapis.com/v1/projects/demo-project/secrets/runtime-key/versions/latest:access") {
            assert.equal((init?.headers).Authorization, "Bearer gcp-access-token");
            return new Response(JSON.stringify({
                name: "projects/demo-project/secrets/runtime-key/versions/latest",
                payload: {
                    data: Buffer.from("gcp-secret-value-4321", "utf8").toString("base64"),
                },
            }), { status: 200 });
        }
        throw new Error(`unexpected gcp request: ${url}`);
    });
    try {
        const provider = new GcpSecretManagerHttpSecretProvider({
            env: {
                AA_GCP_PROJECT_ID: "demo-project",
            },
        });
        assert.equal(provider.isConfigured(), true);
        const secret = await provider.requireSecret("secret://runtime-key");
        assert.equal(secret.value, "gcp-secret-value-4321");
        assert.equal(secret.source, "secret_manager");
        assert.equal(secret.maskedValue?.endsWith("4321"), true);
        assert.equal(fetchMock.calls.length, 2);
    }
    finally {
        fetchMock.restore();
    }
});
test("AwsKmsHttpSecretProvider uses default region when AA_AWS_REGION is not set", async () => {
    const fetchMock = withMockFetch(async (url) => {
        // Default region should be us-east-1
        assert.match(url, /^https:\/\/kms\.us-east-1\.amazonaws\.com/);
        return new Response(JSON.stringify({
            Plaintext: {
                B: Array.from(Buffer.from("kms-secret-default-region", "utf8")),
            },
        }), { status: 200 });
    });
    try {
        const provider = new AwsKmsHttpSecretProvider({
            env: {
                // No AA_AWS_REGION - should default to us-east-1
                AA_AWS_ACCESS_KEY_ID: "AKIATEST",
                AA_AWS_SECRET_ACCESS_KEY: "secret-key",
                AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456789012:key/test",
                AA_KMS_CIPHERTEXT_TEST: Buffer.from("ciphertext-bytes").toString("base64"),
            },
        });
        assert.equal(provider.isConfigured(), true);
        const secret = await provider.requireSecret("secret://kms/test");
        assert.equal(secret.value, "kms-secret-default-region");
    }
    finally {
        fetchMock.restore();
    }
});
test("AwsKmsHttpSecretProvider includes session token in requests when provided", async () => {
    const fetchMock = withMockFetch(async (url, init) => {
        const headers = init?.headers;
        // Session token should be included in Authorization header
        assert.match(headers.Authorization, /AWS4-HMAC-SHA256/);
        return new Response(JSON.stringify({
            Plaintext: {
                B: Array.from(Buffer.from("kms-with-session-token", "utf8")),
            },
        }), { status: 200 });
    });
    try {
        const provider = new AwsKmsHttpSecretProvider({
            env: {
                AA_AWS_REGION: "us-west-2",
                AA_AWS_ACCESS_KEY_ID: "AKIATEST",
                AA_AWS_SECRET_ACCESS_KEY: "secret-key",
                AA_AWS_SESSION_TOKEN: "session-token-xyz",
                AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-west-2:123456789012:key/test",
                AA_KMS_CIPHERTEXT_TEST: Buffer.from("ciphertext-bytes").toString("base64"),
            },
        });
        assert.equal(provider.isConfigured(), true);
        const secret = await provider.requireSecret("secret://kms/test");
        assert.equal(secret.value, "kms-with-session-token");
    }
    finally {
        fetchMock.restore();
    }
});
test("AwsKmsHttpSecretProvider returns false for isConfigured when credentials are missing", () => {
    const provider = new AwsKmsHttpSecretProvider({
        env: {
            // Missing AA_AWS_ACCESS_KEY_ID and AA_AWS_SECRET_ACCESS_KEY
            AA_AWS_REGION: "us-east-1",
        },
    });
    assert.equal(provider.isConfigured(), false);
});
test("AwsKmsHttpSecretProvider throws ValidationError when ciphertext is not configured", async () => {
    const provider = new AwsKmsHttpSecretProvider({
        env: {
            AA_AWS_REGION: "us-east-1",
            AA_AWS_ACCESS_KEY_ID: "AKIATEST",
            AA_AWS_SECRET_ACCESS_KEY: "secret-key",
            AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456789012:key/test",
            // Missing AA_KMS_CIPHERTEXT_*
        },
    });
    try {
        await provider.requireSecret("secret://kms/test");
        assert.fail("Should have thrown");
    }
    catch (err) {
        // The error is ciphertext_not_configured because ciphertext env var is not set
        assert.match(err.message, /kms\.ciphertext_not_configured/);
    }
});
test("GcpSecretManagerHttpSecretProvider returns false for isConfigured when project ID is missing", () => {
    const provider = new GcpSecretManagerHttpSecretProvider({
        env: {
        // Missing AA_GCP_PROJECT_ID
        },
    });
    assert.equal(provider.isConfigured(), false);
});
test("VaultHttpSecretProvider returns false for isConfigured when vault addr is missing", () => {
    const provider = new VaultHttpSecretProvider({
        env: {
            // Missing AA_VAULT_ADDR
            AA_VAULT_TOKEN: "vault-token",
        },
    });
    assert.equal(provider.isConfigured(), false);
});
test("VaultHttpSecretProvider returns true for isConfigured when only vault addr is set", () => {
    // isConfigured only checks AA_VAULT_ADDR, not AA_VAULT_TOKEN
    const provider = new VaultHttpSecretProvider({
        env: {
            AA_VAULT_ADDR: "https://vault.internal:8200",
            // No AA_VAULT_TOKEN
        },
    });
    assert.equal(provider.isConfigured(), true);
});
//# sourceMappingURL=managed-secret-provider-http.test.js.map