import assert from "node:assert/strict";
import test from "node:test";

import { ExternalSecretProvider } from "../../../../src/platform/five-plane-control-plane/iam/external-secret-provider.js";

test("vault provider can be smoke-tested with inline fixtures", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: {
      AA_VAULT_SECRETS_JSON: JSON.stringify({
        "integration/demo": "vault-inline-secret",
      }),
    },
  });
  const secret = await provider.requireSecret("secret://integration/demo");
  assert.equal(secret.value, "vault-inline-secret");
});

test("kms provider can be smoke-tested with inline fixtures", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "kms",
    env: {
      AA_KMS_SECRETS_JSON: JSON.stringify({
        "integration/demo": "kms-inline-secret",
      }),
    },
  });
  const secret = await provider.requireSecret("secret://integration/demo");
  assert.equal(secret.value, "kms-inline-secret");
});
