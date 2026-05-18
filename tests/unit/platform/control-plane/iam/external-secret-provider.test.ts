import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ExternalSecretProvider } from "../../../../../src/platform/five-plane-control-plane/iam/external-secret-provider.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../../helpers/fs.js";

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
    createFile(
      filePath,
      JSON.stringify({
        "secret://system/deploy/kubeconfig/prod": {
          value: "kms-deploy-token-abcdef",
          locator: "kms://projects/demo/locations/global/keyRings/main/cryptoKeys/deploy",
        },
      }),
    );

    const provider = new ExternalSecretProvider({
      providerKind: "kms",
      env: {
        AA_KMS_SECRETS_FILE: filePath,
      },
    });

    const metadata = await provider.describeSecret("secret://system/deploy/kubeconfig/prod");
    assert.equal(metadata.source, "kms");
    assert.equal(metadata.resolved, true);
    assert.equal(
      metadata.envName,
      "kms://projects/demo/locations/global/keyRings/main/cryptoKeys/deploy",
    );
  } finally {
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

  await assert.rejects(
    () => provider.describeSecret("secret://system/registry/ghcr/prod"),
    /secret\.provider_config_invalid:secret_manager:AA_SECRET_MANAGER_SECRETS_JSON/,
  );
});

test("external secret provider rejects path traversal in file paths", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: {
      AA_VAULT_SECRETS_FILE: "/secrets/../etc/passwd",
    },
  });

  await assert.rejects(
    () => provider.describeSecret("secret://system/registry/ghcr/prod"),
    /secret\.provider_config_invalid:vault/,
  );
});

test("external secret provider rejects path within denied root /etc", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "vault",
    env: {
      AA_VAULT_SECRETS_FILE: "/etc/myapp/secrets.json",
    },
  });

  await assert.rejects(
    () => provider.describeSecret("secret://system/registry/ghcr/prod"),
    /secret\.provider_config_invalid:vault/,
  );
});

test("external secret provider rejects path within denied root /proc", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "kms",
    env: {
      AA_KMS_SECRETS_FILE: "/proc/self/secrets.json",
    },
  });

  await assert.rejects(
    () => provider.describeSecret("secret://system/registry/ghcr/prod"),
    /secret\.provider_config_invalid:kms/,
  );
});

test("external secret provider rejects path within denied root /sys", async () => {
  const provider = new ExternalSecretProvider({
    providerKind: "secret_manager",
    env: {
      AA_SECRET_MANAGER_SECRETS_FILE: "/sys/kernel/secrets.json",
    },
  });

  await assert.rejects(
    () => provider.describeSecret("secret://system/registry/ghcr/prod"),
    /secret\.provider_config_invalid:secret_manager/,
  );
});

test("external secret provider rejects file path with symlink traversal", async () => {
  const workspace = createTempWorkspace("aa-external-secret-provider-symlink-");

  try {
    // Create a symlink that escapes the workspace
    const escapeLink = join(workspace, "escape_link");
    createSymlink("/etc", escapeLink);

    // Point to a file through the symlink
    const provider = new ExternalSecretProvider({
      providerKind: "vault",
      env: {
        AA_VAULT_SECRETS_FILE: join(escapeLink, "passwd"),
      },
    });

    await assert.rejects(
      () => provider.describeSecret("secret://system/registry/ghcr/prod"),
      /secret\.provider_config_invalid:vault/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("external secret provider rejects nested symlink traversal", async () => {
  const workspace = createTempWorkspace("aa-external-secret-provider-nested-symlink-");

  try {
    // Create /workspace/allowed -> /workspace/allowed
    const allowedDir = join(workspace, "allowed");
    mkdirSync(allowedDir, { recursive: true });

    // Create a file inside the allowed directory
    const secretFile = join(allowedDir, "secrets.json");
    createFile(secretFile, JSON.stringify({ "secret://test": { value: "test" } }));

    // Create a symlink at /workspace/link -> /etc
    const evilLink = join(workspace, "link");
    createSymlink("/etc", evilLink);

    // Try to access /workspace/allowed/../link/passwd which resolves to /workspace/link/passwd
    // But the path traversal check catches it first
    const provider = new ExternalSecretProvider({
      providerKind: "vault",
      env: {
        AA_VAULT_SECRETS_FILE: join(workspace, "allowed", "..", "link", "passwd"),
      },
    });

    await assert.rejects(
      () => provider.describeSecret("secret://system/registry/ghcr/prod"),
      /secret\.provider_config_invalid:vault/,
    );
  } finally {
    cleanupPath(workspace);
  }
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

test("external secret provider refreshSecret invalidates cached file entries", async () => {
  const workspace = createTempWorkspace("aa-external-secret-provider-refresh-");
  const filePath = join(workspace, "vault-secrets.json");

  try {
    createFile(filePath, JSON.stringify({
      "secret://system/registry/ghcr/prod": {
        value: "vault-registry-token-111111",
        locator: "vault://kv/release/prod/registry",
      },
    }));

    const provider = new ExternalSecretProvider({
      providerKind: "vault",
      env: { AA_VAULT_SECRETS_FILE: filePath },
    });

    const first = await provider.requireSecret("secret://system/registry/ghcr/prod");
    createFile(filePath, JSON.stringify({
      "secret://system/registry/ghcr/prod": {
        value: "vault-registry-token-222222",
        locator: "vault://kv/release/prod/registry",
      },
    }));
    provider.invalidateCache();
    const second = await provider.requireSecret("secret://system/registry/ghcr/prod");

    assert.equal(first.value, "vault-registry-token-111111");
    assert.equal(second.value, "vault-registry-token-222222");
  } finally {
    cleanupPath(workspace);
  }
});
