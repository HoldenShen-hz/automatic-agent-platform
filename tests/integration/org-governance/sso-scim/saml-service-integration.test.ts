import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { SamlService, buildSamlAudience, type SamlProviderConfig, type SamlAssertionInput } from "../../../../src/org-governance/sso-scim/saml/index.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("SSO-SCIM SAML: SamlService registers provider and builds login request", () => {
  const workspace = createTempWorkspace("aa-saml-service-");
  const dbPath = join(workspace, "saml-service.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-login",
      executionId: "exec-saml-login",
      traceId: "trace-saml-login",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-provider-test",
      entryPoint: "https://idp.example.com/saml/sso",
      issuer: "my-application",
      certificateFingerprint: "sha256:abc123def456",
      entityId: "my-app-entity",
      acsUrl: "https://app.example.com/saml/acs",
    };

    samlService.registerProvider(config);

    const loginRequest = samlService.buildLoginRequest("saml-provider-test", {
      relayState: "return-to-dashboard",
    });

    assert.equal(loginRequest.providerId, "saml-provider-test");
    assert.ok(loginRequest.requestId.startsWith("saml_req_"));
    assert.ok(loginRequest.redirectUrl.includes("SAMLRequest="));
    assert.equal(loginRequest.relayState, "return-to-dashboard");
    assert.ok(loginRequest.audience.includes("my-application"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService consumes valid assertion and creates session", () => {
  const workspace = createTempWorkspace("aa-saml-assertion-");
  const dbPath = join(workspace, "saml-assertion.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-assertion",
      executionId: "exec-saml-assertion",
      traceId: "trace-saml-assertion",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-assertion-provider",
      entryPoint: "https://idp.example.com/saml/sso",
      issuer: "https://idp.example.com",
      certificateFingerprint: "sha256:valid-fingerprint",
      allowUnsignedAssertions: true,
    };

    samlService.registerProvider(config);

    const assertion: SamlAssertionInput = {
      assertionId: "assertion-valid-integration",
      issuer: "https://idp.example.com",
      audience: buildSamlAudience(config),
      nameId: "user@example.com",
      fingerprint: "sha256:valid-fingerprint",
      attributes: {
        email: "user@example.com",
        displayName: "Test User",
        department: "Engineering",
      },
      notBefore: "2026-04-01T00:00:00.000Z",
      notOnOrAfter: "2026-04-30T23:59:59.000Z",
    };

    const session = samlService.consumeAssertion("saml-assertion-provider", assertion, new Date("2026-04-20T12:00:00.000Z"));

    assert.ok(session.sessionId.startsWith("saml_session_"));
    assert.equal(session.providerId, "saml-assertion-provider");
    assert.equal(session.subjectId, "user@example.com");
    assert.equal(session.issuer, "https://idp.example.com");
    assert.deepEqual(session.attributes, assertion.attributes);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService rejects assertion with wrong issuer", () => {
  const workspace = createTempWorkspace("aa-saml-bad-issuer-");
  const dbPath = join(workspace, "saml-bad-issuer.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-bad-issuer",
      executionId: "exec-saml-bad-issuer",
      traceId: "trace-saml-bad-issuer",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-bad-issuer",
      entryPoint: "https://idp.example.com/saml",
      issuer: "https://idp.example.com",
      certificateFingerprint: "sha256:fp123",
      allowUnsignedAssertions: true,
    };

    samlService.registerProvider(config);

    const assertion: SamlAssertionInput = {
      assertionId: "assertion-bad-issuer",
      issuer: "https://malicious-idp.example.com", // Wrong issuer
      audience: buildSamlAudience(config),
      nameId: "user@example.com",
      fingerprint: "sha256:fp123",
    };

    assert.throws(
      () => samlService.consumeAssertion("saml-bad-issuer", assertion, new Date()),
      /saml.invalid_issuer/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService rejects assertion with wrong fingerprint", () => {
  const workspace = createTempWorkspace("aa-saml-bad-fp-");
  const dbPath = join(workspace, "saml-bad-fp.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-bad-fp",
      executionId: "exec-saml-bad-fp",
      traceId: "trace-saml-bad-fp",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-bad-fp",
      entryPoint: "https://idp.example.com/saml",
      issuer: "https://idp.example.com",
      certificateFingerprint: "sha256:correct-fingerprint",
      allowUnsignedAssertions: true,
    };

    samlService.registerProvider(config);

    const assertion: SamlAssertionInput = {
      assertionId: "assertion-bad-fingerprint",
      issuer: "https://idp.example.com",
      audience: buildSamlAudience(config),
      nameId: "user@example.com",
      fingerprint: "sha256:wrong-fingerprint",
    };

    assert.throws(
      () => samlService.consumeAssertion("saml-bad-fp", assertion, new Date()),
      /saml.invalid_fingerprint/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService rejects expired assertion", () => {
  const workspace = createTempWorkspace("aa-saml-expired-");
  const dbPath = join(workspace, "saml-expired.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-expired",
      executionId: "exec-saml-expired",
      traceId: "trace-saml-expired",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-expired",
      entryPoint: "https://idp.example.com/saml",
      issuer: "https://idp.example.com",
      certificateFingerprint: "sha256:fp-expired",
      allowUnsignedAssertions: true,
    };

    samlService.registerProvider(config);

    const assertion: SamlAssertionInput = {
      assertionId: "assertion-expired-integration",
      issuer: "https://idp.example.com",
      audience: buildSamlAudience(config),
      nameId: "user@example.com",
      fingerprint: "sha256:fp-expired",
      notOnOrAfter: "2026-04-01T00:00:00.000Z", // Expired
    };

    assert.throws(
      () => samlService.consumeAssertion("saml-expired", assertion, new Date("2026-04-20T12:00:00.000Z")),
      /saml.assertion_expired/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService rejects assertion not yet valid (clock skew)", () => {
  const workspace = createTempWorkspace("aa-saml-clock-skew-");
  const dbPath = join(workspace, "saml-clock-skew.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-clock-skew",
      executionId: "exec-saml-clock-skew",
      traceId: "trace-saml-clock-skew",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-clock-skew",
      entryPoint: "https://idp.example.com/saml",
      issuer: "https://idp.example.com",
      certificateFingerprint: "sha256:fp-clock",
      allowUnsignedAssertions: true,
    };

    samlService.registerProvider(config);

    const assertion: SamlAssertionInput = {
      assertionId: "assertion-clock-skew",
      issuer: "https://idp.example.com",
      audience: buildSamlAudience(config),
      nameId: "user@example.com",
      fingerprint: "sha256:fp-clock",
      notBefore: "2026-04-25T00:00:00.000Z", // Future date
      notOnOrAfter: "2026-04-30T00:00:00.000Z",
    };

    assert.throws(
      () => samlService.consumeAssertion("saml-clock-skew", assertion, new Date("2026-04-20T12:00:00.000Z")),
      /saml.assertion_expired/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService builds logout request", () => {
  const workspace = createTempWorkspace("aa-saml-logout-");
  const dbPath = join(workspace, "saml-logout.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-logout",
      executionId: "exec-saml-logout",
      traceId: "trace-saml-logout",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-logout-provider",
      entryPoint: "https://idp.example.com/saml/logout",
      issuer: "logout-app",
      certificateFingerprint: "sha256:logout-fp",
    };

    samlService.registerProvider(config);

    const session = {
      sessionId: "session-123",
      subjectId: "user@example.com",
      sessionIndex: "index-456",
    };

    const logoutRequest = samlService.buildLogoutRequest("saml-logout-provider", session, "return-to-login");

    assert.equal(logoutRequest.providerId, "saml-logout-provider");
    assert.ok(logoutRequest.requestId.startsWith("saml_logout_"));
    assert.ok(logoutRequest.redirectUrl.includes("SAMLRequest="));
    assert.equal(logoutRequest.relayState, "return-to-login");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: SamlService rejects unknown provider", () => {
  const workspace = createTempWorkspace("aa-saml-unknown-");
  const dbPath = join(workspace, "saml-unknown.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-unknown",
      executionId: "exec-saml-unknown",
      traceId: "trace-saml-unknown",
    });

    assert.throws(
      () => samlService.buildLoginRequest("unknown-provider"),
      /saml.provider_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SSO-SCIM SAML: buildSamlAudience constructs correct audience string", () => {
  const config: SamlProviderConfig = {
    providerId: "my-saml-provider",
    entryPoint: "https://sso.example.com/saml",
    issuer: "my-service",
    certificateFingerprint: "sha256:xyz",
  };

  const audience = buildSamlAudience(config);

  assert.equal(audience, "my-service:my-saml-provider");
});

test("SSO-SCIM SAML: SamlService rejects empty nameId", () => {
  const workspace = createTempWorkspace("aa-saml-empty-nameid-");
  const dbPath = join(workspace, "saml-empty-nameid.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const samlService = new SamlService();

    seedTaskAndExecution(db, store, {
      taskId: "task-saml-empty-nameid",
      executionId: "exec-saml-empty-nameid",
      traceId: "trace-saml-empty-nameid",
    });

    const config: SamlProviderConfig = {
      providerId: "saml-empty-nameid",
      entryPoint: "https://idp.example.com/saml",
      issuer: "https://idp.example.com",
      certificateFingerprint: "sha256:nameid-fp",
    };

    samlService.registerProvider(config);

    const assertion: SamlAssertionInput = {
      issuer: "https://idp.example.com",
      audience: buildSamlAudience(config),
      nameId: "   ", // Empty/whitespace nameId
      fingerprint: "sha256:nameid-fp",
    };

    assert.throws(
      () => samlService.consumeAssertion("saml-empty-nameid", assertion, new Date()),
      /saml.invalid_subject/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
