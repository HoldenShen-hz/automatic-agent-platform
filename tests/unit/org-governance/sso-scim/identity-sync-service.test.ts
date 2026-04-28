import test from "node:test";
import assert from "node:assert/strict";
import { IdentitySyncService } from "../../../../src/org-governance/sso-scim/identity-sync-service.js";
import { ScimProvisioningEventSchema } from "../../../../src/org-governance/sso-scim/scim-sync/index.js";

test("IdentitySyncService bootstrap() builds snapshot with OIDC URL, SAML audience, and SCIM events", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };
  const events: Array<{ eventId: string; action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated"; subjectId: string; occurredAt: string }> = [
    { eventId: "evt-1", action: "user_created", subjectId: "user-1", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-2", action: "user_disabled", subjectId: "user-2", occurredAt: "2024-01-15T00:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(oidcConfig, samlConfig, events);

  assert.ok(snapshot.oidcAuthorizationUrl.includes("https://idp.example.com/authorize"));
  assert.ok(snapshot.oidcAuthorizationUrl.includes("client_id"));
  assert.strictEqual(snapshot.samlAudience, "https://app.example.com:saml-1");
  assert.strictEqual(snapshot.appliedScimEvents.length, 2);
  assert.strictEqual(snapshot.appliedScimEvents[0]!.terminal, false);
  assert.strictEqual(snapshot.appliedScimEvents[1]!.terminal, true);
});

test("IdentitySyncService bootstrap() tracks active subjects based on terminal SCIM actions", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };
  const events: Array<{ eventId: string; action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated"; subjectId: string; occurredAt: string }> = [
    { eventId: "evt-1", action: "user_created", subjectId: "user-active", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-2", action: "user_disabled", subjectId: "user-inactive", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-3", action: "user_deleted", subjectId: "user-deleted", occurredAt: "2024-01-15T00:00:00.000Z" },
  ];

  const snapshot = service.bootstrap(oidcConfig, samlConfig, events);

  assert.deepStrictEqual(snapshot.activeSubjects, ["user-active"]);
});

test("IdentitySyncService bootstrap() emits session revocation and agent freeze plans", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };

  const snapshot = service.bootstrap(oidcConfig, samlConfig, [
    { eventId: "evt-1", action: "user_disabled", subjectId: "user-1", occurredAt: "2024-01-15T00:00:00.000Z" },
  ], {
    oidcSessionsBySubject: { "user-1": ["oidc-1", "oidc-2"] },
    samlSessionsBySubject: { "user-1": ["saml-1"] },
    agentAssignmentsBySubject: { "user-1": ["agent-a"] },
    securityIncidentSubjectIds: ["user-1"],
  });

  assert.equal(snapshot.sessionRevocationPlans.length, 1);
  assert.equal(snapshot.sessionRevocationPlans[0]!.targetSloSeconds, 60);
  assert.deepEqual(snapshot.sessionRevocationPlans[0]!.oidcSessionIds, ["oidc-1", "oidc-2"]);
  assert.equal(snapshot.agentFreezeDirectives.length, 1);
  assert.equal(snapshot.agentFreezeDirectives[0]!.reason, "security_revocation");
});

test("ScimProvisioningEventSchema parses valid SCIM provisioning event", () => {
  const valid = {
    eventId: "evt-001",
    action: "user_created",
    subjectId: "user-123",
    occurredAt: "2024-01-15T10:00:00.000Z",
  };

  const result = ScimProvisioningEventSchema.parse(valid);

  assert.strictEqual(result.eventId, "evt-001");
  assert.strictEqual(result.action, "user_created");
  assert.strictEqual(result.subjectId, "user-123");
});

test("ScimProvisioningEventSchema accepts all valid SCIM actions", () => {
  const actions = ["user_created", "user_updated", "user_disabled", "user_deleted", "group_updated"] as const;
  for (const action of actions) {
    const result = ScimProvisioningEventSchema.parse({
      eventId: "evt-001",
      action,
      subjectId: "user-123",
      occurredAt: "2024-01-15T10:00:00.000Z",
    });
    assert.strictEqual(result.action, action);
  }
});

test("ScimProvisioningEventSchema throws on invalid action", () => {
  assert.throws(() => {
    ScimProvisioningEventSchema.parse({
      eventId: "evt-001",
      action: "invalid_action",
      subjectId: "user-123",
      occurredAt: "2024-01-15T10:00:00.000Z",
    });
  });
});

test("IdentitySyncService bootstrap() routes invalid SCIM events to identity_sync_dlq", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };

  const snapshot = service.bootstrap(oidcConfig, samlConfig, [
    { eventId: "evt-valid", action: "user_created", subjectId: "user-1", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-invalid", action: "bad_action", subjectId: "user-2", occurredAt: "2024-01-15T00:00:00.000Z" },
  ]);

  assert.equal(snapshot.appliedScimEvents.length, 1);
  assert.equal(snapshot.dlqRecords.length, 1);
  assert.equal(snapshot.dlqRecords[0]!.failureCode, "schema_validation_failed");
  assert.equal(snapshot.dlqRecords[0]!.eventType, "bad_action");
});

test("IdentitySyncService bootstrap() emits conflict report for duplicate event ids with different payload", () => {
  const service = new IdentitySyncService();
  const oidcConfig = { providerId: "oidc-1", issuer: "https://idp.example.com", clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://app.example.com/callback", authorizationEndpoint: undefined, tokenEndpoint: undefined, userInfoEndpoint: undefined, scopes: ["openid", "profile"] };
  const samlConfig = { providerId: "saml-1", entryPoint: "https://idp.example.com/sso", issuer: "https://app.example.com", certificateFingerprint: "AA:BB:CC", entityId: undefined, acsUrl: undefined, attributeMapping: undefined };

  const snapshot = service.bootstrap(oidcConfig, samlConfig, [
    { eventId: "evt-dup", action: "user_created", subjectId: "user-1", occurredAt: "2024-01-15T00:00:00.000Z" },
    { eventId: "evt-dup", action: "user_deleted", subjectId: "user-1", occurredAt: "2024-01-15T00:01:00.000Z" },
  ]);

  assert.equal(snapshot.appliedScimEvents.length, 1);
  assert.equal(snapshot.conflictReports.length, 1);
  assert.equal(snapshot.dlqRecords.length, 1);
  assert.equal(snapshot.dlqRecords[0]!.failureCode, "event_id_conflict");
  assert.deepEqual(snapshot.conflictReports[0]!.conflictingFields, ["action", "occurredAt"]);
});
