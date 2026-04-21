import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const REPO_ROOT = process.cwd();
const CLI_PATH = `${REPO_ROOT}/dist/src/sdk/cli/secret-management.js`;

test("secret-management CLI never prints plaintext secrets during resolve or summary", () => {
  const workspace = createTempWorkspace("aa-secret-boundary-");
  const dbPath = join(workspace, "secret-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "register",
        AA_SECRET_REF: "secret://system/deploy/kubeconfig/prod",
        AA_SECRET_DISPLAY_NAME: "Prod Deployment Credential",
        AA_SECRET_CATEGORY: "db_connection_secret",
        AA_SECRET_PROVIDER_KIND: "environment",
        AA_SECRET_SCOPE_TYPE: "system",
        AA_SECRET_SCOPE_REF: "deploy.kubeconfig.prod",
        AA_SECRET_ROTATION_CADENCE_DAYS: "14",
      },
      encoding: "utf8",
    });

    const secretValue = "super-secret-deploy-token-abcdef";
    const resolvedOutput = execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "resolve",
        AA_SECRET_REF: "secret://system/deploy/kubeconfig/prod",
        AA_SECRET_REQUESTED_BY: "ops.deploy",
        AA_SECRET_GRANTED_TO: "deploy-worker",
        AA_SECRET_USAGE_PURPOSE: "apply_manifest",
        AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: secretValue,
      },
      encoding: "utf8",
    });
    assert.doesNotMatch(resolvedOutput, new RegExp(secretValue));
    assert.match(resolvedOutput, /\*+cdef/);

    const summaryOutput = execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "summary",
        AA_SECRET_REF: "secret://system/deploy/kubeconfig/prod",
      },
      encoding: "utf8",
    });
    assert.doesNotMatch(summaryOutput, new RegExp(secretValue));

    const issueOutput = execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "issue",
        AA_SECRET_REF: "secret://system/deploy/kubeconfig/prod",
        AA_SECRET_REQUESTED_BY: "ops.deploy",
        AA_SECRET_GRANTED_TO: "deploy-worker",
        AA_SECRET_USAGE_PURPOSE: "apply_manifest",
        AA_SECRET_LEASE_TTL_MINUTES: "15",
        AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: secretValue,
      },
      encoding: "utf8",
    });
    assert.doesNotMatch(issueOutput, new RegExp(secretValue));
    assert.match(issueOutput, /\*+cdef/);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("secret-management CLI fail-closes when resolving an unregistered secret", () => {
  const workspace = createTempWorkspace("aa-secret-boundary-missing-");
  const dbPath = join(workspace, "secret-boundary-missing.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    assert.throws(
      () =>
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            AA_DB_PATH: dbPath,
            AA_SECRET_ACTION: "resolve",
            AA_SECRET_REF: "secret://system/registry/ghcr/prod",
            AA_SECRET_REQUESTED_BY: "ops.release",
            AA_SECRET_GRANTED_TO: "deploy-worker",
            AA_SECRET_USAGE_PURPOSE: "publish_image",
            AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
          },
          encoding: "utf8",
          stdio: "pipe",
        }),
      /secret\.registry_not_found:secret:\/\/system\/registry\/ghcr\/prod/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("secret-management CLI fail-closes malformed external provider configuration", () => {
  const workspace = createTempWorkspace("aa-secret-boundary-provider-");
  const dbPath = join(workspace, "secret-boundary-provider.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "register",
        AA_SECRET_REF: "secret://system/deploy/kubeconfig/prod",
        AA_SECRET_DISPLAY_NAME: "Prod Deployment Credential",
        AA_SECRET_CATEGORY: "db_connection_secret",
        AA_SECRET_PROVIDER_KIND: "vault",
        AA_SECRET_SCOPE_TYPE: "system",
        AA_SECRET_SCOPE_REF: "deploy.kubeconfig.prod",
        AA_SECRET_ROTATION_CADENCE_DAYS: "14",
      },
      encoding: "utf8",
    });

    assert.throws(
      () =>
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            AA_DB_PATH: dbPath,
            AA_SECRET_ACTION: "resolve",
            AA_SECRET_REF: "secret://system/deploy/kubeconfig/prod",
            AA_SECRET_REQUESTED_BY: "ops.deploy",
            AA_SECRET_GRANTED_TO: "deploy-worker",
            AA_SECRET_USAGE_PURPOSE: "apply_manifest",
            AA_VAULT_SECRETS_JSON: "{not-json",
          },
          encoding: "utf8",
          stdio: "pipe",
        }),
      /secret\.provider_config_invalid:vault:AA_VAULT_SECRETS_JSON/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("secret-management CLI fail-closes lease issuance when no TTL is available", () => {
  const workspace = createTempWorkspace("aa-secret-boundary-lease-ttl-");
  const dbPath = join(workspace, "secret-boundary-lease-ttl.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "register",
        AA_SECRET_REF: "secret://system/registry/ghcr/prod",
        AA_SECRET_DISPLAY_NAME: "GHCR Production Push Token",
        AA_SECRET_CATEGORY: "tenant_credential",
        AA_SECRET_PROVIDER_KIND: "environment",
        AA_SECRET_SCOPE_TYPE: "system",
        AA_SECRET_SCOPE_REF: "registry.ghcr.prod",
      },
      encoding: "utf8",
    });

    assert.throws(
      () =>
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            AA_DB_PATH: dbPath,
            AA_SECRET_ACTION: "issue",
            AA_SECRET_REF: "secret://system/registry/ghcr/prod",
            AA_SECRET_REQUESTED_BY: "ops.release",
            AA_SECRET_GRANTED_TO: "publish-worker",
            AA_SECRET_USAGE_PURPOSE: "publish_image",
            AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
          },
          encoding: "utf8",
          stdio: "pipe",
        }),
      /secret\.lease_ttl_required:secret:\/\/system\/registry\/ghcr\/prod/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("secret-management CLI fail-closes malformed provider-issued lease configuration", () => {
  const workspace = createTempWorkspace("aa-secret-boundary-provider-lease-");
  const dbPath = join(workspace, "secret-boundary-provider-lease.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    execFileSync("node", ["--enable-source-maps", CLI_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        AA_DB_PATH: dbPath,
        AA_SECRET_ACTION: "register",
        AA_SECRET_REF: "secret://system/registry/ghcr/prod",
        AA_SECRET_DISPLAY_NAME: "GHCR Production Push Token",
        AA_SECRET_CATEGORY: "tenant_credential",
        AA_SECRET_PROVIDER_KIND: "vault",
        AA_SECRET_SCOPE_TYPE: "system",
        AA_SECRET_SCOPE_REF: "registry.ghcr.prod",
      },
      encoding: "utf8",
    });

    assert.throws(
      () =>
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            AA_DB_PATH: dbPath,
            AA_SECRET_ACTION: "issue",
            AA_SECRET_REF: "secret://system/registry/ghcr/prod",
            AA_SECRET_REQUESTED_BY: "ops.release",
            AA_SECRET_GRANTED_TO: "publish-worker",
            AA_SECRET_USAGE_PURPOSE: "publish_image",
            AA_VAULT_SECRETS_JSON: JSON.stringify({
              "secret://system/registry/ghcr/prod": {
                value: "vault-registry-token-123456",
                issued_lease: {
                  value: "vault-issued-lease-token-654321",
                },
              },
            }),
          },
          encoding: "utf8",
          stdio: "pipe",
        }),
      /secret\.provider_config_invalid_entry:/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
