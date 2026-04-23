import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { IdentitySyncService } from "../../../../src/org-governance/sso-scim/identity-sync-service.js";
import { buildOidcAuthorizationUrl, type OidcProviderConfig } from "../../../../src/org-governance/sso-scim/oidc/index.js";
import { buildSamlAudience, type SamlProviderConfig } from "../../../../src/org-governance/sso-scim/saml/index.js";
import { isTerminalScimAction, type ScimProvisioningEvent } from "../../../../src/org-governance/sso-scim/scim-sync/index.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("SSO-SCIM: IdentitySyncService bootstraps with OIDC and SAML configs", () => {
  const workspace = createTempWorkspace("aa-identity-sync-");
  const dbPath = join(workspace, "identity-sync.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const identityService = new IdentitySyncService();

    seedTaskAndExecution(db, store, {
      taskId: "task-identity-sync",
      executionId: "exec-identity-sync",
      traceId: "trace-identity-sync",
    });

    const oidcConfig: OidcProviderConfig = {
      providerId: "oidc-test",
      issuer: "https://idp.example.com",
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      scopes: ["openid", "profile", "email"],
    };

    const samlConfig: SamlProviderConfig = {
      providerId: "saml-test",
      entryPoint: "https://idp.example.com/saml/sso",
      issuer: "app.example.com",
      certificateFingerprint: "sha256:test-fingerprint",
    };

    const events: ScimProvisioningEvent[] = [
      {
        eventId: newId("scim_evt"),
        action: "user_created",
        subjectId: "user-001",
        occurredAt: nowIso(),
      },
      {
        eventId: newId("scim_evt"),
        action: "user_updated",
        subjectId: "user-001",
        occurredAt: nowIso(),
      },
    ];

    const snapshot = identityService.bootstrap(oidcConfig, samlConfig, events);

    assert.ok(snapshot.oidcAuthorizationUrl.startsWith("https://idp.example.com/authorize"));
    assert.ok(snapshot.oidcAuthorizationUrl.includes("client_id=test-client"));
    assert.ok(snapshot.oidcAuthorizationUrl.includes("scope="));
    assert.equal(snapshot.samlAudience, "app.example.com:saml-test");
    assert.equal(snapshot.appliedScimEvents.length, 2);
    assert.equal(snapshot.appliedScimEvents[0]!.terminal, false);
    assert.equal(snapshot.appliedScimEvents[1]!.terminal, false);
    assert.ok(snapshot.activeSubjects.includes("user-001"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM: terminal SCIM events remove subjects from active set", () => {
  const workspace = createTempWorkspace("aa-identity-sync-terminal-");
  const dbPath = join(workspace, "identity-sync-terminal.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const identityService = new IdentitySyncService();

    seedTaskAndExecution(db, store, {
      taskId: "task-identity-terminal",
      executionId: "exec-identity-terminal",
      traceId: "trace-identity-terminal",
    });

    const oidcConfig: OidcProviderConfig = {
      providerId: "oidc-terminal",
      issuer: "https://idp.example.com",
      clientId: "client-terminal",
      redirectUri: "https://app.example.com/callback",
      scopes: ["openid"],
    };

    const samlConfig: SamlProviderConfig = {
      providerId: "saml-terminal",
      entryPoint: "https://idp.example.com/saml/sso",
      issuer: "app.example.com",
      certificateFingerprint: "sha256:terminal-fp",
    };

    const events: ScimProvisioningEvent[] = [
      {
        eventId: newId("scim_evt"),
        action: "user_created",
        subjectId: "user-active",
        occurredAt: nowIso(),
      },
      {
        eventId: newId("scim_evt"),
        action: "user_disabled",
        subjectId: "user-active",
        occurredAt: nowIso(),
      },
      {
        eventId: newId("scim_evt"),
        action: "user_deleted",
        subjectId: "user-deleted",
        occurredAt: nowIso(),
      },
    ];

    const snapshot = identityService.bootstrap(oidcConfig, samlConfig, events);

    assert.equal(snapshot.appliedScimEvents[0]!.terminal, false);
    assert.equal(snapshot.appliedScimEvents[1]!.terminal, true);
    assert.equal(snapshot.appliedScimEvents[2]!.terminal, true);
    assert.ok(!snapshot.activeSubjects.includes("user-active"));
    assert.ok(!snapshot.activeSubjects.includes("user-deleted"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM: buildOidcAuthorizationUrl constructs valid authorization URL", () => {
  const config: OidcProviderConfig = {
    providerId: "oidc-build",
    issuer: "https://auth.example.com",
    clientId: "my-client-id",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile", "email", "offline"],
  };

  const url = buildOidcAuthorizationUrl(config, "random-state-123");

  assert.ok(url.startsWith("https://auth.example.com/authorize"));
  assert.ok(url.includes("client_id=my-client-id"));
  assert.ok(url.includes("redirect_uri="));
  assert.ok(url.includes("response_type=code"));
  assert.ok(url.includes("state=random-state-123"));
  assert.ok(url.includes("scope="));
});

test("SSO-SCIM: buildSamlAudience combines issuer and providerId", () => {
  const config: SamlProviderConfig = {
    providerId: "saml-provider",
    entryPoint: "https://sso.example.com/saml",
    issuer: "my-app",
    certificateFingerprint: "sha256:abc123",
  };

  const audience = buildSamlAudience(config);

  assert.equal(audience, "my-app:saml-provider");
});

test("SSO-SCIM: isTerminalScimAction correctly identifies terminal actions", () => {
  assert.equal(isTerminalScimAction("user_disabled"), true);
  assert.equal(isTerminalScimAction("user_deleted"), true);
  assert.equal(isTerminalScimAction("user_created"), false);
  assert.equal(isTerminalScimAction("user_updated"), false);
  assert.equal(isTerminalScimAction("group_updated"), false);
});

test("SSO-SCIM: IdentitySyncService handles empty SCIM event list", () => {
  const workspace = createTempWorkspace("aa-identity-sync-empty-");
  const dbPath = join(workspace, "identity-sync-empty.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const identityService = new IdentitySyncService();

    seedTaskAndExecution(db, store, {
      taskId: "task-identity-empty",
      executionId: "exec-identity-empty",
      traceId: "trace-identity-empty",
    });

    const oidcConfig: OidcProviderConfig = {
      providerId: "oidc-empty",
      issuer: "https://idp.example.com",
      clientId: "client-empty",
      redirectUri: "https://app.example.com/callback",
      scopes: ["openid"],
    };

    const samlConfig: SamlProviderConfig = {
      providerId: "saml-empty",
      entryPoint: "https://idp.example.com/saml",
      issuer: "app.example.com",
      certificateFingerprint: "sha256:empty",
    };

    const snapshot = identityService.bootstrap(oidcConfig, samlConfig, []);

    assert.equal(snapshot.appliedScimEvents.length, 0);
    assert.equal(snapshot.activeSubjects.length, 0);
    assert.ok(snapshot.oidcAuthorizationUrl.length > 0);
    assert.ok(snapshot.samlAudience.length > 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM: IdentitySyncService processes mixed terminal and non-terminal events", () => {
  const workspace = createTempWorkspace("aa-identity-sync-mixed-");
  const dbPath = join(workspace, "identity-sync-mixed.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const identityService = new IdentitySyncService();

    seedTaskAndExecution(db, store, {
      taskId: "task-identity-mixed",
      executionId: "exec-identity-mixed",
      traceId: "trace-identity-mixed",
    });

    const oidcConfig: OidcProviderConfig = {
      providerId: "oidc-mixed",
      issuer: "https://idp.example.com",
      clientId: "client-mixed",
      redirectUri: "https://app.example.com/callback",
      scopes: ["openid"],
    };

    const samlConfig: SamlProviderConfig = {
      providerId: "saml-mixed",
      entryPoint: "https://idp.example.com/saml",
      issuer: "app.example.com",
      certificateFingerprint: "sha256:mixed",
    };

    const events: ScimProvisioningEvent[] = [
      { eventId: newId("scim"), action: "user_created", subjectId: "user-a", occurredAt: nowIso() },
      { eventId: newId("scim"), action: "user_created", subjectId: "user-b", occurredAt: nowIso() },
      { eventId: newId("scim"), action: "user_disabled", subjectId: "user-a", occurredAt: nowIso() },
      { eventId: newId("scim"), action: "user_created", subjectId: "user-c", occurredAt: nowIso() },
      { eventId: newId("scim"), action: "user_deleted", subjectId: "user-b", occurredAt: nowIso() },
    ];

    const snapshot = identityService.bootstrap(oidcConfig, samlConfig, events);

    assert.equal(snapshot.appliedScimEvents.length, 5);
    assert.ok(!snapshot.activeSubjects.includes("user-a"), "user-a should be removed by user_disabled");
    assert.ok(!snapshot.activeSubjects.includes("user-b"), "user-b should be removed by user_deleted");
    assert.ok(snapshot.activeSubjects.includes("user-c"), "user-c should remain active");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});