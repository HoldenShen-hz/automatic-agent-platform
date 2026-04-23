import assert from "node:assert/strict";
import test from "node:test";
import { ExternalSecretProvider } from "../../../../src/platform/control-plane/iam/external-secret-provider.js";
test("vault provider can be smoke-tested with inline fixtures", {
    skip: process.env["AA_TEST_VAULT_INLINE_SECRETS"] == null,
}, async () => {
    const provider = new ExternalSecretProvider({
        providerKind: "vault",
        env: {
            AA_VAULT_INLINE_SECRETS: process.env["AA_TEST_VAULT_INLINE_SECRETS"],
        },
    });
    const secret = await provider.requireSecret("integration/demo");
    assert.equal(typeof secret.value, "string");
    assert.ok(secret.value.length > 0);
});
test("kms provider can be smoke-tested with inline fixtures", {
    skip: process.env["AA_TEST_KMS_INLINE_SECRETS"] == null,
}, async () => {
    const provider = new ExternalSecretProvider({
        providerKind: "kms",
        env: {
            AA_KMS_INLINE_SECRETS: process.env["AA_TEST_KMS_INLINE_SECRETS"],
        },
    });
    const secret = await provider.requireSecret("integration/demo");
    assert.equal(typeof secret.value, "string");
    assert.ok(secret.value.length > 0);
});
//# sourceMappingURL=secret-provider-integration.test.js.map